SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.UserAppPreferences','NotificationPreviewsEnabled') IS NULL ALTER TABLE dbo.UserAppPreferences ADD NotificationPreviewsEnabled BIT NOT NULL CONSTRAINT DF_UserAppPreferences_NotificationPreviews DEFAULT 0;
IF COL_LENGTH('dbo.ConversationMembers','IsActive') IS NULL ALTER TABLE dbo.ConversationMembers ADD IsActive BIT NOT NULL CONSTRAINT DF_ConversationMembers_IsActive DEFAULT 1;
IF COL_LENGTH('dbo.ConversationMembers','MutedUntil') IS NULL ALTER TABLE dbo.ConversationMembers ADD MutedUntil DATETIME2 NULL;
IF COL_LENGTH('dbo.Messages','ClientMessageId') IS NULL ALTER TABLE dbo.Messages ADD ClientMessageId UNIQUEIDENTIFIER NULL;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_Messages_Sender_ClientMessage' AND object_id=OBJECT_ID('dbo.Messages')) EXEC(N'CREATE UNIQUE INDEX UX_Messages_Sender_ClientMessage ON dbo.Messages(SenderUserId,ClientMessageId) WHERE ClientMessageId IS NOT NULL');

IF OBJECT_ID('dbo.UserNotifications','U') IS NULL
CREATE TABLE dbo.UserNotifications(
 Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(), NotificationId UNIQUEIDENTIFIER NOT NULL,
 UserId UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.Users(Id), NotificationType NVARCHAR(100) NOT NULL,
 Title NVARCHAR(180) NOT NULL, Body NVARCHAR(500) NOT NULL, CommunityId UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.Communities(Id),
 EntityId UNIQUEIDENTIFIER NULL, NavigationData NVARCHAR(2000) NULL, CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 ReadAt DATETIME2 NULL, DeliveryStatus NVARCHAR(30) NOT NULL DEFAULT 'PENDING',
 CONSTRAINT UQ_UserNotifications_Event_User UNIQUE(NotificationId,UserId)
);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_UserNotifications_User_Created' AND object_id=OBJECT_ID('dbo.UserNotifications')) EXEC(N'CREATE INDEX IX_UserNotifications_User_Created ON dbo.UserNotifications(UserId,CreatedAt DESC) INCLUDE(ReadAt,DeliveryStatus,CommunityId,EntityId)');
UPDATE dbo.NotificationPreferences SET CommunityPosts='ON' WHERE CommunityPosts='DAILY';

COMMIT TRANSACTION;
