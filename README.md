# CDA Connect — native Ubuntu deployment

Run commands from the repository root. This guide replaces the earlier Docker instructions. The deployment path uses no containers.

Application: a private Ubuntu host. Database: a separate private SQL Server host. Website: https://cdaconnect.org through an existing cloudflared host service.

Status: files prepared locally; not deployed. SSH trust/authentication and SQL administrator access are still needed. The saved application SQL login failed. SQL creation/protection/backup execution, native Linux services and the tunnel have not been verified live.

## Native architecture

Cloudflare HTTPS → cloudflared host service → Nginx loopback listener → Node API loopback listener → private SQL Server host.

- cda-api.service runs the API as unprivileged cda-app.
- cda-worker.service runs the worker as cda-app.
- cda-redis.service runs a dedicated password-protected Redis on 127.0.0.1:6380, using AOF persistence. Existing Redis on 6379 is not reconfigured.
- Code: /opt/cda-connect/releases/<release>; active symlink: /opt/cda-connect/current.
- Backend configuration: /etc/cda-connect/backend.env, root-owned mode 600.
- Redis configuration: /etc/cda-connect/redis.conf, root:redis mode 640.
- Persistent uploads: /var/lib/cda-connect/uploads and /var/lib/cda-connect/private-uploads.
- Redis data: /var/lib/cda-connect-redis.

Nginx forwards API, uploads and Socket.IO requests and serves the built frontend. API port 4000 and Redis port 6380 bind only to loopback. cloudflared must run on the same host, targeting http://127.0.0.1:8080. The client remains on HTTPS.

## Application VM prerequisites

Install a supported system-wide Node.js version 22.13 or later at /usr/bin/node. Avoid a private nvm installation for the systemd runtime, because services cannot access the deployment user's home directory. Check /usr/bin/node --version. Use your administrator's approved Node installation method; Ubuntu's default nodejs version may be too old. The script checks the version before installation.

On Ubuntu, install native prerequisites:

```bash
sudo apt update
sudo apt install -y nginx redis-server rsync openssl python3 curl build-essential
sudo npm install --global pnpm@11.19.0
/usr/bin/node --version
pnpm --version
```

No Docker commands or Docker-group membership are required. The cda account needs sudo to install system services. Inspect existing Nginx sites and listeners before installation; other sites are preserved, and port 8080 must be available.

## 1. Prepare SQL Server

On the private SQL Server host, create its backup directory before initialization:

```bash
sudo install -d -o mssql -g mssql -m 700 /var/opt/mssql/backup
```

Allow SQL TCP 1433 only from the application VM and your authorized administration workstation. Do not expose it through the public tunnel. Confirm SQL Server is listening and you have a SQL sysadmin credential for installation. The runtime API must never use that credential.

In PowerShell 7 on your Windows computer:

```powershell
Set-Location '<path-to-your-cda-connect-clone>'
# Node 22.13+ and backend dependencies are required.
.\Initialize-Database.ps1 -Action init -Server <private-database-host> -AdminUser sa -TrustServerCertificate
```

The script securely prompts for passwords. Use a new random application password of at least 8 characters, and save it in your password manager and server backend environment. The previously configured application login failed; use the correctly provisioned application password. TrustServerCertificate is for the current private SQL certificate; install a trusted SQL certificate and omit this switch when available. SQL transport remains encrypted.

The installer refuses if CDAConnect or community_app already exists, avoiding accidental overwrite, permission changes or credential rotation. If either exists, inspect it with your DBA first; do not delete it to make the script succeed. The schema runs transactionally, but database creation itself is outside the transaction: a failed fresh installation leaves the new database for inspection. If a later protection/backup stage fails, retain the database and correct that stage without rerunning the fresh schema.

Initialization creates the schema, enables FULL recovery and page checksums, creates the restricted login, installs deletion guards, takes the first full backup with CHECKSUM, runs RESTORE VERIFYONLY, and checks table presence and DBCC CHECKDB. Backup files are written on the SQL VM, not this Windows computer.

```powershell
.\Initialize-Database.ps1 -Action verify -Server <private-database-host> -AdminUser sa -TrustServerCertificate
.\Initialize-Database.ps1 -Action backup -Server <private-database-host> -AdminUser sa -TrustServerCertificate
```

Do not run every historical migration blindly. `schema.sql` is for a new empty database; the other migration files are retained for individually reviewed upgrades. Never feed the fresh schema to an existing production database.

## Upload and first startup

On Windows PowerShell 7:

```powershell
Set-Location '<path-to-your-cda-connect-clone>'
ssh <deployment-user>@<private-application-host>
# After verifying SSH trust/login, exit the remote shell.
.\Transfer-App.ps1 -Upload
```

Use the exact release timestamp printed by the uploader. On the application VM:

```bash
cd ~/cda-connect/releases/YOUR_RELEASE_TIMESTAMP
bash deploy/start-ubuntu.sh
```

This builds and tests as the deployment user, then asks for sudo. On first installation it generates unique JWT/Redis secrets in /etc/cda-connect. It intentionally stops while DB_PASSWORD still contains a placeholder. Configure it:

```bash
sudo nano /etc/cda-connect/backend.env
```

Set DB_PASSWORD to the strong password provisioned for community_app. Keep DB_SERVER set to the private database hostname, DB_NAME=CDAConnect, DB_USER=community_app, DB_ENCRYPT=true, HOST=127.0.0.1 and PORT=4000. Keep the generated REDIS_URL pointing to 127.0.0.1:6380, matching redis.conf. PUBLIC_BASE_URL and CORS_ORIGIN must be https://cdaconnect.org.

Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER for registration/password recovery. Configure other providers only if used. Do not put SQL administrator credentials here. Preserve generated JWT secrets on later updates: JWT_ACCESS_SECRET also encrypts authenticator secrets. For an existing installation, transfer its original secrets rather than generating replacements.

After saving, finish installation without rebuilding:

```bash
sudo bash deploy/install-native.sh "$PWD"
```

The installer validates the backend environment, copies a versioned runtime release, installs systemd units, validates Nginx and switches the current symlink. It waits for API/database/Redis health. If the API fails, it restores the earlier code symlink when one exists. This is code rollback only; it does not restore database data. Worker startup and end-to-end functionality still need checks.

## Cloudflare and verification

Keep the existing tunnel credentials and unrelated routes. Set the published application hostname cdaconnect.org to HTTP service http://127.0.0.1:8080. No public 80/443 port forwarding is required. Do not cache /api/*, /socket.io/* or /health; keep WebSockets enabled.

```bash
sudo systemctl status cda-api cda-worker cda-redis nginx --no-pager
curl --fail http://127.0.0.1:8080/health
sudo journalctl -u cda-api -u cda-worker -n 100 --no-pager
```

Then open https://cdaconnect.org/health and check api, mssql and redis are all ok. Exercise login, SMS registration, account isolation, communities, chat reconnects, uploads and private documents. Redis and Node services start on boot and restart after crashes. systemd status is not proof that all background jobs complete; monitor application health and logs.

## Future updates

Correct files in the same Windows project folder, then run:

```powershell
.\Transfer-App.ps1 -Upload -Start
```

The script opens an interactive SSH session for the sudo prompt. Credentials stay in /etc/cda-connect; user files stay in /var/lib/cda-connect. Retain earlier /opt/cda-connect/releases directories for a reviewed compatible code rollback. Do not rerun the fresh SQL installer during code updates.

## 5. Backup installation and recovery

Copy deploy/sql-backup.sh, deploy/install-sql-backup.sh and the four cda-sql service/timer files to an administration directory on the SQL VM. Create root-owned, mode-600 `/etc/cda-connect/backup.env`:

```text
SQL_BACKUP_USER=<SQL backup administrator>
SQLCMDPASSWORD=<its password>
SQLCMD_BIN=/opt/mssql-tools18/bin/sqlcmd
```

This account must be able to perform backups and RESTORE VERIFYONLY; it is separate from community_app. Protect it like an administrator credential. Adjust the sqlcmd path if needed. Run:

```bash
sudo bash install-sql-backup.sh
systemctl list-timers 'cda-sql-*'
sudo journalctl -u cda-sql-full.service -u cda-sql-log.service
```

The installer requires a successful full backup before enabling timers. Full backups run daily at 02:00 UTC; log backups run every 15 minutes. Both use CHECKSUM and VERIFYONLY and never overwrite backup files. A file lock prevents concurrent jobs. FULL recovery requires reliable log backups; failed jobs can cause transaction log growth. Monitor failed services, backup age and disk space. Timers log failures but do not send external alerts until your monitoring is configured.

**A backup on the SQL VM is not an off-VM backup.** Copy completed .bak and .trn files to a separate protected disk/server, with restricted access and preferably immutable retention. Retain a full backup and its entire subsequent log chain. No automatic file deletion is configured until an off-VM retention policy is chosen. Also back up the /var/lib/cda-connect/uploads and /var/lib/cda-connect/private-uploads directories and securely preserve backend secrets and tunnel credentials. SQL backups contain metadata, not the uploaded files.

Before accepting production traffic, restore to a separate test database using RESTORE FILELISTONLY and RESTORE DATABASE ... WITH MOVE under a different database name and different physical filenames. Apply subsequent logs in order, then recover and run DBCC CHECKDB. Test application access against the restored copy. VERIFYONLY checks the backup's readability/checksums; it does not prove a complete recovery. Never use WITH REPLACE against CDAConnect during a drill.

The runtime login can read/write application rows but cannot alter/drop tables, truncate tables or drop the database. DROP guards also intercept accidental administrator drop commands. They do not prevent privileged administrators from disabling the guards, direct disk deletion, or mistaken UPDATE/DELETE operations; recoverability requires the backup/log chain. Legitimate row deletion is used by the application, so it has not been disabled globally.

## Review and limits

The corrected fresh schema declares 99 tables. Earlier work fixed missing marketplace/emergency/poll fields, authentication token confusion, concurrent refresh-token collisions and vulnerable multer/qs dependencies. Existing React UI and unrelated Git changes were preserved.

Local build/regression checks are separate from Linux deployment acceptance. Most legacy tests are structural; the JWT tests execute built code. The native scripts are syntax checked, but systemd/Nginx/Redis behavior must be verified on Ubuntu. The frontend remains a partial feature migration, including unfinished administration, finance, document-management and membership-QR flows. SMS configuration, off-VM backup copying and a real restore drill remain necessary.

Legacy Docker files remain only as inactive historical material; Transfer-App.ps1 excludes them and the active start-ubuntu.sh uses native services exclusively.

References: [Nginx WebSocket proxying](https://nginx.org/en/docs/http/websocket.html), [Redis configuration](https://redis.io/docs/latest/operate/oss_and_stack/management/config/), [Cloudflare Tunnel setup](https://developers.cloudflare.com/tunnel/setup/), [SQL Server Linux backup/restore](https://learn.microsoft.com/sql/linux/sql-server-linux-backup-and-restore-database?view=sql-server-ver17).
