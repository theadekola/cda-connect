SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.Users','SystemRole') IS NULL
  ALTER TABLE dbo.Users ADD SystemRole NVARCHAR(30) NOT NULL CONSTRAINT DF_Users_SystemRole DEFAULT 'MEMBER';
IF COL_LENGTH('dbo.Users','IsProtectedAccount') IS NULL
  ALTER TABLE dbo.Users ADD IsProtectedAccount BIT NOT NULL CONSTRAINT DF_Users_IsProtectedAccount DEFAULT 0;
IF COL_LENGTH('dbo.Users','MustResetPassword') IS NULL
  ALTER TABLE dbo.Users ADD MustResetPassword BIT NOT NULL CONSTRAINT DF_Users_MustResetPassword DEFAULT 0;

IF OBJECT_ID('dbo.SystemAdminPermissions','U') IS NULL
CREATE TABLE dbo.SystemAdminPermissions(
  UserId UNIQUEIDENTIFIER NOT NULL,
  PermissionCode NVARCHAR(80) NOT NULL,
  GrantedBy UNIQUEIDENTIFIER NULL,
  GrantedAt DATETIME2 NOT NULL CONSTRAINT DF_SystemAdminPermissions_GrantedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_SystemAdminPermissions PRIMARY KEY(UserId,PermissionCode),
  CONSTRAINT FK_SystemAdminPermissions_User FOREIGN KEY(UserId) REFERENCES dbo.Users(Id),
  CONSTRAINT FK_SystemAdminPermissions_GrantedBy FOREIGN KEY(GrantedBy) REFERENCES dbo.Users(Id)
);

IF OBJECT_ID('dbo.SystemAdminAuditLogs','U') IS NULL
CREATE TABLE dbo.SystemAdminAuditLogs(
  Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SystemAdminAuditLogs PRIMARY KEY DEFAULT NEWID(),
  ActorUserId UNIQUEIDENTIFIER NOT NULL,
  ActionCode NVARCHAR(100) NOT NULL,
  TargetType NVARCHAR(60) NOT NULL,
  TargetId NVARCHAR(100) NULL,
  Reason NVARCHAR(1000) NOT NULL,
  BeforeJson NVARCHAR(MAX) NULL,
  AfterJson NVARCHAR(MAX) NULL,
  IpAddress NVARCHAR(80) NULL,
  UserAgent NVARCHAR(500) NULL,
  CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_SystemAdminAuditLogs_CreatedAt DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_SystemAdminAuditLogs_Actor FOREIGN KEY(ActorUserId) REFERENCES dbo.Users(Id)
);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_SystemAdminAuditLogs_CreatedAt')
  CREATE INDEX IX_SystemAdminAuditLogs_CreatedAt ON dbo.SystemAdminAuditLogs(CreatedAt DESC);
IF OBJECT_ID('dbo.TR_SystemAdminAuditLogs_AppendOnly','TR') IS NULL
EXEC('CREATE TRIGGER dbo.TR_SystemAdminAuditLogs_AppendOnly ON dbo.SystemAdminAuditLogs INSTEAD OF UPDATE,DELETE AS BEGIN SET NOCOUNT ON; THROW 51020,''System administrator audit logs are append-only.'',1; END');

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_Users_ProtectedSuperAdmin')
  CREATE UNIQUE INDEX UX_Users_ProtectedSuperAdmin ON dbo.Users(IsProtectedAccount)
  WHERE IsProtectedAccount=1 AND SystemRole='SUPER_ADMIN';

IF OBJECT_ID('dbo.TR_Users_ProtectSuperAdmin','TR') IS NULL
EXEC('CREATE TRIGGER dbo.TR_Users_ProtectSuperAdmin ON dbo.Users AFTER UPDATE,DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF EXISTS(SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.Id=d.Id WHERE d.IsProtectedAccount=1 AND d.SystemRole=''SUPER_ADMIN'' AND (i.Id IS NULL OR i.IsProtectedAccount=0 OR i.SystemRole<>''SUPER_ADMIN'' OR i.AccountStatus<>''ACTIVE''))
 BEGIN ROLLBACK TRANSACTION; THROW 51021,''The protected Super Admin cannot be deleted, demoted, unprotected, or deactivated.'',1; END
END');

COMMIT TRANSACTION;
GO

/*
 Protected bootstrap. Run only from a secured deployment session with SQLCMD variables:
 sqlcmd ... -v SuperAdminEmail="admin@example.com" SuperAdminPasswordHash="$2b$12$..." SuperAdminFirstName="System" SuperAdminLastName="Administrator"
 Generate the bcrypt hash outside SQL, never put a plaintext password in this file or command history.
*/
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @email NVARCHAR(255)=LOWER(LTRIM(RTRIM('$(SuperAdminEmail)')));
DECLARE @hash NVARCHAR(255)='$(SuperAdminPasswordHash)';
IF @email LIKE '$(%' OR @hash LIKE '$(%' OR @hash NOT LIKE '$2%$%'
  THROW 51022,'Supply SuperAdminEmail and a bcrypt SuperAdminPasswordHash using SQLCMD variables.',1;
IF EXISTS(SELECT 1 FROM dbo.Users WHERE IsProtectedAccount=1 AND SystemRole='SUPER_ADMIN' AND Email<>@email)
  THROW 51023,'A different protected Super Admin already exists.',1;
DECLARE @id UNIQUEIDENTIFIER=(SELECT Id FROM dbo.Users WITH(UPDLOCK,HOLDLOCK) WHERE Email=@email);
IF @id IS NULL BEGIN
 SET @id=NEWID();
 INSERT dbo.Users(Id,FirstName,LastName,Email,PasswordHash,AccountStatus,SystemRole,IsProtectedAccount,MustResetPassword,EmailVerified,CreatedAt,UpdatedAt)
 VALUES(@id,'$(SuperAdminFirstName)','$(SuperAdminLastName)',@email,@hash,'ACTIVE','SUPER_ADMIN',1,1,1,SYSUTCDATETIME(),SYSUTCDATETIME());
END ELSE
 UPDATE dbo.Users SET SystemRole='SUPER_ADMIN',IsProtectedAccount=1,AccountStatus='ACTIVE',MustResetPassword=1,UpdatedAt=SYSUTCDATETIME() WHERE Id=@id;
INSERT dbo.SystemAdminPermissions(UserId,PermissionCode,GrantedBy)
SELECT @id,v.Code,NULL FROM(VALUES
 ('DASHBOARD_VIEW'),('USER_MANAGE'),('COMMUNITY_MANAGE'),('CONTENT_MODERATE'),('SECURITY_VIEW'),
 ('NOTIFICATION_VIEW'),('DOCUMENT_VIEW'),('MARKETPLACE_MODERATE'),('GOVERNANCE_VIEW'),('EMERGENCY_MANAGE'),
 ('AUDIT_VIEW'),('SUPPORT_MANAGE'),('ADMIN_MANAGE'),('CONFIG_VIEW'))v(Code)
WHERE NOT EXISTS(SELECT 1 FROM dbo.SystemAdminPermissions p WHERE p.UserId=@id AND p.PermissionCode=v.Code);
COMMIT TRANSACTION;
GO
