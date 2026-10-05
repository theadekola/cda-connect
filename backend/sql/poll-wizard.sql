-- Run as a database administrator in the configured CDA Connect database.
-- Existing poll data is preserved. This does not grant schema-changing permissions.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID('dbo.Polls','U') IS NULL OR OBJECT_ID('dbo.PollOptions','U') IS NULL OR OBJECT_ID('dbo.PollVotes','U') IS NULL
 THROW 50001, 'Base poll tables are missing. Check the selected database and install the base app schema before this migration.', 1;
IF COL_LENGTH('dbo.Polls','SettingsJson') IS NULL ALTER TABLE dbo.Polls ADD SettingsJson nvarchar(max) NULL;
IF COL_LENGTH('dbo.Polls','CreateRequestId') IS NULL ALTER TABLE dbo.Polls ADD CreateRequestId uniqueidentifier NULL;
IF COL_LENGTH('dbo.PollVotes','OtherText') IS NULL ALTER TABLE dbo.PollVotes ADD OtherText nvarchar(500) NULL;
IF OBJECT_ID('dbo.PollComments','U') IS NULL
 CREATE TABLE dbo.PollComments(Id uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWID(),PollId uniqueidentifier NOT NULL REFERENCES dbo.Polls(Id) ON DELETE CASCADE,UserId uniqueidentifier NOT NULL REFERENCES dbo.Users(Id),Body nvarchar(2000) NOT NULL,CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
COMMIT TRANSACTION;
GO
