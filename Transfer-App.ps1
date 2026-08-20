[CmdletBinding()]
param(
    [string]$Source = $PSScriptRoot,
    [string]$AppHost = 'cda@192.168.10.103',
    [string]$RemoteDirectory = 'cda-connect',
    [switch]$InstallPrerequisites
)

$ErrorActionPreference = 'Stop'
$nativeEnv = Join-Path $Source 'backend\.env.production'
if (-not (Test-Path -LiteralPath $nativeEnv)) {
    throw 'Create backend\.env.production from its example first.'
}
if (Select-String -LiteralPath $nativeEnv -Pattern 'REPLACE_WITH' -Quiet) {
    throw 'Replace every REPLACE_WITH placeholder in backend\.env.production first.'
}

$archive = Join-Path ([System.IO.Path]::GetTempPath()) 'cda-connect-native.tar.gz'
if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
Push-Location $Source
try {
    tar --exclude='node_modules' --exclude='.expo' --exclude='dist' --exclude='.git' --exclude='frontend/android' --exclude='frontend/ios' -czf $archive .
} finally {
    Pop-Location
}

ssh $AppHost "mkdir -p '$RemoteDirectory'"
scp $archive "${AppHost}:$RemoteDirectory/cda-connect-native.tar.gz"
ssh $AppHost "cd '$RemoteDirectory' && tar -xzf cda-connect-native.tar.gz && rm cda-connect-native.tar.gz && chmod +x deploy-app.sh install-prerequisites.sh"
if ($InstallPrerequisites) {
    ssh -t $AppHost "cd '$RemoteDirectory' && ./install-prerequisites.sh"
}
ssh -t $AppHost "cd '$RemoteDirectory' && ./deploy-app.sh"
Remove-Item -LiteralPath $archive -Force
