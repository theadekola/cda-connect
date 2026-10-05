# CDA Connect working instructions

Work from the repository root. Keep workstation paths, private hostnames, IP addresses, account names and credentials out of tracked files.

For an Attendance frontend update, upload from PowerShell:

```powershell
$SshTarget = Read-Host 'SSH target (user@host)'
scp frontend/src/Attendance.tsx "${SshTarget}:/home/cda/cda-connect/frontend/src/Attendance.tsx"
if ($LASTEXITCODE -ne 0) { throw 'Upload failed' }
```

Then run on Ubuntu:

```bash
cd /home/cda/cda-connect
bash deploy/start-ubuntu.sh
```

These commands describe the deployment workflow; recording them does not mean deployment has run. Only report deployment success after verifying execution.

## Required handoff for app changes

Always include copy-and-paste PowerShell upload commands in the final response after app changes. Identify all files needed for the update, including frontend, backend, dependencies and migrations when applicable. Prompt for private connection details at execution time, stop uploads on failure, and include the Ubuntu deployment commands. Do not create `.ps1` scripts, ZIP archives or Markdown files as deliverables. Clearly state whether deployment has actually been executed.

