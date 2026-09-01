[CmdletBinding()]
param(
    [string]$Source = $PSScriptRoot,
    [string]$AppHost = 'cda@192.168.10.103',
    [string]$RemoteRoot = '/home/cda/cda-connect'
)

$ErrorActionPreference = 'Stop'
$knownHosts = Join-Path $Source '.codex_known_hosts'
if (-not (Test-Path -LiteralPath $knownHosts -PathType Leaf)) {
    throw "SSH host-key file not found: $knownHosts"
}
$sshOptions = @(
    '-o', "UserKnownHostsFile=$knownHosts"
    '-o', 'StrictHostKeyChecking=yes'
)

function Assert-NativeCommandSucceeded {
    param([Parameter(Mandatory)][string]$Action)

    if ($LASTEXITCODE -ne 0) {
        throw "$Action failed with exit code $LASTEXITCODE."
    }
}

$uploads = @(
    @{
        Local  = 'frontend\app\_layout.tsx'
        Remote = 'frontend/app/_layout.tsx'
    }
    @{
        Local  = 'frontend\app\community\[id]\chat.tsx'
        Remote = 'frontend/app/community/[id]/chat.tsx'
    }
    @{
        Local  = 'backend\src\routes\chat.ts'
        Remote = 'backend/src/routes/chat.ts'
    }
)

foreach ($upload in $uploads) {
    $localPath = Join-Path $Source $upload.Local
    if (-not (Test-Path -LiteralPath $localPath -PathType Leaf)) {
        throw "Required file not found: $localPath"
    }

    $remotePath = "$RemoteRoot/$($upload.Remote)"
    $remoteParent = $remotePath.Substring(0, $remotePath.LastIndexOf('/'))

    & ssh @sshOptions $AppHost "mkdir -p '$remoteParent'"
    Assert-NativeCommandSucceeded "Creating $remoteParent on $AppHost"

    & scp @sshOptions $localPath "${AppHost}:$remotePath"
    Assert-NativeCommandSucceeded "Uploading $($upload.Local)"
}

$deployCommand = @"
set -e
cd '$RemoteRoot/backend'
npm run build
pm2 restart cda-api --update-env
pm2 save

cd '$RemoteRoot/frontend'
npx expo export --platform web --clear
sudo rsync -a --delete dist/ /var/www/cda-connect/
sudo nginx -t
sudo systemctl reload nginx
pm2 restart cda-expo --update-env
pm2 save
"@

& ssh @sshOptions -t $AppHost $deployCommand
Assert-NativeCommandSucceeded 'Remote application rebuild and restart'

Write-Host 'Chat update deployed successfully.' -ForegroundColor Green
