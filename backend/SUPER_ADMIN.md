# Super Admin access

Schema migrations never contain a person's email or password. Migration `0045` creates the account flags, protection trigger, recent-authentication field, permission assignments and time-limited access grants. Migration `0046` separates masked platform audit data from user PII, finance and security views.

After applying migrations, a database administrator creates or promotes the first protected Super Admin with temporary environment variables:

```bash
export SUPER_ADMIN_EMAIL='admin@example.org'
export SUPER_ADMIN_PASSWORD='use-a-unique-password-from-a-password-manager'
export SUPER_ADMIN_FIRST_NAME='Platform'
export SUPER_ADMIN_LAST_NAME='Administrator'
export SUPER_ADMIN_PERMISSIONS='PLATFORM_AUDIT_VIEW'
npm run setup:super-admin
unset SUPER_ADMIN_EMAIL SUPER_ADMIN_PASSWORD SUPER_ADMIN_FIRST_NAME SUPER_ADMIN_LAST_NAME SUPER_ADMIN_PERMISSIONS
```

The setup command uses `DB_ADMIN_USER` and `DB_ADMIN_PASSWORD`, hashes a newly created account password with bcrypt, verifies the password before promoting an existing account, refuses to proceed when a different protected Super Admin exists, and writes the change to `AuditLogs` in the same serializable transaction.

Normal mode grants only assigned platform permissions. Support mode is read-only, requires a reason and expires after 30 minutes. Break-glass mode requires recent password confirmation, a reason and a community scope, expires after 15 minutes, and is currently accepted only for attendance management. It does not grant community ownership, finance management or governance authority.

The API flow is:

1. `POST /api/v1/super-admin/reauthenticate` with the current password.
2. `POST /api/v1/super-admin/access` with `mode`, `reason` and, for break-glass, `communityId`.
3. Use the assigned audit endpoints during the active window.
4. `DELETE /api/v1/super-admin/access/:grantId` to end access early.

Every route below `/api/v1/super-admin` rechecks the active Super Admin flag in MSSQL. Client-side flags are only for navigation visibility.
