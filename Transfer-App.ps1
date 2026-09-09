[CmdletBinding()]
param(
  [string]$ProjectPath = 'C:\Users\TheAdekola\Documents\Codex\WorkSpace\cda-connect',
  [string]$SshTarget = 'cda@192.168.10.103',
  [string]$IdentityFile,
  [switch]$Upload,
  [switch]$Start
)
$ErrorActionPreference = 'Stop'
if ($SshTarget -notmatch '^[a-zA-Z0-9_.-]+@[a-zA-Z0-9.-]+$') { throw 'Invalid SSH target' }
if ($Start -and !$Upload) { throw '-Start requires -Upload' }
$root = (Resolve-Path -LiteralPath $ProjectPath).Path
$rootPrefix = $root.TrimEnd([char[]]'\/') + [IO.Path]::DirectorySeparatorChar
$releaseId = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)
$staging = Join-Path $root "work\release-$releaseId"
New-Item -ItemType Directory -Path $staging | Out-Null
# Explicit allowlist: no .git, caches, node_modules, .env secrets or user uploads.
$files = @('README.md','Transfer-App.ps1','Initialize-Database.ps1','.gitignore','.gitattributes')
$files += @('backend/package.json','backend/pnpm-lock.yaml','backend/pnpm-workspace.yaml','backend/tsconfig.json','backend/.env.production.example')
$files += @('frontend/package.json','frontend/package-lock.json','frontend/tsconfig.json','frontend/vite.config.ts','frontend/index.html','frontend/capacitor.config.ts','frontend/README.md','frontend/.env.example')
foreach ($directory in @('backend/src','backend/sql','backend/scripts','backend/test','frontend/src','frontend/public','frontend/tests','deploy')) {
  $files += Get-ChildItem -LiteralPath (Join-Path $root $directory) -File -Recurse |
    Where-Object { $_.Name -notlike '.env*' -or $_.Name -like '*.example' } |
    Where-Object { $_.FullName -notmatch '[\\/]secrets[\\/]' -and $_.Name -notin @('Caddyfile','.env.example') } |
    ForEach-Object {
      # Compatible with Windows PowerShell 5.1/.NET Framework and PowerShell 7.
      $fullPath = [IO.Path]::GetFullPath($_.FullName)
      if (!$fullPath.StartsWith($rootPrefix,[StringComparison]::OrdinalIgnoreCase)) {
        throw "Source file is outside the project directory: $fullPath"
      }
      $fullPath.Substring($rootPrefix.Length)
    }
}
foreach ($relative in $files) {
  $destination = Join-Path $staging $relative
  New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
  Copy-Item -LiteralPath (Join-Path $root $relative) -Destination $destination
}
$archive = Join-Path $root "work\cda-connect-$releaseId.tgz"
& tar -czf $archive -C $staging .
if ($LASTEXITCODE -ne 0) { throw 'Packaging failed' }
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
Write-Host "Package: $archive"
Write-Host "SHA256: $hash"
if (!$Upload) { return }
$sshOptions = @('-o','StrictHostKeyChecking=yes')
if ($IdentityFile) { $sshOptions += @('-i',(Resolve-Path -LiteralPath $IdentityFile).Path) }
$remote = "cda-connect/releases/$releaseId"
& ssh @sshOptions $SshTarget "umask 077 && mkdir -p $remote"
if ($LASTEXITCODE -ne 0) { throw 'SSH failed; verify host trust and login in your PowerShell session.' }
& scp @sshOptions $archive "${SshTarget}:$remote/source.tgz"
if ($LASTEXITCODE -ne 0) { throw 'Upload failed' }
& ssh @sshOptions $SshTarget "cd $remote && echo '$hash  source.tgz' | sha256sum -c - && tar -xzf source.tgz"
if ($LASTEXITCODE -ne 0) { throw 'Remote verification or extraction failed' }
Write-Host "Uploaded to ~/$remote. Earlier releases are retained. Native runtime data lives in /var/lib/cda-connect."
if ($Start) {
  # Native installer prompts for sudo on Ubuntu; credentials stay on the VM.
  & ssh -t @sshOptions $SshTarget "cd $remote && bash deploy/start-ubuntu.sh"
  if ($LASTEXITCODE -ne 0) { throw 'Native startup failed. Inspect systemd logs; preserve /var/lib/cda-connect.' }
}
