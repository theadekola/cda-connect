
# CDA Connect

### Stronger Communities, Better Together

**CDA Connect** is a multi-community digital platform designed to improve how communities communicate, organise activities, manage membership, coordinate governance and deliver community services.

The platform brings community administration, communication, meetings, voting, financial workflows, document management, local services and emergency coordination into a connected digital environment.

CDA Connect is developed and maintained by **Adekola Kazeem Ayannuga** through The Adekola Labs.

**Website:** https://cdaconnect.org  
**Portfolio:** https://theadekola.online  
**Repository:** https://github.com/theadekola/cda-connect

---

## 1. Project Overview

Community organisations often depend on disconnected communication channels, manual registers, spreadsheets and paper-based records.

These approaches can make it difficult to:

- Maintain accurate membership records.
- Communicate announcements consistently.
- Organise meetings and attendance.
- Coordinate community decisions.
- Manage contributions and financial records.
- Track complaints and community issues.
- Maintain documents and historical records.
- Coordinate responses to emergencies.
- Provide transparent community administration.

CDA Connect addresses these challenges through a reusable multi-community software platform.

Rather than building a separate application for every community, the platform allows multiple communities to operate within a shared digital environment while maintaining their own membership, administration and organisational workflows.

### Product Objectives

1. Digitise community administration.
2. Improve communication and participation.
3. Support transparent governance.
4. Simplify membership and records management.
5. Provide structured financial workflows.
6. Improve community safety and emergency coordination.
7. Support local services and opportunities.
8. Deliver consistent web and mobile experiences.

---

## 2. Application Status

**CDA Connect is an actively developed software platform with a public website at https://cdaconnect.org.**

The repository contains application source code, database schema and migration resources, deployment scripts and technical documentation.

The presence of these resources demonstrates the implementation and engineering structure of the project. It does not, by itself, establish that every documented service or feature has been deployed and verified in production.

The native Ubuntu deployment procedures in this repository describe the intended self-hosted runtime architecture.

Production readiness must be assessed against the actual running environment, including:

- Application availability.
- API and database connectivity.
- Authentication and authorisation.
- Background worker processing.
- Redis connectivity.
- File storage permissions.
- Notification delivery.
- Backup execution.
- Disaster recovery.
- Monitoring and operational alerts.

Some frontend modules and administrative workflows remain under development or require further integration testing.

### Deployment Status

| Component | Documented implementation |
|---|---|
| Web application | React, TypeScript and Vite |
| Mobile application | Capacitor-based Android/iOS delivery |
| Backend | Node.js, Express and TypeScript |
| Database | Microsoft SQL Server |
| Cache and queues | Redis and BullMQ |
| Real-time communication | Socket.IO |
| Web server | Nginx |
| Secure access | Cloudflare Tunnel |
| Service management | systemd |
| Application storage | Local protected upload directories |
| Database backups | SQL Server backup scripts and timers |
| Production verification | Requires environment-specific checks |

The native deployment instructions should not be interpreted as confirmation that every component has passed live acceptance testing.

---

## 3. Core Features

CDA Connect is designed around interconnected community-management modules.

### 3.1 Community Management

- Create and manage communities.
- Discover available communities.
- Request community membership.
- Approve or reject membership requests.
- Assign community administrators.
- Maintain community profiles.
- Manage community information and settings.
- Support participation in multiple communities.

### 3.2 Membership Management

- Member registration and profiles.
- Community membership records.
- Member directories.
- Administrative membership controls.
- Member roles and permissions.
- Membership cards.
- Membership verification workflows.

### 3.3 Communication and Social Feed

- Community news feeds.
- Posts and announcements.
- Comments and reactions.
- Community discussions.
- Direct and group messaging.
- Media and document attachments.
- Community activity history.
- Notification workflows.

### 3.4 Meetings and Attendance

- Meeting creation and scheduling.
- Meeting agendas.
- Meeting participation.
- RSVP workflows.
- Attendance recording.
- Meeting announcements.
- Meeting history.
- Administrative meeting controls.

### 3.5 Governance and Voting

- Community polls.
- Voting workflows.
- Community proposals.
- Discussion and decision records.
- Voting eligibility controls.
- Governance-related administrative functions.
- Decision and activity tracking.

### 3.6 Community Finance

- Community levy records.
- Contribution tracking.
- Payment records.
- Receipts.
- Expenses.
- Financial reporting workflows.
- Administrative finance controls.

Finance features should be assessed individually for completion, authorisation and reconciliation before production use.

### 3.7 Emergency and Safety

- Emergency reporting.
- Community alerts.
- Incident coordination.
- Emergency-response status tracking.
- Safety-related notifications.
- Administrative emergency monitoring.

Emergency functions should not be treated as a replacement for official emergency services.

### 3.8 Documents and Records

- Community document management.
- Document uploads.
- Controlled access.
- Community records.
- Administrative document workflows.
- Document retrieval and viewing.

### 3.9 Marketplace and Services

- Community marketplace.
- Local service listings.
- Community opportunities.
- Community events.
- Service discovery.
- Local information sharing.

### 3.10 Administration and Security

- Administrative dashboard.
- User management.
- Community management.
- Roles and permissions.
- Audit logs.
- Moderation.
- Platform monitoring.
- Security-related administration.
- Data and privacy controls.

**Feature availability:** The modules above describe the application's functional scope. Some workflows remain in development or require production verification. Their inclusion here does not imply that every feature is fully operational.

---

## 4. Technology Stack

### Frontend

- React 19
- TypeScript
- Vite
- Responsive web interfaces
- Progressive Web App architecture

### Mobile

- Capacitor
- Android application delivery
- iOS application delivery
- Shared web application architecture

### Backend

- Node.js
- Express
- TypeScript
- REST APIs
- Socket.IO

### Database

- Microsoft SQL Server
- Relational database schema
- Database migrations
- SQL queries and transactions
- Database access controls

### Background Processing

- Redis
- BullMQ
- Background workers
- Notification jobs
- Asynchronous processing

### Infrastructure

- Ubuntu Linux
- Nginx
- systemd
- Cloudflare Tunnel
- Native Node.js services
- SQL Server on a separate private host

### Engineering Tools

- Git and GitHub
- PowerShell deployment scripts
- pnpm
- Database administration tools
- Application logging
- Deployment and verification scripts

---

## 5. Application Architecture

The documented native Ubuntu architecture separates public access, application processing, background services and database storage.

```text
                    INTERNET
                       |
                       v
              Cloudflare HTTPS
                       |
                       v
                Cloudflare Tunnel
                       |
                       v
                cloudflared
                       |
                       v
                Nginx :8080
                       |
             +---------+---------+
             |                   |
             v                   v
       React Web/PWA       Node.js API
       Static Assets       127.0.0.1:4000
                                 |
                 +---------------+---------------+
                 |               |               |
                 v               v               v
           SQL Server         Redis           Uploads
           Private Host    127.0.0.1:6380   Protected Storage
                                 |
                                 v
                           BullMQ Worker
```

### Architecture Principles

**Client separation**

The frontend communicates with backend services through application APIs.

**Private database access**

Microsoft SQL Server runs on a separate private host. Database access should be restricted to authorised application and administration systems.

**Background processing**

Redis and BullMQ support asynchronous tasks and background workflows.

**Real-time communication**

Socket.IO supports application features requiring persistent client/server communication.

**Protected storage**

Uploaded files are stored in dedicated application directories with controlled access.

**Restricted network exposure**

The documented configuration binds the application API and Redis to loopback interfaces rather than exposing them directly to the public internet.

**Service isolation**

The application and background workers operate under an unprivileged Linux service account.

---

## 6. Native Ubuntu Deployment

The active deployment approach documented in this repository uses native Ubuntu services rather than Docker containers.

Legacy Docker-related files may remain for historical reference but are not part of the documented native deployment procedure.

### 6.1 Server Architecture

**Application VM**

Runs:

- Node.js API
- Application worker
- Redis
- Nginx
- cloudflared
- Built frontend assets

**Database VM**

Runs:

- Microsoft SQL Server
- Application database
- Database backup jobs

### 6.2 Required Software

- Ubuntu Linux
- Node.js 22.13 or later
- pnpm 11.19.0
- Nginx
- Redis
- PowerShell 7 on the deployment workstation
- Microsoft SQL Server on the private database host

Check Node.js:

```bash
/usr/bin/node --version
```

Install Ubuntu dependencies:

```bash
sudo apt update

sudo apt install -y \
  nginx \
  redis-server \
  rsync \
  openssl \
  python3 \
  curl \
  build-essential
```

Install pnpm after confirming the supported Node.js runtime is installed:

```bash
sudo npm install --global pnpm@11.19.0
```

Verify:

```bash
pnpm --version
```

A system-wide Node.js installation is preferred for systemd services.

---

## 7. Native Service Configuration

The deployment architecture uses three dedicated application services.

### API Service

```text
cda-api.service
```

Runs the backend API using the restricted `cda-app` Linux account.

### Worker Service

```text
cda-worker.service
```

Runs background application jobs.

### Redis Service

```text
cda-redis.service
```

Runs a dedicated Redis instance.

Documented Redis configuration:

```text
Host: 127.0.0.1
Port: 6380
Persistence: AOF
Authentication: Enabled
```

An existing Redis instance on port 6379 is not intended to be modified.

### Service Verification

```bash
sudo systemctl status \
  cda-api \
  cda-worker \
  cda-redis \
  nginx \
  --no-pager
```

Inspect logs:

```bash
sudo journalctl \
  -u cda-api \
  -u cda-worker \
  -n 100 \
  --no-pager
```

A running service does not guarantee that all application workflows are functioning correctly.

---

## 8. Application Directory Structure

The documented deployment uses versioned application releases.

```text
/opt/cda-connect/
├── releases/
│   ├── release-001/
│   ├── release-002/
│   └── ...
└── current -> releases/active-release
```

Configuration:

```text
/etc/cda-connect/
├── backend.env
└── redis.conf
```

Persistent application storage:

```text
/var/lib/cda-connect/
├── uploads/
└── private-uploads/
```

Redis persistence:

```text
/var/lib/cda-connect-redis/
```

### Configuration Security

The backend environment file should be restricted to authorised administrative access.

```text
/etc/cda-connect/backend.env
```

The documented permission model uses root ownership and mode `600`.

Secrets must not be committed to GitHub.

---

## 9. Microsoft SQL Server

CDA Connect uses Microsoft SQL Server as its primary relational database.

### Database Name

```text
CDAConnect
```

### Application Login

```text
community_app
```

The application account should have only the permissions required for normal runtime operations.

It must not use SQL Server administrator credentials.

### Database Preparation

On the SQL Server host:

```bash
sudo install -d \
  -o mssql \
  -g mssql \
  -m 700 \
  /var/opt/mssql/backup
```

Database installation and administration should be performed by an authorised database administrator.

### Fresh Database Installation

From Windows PowerShell 7:

```powershell
.\Initialize-Database.ps1 `
  -Action init `
  -Server <private-database-host> `
  -AdminUser sa `
  -TrustServerCertificate
```

The script prompts for credentials.

`TrustServerCertificate` should only be used where the private SQL certificate arrangement requires it. A properly trusted SQL certificate is preferred.

The initialisation procedure is intended for a new, empty database.

**Do not run the fresh schema against an existing production database.**

### Database Verification

```powershell
.\Initialize-Database.ps1 `
  -Action verify `
  -Server <private-database-host> `
  -AdminUser sa `
  -TrustServerCertificate
```

### Manual Backup

```powershell
.\Initialize-Database.ps1 `
  -Action backup `
  -Server <private-database-host> `
  -AdminUser sa `
  -TrustServerCertificate
```

The repository's fresh schema currently declares 99 tables. This is a schema-design count, not proof that all tables or modules have been verified in production.

---

## 10. Application Deployment

The documented deployment process transfers application files from a development workstation to the Ubuntu application VM.

### Upload

From Windows PowerShell 7:

```powershell
.\Transfer-App.ps1 -Upload
```

After upload, connect to the application VM and enter the transferred release directory.

```bash
cd ~/cda-connect/releases/YOUR_RELEASE_TIMESTAMP
```

Run:

```bash
bash deploy/start-ubuntu.sh
```

The script prepares the application and initiates native installation.

### Backend Configuration

Edit:

```bash
sudo nano /etc/cda-connect/backend.env
```

Required configuration includes:

```text
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

Redis, JWT and provider secrets must be securely generated and preserved.

Do not use example secrets in production.

### Complete Native Installation

```bash
sudo bash deploy/install-native.sh "$PWD"
```

The installer is designed to:

- Validate runtime configuration.
- Install a versioned release.
- Configure systemd services.
- Validate Nginx.
- Switch the active release.
- Check application health.
- Restore the previous code symlink where supported if installation fails.

Code rollback does not restore database changes or lost application data.

---

## 11. Cloudflare Tunnel and HTTPS

The documented deployment uses Cloudflare Tunnel to provide public HTTPS access without directly exposing the application VM through public port forwarding.

### Public Domain

```text
https://cdaconnect.org
```

### Tunnel Target

```text
http://127.0.0.1:8080
```

Nginx handles frontend delivery and proxies API and Socket.IO traffic.

The tunnel should preserve WebSocket functionality.

Avoid caching:

```text
/api/*
/socket.io/*
/health
```

### Public Health Check

```bash
curl -i https://cdaconnect.org/health
```

The expected health response should be inspected for the status of the API and required dependencies.

Do not assume the application is healthy solely because the homepage loads.

---

## 12. Security Architecture

The application includes or documents several security controls.

### Authentication

- Account authentication.
- Session management.
- Token-based access.
- Authentication-related verification workflows.

### Authorisation

- Role-based access.
- Community-level permissions.
- Administrative restrictions.
- Protected operations.

### Infrastructure Security

- Restricted API listener.
- Restricted Redis listener.
- Private SQL Server connectivity.
- Protected environment files.
- Unprivileged Linux services.
- HTTPS access.
- Controlled file-storage paths.

### Audit and Monitoring

- Application logs.
- Administrative audit records.
- Security-related event tracking.
- Service monitoring.

### Important Security Requirements

Before accepting sensitive production traffic:

1. Verify authentication and access controls.
2. Test community data isolation.
3. Confirm private documents cannot be accessed without authorisation.
4. Validate uploaded-file restrictions.
5. Confirm exposed credentials have been rotated.
6. Test password recovery and session revocation.
7. Review administrator privileges.
8. Verify audit logging.
9. Validate rate limiting and abuse protection.

Documented controls should be tested against the running deployment.

---

## 13. Database Backup and Recovery

Database backups are a critical part of the deployment architecture.

The repository includes scripts for SQL Server backup scheduling and verification.

### Backup Components

```text
deploy/sql-backup.sh
deploy/install-sql-backup.sh
```

The documented backup schedule includes:

| Backup Type | Schedule |
|---|---|
| Full database backup | Daily at 02:00 UTC |
| Transaction log backup | Every 15 minutes |

These schedules describe the intended timer configuration and must be verified on the database VM.

### Backup Installation

```bash
sudo bash install-sql-backup.sh
```

Inspect timers:

```bash
systemctl list-timers 'cda-sql-*'
```

Inspect backup logs:

```bash
sudo journalctl \
  -u cda-sql-full.service \
  -u cda-sql-log.service
```

### Backup Verification

The scripts document use of:

- SQL Server backup checksums.
- RESTORE VERIFYONLY.
- Separate backup files.
- Job locking to prevent overlapping execution.

**RESTORE VERIFYONLY does not prove that a database can be fully recovered.**

### Off-Server Backups

Backups stored only on the SQL Server VM are not sufficient for disaster recovery.

Completed backups should also be copied to a separate protected storage system.

Recommended protections include:

- Restricted access.
- Encryption.
- Retention policies.
- Immutable or protected copies where available.
- Monitoring of backup failures.
- Periodic recovery testing.

### Recovery Testing

A complete recovery drill should:

1. Restore a full backup to a separate test database.
2. Restore the required transaction logs in order.
3. Recover the database.
4. Run integrity checks.
5. Verify application connectivity.
6. Confirm that critical records and workflows are accessible.

Never overwrite the production database during a recovery drill.

Application uploads, environment secrets and tunnel credentials require separate backup arrangements.

---

## 14. Health Monitoring and Production Verification

Production acceptance should cover the complete application, not just the web server.

### Infrastructure Checks

- N