SET XACT_ABORT ON;

IF COL_LENGTH('dbo.Users','IsSuperAdmin') IS NULL
 ALTER TABLE dbo.Users ADD IsSuperAdmin BIT NOT NULL CONSTRAINT DF_Users_IsSuperAdmin DEFAULT 0;

IF COL_LENGTH('dbo.Users','IsProtectedAccount') IS NULL
 ALTER TABLE dbo.Users ADD IsProtectedAccount BIT NOT NULL CONSTRAINT DF_Users_IsProtectedAccount DEFAULT 0;

IF COL_LENGTH('dbo.UserSessions','ReauthenticatedAt') IS NULL
 ALTER TABLE dbo.UserSessions ADD ReauthenticatedAt DATETIME2 NULL;

IF OBJECT_ID('dbo.SuperAdminPermissionAssignments','U') IS NULL
 CREATE TABLE dbo.SuperAdminPermissionAssignments(
  UserId UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.Users(Id),
  PermissionCode NVARCHAR(100) NOT NULL,
  GrantedBy UNIQUEIDENTIFIER NULL REFERENCES dbo.Users(Id),
  GrantedAt DATETIME2 NOT NULL CONSTRAINT DF_SuperAdminPermissionAssignments_GrantedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_SuperAdminPermissionAssignments PRIMARY KEY(UserId,PermissionCode),
  CONSTRAINT CK_SuperAdminPermissionAssignments_Code CHECK(PermissionCode IN('PLATFORM_AUDIT_VIEW','USER_PII_VIEW','FINANCE_AUDIT_VIEW','SECURITY_AUDIT_VIEW'))
 );

IF OBJECT_ID('dbo.SuperAdminAccessGrants','U') IS NULL
 CREATE TABLE dbo.SuperAdminAccessGrants(
  Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SuperAdminAccessGrants PRIMARY KEY DEFAULT NEWID(),
  UserId UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.Users(Id),
  CommunityId UNIQUEIDENTIFIER NULL REFERENCES dbo.Communities(Id),
  AccessMode NVARCHAR(20) NOT NULL,
  Reason NVARCHAR(1000) NOT NULL,
  ConfirmedAt DATETIME2 NOT NULL,
  ExpiresAt DATETIME2 NOT NULL,
  RevokedAt DATETIME2 NULL,
  CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_SuperAdminAccessGrants_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_SuperAdminAccessGrants_Mode CHECK(AccessMode IN('SUPPORT','BREAK_GLASS')),
  CONSTRAINT CK_SuperAdminAccessGrants_Expiry CHECK(ExpiresAt>ConfirmedAt),
  CONSTRAINT CK_SuperAdminAccessGrants_BreakGlassScope CHECK(AccessMode<>'BREAK_GLASS' OR CommunityId IS NOT NULL)
 );

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.SuperAdminAccessGrants') AND name='IX_SuperAdminAccessGrants_Active')
 CREATE INDEX IX_SuperAdminAccessGrants_Active ON dbo.SuperAdminAccessGrants(UserId,AccessMode,ExpiresAt) INCLUDE(CommunityId,RevokedAt);

GO

CREATE OR ALTER TRIGGER dbo.TR_Users_ProtectSuperAdmin
ON dbo.Users
AFTER UPDATE,DELETE
AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(
  SELECT 1
  FROM deleted oldRow
  LEFT JOIN inserted newRow ON newRow.Id=oldRow.Id
  WHERE oldRow.IsProtectedAccount=1
    AND (newRow.Id IS NULL OR newRow.IsProtectedAccount<>1 OR newRow.IsSuperAdmin<>1 OR newRow.AccountStatus<>'ACTIVE')
 )
  THROW 51001,'A protected super-admin account cannot be deleted, deactivated or demoted',1;
END;

GO

CREATE OR ALTER VIEW dbo.AuditUsers
AS
 SELECT u.AuditId AS UserId,u.AccountStatus,u.IsSuperAdmin,u.IsProtectedAccount,u.EmailVerified,u.PhoneVerified,u.CreatedAt,u.UpdatedAt
 FROM dbo.Users u;

GO

CREATE OR ALTER VIEW dbo.AuditUserPII
AS
 SELECT u.AuditId AS UserId,u.Id AS InternalId,u.FirstName,u.LastName,u.Email,u.Phone,u.Country,u.State,u.LGA,u.Postcode,u.Address,u.DateOfBirth
 FROM dbo.Users u;

GO

CREATE OR ALTER VIEW dbo.AuditSecurity
AS
 SELECT s.Id AS SessionId,u.AuditId AS UserId,s.CreatedAt,s.ExpiresAt,s.RevokedAt,s.RotatedAt,s.ReauthenticatedAt,
  CASE WHEN s.TrustedName IS NULL THEN CAST(0 AS BIT) ELSE CAST(1 AS BIT) END IsTrusted
 FROM dbo.UserSessions s
 JOIN dbo.Users u ON u.Id=s.UserId;

GO

IF DATABASE_PRINCIPAL_ID('cda_platform_audit_reader') IS NULL CREATE ROLE cda_platform_audit_reader AUTHORIZATION dbo;
IF DATABASE_PRINCIPAL_ID('cda_user_pii_reader') IS NULL CREATE ROLE cda_user_pii_reader AUTHORIZATION dbo;
IF DATABASE_PRINCIPAL_ID('cda_finance_audit_reader') IS NULL CREATE ROLE cda_finance_audit_reader AUTHORIZATION dbo;
IF DATABASE_PRINCIPAL_ID('cda_security_audit_reader') IS NULL CREATE ROLE cda_security_audit_reader AUTHORIZATION dbo;

REVOKE SELECT ON dbo.AuditContributions FROM cda_audit_reader;
GRANT SELECT ON dbo.AuditUsers TO cda_audit_reader;
GRANT SELECT ON dbo.AuditCommunities TO cda_audit_reader;
GRANT SELECT ON dbo.AuditUsers TO cda_platform_audit_reader;
GRANT SELECT ON dbo.AuditCommunities TO cda_platform_audit_reader;
GRANT SELECT ON dbo.AuditUserPII TO cda_user_pii_reader;
GRANT SELECT ON dbo.AuditContributions TO cda_finance_audit_reader;
GRANT SELECT ON dbo.AuditSecurity TO cda_security_audit_reader;
