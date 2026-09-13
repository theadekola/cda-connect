# CDA Connect working instructions

Use `C:\Users\TheAdekola\Documents\Codex\WorkSpace\cda-connect` as the default location for saving and updating this app. Apply app changes directly in this project.

For an Attendance frontend update, upload from PowerShell:

```powershell
Set-Location 'C:\Users\TheAdekola\Documents\Codex\WorkSpace\cda-connect'
scp frontend/src/Attendance.tsx cda@192.168.10.103:/home/cda/cda-connect/frontend/src/Attendance.tsx
```

Then run on Ubuntu:

```bash
cd /home/cda/cda-connect
bash deploy/start-ubuntu.sh
```

These commands describe the deployment workflow; recording them does not mean deployment has run. Only report deployment success after verifying execution.

## Required handoff for app changes

Always include copy-and-paste PowerShell upload commands in the final response after app changes. Identify all files needed for the update, including frontend, backend, dependencies, and migrations when applicable; do not assume Attendance.tsx is the only changed file. Use the project path and SSH target above, stop uploads on failure, and include the Ubuntu deployment commands. Provide direct scp commands in the chat. The user does not want .ps1 scripts, ZIP archives, or Markdown files as deliverables. Do not offer those formats. Clearly state whether deployment has actually been executed.

