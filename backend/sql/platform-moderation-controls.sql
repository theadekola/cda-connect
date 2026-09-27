SET XACT_ABORT ON;

IF COL_LENGTH('dbo.Communities','PlatformStatus') IS NULL
 ALTER TABLE dbo.Communities ADD PlatformStatus NVARCHAR(20) NOT NULL CONSTRAINT DF_Communities_PlatformStatus DEFAULT 'ACTIVE';
IF COL_LENGTH('dbo.Communities','SuspendedAt') IS NULL
 ALTER TABLE dbo.Communities ADD SuspendedAt DATETIME2 NULL;
IF COL_LENGTH('dbo.Communities','SuspendedBy') IS NULL
 ALTER TABLE dbo.Communities ADD SuspendedBy UNIQUEIDENTIFIER NULL;
IF COL_LENGTH('dbo.Communities','SuspensionReason') IS NULL
 ALTER TABLE dbo.Communities ADD SuspensionReason NVARCHAR(1000) NULL;
IF COL_LENGTH('dbo.Communities','UpdatedAt') IS NULL
 ALTER TABLE dbo.Communities ADD UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Communities_UpdatedAt DEFAULT SYSUTCDATETIME();

IF OBJECT_ID('dbo.CK_Communities_PlatformStatus','C') IS NULL
 EXEC(N'ALTER TABLE dbo.Communities ADD CONSTRAINT CK_Communities_PlatformStatus CHECK(PlatformStatus IN(''ACTIVE'',''RESTRICTED'',''SUSPENDED'',''ARCHIVED''));');
IF OBJECT_ID('dbo.FK_Communities_SuspendedBy','F') IS NULL
 EXEC(N'ALTER TABLE dbo.Communities ADD CONSTRAINT FK_Communities_SuspendedBy FOREIGN KEY(SuspendedBy) REFERENCES dbo.Users(Id);');
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.Communities') AND name='IX_Communities_PlatformStatus')
 EXEC(N'CREATE INDEX IX_Communities_PlatformStatus ON dbo.Communities(PlatformStatus,CreatedAt) INCLUDE(Name,OwnerUserId,IsVerified);');

IF OBJECT_ID('dbo.CK_SuperAdminPermissionAssignments_Code','C') IS NOT NULL
 ALTER TABLE dbo.SuperAdminPermissionAssignments DROP CONSTRAINT CK_SuperAdminPermissionAssignments_Code;
ALTER TABLE dbo.SuperAdminPermissionAssignments ADD CONSTRAINT CK_SuperAdminPermissionAssignments_Code CHECK(PermissionCode IN('PLATFORM_AUDIT_VIEW','USER_PII_VIEW','FINANCE_AUDIT_VIEW','SECURITY_AUDIT_VIEW','SUPER_ADMIN_MANAGE','COMMUNITY_MANAGE'));

INSERT dbo.SuperAdminPermissionAssignments(UserId,PermissionCode,GrantedBy)
SELECT u.Id,permission.PermissionCode,u.Id
FROM dbo.Users u
CROSS JOIN(VALUES('SUPER_ADMIN_MANAGE'),('COMMUNITY_MANAGE')) permission(PermissionCode)
WHERE u.IsSuperAdmin=1 AND u.IsProtectedAccount=1 AND u.AccountStatus='ACTIVE'
 AND NOT EXISTS(SELECT 1 FROM dbo.SuperAdminPermissionAssignments existing WHERE existing.UserId=u.Id AND existing.PermissionCode=permission.PermissionCode);
