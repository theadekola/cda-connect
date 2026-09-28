SET XACT_ABORT ON;

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
  WHERE newRow.Id IS NULL
    AND oldRow.IsProtectedAccount=1
 )
  THROW 51001,'A protected super-admin account cannot be deleted',1;

 IF EXISTS(
  SELECT 1
  FROM deleted oldRow
  JOIN inserted newRow ON newRow.Id=oldRow.Id
  WHERE ISNULL(newRow.Email,'')<>ISNULL(oldRow.Email,'')
    AND NOT (oldRow.IsProtectedAccount=0 AND newRow.AccountStatus='DELETED' AND newRow.Email LIKE 'deleted-%@deleted.invalid')
 )
  THROW 51002,'A registered email address is locked and cannot be changed',1;

 IF EXISTS(
  SELECT 1
  FROM deleted oldRow
  JOIN inserted newRow ON newRow.Id=oldRow.Id
  WHERE oldRow.IsProtectedAccount=1
    AND (newRow.IsProtectedAccount<>1 OR newRow.IsSuperAdmin<>1 OR newRow.AccountStatus<>'ACTIVE')
 )
  THROW 51001,'A protected super-admin account cannot be deactivated or demoted',1;
END;
