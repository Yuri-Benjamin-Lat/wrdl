param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,

  [switch]$ConfirmIsolatedTarget
)

$ErrorActionPreference = "Stop"
if (-not $ConfirmIsolatedTarget) {
  throw "Pass -ConfirmIsolatedTarget only after verifying this is a disposable database."
}

$targetUrl = $env:WRDL_RESTORE_DATABASE_URL
if ([string]::IsNullOrWhiteSpace($targetUrl)) {
  throw "Set WRDL_RESTORE_DATABASE_URL to the disposable restore target."
}
foreach ($protectedUrl in @($env:WRDL_STAGING_DATABASE_URL, $env:WRDL_PRODUCTION_DATABASE_URL)) {
  if (-not [string]::IsNullOrWhiteSpace($protectedUrl) -and $targetUrl -eq $protectedUrl) {
    throw "The restore target matches a protected WRDL database."
  }
}
foreach ($command in @("gpg", "pg_restore", "psql")) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "$command is required and was not found."
  }
}

$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
$checksumFile = "$resolvedBackup.sha256"
if (Test-Path -LiteralPath $checksumFile) {
  $expected = ((Get-Content -LiteralPath $checksumFile -Raw).Trim() -split "\s+")[0]
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedBackup).Hash
  if ($expected -ne $actual) { throw "Encrypted backup checksum does not match." }
}

$restoreId = [guid]::NewGuid()
$plainDump = Join-Path ([System.IO.Path]::GetTempPath()) "wrdl-restore-$restoreId.dump"
$tocFile = Join-Path ([System.IO.Path]::GetTempPath()) "wrdl-restore-$restoreId.toc"
$hooksTocFile = Join-Path ([System.IO.Path]::GetTempPath()) "wrdl-restore-$restoreId-hooks.toc"
$dataBody = Join-Path ([System.IO.Path]::GetTempPath()) "wrdl-restore-$restoreId-data-body.sql"
$dataSql = Join-Path ([System.IO.Path]::GetTempPath()) "wrdl-restore-$restoreId-data.sql"
try {
  & gpg --batch --yes --decrypt --output $plainDump $resolvedBackup
  if ($LASTEXITCODE -ne 0) { throw "Backup decryption failed." }

  # Supabase owns auth, storage, realtime, and other platform schemas. Replacing
  # those definitions in a fresh hosted project fails by design. Restore only
  # WRDL-owned definitions, while retaining application data from auth/storage.
  & pg_restore --list $plainDump | Set-Content -LiteralPath $tocFile
  if ($LASTEXITCODE -ne 0) { throw "Backup table-of-contents inspection failed." }

  $tocEntries = Get-Content -LiteralPath $tocFile
  $crossSchemaHooks = @(
    "TRIGGER auth users on_auth_user_created ",
    "POLICY realtime messages wrdl_private_realtime_receive ",
    "POLICY storage objects avatar_authenticated_read ",
    "POLICY storage objects avatar_owner_delete ",
    "POLICY storage objects avatar_owner_insert ",
    "POLICY storage objects avatar_owner_update "
  )
  $hooksToc = foreach ($line in $tocEntries) {
    $keep = $line.StartsWith(";")
    foreach ($pattern in $crossSchemaHooks) {
      if ($line.Contains($pattern)) { $keep = $true; break }
    }
    if ($keep -or $line.StartsWith(";")) { $line } else { ";$line" }
  }
  $hooksToc | Set-Content -LiteralPath $hooksTocFile

  $excludedEntries = @(
    "TABLE DATA auth schema_migrations ",
    "TABLE DATA storage migrations ",
    "TABLE DATA storage buckets_vectors ",
    "TABLE DATA storage vector_indexes ",
    "DEFAULT ACL public DEFAULT PRIVILEGES FOR SEQUENCES supabase_admin",
    "DEFAULT ACL public DEFAULT PRIVILEGES FOR FUNCTIONS supabase_admin",
    "DEFAULT ACL public DEFAULT PRIVILEGES FOR TABLES supabase_admin"
  )
  $filteredToc = foreach ($line in $tocEntries) {
    $exclude = $false
    foreach ($pattern in $excludedEntries) {
      if ($line.Contains($pattern)) { $exclude = $true; break }
    }
    if ($exclude -and -not $line.StartsWith(";")) { ";$line" } else { $line }
  }
  $filteredToc | Set-Content -LiteralPath $tocFile

  $resetTarget = @"
DROP SCHEMA IF EXISTS private CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP POLICY IF EXISTS avatar_authenticated_read ON storage.objects;
DROP POLICY IF EXISTS avatar_owner_insert ON storage.objects;
DROP POLICY IF EXISTS avatar_owner_update ON storage.objects;
DROP POLICY IF EXISTS avatar_owner_delete ON storage.objects;
DROP POLICY IF EXISTS wrdl_private_realtime_receive ON realtime.messages;
CREATE SCHEMA public AUTHORIZATION postgres;
CREATE SCHEMA private AUTHORIZATION postgres;
GRANT ALL ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
DO `$`$
DECLARE tables_to_clear text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
  INTO tables_to_clear
  FROM pg_tables
  WHERE schemaname = 'auth' AND tablename <> 'schema_migrations';
  IF tables_to_clear IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE ' || tables_to_clear || ' CASCADE';
  END IF;
END `$`$;
TRUNCATE TABLE storage.objects, storage.buckets CASCADE;
"@
  $resetTarget | & psql $targetUrl --no-psqlrc --set=ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw "Disposable restore target reset failed." }

  & pg_restore --schema-only --schema=public --schema=private --no-owner --use-list=$tocFile --dbname=$targetUrl $plainDump
  if ($LASTEXITCODE -ne 0) { throw "WRDL schema restore failed." }

  # These WRDL-owned hooks live on Supabase-managed tables, so schema filters
  # omit them. Restore only the explicitly allowlisted trigger and policies.
  & pg_restore --schema-only --no-owner --use-list=$hooksTocFile --dbname=$targetUrl $plainDump
  if ($LASTEXITCODE -ne 0) { throw "WRDL cross-schema hook restore failed." }

  & pg_restore --data-only --schema=auth --schema=storage --schema=public --schema=private --no-owner --no-acl --use-list=$tocFile --file=$dataBody $plainDump
  if ($LASTEXITCODE -ne 0) { throw "WRDL restore-data extraction failed." }

  Set-Content -LiteralPath $dataSql -Value "SET session_replication_role = replica;"
  Get-Content -LiteralPath $dataBody | Add-Content -LiteralPath $dataSql
  Add-Content -LiteralPath $dataSql -Value "RESET ALL;"
  & psql $targetUrl --no-psqlrc --single-transaction --set=ON_ERROR_STOP=1 --file=$dataSql
  if ($LASTEXITCODE -ne 0) { throw "WRDL application-data restore failed." }

  $verification = @"
select
  to_regclass('public.profiles') is not null as profiles_present,
  to_regclass('public.battles') is not null as battles_present,
  to_regclass('private.daily_puzzles') is not null as daily_present;
"@
  $verification | & psql $targetUrl --no-psqlrc --set=ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw "Restored database verification failed." }
  Write-Host "Isolated restore and core-schema verification passed."
}
finally {
  foreach ($temporaryFile in @($plainDump, $tocFile, $hooksTocFile, $dataBody, $dataSql)) {
    if (Test-Path -LiteralPath $temporaryFile) {
      Remove-Item -LiteralPath $temporaryFile -Force
    }
  }
}
