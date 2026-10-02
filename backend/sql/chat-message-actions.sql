IF OBJECT_ID('MessagePreferences','U') IS NULL
CREATE TABLE MessagePreferences(
 MessageId UNIQUEIDENTIFIER NOT NULL REFERENCES Messages(Id),
 UserId UNIQUEIDENTIFIER NOT NULL REFERENCES Users(Id),
 IsStarred BIT NOT NULL DEFAULT 0,
 IsHidden BIT NOT NULL DEFAULT 0,
 Note NVARCHAR(2000) NULL,
 PRIMARY KEY(MessageId,UserId)
);
IF OBJECT_ID('MessageReactions','U') IS NULL
CREATE TABLE MessageReactions(
 MessageId UNIQUEIDENTIFIER NOT NULL REFERENCES Messages(Id),
 UserId UNIQUEIDENTIFIER NOT NULL REFERENCES Users(Id),
 Emoji NVARCHAR(16) NOT NULL,
 PRIMARY KEY(MessageId,UserId)
);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_MessagePreferences_User' AND object_id=OBJECT_ID('MessagePreferences'))
 CREATE INDEX IX_MessagePreferences_User ON MessagePreferences(UserId,IsStarred) INCLUDE(MessageId,Note,IsHidden);

IF COL_LENGTH('Messages','ForwardedFromMessageId') IS NULL
 ALTER TABLE Messages ADD ForwardedFromMessageId UNIQUEIDENTIFIER NULL REFERENCES Messages(Id);
