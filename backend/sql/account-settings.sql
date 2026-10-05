USE [CDAConnect];
GO
IF OBJECT_ID(N'dbo.AccountSettings',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.AccountSettings(
  UserId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY REFERENCES dbo.Users(Id),
  Username NVARCHAR(30) COLLATE Latin1_General_100_CI_AS NULL,
  UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
 );
END;
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.AccountSettings') AND name='UX_AccountSettings_Username')
 CREATE UNIQUE INDEX UX_AccountSettings_Username ON dbo.AccountSettings(Username) WHERE Username IS NOT NULL;
GO

IF COL_LENGTH('dbo.AccountSettings','PrivateAccount') IS NULL ALTER TABLE dbo.AccountSettings ADD PrivateAccount BIT NOT NULL DEFAULT 1;
IF COL_LENGTH('dbo.AccountSettings','AllowFollowers') IS NULL ALTER TABLE dbo.AccountSettings ADD AllowFollowers BIT NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.AccountSettings','EmailUpdates') IS NULL ALTER TABLE dbo.AccountSettings ADD EmailUpdates BIT NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.AccountSettings','PersonalizedExperience') IS NULL ALTER TABLE dbo.AccountSettings ADD PersonalizedExperience BIT NOT NULL DEFAULT 1;
GO
IF OBJECT_ID('dbo.UserFollows','U') IS NULL
 CREATE TABLE dbo.UserFollows(FollowerId UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.Users(Id),FollowedId UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.Users(Id),CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),PRIMARY KEY(FollowerId,FollowedId),CHECK(FollowerId<>FollowedId));
GO
