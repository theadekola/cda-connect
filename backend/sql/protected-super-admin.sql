SET XACT_ABORT ON;

IF COL_LENGTH('dbo.Users','IsSuperAdmin') IS NULL
 ALTER TABLE dbo.Users ADD IsSuperAdmin BIT NOT NULL CONSTRAINT DF_Users_IsSuperAdmin DEFAULT 0;

IF COL_LENGTH('dbo.Users','IsProtectedAccount') IS NULL
 ALTER TABLE dbo.Users ADD IsProtectedAccount BIT NOT NULL CONSTRAINT DF_Users_IsProtectedAccount DEFAULT 0;

GO

DECLARE @protectedUserId UNIQUEIDENTIFIER;
SELECT @protectedUserId=Id
FROM dbo.Users
WHERE LOWER(Email)=N'adekola750@outlook.com';

IF @protectedUserId IS NULL
 THROW 51000,'The protected super-admin account adekola750@outlook.com was not found',1;

UPDATE dbo.Users
SET IsSuperAdmin=1,IsProtectedAccount=1,AccountStatus='ACTIVE',UpdatedAt=SYSUTCDATETIME()
WHERE Id=@protectedUserId;

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
    AND (
      newRow.Id IS NULL
      OR newRow.IsProtectedAccount<>1
      OR newRow.IsSuperAdmin<>1
      OR newRow.AccountStatus<>'ACTIVE'
    )
 )
  THROW 51001,'The protected super-admin account cannot be deleted, deactivated or demoted',1;
END;

GO

CREATE OR ALTER VIEW dbo.AuditUsers
AS
 SELECT u.AuditId AS UserId,u.Id AS InternalId,u.FirstName,u.LastName,u.Email,u.Phone,u.Country,u.State,u.LGA,u.Postcode,u.Address,u.DateOfBirth,u.AccountStatus,u.IsSuperAdmin,u.IsProtectedAccount,u.EmailVerified,u.PhoneVerified,u.CreatedAt,u.UpdatedAt
 FROM dbo.Users u;

GO

GRANT SELECT ON dbo.AuditUsers TO cda_audit_reader;
