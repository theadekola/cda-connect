USE [CDAConnect];
GO
IF OBJECT_ID('PrivacySafetySettings','U') IS NULL THROW 50001, 'Apply privacy-safety.sql first.', 1;
GO
IF COL_LENGTH('PrivacySafetySettings','ShareLocation') IS NULL
 ALTER TABLE PrivacySafetySettings ADD ShareLocation BIT NOT NULL CONSTRAINT DF_PrivacySafetySettings_ShareLocation DEFAULT 0;
IF OBJECT_ID('SavedCommunities','U') IS NULL
 CREATE TABLE SavedCommunities(UserId UNIQUEIDENTIFIER NOT NULL REFERENCES Users(Id),CommunityId UNIQUEIDENTIFIER NOT NULL REFERENCES Communities(Id),CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),PRIMARY KEY(UserId,CommunityId));
GO
