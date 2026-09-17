SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID('dbo.NotificationDeliveries','U') IS NULL
CREATE TABLE dbo.NotificationDeliveries(
 NotificationId UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.NotificationOutbox(NotificationId),
 UserId UNIQUEIDENTIFIER NOT NULL,Channel VARCHAR(20) NOT NULL,DestinationHash CHAR(64) NOT NULL,
 JobId VARCHAR(200) NULL,Status VARCHAR(20) NOT NULL,Reason NVARCHAR(2000) NULL,ProviderMessageId NVARCHAR(250) NULL,
 UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT PK_NotificationDeliveries PRIMARY KEY(NotificationId,UserId,Channel,DestinationHash),
 CONSTRAINT CK_NotificationDeliveries_Status CHECK(Status IN('QUEUED','PROCESSING','SENT','FAILED','SKIPPED','MUTED','NO_DEVICE','UNKNOWN'))
);
IF COL_LENGTH('NotificationDeliveries','JobId') IS NULL ALTER TABLE NotificationDeliveries ADD JobId VARCHAR(200) NULL;
IF COL_LENGTH('NotificationOutbox','ExpectedCount') IS NULL ALTER TABLE NotificationOutbox ADD ExpectedCount INT NOT NULL DEFAULT 0,TerminalCount INT NOT NULL DEFAULT 0,DispatchComplete BIT NOT NULL DEFAULT 0,CompletionReason NVARCHAR(200) NULL,UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();
IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_EmergencyNotificationDeliveries_Status') ALTER TABLE dbo.EmergencyNotificationDeliveries DROP CONSTRAINT CK_EmergencyNotificationDeliveries_Status;
ALTER TABLE dbo.EmergencyNotificationDeliveries ADD CONSTRAINT CK_EmergencyNotificationDeliveries_Status CHECK(Status IN('PENDING','PROCESSING','SENT','FAILED','UNKNOWN','SKIPPED'));
IF COL_LENGTH('EmergencyNotificationDeliveries','UpdatedAt') IS NULL ALTER TABLE dbo.EmergencyNotificationDeliveries ADD UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();
-- Do not silently rewrite historical votes. Fail deployment if existing records need investigation.
IF EXISTS(SELECT 1 FROM FormalBallotVotes v LEFT JOIN FormalBallotOptions o ON o.Id=v.OptionId AND o.BallotId=v.BallotId WHERE o.Id IS NULL) THROW 51000,'Invalid historical ballot option associations require administrator review',1;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UQ_FormalBallotOptions_Ballot_Id' AND object_id=OBJECT_ID('FormalBallotOptions')) CREATE UNIQUE INDEX UQ_FormalBallotOptions_Ballot_Id ON FormalBallotOptions(BallotId,Id);
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_FormalBallotVotes_BallotOption') ALTER TABLE FormalBallotVotes ADD CONSTRAINT FK_FormalBallotVotes_BallotOption FOREIGN KEY(BallotId,OptionId) REFERENCES FormalBallotOptions(BallotId,Id);
COMMIT TRANSACTION;
