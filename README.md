# CDA Connect

**Stronger Communities, Better Together**

**CDA Connect** is a live, publicly deployed multi-community platform for communication, membership, meetings, governance, finance, documents, local services and community safety. The platform is in public use at **https://cdaconnect.org** and continues to receive improvements. A shared installation supports multiple communities with community-scoped membership, administration and records.

- **Live application:** https://cdaconnect.org
- **Repository:** https://github.com/theadekola/cda-connect
- **Security policy:** [SECURITY.md](SECURITY.md)
- **Maintainer:** Adekola Kazeem Ayannuga, The Adekola Labs
- **Portfolio:** https://theadekola.online

## Project status

CDA Connect is operational, publicly accessible and in use. The repository includes the web application, Capacitor mobile projects, backend API, SQL Server schema and migrations, tests and native Ubuntu deployment automation. Active maintenance includes feature updates, security work, performance improvements and integration testing.

Public availability does not establish that every module or third-party integration has passed full production acceptance testing. Feature availability may vary by environment. Android and iOS projects are present, but their inclusion does not establish app-store publication.

## Features

- **Community management:** creation, discovery, profiles, membership requests, administrators, moderators and preferences.
- **Membership:** registration, directories, roles, permissions, membership cards and verification workflows.
- **Social communication:** feeds, announcements, comments, reactions, media, direct and group messaging.
- **Meetings:** scheduling, agendas, attendance, participation records and meeting history.
- **Governance:** proposals, polls, voting, decision records and administrative controls.
- **Finance:** levies, contributions, payment records, receipts, expenses and reporting workflows.
- **Documents:** uploads, access-controlled records, viewing and retrieval.
- **Community services:** marketplace listings, events, local services and opportunities.
- **Safety:** issue reporting, emergency alerts and response coordination. These do not replace official emergency services.
- **Administration:** dashboards, moderation, audit-related records and security controls.
- **Accessibility:** responsive design, interface preferences and accessibility-oriented development; practical assistive-technology testing remains important.

The features listed describe the product scope. Individual workflows may still require integration, provider configuration or environment-specific verification.

## Technology stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, TanStack Query |
| Mobile | Capacitor 8 Android and iOS projects |
| Backend | Node.js 22.13+, Express 5, TypeScript |
| Database | Microsoft SQL Server |
| Background processing | Redis, BullMQ |
| Real-time | Socket.IO |
| Storage | Protected local uploads or configured S3-compatible storage |
| Production runtime | Ubuntu, Nginx, systemd, Cloudflare Tunnel |
| Tooling | npm (frontend), pnpm 11.19 (backend), PowerShell, Bash, Playwright |

Native integrations in the project include push notifications, geolocation, network status, contacts, file access, sharing and biometric authentication. Their availability depends on platform permissions and configuration.

## Architecture

```text
Internet / Web and Mobile Clients
              |
       Cloudflare HTTPS
              |
       Cloudflare Tunnel
              |
       cloudflared -> Nginx :8080
                          |
                 +--------+--------+
                 |                 |
            React / PWA       Node.js API
            static assets     127.0.0.1:4000
                                   |
                         +---------+---------+
                         |         |         |
                     SQL Server   Redis   File Storage
                     private VM  :6380   local / S3
                                   |
                              BullMQ Worker
```

The documented deployment binds the API and dedicated Redis instance to loopback interfaces. Nginx serves the frontend and proxies API and Socket.IO requests. SQL Server runs on a separate private host. The application and worker run under an unprivileged Linux account.

## Repository layout

```text
backend/                    API, workers, tests and SQL resources
  sql/schema.sql            fresh database schema
  sql/*.sql                 incremental migrations
deploy/                     native Ubuntu services and operations scripts
frontend/                   React/PWA and Capacitor applications
scripts/                    repository and workflow support scripts
Initialize-Database.ps1     database init, verify and backup entry point
Transfer-App.ps1            versioned application transfer workflow
docker-compose.infrastructure.yml  infrastructure-related compose file
SECURITY.md                 vulnerability reporting policy
README.md                   project documentation
```

The fresh database schema currently declares 99 tables. This is a schema count, not proof that all associated workflows are operational. Do not initialise an existing production database with the fresh schema.

## Local development

### Prerequisites

Node.js 22.13 or later, npm, pnpm 11.19, SQL Server and Redis. Configure development-only credentials and services before testing database-backed functionality.

```bash
git clone https://github.com/theadekola/cda-connect.git
cd cda-connect
cd backend
# Copy backend/.env.example to an untracked local environment file
# and replace placeholders with development-only values.
pnpm install --frozen-lockfile
pnpm run dev
```

Frontend (in a separate terminal):

```bash
cd frontend
npm ci
npm run dev
```

### Build and test

```bash
cd backend
pnpm run typecheck
pnpm run build
pnpm test

cd ../frontend
npm run typecheck
npm run build
npm test
```

Browser end-to-end tests use Playwright:

```bash
cd frontend
npx playwright install chromium
npx playwright test
```

Native projects must be tested separately on supported devices:

```bash
cd frontend
npm run cap:sync:android
npm run android
npm run cap:sync:ios
npm run ios
```

Android requires Android Studio/SDK; iOS builds require macOS/Xcode.

## Configuration

Never commit production `.env` files, passwords, JWT secrets, provider keys, tunnel credentials, database backups or personal data. Important backend configuration keys include:

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

`STORAGE_DRIVER` accepts `local` or `s3`; S3-compatible storage needs secure endpoint, region, bucket and credentials configuration. Treat example environment files as templates only.

## Database setup

Use the PowerShell 7 database utility only with appropriate administrator authorisation. For a **new empty database**:

```powershell
.\Initialize-Database.ps1 `
  -Action init `
  -Server <private-database-host> `
  -AdminUser <database-administrator>
```

Verify:

```powershell
.\Initialize-Database.ps1 `
  -Action verify `
  -Server <private-database-host> `
  -AdminUser <database-administrator>
```

The script prompts for credentials. A properly trusted SQL Server certificate is preferred. Use `-TrustServerCertificate` only where the private certificate arrangement requires it. The runtime `community_app` login should use least-privilege permissions and must not use SQL administrator credentials.

## Native Ubuntu production deployment

The supported workflow uses versioned native Ubuntu releases rather than running the application itself in Docker. The application VM hosts the API, worker, Redis, Nginx, cloudflared and built frontend. The separate database VM hosts SQL Server and its backup jobs.

### Transfer and build

From Windows PowerShell 7 at the repository root:

```powershell
.\Transfer-App.ps1 -Upload
```

On the Ubuntu application VM:

```bash
cd ~/cda-connect/releases/<release-directory>
bash deploy/start-ubuntu.sh
```

The script checks Node.js, normalises shell line endings, validates shell scripts, installs locked dependencies, builds and tests both applications, and invokes the native installer.

### Protected runtime configuration

The installer creates or validates `/etc/cda-connect/backend.env` and `/etc/cda-connect/redis.conf`. New installations generate Redis and JWT secrets; replace database placeholders and configure providers before activating services. Typical backend settings include:

```dotenv
DB_SERVER=<private-sql-host>
DB_NAME=CDAConnect
DB_USER=community_app
DB_PASSWORD=<secure-secret>
DB_ENCRYPT=true
HOST=127.0.0.1
PORT=4000
PUBLIC_BASE_URL=https://cdaconnect.org
CORS_ORIGIN=https://cdaconnect.org
```

### Deployment-only migration credentials

**Required:** The native installer expects a separate `/etc/cda-connect/migrations.env` file containing credentials for a dedicated deployment migration identity. Give this identity only the schema and deployment permissions required by the reviewed migrations; do not use the SQL Server `sa` account or the runtime `community_app` identity. The file must be owned by root with permission mode `600`, and it must never be loaded into the API or worker service environment.

Create the file from the tracked template only when it does not already exist:

```bash
if [ ! -e /etc/cda-connect/migrations.env ]; then
  sudo install -o root -g root -m 600 \
    deploy/migrations.env.example \
    /etc/cda-connect/migrations.env
fi

sudoedit /etc/cda-connect/migrations.env
sudo stat -c '%U %G %a' /etc/cda-connect/migrations.env
```

Expected permissions: `root root 600`. Configure:

```dotenv
DB_ADMIN_USER=<dedicated-migration-user>
DB_ADMIN_PASSWORD=<secure-migration-password>
MIGRATION_ADOPT_EXISTING=false
```

Keep `MIGRATION_ADOPT_EXISTING=false` for a new database and normal deployments. Set it to `true` only for the first reviewed adoption of an existing database that has no migration ledger, after verifying a current backup and confirming the expected baseline schema. Return it to `false` after that adoption.

Do not commit, print or reuse this file as an application runtime environment file.

### Install or redeploy

After the application has been built and its configuration completed:

```bash
sudo bash deploy/install-native.sh "$PWD"
```

The installer validates configuration, applies and verifies migrations, creates a versioned release, configures systemd and Nginx, switches the active symlink, restarts services and checks health. A code rollback does not reverse database migrations or recover lost application data.

### Service and health checks

```bash
sudo systemctl status cda-api cda-worker cda-redis nginx cloudflared --no-pager
systemctl --failed --no-pager
sudo journalctl -u cda-api -u cda-worker -n 100 --no-pager
curl -fsS http://127.0.0.1:4000/health
curl -fsS http://127.0.0.1:8080/health
curl -fsS https://cdaconnect.org/health
```

The public Cloudflare Tunnel origin is documented as `http://127.0.0.1:8080`. Preserve WebSocket support and do not cache authenticated API, Socket.IO or health responses. A working homepage alone does not prove dependency health.

## Backups and disaster recovery

The repository includes SQL Server full and transaction-log backup services. On the SQL Server host, from the repository root:

```bash
sudo bash deploy/install-sql-backup.sh
```

The installer requires protected `/etc/cda-connect/backup.env` credentials. Documented schedules are daily full backups at 02:00 UTC and transaction-log backups every 15 minutes. Verify the timers and logs:

```bash
systemctl list-timers 'cda-sql-*'
sudo journalctl -u cda-sql-full.service -u cda-sql-log.service --no-pager
```

`RESTORE VERIFYONLY` does not guarantee recoverability. Keep off-server copies, conduct restoration drills on non-production systems, and back up uploads, application configuration and tunnel credentials separately.

## Security and privacy

- Enforce authentication and community-scoped permissions on the server, not only in the frontend.
- Restrict SQL Server, Redis, administrator access and private document downloads.
- Validate uploaded file types, sizes and access rights.
- Protect passwords, tokens, credentials and private member information.
- Test session revocation, account recovery, rate limiting and audit trails.
- Use synthetic or properly anonymised data for tests and demonstrations.
- Rotate compromised credentials; removing them from Git history does not invalidate them.
- Report vulnerabilities through [SECURITY.md](SECURITY.md), not public exploit disclosures.

## Operational verification and ongoing improvements

CDA Connect is live and publicly used. Continued engineering and verification focus on:

- Finance authorisation, reconciliation, receipts and audit records.
- Notification provider delivery, queue health and retry behaviour.
- Android and iOS device testing and release-channel verification.
- Community isolation and private document access testing.
- Accessibility, performance, monitoring and alerting.
- Off-server backup replication and full recovery drills.
- Authentication, password recovery and administrative security.

These are areas of continued improvement or verification, not a claim that the entire public application is unavailable or nonfunctional. Emergency features do not replace official emergency services. Financial workflows must comply with applicable requirements.

## Project background

CDA Connect grew from practical experience with community administration and the difficulties of manual membership records, disconnected communications, attendance registers and fragmented decision-making. The project applies full-stack engineering, relational database design and infrastructure management to everyday community operations.

## Contributing

Review the repository architecture and [SECURITY.md](SECURITY.md) before submitting changes. Use appropriate tests, maintain backend permission checks and community data isolation, and never commit secrets or production member data. Contributions are subject to maintainer review.

## Licence

The repository does not currently contain an open-source licence. Public source availability does not itself grant permission to copy, modify or redistribute the software. Contact the owner about permitted use.

## Ownership and links

- **Founder and lead developer:** Adekola Kazeem Ayannuga
- **Organisation:** The Adekola Labs
- **Live application:** https://cdaconnect.org
- **Portfolio:** https://theadekola.online
- **Repository:** https://github.com/theadekola/cda-connect

---

**CDA Connect: Stronger Communities, Better Together.**
