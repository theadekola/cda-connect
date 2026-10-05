USE CDAConnect;
GO
IF OBJECT_ID('dbo.MessageReactions','U') IS NULL
 CREATE TABLE dbo.MessageReactions(MessageId uniqueidentifier NOT NULL REFERENCES dbo.Messages(Id),UserId uniqueidentifier NOT NULL REFERENCES dbo.Users(Id),Reaction nvarchar(16) NOT NULL,CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),CONSTRAINT PK_MessageReactions PRIMARY KEY(MessageId,UserId));
IF OBJECT_ID('dbo.StarredMessages','U') IS NULL
 CREATE TABLE dbo.StarredMessages(MessageId uniqueidentifier NOT NULL REFERENCES dbo.Messages(Id),UserId uniqueidentifier NOT NULL REFERENCES dbo.Users(Id),CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),CONSTRAINT PK_StarredMessages PRIMARY KEY(MessageId,UserId));
IF OBJECT_ID('dbo.MessageNotes','U') IS NULL
 CREATE TABLE dbo.MessageNotes(MessageId uniqueidentifier NOT NULL REFERENCES dbo.Messages(Id),UserId uniqueidentifier NOT NULL REFERENCES dbo.Users(Id),Note nvarchar(2000) NOT NULL,CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),CONSTRAINT PK_MessageNotes PRIMARY KEY(MessageId,UserId));
IF OBJECT_ID('dbo.MessageReports','U') IS NULL
BEGIN
 CREATE TABLE dbo.MessageReports(Id uniqueidentifier NOT NULL DEFAULT NEWID() PRIMARY KEY,MessageId uniqueidentifier NOT NULL REFERENCES dbo.Messages(Id),ConversationId uniqueidentifier NOT NULL REFERENCES dbo.Conversations(Id),CommunityId uniqueidentifier NOT NULL REFERENCES dbo.Communities(Id),ReportedBy uniqueidentifier NOT NULL REFERENCES dbo.Users(Id),Reason nvarchar(40) NOT NULL,Details nvarchar(2000) NOT NULL,Status nvarchar(30) NOT NULL DEFAULT 'OPEN',CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),CONSTRAINT UQ_MessageReports_Message_Reporter UNIQUE(MessageId,ReportedBy));
 CREATE INDEX IX_MessageReports_Community_Status ON dbo.MessageReports(CommunityId,Status,CreatedAt DESC);
END;
GO
