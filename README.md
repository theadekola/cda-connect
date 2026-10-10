# CDA Connect

**Stronger Communities, Better Together**

CDA Connect is a multi-community platform for communication, membership, meetings, governance, finance, documents, local services and community safety. A single installation can serve multiple communities while keeping each community's membership, administration and records separate.

- Website: [cdaconnect.org](https://cdaconnect.org)
- Security policy: [SECURITY.md](SECURITY.md)
- Maintainer: Adekola Kazeem Ayannuga, The Adekola Labs

## Project status

CDA Connect is under active development. This repository contains the web application, Capacitor mobile projects, backend API, SQL Server schema and migrations, tests, and native Ubuntu deployment automation.

The presence of a feature or deployment script in the repository does not prove that it has passed production acceptance testing. Finance, emergency, notification, mobile and recovery workflows require environment-specific verification before operational use.

## Features

- Multi-community creation, discovery, membership and administration
- Member profiles, directories, roles, permissions and membership cards
- Community feeds, announcements, comments, reactions and media
- Direct and group messaging with real-time updates
- Meetings, attendance, events, polls and voting
- Levy, contribution, payment, receipt and expense workflows
- Community documents and access-controlled records
- Marketplace listings, local services and opportunities
- Issue reporting, emergency alerts and response coordination
- Platform administration, moderation, audit and security controls

Some workflows remain under development or require additional integration and production testing.

## Technology

### Frontend and mobile

- React 19, TypeScript and Vite
- React Router and TanStack Query
- Progressive Web App support
- Capacitor 8 Android and iOS projects
- npm for frontend dependency management and builds

The Android and iOS projects are included in the repository. Their presence does not claim that a particular store release has been published or approved.

### Backend

- Node.js 22.13 or later
- Express 5 and TypeScript
- Microsoft SQL Server
- Redis and BullMQ
- Socket.IO
- Local or S3-compatible object storage
- pnpm 11.19 for backend dependency management

### Native production runtime

- Ubuntu Linux
- Nginx
- systemd
- Cloudflare Tunnel
- Dedicated Redis service
- SQL Server on a private database host

## Repository layout

```text
backend/                    API, workers, tests and SQL resources
  sql/schema.sql            fresh database schema
  sql/*.sql                 reviewed incremental migrations
deploy/                     native Ubuntu services and operations scripts
frontend/                   React/PWA and Capacitor applications
scripts/                    repository and workflow support scripts
Initialize-Database.ps1     database initialise, verify and backup commands
Transfer-App.ps1            versioned application transfer workflow
SECURITY.md                 vulnerability reporting policy
```

The fresh schema currently declares 99 tables. Do not run it against an existing production database; use reviewed migrations and a tested backup and recovery plan.

## Local development

### Requirements

- Node.js 22.13 or later
- npm
- pnpm 11.19
- Microsoft SQL Server
- Redis

### Backend

Copy `backend/.env.example` to an untracked local environment file and replace every required placeholder with development-only values.

```bash
cd backend
pnpm install --frozen-lockfile
pnpm run dev
```

Useful checks:

```bash
pnpm run typecheck
pnpm run build
pnpm test
```

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm run build
npm test
```

To synchronise generated web assets and native configuration:

```bash
npm run cap:sync:android
npm run cap:sync:ios
```

Native applications must be tested separately on supported devices.

## Configuration

Runtime configuration belongs outside Git. Never commit production `.env` files, passwords, JWT signing secrets, provider credentials, private keys, tunnel credentials, database backups or member data.

Important backend settings include:

```text
DB_SERVER
DB_NAME
DB_USER
DB_PASSWORD
DB_ENCRYPT
REDIS_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
PUBLIC_BASE_URL
CORS_ORIGIN
STORAGE_DRIVER
```

`STORAGE_DRIVER` accepts `local` or `s3`. The documented native deployment defaults to protected local upload directories. S3-compatible storage requires its endpoint, region, bucket and credentials to be configured securely.

Use the example environment files only as templates. Example values are not production secrets.

## Architecture

```text
Internet
   |
Cloudflare HTTPS and Tunnel
   |
Nginx loopback listener
   |-----------------------|
React/PWA assets       Node.js API
                           |
              |------------|------------|
          SQL Server     Redis       File storage
                           |
                      BullMQ worker
```

The documented native deployment binds the API and dedicated Redis instance to loopback interfaces. Nginx serves the frontend and proxies API and Socket.IO traffic. Application and worker services run as an unprivileged account.

Loopback addresses such as `127.0.0.1` identify the same machine. They are not passwords or application secrets.

## Database setup

Database administration must be performed by an authorised administrator. From PowerShell 7, initialise a new empty database with:

```powershell
.\Initialize-Database.ps1 `
  -Action init `
  -Server <private-database-host> `
  -AdminUser <database-administrator>
```

Verify it with:

```powershell
.\Initialize-Database.ps1 `
  -Action verify `
  -Server <private-database-host> `
  -AdminUser <database-administrator>
```

The script prompts for credentials. Use `-TrustServerCertificate` only when the private SQL certificate arrangement requires it; a properly trusted certificate is preferred.

## Testing

The standard repository checks are:

```bash
cd backend
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm test

cd ../frontend
npm ci
npm run typecheck
npm run build
npm test
```

Browser end-to-end tests use Playwright and require its browser runtime:

```bash
cd frontend
npx playwright install chromium
npx playwright test
```

Passing automated tests does not replace mobile-device, security, accessibility or production acceptance testing.

## Native Ubuntu deployment

The supported repository workflow creates versioned releases. From Windows PowerShell 7:

```powershell
.\Transfer-App.ps1 -Upload
```

On the application VM, enter the uploaded release directory and run:

```bash
cd ~/cda-connect/releases/<release-directory>
bash deploy/start-ubuntu.sh
```

The start script validates shell files, checks the Node.js version, installs locked dependencies, builds and tests both applications, and then invokes the native installer with `sudo`.

On first installation, the installer creates protected configuration templates and generated Redis/JWT secrets. Installation intentionally stops while required database settings still contain placeholders. Review `/etc/cda-connect/backend.env`, replace every required placeholder, and rerun:

```bash
sudo bash deploy/install-native.sh "$PWD"
```

The installer creates a versioned release, validates Nginx, switches the active symlink, starts services and checks application health. A code rollback does not reverse database migrations or restore lost data.

### Service checks

```bash
sudo systemctl status cda-api cda-worker cda-redis nginx cloudflared --no-pager
systemctl --failed --no-pager
curl -fsS http://127.0.0.1:8080/health
curl -fsS https://cdaconnect.org/health
```

The health response checks the API, SQL Server, Redis and worker heartbeat. Review dependency status rather than relying only on the homepage or HTTP status.

## Backups and recovery

The repository includes SQL Server full and transaction-log backup services. From the repository root on the SQL Server host:

```bash
sudo bash deploy/install-sql-backup.sh
```

The installer requires a protected `/etc/cda-connect/backup.env` containing the backup login configuration.

The documented timers schedule:

| Backup | Schedule |
|---|---|
| Full database backup | Daily at 02:00 UTC |
| Transaction-log backup | Every 15 minutes |

Verify timers and logs:

```bash
systemctl list-timers 'cda-sql-*'
sudo journalctl -u cda-sql-full.service -u cda-sql-log.service --no-pager
```

`RESTORE VERIFYONLY` is useful but does not prove recoverability. Copy completed backups to separate protected storage and run periodic restoration drills against a non-production database. Back up uploads, environment files and tunnel credentials separately.

## Production acceptance

Before accepting real user data, verify at least:

- Registration, login, logout, recovery, session expiry and revocation
- Role enforcement, community isolation and administrative boundaries
- Feed, messaging, meetings, polls and notification delivery
- Finance authorisation, reconciliation, receipts and audit records
- Private document access and upload restrictions
- Emergency recipient selection and background delivery
- Android and iOS installation, permissions and network recovery
- Service monitoring, queue processing and provider failures
- Backup completion and full recovery procedures
- Accessibility, performance and abuse protection

Emergency features do not replace official emergency services. Finance workflows must be reviewed for applicable legal, regulatory and security requirements.

## Security and privacy

- Report vulnerabilities through [SECURITY.md](SECURITY.md).
- Keep production secrets and personal data out of issues, logs and commits.
- Rotate or revoke any credential that may have been exposed; deleting Git history does not invalidate it.
- Use synthetic or properly anonymised data in tests and demonstrations.
- Restrict database, Redis, upload, backup and administrator access.
- Review branches, tags, forks and cached references when cleaning repository history.

The public repository is a sanitised source baseline, but every release and running environment still requires its own security review.

## Known limitations

CDA Connect remains under active development. Areas requiring continuing work or environment-specific verification include:

- Finance reconciliation and operational controls
- Notification provider delivery and queue monitoring
- Mobile-device and store-release testing
- Community data-isolation and document-permission testing
- Accessibility and performance testing
- Off-server backup replication and complete recovery drills
- Production monitoring and alert delivery

## Licence

This repository currently does not contain an open-source licence. Source availability on GitHub does not grant permission to copy, modify or redistribute the software. Contact the project owner regarding permitted use.

## Project ownership

**Founder and lead developer:** Adekola Kazeem Ayannuga  
**Organisation:** The Adekola Labs  
**Website:** [cdaconnect.org](https://cdaconnect.org)  
**Portfolio:** [theadekola.online](https://theadekola.online)  
**GitHub:** [github.com/theadekola](https://github.com/theadekola)

---

**CDA Connect — Stronger Communities, Better Together**

