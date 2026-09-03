param(
  [string]$DatabaseUrl = $env:WRDL_STAGING_DATABASE_URL
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  throw "Set WRDL_STAGING_DATABASE_URL or pass -DatabaseUrl."
}
if (
  -not [string]::IsNullOrWhiteSpace($env:WRDL_PRODUCTION_DATABASE_URL) -and
  $DatabaseUrl -eq $env:WRDL_PRODUCTION_DATABASE_URL
) {
  throw "The database acceptance suite must never run against production."
}
if (-not (Get-Command "psql" -ErrorAction SilentlyContinue)) {
  throw "The native PostgreSQL psql client is required and was not found."
}

$testRoot = Join-Path $PSScriptRoot "..\supabase\tests"
$testFiles = Get-ChildItem -LiteralPath $testRoot -Filter "*.sql" -File | Sort-Object Name
if ($testFiles.Count -eq 0) { throw "No database acceptance tests were found." }

foreach ($testFile in $testFiles) {
  Write-Host "Running $($testFile.Name)"
  $testPath = $testFile.FullName
  & psql $DatabaseUrl --no-psqlrc --set=ON_ERROR_STOP=1 --file=$testPath
  if ($LASTEXITCODE -ne 0) {
    throw "Database acceptance failed in $($testFile.Name)."
  }
}
Write-Host "All $($testFiles.Count) rollback-only database tests passed."
