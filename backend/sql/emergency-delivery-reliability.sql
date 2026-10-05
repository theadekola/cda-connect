SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.EmergencyNotificationDeliveries','U') IS NULL
BEGIN
  CREATE TABLE dbo.EmergencyNotificationDeliveries(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_EmergencyNotificationDeliveries PRIMARY KEY DEFAULT NEWID(),
    AlertId UNIQUEIDENTIFIER NOT NULL,
    UserId UNIQUEIDENTIFIER NOT NULL,
    Channel NVARCHAR(20) NOT NULL,
    DestinationHash CHAR(64) NOT NULL,
    Status NVARCHAR(30) NOT NULL CONSTRAINT DF_EmergencyNotificationDeliveries_Status DEFAULT 'PENDING',
    AttemptCount INT NOT NULL CONSTRAINT DF_EmergencyNotificationDeliveries_Attempts DEFAULT 0,
    LastError NVARCHAR(2000) NULL,
    ProviderMessageId NVARCHAR(250) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_EmergencyNotificationDeliveries_Created DEFAULT SYSUTCDATETIME(),
    SentAt DATETIME2 NULL,
    CONSTRAINT FK_EmergencyNotificationDeliveries_Alert FOREIGN KEY(AlertId) REFERENCES dbo.EmergencyAlerts(Id),
    CONSTRAINT FK_EmergencyNotificationDeliveries_User FOREIGN KEY(UserId) REFERENCES dbo.Users(Id),
    CONSTRAINT CK_EmergencyNotificationDeliveries_Channel CHECK(Channel IN('PUSH','EMAIL')),
    CONSTRAINT CK_EmergencyNotificationDeliveries_Status CHECK(Status IN('PENDING','PROCESSING','SENT','FAILED')),
    CONSTRAINT UQ_EmergencyNotificationDeliveries_Target UNIQUE(AlertId,UserId,Channel,DestinationHash)
  );
END;

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_EmergencyDeliveries_Status' AND object_id=OBJECT_ID('dbo.EmergencyNotificationDeliveries'))
  CREATE INDEX IX_EmergencyDeliveries_Status ON dbo.EmergencyNotificationDeliveries(Status,CreatedAt) INCLUDE(AlertId,UserId,Channel,AttemptCount);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_AsyncJobAudit_EmergencyJob' AND object_id=OBJECT_ID('dbo.AsyncJobAudit'))
  CREATE UNIQUE INDEX UX_AsyncJobAudit_EmergencyJob ON dbo.AsyncJobAudit(QueueName,JobKey) WHERE QueueName='emergency-broadcasts';

COMMIT TRANSACTION;
