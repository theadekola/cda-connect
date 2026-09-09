USE [master];
GO
CREATE OR ALTER TRIGGER [CDAConnect_PreventDropDatabase]
ON ALL SERVER
FOR DROP_DATABASE
AS
BEGIN
  SET NOCOUNT ON;
  IF EVENTDATA().value('(/EVENT_INSTANCE/DatabaseName)[1]', 'sysname') = N'CDAConnect'
  BEGIN
    RAISERROR('CDAConnect deletion is blocked. A DBA must explicitly disable CDAConnect_PreventDropDatabase after verifying a restorable backup.',16,1);
    ROLLBACK;
  END;
END;
GO
USE [CDAConnect];
GO
CREATE OR ALTER TRIGGER [CDAConnect_PreventDropObjects]
ON DATABASE
FOR DROP_TABLE, DROP_VIEW, DROP_PROCEDURE, DROP_FUNCTION, DROP_SCHEMA
AS
BEGIN
  SET NOCOUNT ON;
  RAISERROR('Object deletion is blocked. A DBA must explicitly disable CDAConnect_PreventDropObjects for an approved migration.',16,1);
  ROLLBACK;
END;
GO
