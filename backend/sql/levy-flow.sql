-- Apply as database administrator in the configured application database.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID('dbo.MemberDuesPlans','U') IS NULL OR OBJECT_ID('dbo.MemberDuesLedger','U') IS NULL OR OBJECT_ID('dbo.LevyPaymentSubmissions','U') IS NULL
 THROW 50001,'Base finance tables are missing. Check the selected database.',1;
IF COL_LENGTH('dbo.MemberDuesPlans','AllowPartial') IS NULL ALTER TABLE dbo.MemberDuesPlans ADD AllowPartial bit NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.MemberDuesPlans','LatePenalty') IS NULL ALTER TABLE dbo.MemberDuesPlans ADD LatePenalty decimal(18,2) NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.MemberDuesPlans','DueDay') IS NULL ALTER TABLE dbo.MemberDuesPlans ADD DueDay int NULL;
IF COL_LENGTH('dbo.MemberDuesLedger','CycleDate') IS NULL ALTER TABLE dbo.MemberDuesLedger ADD CycleDate date NULL;
IF COL_LENGTH('dbo.MemberDuesLedger','PenaltyApplied') IS NULL ALTER TABLE dbo.MemberDuesLedger ADD PenaltyApplied decimal(18,2) NOT NULL DEFAULT 0;
IF OBJECT_ID('dbo.CommunityPaymentAccounts','U') IS NULL CREATE TABLE dbo.CommunityPaymentAccounts(CommunityId uniqueidentifier PRIMARY KEY REFERENCES dbo.Communities(Id),BankName nvarchar(150) NOT NULL,AccountName nvarchar(200) NOT NULL,AccountNumber nvarchar(50) NOT NULL,Instructions nvarchar(1000) NULL,UpdatedBy uniqueidentifier NOT NULL REFERENCES dbo.Users(Id),UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
COMMIT;
GO
UPDATE l SET CycleDate=COALESCE(p.DueDate,DATEFROMPARTS(p.Year,1,1)) FROM dbo.MemberDuesLedger l JOIN dbo.MemberDuesPlans p ON p.Id=l.PlanId WHERE l.CycleDate IS NULL;
IF EXISTS(SELECT 1 FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID('dbo.MemberDuesLedger') AND name='UQ_Dues_UserPlan') ALTER TABLE dbo.MemberDuesLedger DROP CONSTRAINT UQ_Dues_UserPlan;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.MemberDuesLedger') AND name='UX_Dues_Cycle') CREATE UNIQUE INDEX UX_Dues_Cycle ON dbo.MemberDuesLedger(PlanId,UserId,CycleDate);
GO
