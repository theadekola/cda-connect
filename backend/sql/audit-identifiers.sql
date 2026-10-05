SET XACT_ABORT ON;

IF OBJECT_ID('dbo.Users','U') IS NULL OR OBJECT_ID('dbo.Communities','U') IS NULL OR OBJECT_ID('dbo.LevyPaymentSubmissions','U') IS NULL
 THROW 51000,'Required audit identifier tables are missing',1;

IF COL_LENGTH('dbo.Users','AuditId') IS NULL
 ALTER TABLE dbo.Users ADD AuditId BIGINT IDENTITY(1,1) NOT NULL;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.Users') AND name='UX_Users_AuditId')
 CREATE UNIQUE NONCLUSTERED INDEX UX_Users_AuditId ON dbo.Users(AuditId);

IF COL_LENGTH('dbo.Communities','AuditId') IS NULL
 ALTER TABLE dbo.Communities ADD AuditId BIGINT IDENTITY(1,1) NOT NULL;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.Communities') AND name='UX_Communities_AuditId')
 CREATE UNIQUE NONCLUSTERED INDEX UX_Communities_AuditId ON dbo.Communities(AuditId);

IF COL_LENGTH('dbo.LevyPaymentSubmissions','AuditId') IS NULL
 ALTER TABLE dbo.LevyPaymentSubmissions ADD AuditId BIGINT IDENTITY(1,1) NOT NULL;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.LevyPaymentSubmissions') AND name='UX_LevyPaymentSubmissions_AuditId')
 CREATE UNIQUE NONCLUSTERED INDEX UX_LevyPaymentSubmissions_AuditId ON dbo.LevyPaymentSubmissions(AuditId);

GO

CREATE OR ALTER VIEW dbo.AuditUsers
AS
 SELECT u.AuditId AS UserId,u.Id AS InternalId,u.FirstName,u.LastName,u.Email,u.Phone,u.Country,u.State,u.LGA,u.Postcode,u.Address,u.DateOfBirth,u.AccountStatus,u.EmailVerified,u.PhoneVerified,u.CreatedAt,u.UpdatedAt
 FROM dbo.Users u;

GO

CREATE OR ALTER VIEW dbo.AuditCommunities
AS
 SELECT c.AuditId AS CommunityId,c.Id AS InternalId,c.Name,c.Description,c.CommunityType,c.Country,c.City,c.IsPrivate,owner.AuditId AS OwnerUserId,c.CreatedAt
 FROM dbo.Communities c
 JOIN dbo.Users owner ON owner.Id=c.OwnerUserId;

GO

CREATE OR ALTER VIEW dbo.AuditContributions
AS
 SELECT payment.AuditId AS ContributionId,payment.Id AS InternalId,community.AuditId AS CommunityId,member.AuditId AS UserId,payment.Amount,payment.PaymentMethod,payment.Reference,payment.Status,reviewer.AuditId AS ReviewedBy,payment.ReviewedAt,payment.SubmittedAt
 FROM dbo.LevyPaymentSubmissions payment
 JOIN dbo.Communities community ON community.Id=payment.CommunityId
 JOIN dbo.Users member ON member.Id=payment.UserId
 LEFT JOIN dbo.Users reviewer ON reviewer.Id=payment.ReviewedBy;

GO

IF DATABASE_PRINCIPAL_ID('cda_audit_reader') IS NULL
 CREATE ROLE cda_audit_reader AUTHORIZATION dbo;
GRANT SELECT ON dbo.AuditUsers TO cda_audit_reader;
GRANT SELECT ON dbo.AuditCommunities TO cda_audit_reader;
GRANT SELECT ON dbo.AuditContributions TO cda_audit_reader;
