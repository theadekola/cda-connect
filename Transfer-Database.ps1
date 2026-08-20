[CmdletBinding()]
param(
    [string]$Source = $PSScriptRoot,
    [string]$DatabaseHost = 'mssql@192.168.10.101',
    [string]$SqlAdmin = 'sa',
    [string]$AppLogin = 'community_app'
)

$ErrorActionPreference = 'Stop'
$schema = Join-Path $Source 'backend\sql\schema.sql'
$bootstrap = Join-Path $Source 'backend\sql\database-bootstrap.sql'
$remoteScript = Join-Path $Source 'backend\sql\remote-database-init.sh'
scp $schema "${DatabaseHost}:/tmp/cda-schema.sql"
scp $bootstrap "${DatabaseHost}:/tmp/cda-database-bootstrap.sql"
scp $remoteScript "${DatabaseHost}:/tmp/cda-remote-database-init.sh"
Write-Host 'Files transferred. The remote command will securely prompt for the SQL admin and application passwords.'
ssh -t $DatabaseHost "chmod 700 /tmp/cda-remote-database-init.sh && /tmp/cda-remote-database-init.sh '$SqlAdmin' '$AppLogin'"
