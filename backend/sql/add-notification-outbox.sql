IF COL_LENGTH('UserAppPreferences','TimeZone') IS NULL
  ALTER TABLE UserAppPreferences ADD TimeZone NVARCHAR(100) NOT NULL CONSTRAINT DF_UserAppPreferences_TimeZone DEFAULT 'UTC';

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='NotificationOutbox')
CREATE TABLE NotificationOutbox(NotificationId UNIQUEIDENTIFIER PRIMARY KEY,EventId UNIQUEIDENTIFIER NOT NULL UNIQUE,CommunityId UNIQUEIDENTIFIER NOT NULL,NotificationType NVARCHAR(100) NOT NULL,Payload NVARCHAR(MAX) NOT NULL,Status NVARCHAR(30) NOT NULL DEFAULT 'PENDING',AttemptCount INT NOT NULL DEFAULT 0,LastError NVARCHAR(2000),QueuedAt DATETIME2,DispatchedAt DATETIME2,CompletedAt DATETIME2,CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='NotificationDigestItems')
CREATE TABLE NotificationDigestItems(Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),NotificationId UNIQUEIDENTIFIER NOT NULL,UserId UNIQUEIDENTIFIER NOT NULL,Frequency NVARCHAR(20) NOT NULL,Title NVARCHAR(180) NOT NULL,Body NVARCHAR(500) NOT NULL,Data NVARCHAR(2000),CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),DeliveredAt DATETIME2 NULL,CONSTRAINT UQ_NotificationDigest_User_Event UNIQUE(NotificationId,UserId));

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_UserDevices_User' AND object_id=OBJECT_ID('UserDevices')) CREATE INDEX IX_UserDevices_User ON UserDevices(UserId) INCLUDE(DeviceToken,Platform,LastActiveAt);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_CommunityMembers_NotificationRecipients' AND object_id=OBJECT_ID('CommunityMembers')) CREATE INDEX IX_CommunityMembers_NotificationRecipients ON CommunityMembers(CommunityId,Status,UserId);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_NotificationOutbox_Status' AND object_id=OBJECT_ID('NotificationOutbox')) CREATE INDEX IX_NotificationOutbox_Status ON NotificationOutbox(Status,CreatedAt) INCLUDE(NotificationId,EventId,AttemptCount);
