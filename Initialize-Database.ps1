[CmdletBinding()]
param(
  [ValidateSet('init','protect','verify','backup','log-backup')][string]$Action = 'verify',
  [string]$Server = 'localhost',
  [string]$AdminUser = 'sa',
  [switch]$TrustServerCertificate
)
$ErrorActionPreference = 'Stop'
$names = @('DB_SERVER','DB_ADMIN_USER','DB_ADMIN_PASSWORD','APP_DB_PASSWORD','DB_TRUST_CERT')
$saved = @{}
foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
try {
  $env:DB_SERVER=$Server; $env:DB_ADMIN_USER=$AdminUser
  $env:DB_TRUST_CERT=([bool]$TrustServerCertificate).ToString().ToLowerInvariant()
  do {
    $credential = Read-Host "Existing SQL administrator password for $AdminUser" -AsSecureString
    if ($credential.Length -eq 0) { Write-Warning 'The SQL administrator password cannot be blank. Enter the existing SQL login password.' }
  } while ($credential.Length -eq 0)
  $env:DB_ADMIN_PASSWORD = [Net.NetworkCredential]::new('', $credential).Password
  if ($Action -in @('init','protect')) {
    Write-Host 'The next password is a NEW password you choose for community_app. Save it securely; the backend must use this same password.'
    do {
      $appCredential = Read-Host 'New community_app SQL password (at least 8 characters)' -AsSecureString
      if ($appCredential.Length -lt 8) { Write-Warning 'The application password must contain at least 8 characters. It cannot be blank.' }
    } while ($appCredential.Length -lt 8)
    $env:APP_DB_PASSWORD = [Net.NetworkCredential]::new('', $appCredential).Password
  }
  & node (Join-Path $PSScriptRoot 'backend/scripts/database.mjs') $Action
  if ($LASTEXITCODE -ne 0) { throw 'Database operation failed. Review the error before retrying.' }
} finally {
  foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name,$saved[$name],'Process') }
}
