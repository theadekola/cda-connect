USE CDAConnect;
GO
IF OBJECT_ID('dbo.CommunityPreferences','U') IS NULL
 CREATE TABLE dbo.CommunityPreferences(UserId uniqueidentifier NOT NULL PRIMARY KEY REFERENCES dbo.Users(Id),Interests nvarchar(2000) NOT NULL DEFAULT '[]',ContentTypes nvarchar(2000) NOT NULL DEFAULT '[]',FollowedTags nvarchar(2000) NOT NULL DEFAULT '[]',MutedTags nvarchar(2000) NOT NULL DEFAULT '[]',HideSensitive bit NOT NULL DEFAULT 1,UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
GO
IF COL_LENGTH('dbo.CommunityPosts','IsSensitive') IS NULL
 ALTER TABLE dbo.CommunityPosts ADD IsSensitive bit NOT NULL CONSTRAINT DF_CommunityPosts_IsSensitive DEFAULT(0) WITH VALUES;
GO
IF COL_LENGTH('dbo.NotificationPreferences','Initiatives') IS NULL
 ALTER TABLE dbo.NotificationPreferences ADD Initiatives bit NOT NULL CONSTRAINT DF_NotificationPreferences_Initiatives DEFAULT(1) WITH VALUES;
GO
