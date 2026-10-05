-- Run as a SQL administrator against the existing CDAConnect database.
USE [CDAConnect];
GO
IF OBJECT_ID(N'dbo.WebPushSubscriptions',N'U') IS NULL
BEGIN
 CREATE TABLE dbo.WebPushSubscriptions(
  Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  UserId UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.Users(Id),
  EndpointHash BINARY(32) NOT NULL UNIQUE,
  Endpoint NVARCHAR(2048) NOT NULL,
  P256dh VARCHAR(100) NOT NULL,
  Auth VARCHAR(100) NOT NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
 );
 CREATE INDEX IX_WebPushSubscriptions_User ON dbo.WebPushSubscriptions(UserId);
END;
GO
