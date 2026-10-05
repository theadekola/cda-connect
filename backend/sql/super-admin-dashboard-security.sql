SET XACT_ABORT ON;

IF COL_LENGTH('dbo.UserSessions','PasswordConfirmedAt') IS NULL
 ALTER TABLE dbo.UserSessions ADD PasswordConfirmedAt DATETIME2 NULL;

INSERT dbo.SuperAdminPermissionAssignments(UserId,PermissionCode,GrantedBy)
SELECT u.Id,permissions.PermissionCode,u.Id
FROM dbo.Users u
CROSS JOIN(VALUES('PLATFORM_AUDIT_VIEW'),('USER_PII_VIEW'),('FINANCE_AUDIT_VIEW'),('SECURITY_AUDIT_VIEW')) permissions(PermissionCode)
WHERE u.IsSuperAdmin=1 AND u.IsProtectedAccount=1 AND u.AccountStatus='ACTIVE'
 AND NOT EXISTS(SELECT 1 FROM dbo.SuperAdminPermissionAssignments p WHERE p.UserId=u.Id AND p.PermissionCode=permissions.PermissionCode);

GO

CREATE OR ALTER TRIGGER dbo.TR_Users_ProtectSuperAdmin
ON dbo.Users
AFTER UPDATE,DELETE
AS
BEGIN
 SET NOCOUNT ON;
 IF TRY_CONVERT(INT,SESSION_CONTEXT(N'ProtectedAccountSecurityChange'))=1 RETURN;
 IF EXISTS(
  SELECT 1
  FROM deleted oldRow
  LEFT JOIN inserted newRow ON newRow.Id=oldRow.Id
  WHERE oldRow.IsProtectedAccount=1 AND (
   newRow.Id IS NULL OR newRow.IsProtectedAccount<>1 OR newRow.IsSuperAdmin<>1 OR newRow.AccountStatus<>'ACTIVE'
   OR ISNULL(newRow.Email,N'')<>ISNULL(oldRow.Email,N'')
   OR ISNULL(newRow.PasswordHash,N'')<>ISNULL(oldRow.PasswordHash,N'')
   OR (oldRow.TwoFactorEnabled=1 AND oldRow.TwoFactorMethod='authenticator' AND (
    newRow.TwoFactorEnabled<>1 OR newRow.TwoFactorMethod<>'authenticator' OR ISNULL(newRow.TwoFactorSecret,N'')<>ISNULL(oldRow.TwoFactorSecret,N'')
   ))
  )
 ) THROW 51001,'Protected Super Admin credentials and recovery methods require the dedicated audited security workflow',1;
END;
