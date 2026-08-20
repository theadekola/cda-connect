:setvar DatabaseName "CDAConnect"
:setvar AppLogin "community_app"

IF DB_ID(N'$(DatabaseName)') IS NULL
BEGIN
    EXEC(N'CREATE DATABASE [' + REPLACE(N'$(DatabaseName)', N']', N']]') + N']');
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$(AppLogin)')
BEGIN
    DECLARE @loginSql nvarchar(max) = N'CREATE LOGIN [' + REPLACE(N'$(AppLogin)', N']', N']]') +
        N'] WITH PASSWORD = N''' + REPLACE(N'$(AppPassword)', N'''', N'''''') + N''', CHECK_POLICY = ON';
    EXEC(@loginSql);
END;
GO

USE [CDAConnect];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$(AppLogin)')
BEGIN
    EXEC(N'CREATE USER [' + REPLACE(N'$(AppLogin)', N']', N']]') + N'] FOR LOGIN [' + REPLACE(N'$(AppLogin)', N']', N']]') + N']');
END;
GO
ALTER ROLE db_datareader ADD MEMBER [community_app];
ALTER ROLE db_datawriter ADD MEMBER [community_app];
GRANT EXECUTE TO [community_app];
GO
