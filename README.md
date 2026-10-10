
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


## 14. Health Monitoring and Production Verification

Production acceptance must cover the complete application environment, not only the public website.

### 14.1 Infrastructure Checks

The following components should be checked regularly:

- Ubuntu application VM availability.
- Ubuntu database VM availability.
- Node.js API service.
- Background worker service.
- Redis service.
- Nginx reverse proxy.
- Cloudflare Tunnel connectivity.
- Microsoft SQL Server connectivity.
- Disk utilisation.
- Memory utilisation.
- CPU utilisation.
- Application and system logs.
- Database backup execution.
- Background queue processing.

### 14.2 Service Status

On the application VM:

```bash
sudo systemctl status \
  cda-api \
  cda-worker \
  cda-redis \
  nginx \
  cloudflared \
  --no-pager
```

Check failed services:

```bash
systemctl --failed --no-pager
```

Check whether services start automatically:

```bash
systemctl is-enabled \
  cda-api \
  cda-worker \
  cda-redis \
  nginx \
  cloudflared
```

### 14.3 API Health

Check the internal application endpoint:

```bash
curl -fsS http://127.0.0.1:8080/health
```

Check the public endpoint:

```bash
curl -fsS https://cdaconnect.org/health
```

The health response should report the status of:

- API.
- Microsoft SQL Server.
- Redis.
- Background worker.
- Background queues, where implemented.

A successful HTTP response is not sufficient if required dependencies are reporting failures.

Health endpoints should not expose credentials, private connection strings, internal addresses or other sensitive infrastructure details.

### 14.4 Background Queue Monitoring

CDA Connect uses Redis and BullMQ for asynchronous processing.

Background workflows may include:

- Notifications.
- Email and SMS processing.
- Emergency broadcasts.
- Scheduled operations.
- Other application jobs.

Monitoring should inspect:

- Waiting jobs.
- Active jobs.
- Completed jobs.
- Failed jobs.
- Delayed jobs.
- Stalled jobs.
- Worker heartbeat.
- Queue processing latency.

A queue with zero failed jobs does not necessarily prove that notifications were delivered successfully.

Provider delivery status and application-level results must also be checked.

### 14.5 System Resources

Check disk usage:

```bash
df -h
```

Check memory:

```bash
free -h
```

Check CPU and process activity:

```bash
top
```

Check listening ports:

```bash
sudo ss -lntp
```

Expected local listeners include:

| Service | Expected address |
|---|---|
| Node.js API | 127.0.0.1:4000 |
| Dedicated Redis | 127.0.0.1:6380 |
| Nginx application listener | 127.0.0.1:8080 |
| SQL Server | Private database host |

Actual bindings must be confirmed on the running environment.

### 14.6 Application Logs

API logs:

```bash
sudo journalctl -u cda-api -n 100 --no-pager
```

Worker logs:

```bash
sudo journalctl -u cda-worker -n 100 --no-pager
```

Redis logs:

```bash
sudo journalctl -u cda-redis -n 100 --no-pager
```

Nginx logs:

```bash
sudo journalctl -u nginx -n 100 --no-pager
```

Cloudflare Tunnel logs:

```bash
sudo journalctl -u cloudflared -n 100 --no-pager
```

Logs must be reviewed for errors without exposing sensitive user data or authentication credentials.

---

## 15. Functional Production Acceptance

Infrastructure health checks must be complemented by functional testing.

The following workflows should be tested using authorised test accounts and non-sensitive test data.

### Authentication and Accounts

- User registration.
- Login and logout.
- Password recovery.
- Token refresh.
- Session expiration.
- Account access restrictions.
- Multi-factor authentication where enabled.

### Community Management

- Community creation.
- Community discovery.
- Membership requests.
- Membership approval.
- Community administration.
- Community switching.
- Member-role restrictions.

### Communication

- Create a post.
- Comment on a post.
- Send a message.
- Receive a message.
- Reconnect after network interruption.
- Receive notifications.
- Upload permitted attachments.

### Meetings and Governance

- Create meetings.
- Manage attendance.
- Submit RSVP responses.
- Create polls.
- Submit votes.
- Enforce voting eligibility.
- Review voting results.
- Restrict unauthorised governance actions.

### Community Finance

- Create permitted finance records.
- Record payments.
- Generate receipts.
- Review transaction history.
- Verify role-based permissions.
- Check reconciliation and reporting.
- Verify audit records.

Financial workflows must be tested for consistency, authorisation and appropriate error handling before being relied upon operationally.

### Documents and Private Data

- Upload a document.
- Retrieve an authorised document.
- Reject unauthorised document access.
- Verify file-type restrictions.
- Test file-size limits.
- Confirm community data isolation.

### Emergency Workflows

- Submit an emergency alert.
- Verify authorised recipients.
- Process background notifications.
- Record response status.
- Confirm administrative resolution.

Emergency workflows must not be presented as guaranteed emergency-response services.

### Mobile Applications

- Android installation and startup.
- iOS installation and startup.
- Authentication.
- Navigation.
- API connectivity.
- Notifications.
- Network interruption handling.
- Session persistence.

Android and iOS functionality should be tested separately on supported devices.

---

## 16. Production Troubleshooting

This section describes initial diagnostic procedures for common infrastructure problems.

### 16.1 API Not Responding

Check:

```bash
sudo systemctl status cda-api --no-pager
```

Review logs:

```bash
sudo journalctl -u cda-api -n 100 --no-pager
```

Confirm the local listener:

```bash
sudo ss -lntp | grep ':4000'
```

Check the application health endpoint through Nginx:

```bash
curl -i http://127.0.0.1:8080/health
```

Possible causes include:

- Invalid environment configuration.
- Database connection failure.
- Redis connection failure.
- Missing application dependencies.
- Incorrect file permissions.
- Application startup errors.

Do not restart repeatedly without first examining the error.

### 16.2 Database Connection Failure

Verify:

- SQL Server is running.
- The private database hostname resolves.
- TCP 1433 is reachable from the application VM.
- The application login exists.
- The password is correct.
- Database permissions are appropriate.
- SQL encryption settings match the server configuration.

The application must not use the SQL Server administrator account.

Do not log database passwords or publish connection strings.

### 16.3 Redis Connection Failure

Check:

```bash
sudo systemctl status cda-redis --no-pager
```

Confirm the listener:

```bash
sudo ss -lntp | grep ':6380'
```

Review logs:

```bash
sudo journalctl -u cda-redis -n 100 --no-pager
```

Confirm that the application's Redis connection configuration matches the dedicated Redis service.

Do not expose Redis to the public internet.

### 16.4 Worker Not Processing Jobs

Check:

```bash
sudo systemctl status cda-worker --no-pager
```

Review:

```bash
sudo journalctl -u cda-worker -n 100 --no-pager
```

Investigate:

- Redis connectivity.
- Queue configuration.
- Worker startup errors.
- Provider credentials.
- Failed or stalled jobs.
- Job retry behaviour.

A healthy worker process does not guarantee successful external notification delivery.

### 16.5 Website Unavailable

Check Nginx:

```bash
sudo nginx -t
```

Inspect status:

```bash
sudo systemctl status nginx --no-pager
```

Check the internal application:

```bash
curl -i http://127.0.0.1:8080/health
```

Inspect Cloudflare Tunnel:

```bash
sudo systemctl status cloudflared --no-pager
```

If the internal endpoint works but the public domain fails, investigate Cloudflare routing, tunnel connectivity and DNS configuration.

### 16.6 Storage Problems

Check:

```bash
df -h
```

Inspect application storage:

```bash
sudo du -sh /var/lib/cda-connect/
```

Inspect Redis storage:

```bash
sudo du -sh /var/lib/cda-connect-redis/
```

Do not delete database backups, uploaded files or Redis persistence data without reviewing their purpose and retention requirements.

---

## 17. Updating CDA Connect

CDA Connect uses a versioned native deployment approach.

Application updates should preserve:

- Existing database records.
- Uploaded files.
- Environment configuration.
- JWT signing secrets.
- Redis credentials.
- Tunnel credentials.
- Required background-service configuration.

### 17.1 Upload a New Release

From Windows PowerShell 7:

```powershell
.\Transfer-App.ps1 -Upload -Start
```

The deployment script transfers the updated application and initiates the installation procedure.

### 17.2 Verify the Update

After deployment:

```bash
sudo systemctl status \
  cda-api \
  cda-worker \
  cda-redis \
  nginx \
  --no-pager
```

Check:

```bash
curl -fsS http://127.0.0.1:8080/health
```

Then:

```bash
curl -fsS https://cdaconnect.org/health
```

Review application logs and test critical workflows.

### 17.3 Rollback

The versioned release structure allows earlier application code to be retained for a reviewed rollback.

However:

**Application rollback is not database rollback.**

Database schema changes may not be compatible with an earlier application version.

Before performing a rollback:

1. Identify the current release.
2. Identify the previous compatible release.
3. Review database migration compatibility.
4. Confirm that required backups exist.
5. Follow the documented deployment rollback procedure.
6. Recheck application and database health.

Do not rerun the fresh database installation script during ordinary application updates.

---

## 18. Known Limitations and Ongoing Development

CDA Connect remains under active development.

The following areas require continued implementation, integration or operational verification.

### Application Functionality

- Completion and integration of remaining administration workflows.
- Finance-module hardening and reconciliation.
- Document-management integration and permission testing.
- Membership-card and QR-code workflows.
- Mobile platform testing.
- Notification delivery validation.
- Community-level data isolation testing.

### Infrastructure

- Verification of native systemd services.
- Production configuration review.
- Monitoring and alert delivery.
- SQL Server backup monitoring.
- Off-server backup replication.
- Full database restoration testing.
- Recovery procedure documentation.
- Security and access-control testing.

### Product Development

- Accessibility improvements.
- Community discovery improvements.
- Governance workflow enhancements.
- Mobile experience improvements.
- Performance optimisation.
- Operational reporting.
- Reliability improvements.

This section distinguishes ongoing development from completed and independently verified functionality.

---

## 19. Repository Security and Development History

CDA Connect has undergone security-related repository cleanup.

Sensitive configuration and non-public information were removed from the publicly accessible source history.

The public `main` branch currently represents a sanitised repository baseline.

As a result, the visible public commit count may be lower than the earlier development history.

This should not be interpreted as meaning that the application was originally developed in a single commit.

### Repository Security Principles

The repository should not contain:

- Production passwords.
- Database administrator credentials.
- Private API keys.
- JWT secrets.
- Cloudflare Tunnel credentials.
- Production environment files.
- Private SSH keys.
- Sensitive member information.
- Confidential financial records.
- Production database backups.

### Important Security Note

Removing secrets from Git history does not automatically invalidate previously exposed credentials.

Any credentials that may have been exposed should be rotated or revoked.

Repository branches, tags, forks and other retained copies should also be reviewed.

### Development Evidence

The repository provides source-code evidence of:

- Frontend engineering.
- Backend application development.
- Database integration.
- Real-time communication.
- Background processing.
- Deployment automation.
- Infrastructure configuration.
- Continuing technical development.

Historical development screenshots and other dated records may provide additional context where earlier commits are no longer publicly visible.

---

## 20. Data Protection and Privacy

CDA Connect processes information associated with users and community organisations.

The application should be operated with appropriate privacy and security safeguards.

These include:

- Role-based access controls.
- Community-level data isolation.
- Secure authentication.
- Protected file storage.
- Appropriate retention practices.
- Restricted administrative access.
- Secure transport.
- Audit logging.
- Backup protection.
- Controlled disclosure of personal information.

Production data must not be copied into public demonstrations or GitHub repositories.

Test and demonstration environments should use synthetic or appropriately anonymised data.

Applicable data-protection requirements must be assessed for the jurisdictions in which the platform operates.

---

## 21. Development and Engineering Approach

CDA Connect follows a modular application architecture.

Development work includes:

1. Identifying community requirements.
2. Designing application workflows.
3. Developing frontend components.
4. Implementing backend APIs.
5. Designing relational data structures.
6. Integrating real-time services.
7. Implementing background processing.
8. Applying authentication and authorisation.
9. Testing application behaviour.
10. Preparing deployment and maintenance procedures.

The engineering approach aims to maintain clear boundaries between user interfaces, application logic, database operations, background services and infrastructure.

---

## 22. Project Background

The original concept behind CDA Connect emerged from practical experience with community administration.

During my involvement in community leadership, I observed challenges involving communication, meeting coordination, attendance, physical records, community decisions and resident participation.

An initial community-specific application concept was subsequently expanded into a reusable multi-community platform.

The resulting CDA Connect product is intended to support different communities through a shared technical architecture while preserving community-specific administration and membership.

The current platform represents the continuing development of that original idea into a broader digital product.

---

## 23. Project Ownership and Technical Contribution

**Founder and Lead Developer:** Adekola Kazeem Ayannuga

My technical contribution includes:

- Product concept and requirements.
- Application architecture.
- Frontend engineering.
- Backend API development.
- Database design and integration.
- Authentication and authorisation.
- Real-time communication.
- Background processing.
- Mobile application delivery.
- Deployment architecture.
- Infrastructure configuration.
- Technical documentation.
- Continuing maintenance and development.

CDA Connect is one of the independent software products documented through The Adekola Labs.

---

## 24. Technical References

### Project

**CDA Connect Website**

https://cdaconnect.org

**GitHub Repository**

https://github.com/theadekola/cda-connect

### Developer

**The Adekola Labs**

https://theadekola.online

### Infrastructure Documentation

**Nginx WebSocket Proxying**

https://nginx.org/en/docs/http/websocket.html

**Redis Documentation**

https://redis.io/docs/latest/

**Cloudflare Tunnel Documentation**

https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

**Microsoft SQL Server Documentation**

https://learn.microsoft.com/sql/

**Node.js Documentation**

https://nodejs.org/docs/latest/api/

**BullMQ Documentation**

https://docs.bullmq.io/

**Capacitor Documentation**

https://capacitorjs.com/docs

---

## 25. Project Disclaimer

CDA Connect is an actively developed software platform.

Documentation describes application functionality, architecture, implementation resources and deployment procedures.

The existence of a documented feature or deployment component does not guarantee that it has been independently verified in every production environment.

Actual service availability, feature readiness, security controls, backup execution and disaster-recovery capability must be established through testing and operational monitoring.

Emergency-related features do not replace official emergency services.

Financial workflows must be operated in accordance with applicable legal, regulatory and security requirements.

---

## 26. Contact

**Adekola Kazeem Ayannuga**

Founder and Lead Developer, CDA Connect

**Website:** https://cdaconnect.org

**Portfolio:** https://theadekola.online

**GitHub:** https://github.com/theadekola

---

**CDA Connect**

*Stronger Communities, Better Together.*

Developed through **The Adekola Labs**.
