param(
  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory,

  [Parameter(Mandatory = $true)]
  [string]$Recipient
)

$ErrorActionPreference = "Stop"
$databaseUrl = $env:WRDL_DATABASE_URL
if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
  throw "Set WRDL_DATABASE_URL in the current PowerShell process."
}

foreach ($command in @("pg_dump", "gpg")) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "$command is required and was not found."
  }
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$plainDump = Join-Path ([System.IO.Path]::GetTempPath()) "wrdl-$stamp-$([guid]::NewGuid()).dump"
$encryptedDump = Join-Path $resolvedOutput "wrdl-$stamp.dump.gpg"
$checksumFile = "$encryptedDump.sha256"

try {
  & pg_dump --format=custom --no-owner --dbname=$databaseUrl --file=$plainDump
  if ($LASTEXITCODE -ne 0) { throw "Database export failed." }

  & gpg --batch --yes --recipient $Recipient --encrypt --output $encryptedDump $plainDump
  if ($LASTEXITCODE -ne 0) { throw "Backup encryption failed." }

  $checksum = (Get-FileHash -Algorithm SHA256 -LiteralPath $encryptedDump).Hash
  Set-Content -LiteralPath $checksumFile -Value "$checksum  $([System.IO.Path]::GetFileName($encryptedDump))"
  Write-Host "Encrypted backup and checksum created in $resolvedOutput"
}
finally {
  if (Test-Path -LiteralPath $plainDump) {
    Remove-Item -LiteralPath $plainDump -Force
  }
}
