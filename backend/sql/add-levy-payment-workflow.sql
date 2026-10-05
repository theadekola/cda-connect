/* CDA Connect levy assignment, payment evidence and approval workflow. */
IF COL_LENGTH('MemberDuesPlans','Description') IS NULL ALTER TABLE MemberDuesPlans ADD Description NVARCHAR(2000) NULL;
IF COL_LENGTH('MemberDuesPlans','Frequency') IS NULL ALTER TABLE MemberDuesPlans ADD Frequency NVARCHAR(30) NOT NULL CONSTRAINT DF_MemberDuesPlans_Frequency DEFAULT 'ONE_TIME';
IF COL_LENGTH('MemberDuesPlans','AudienceType') IS NULL ALTER TABLE MemberDuesPlans ADD AudienceType NVARCHAR(20) NOT NULL CONSTRAINT DF_MemberDuesPlans_Audience DEFAULT 'ALL';
GO
IF OBJECT_ID('LevyPaymentSubmissions','U') IS NULL
CREATE TABLE LevyPaymentSubmissions(Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),LedgerId UNIQUEIDENTIFIER NOT NULL,CommunityId UNIQUEIDENTIFIER NOT NULL,UserId UNIQUEIDENTIFIER NOT NULL,Amount DECIMAL(18,2) NOT NULL,PaymentMethod NVARCHAR(30) NOT NULL DEFAULT 'BANK_TRANSFER',Reference NVARCHAR(120) NOT NULL,EvidenceUrl NVARCHAR(1000) NOT NULL,Note NVARCHAR(2000) NULL,Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',ReviewedBy UNIQUEIDENTIFIER NULL,ReviewedAt DATETIME2 NULL,ReviewNote NVARCHAR(2000) NULL,SubmittedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),FOREIGN KEY(LedgerId) REFERENCES MemberDuesLedger(Id),FOREIGN KEY(CommunityId) REFERENCES Communities(Id),FOREIGN KEY(UserId) REFERENCES Users(Id),FOREIGN KEY(ReviewedBy) REFERENCES Users(Id),CONSTRAINT CK_LevyPayment_Method CHECK(PaymentMethod='BANK_TRANSFER'),CONSTRAINT CK_LevyPayment_Status CHECK(Status IN('PENDING','APPROVED','REJECTED')));
GO
IF NOT EXISTS(SELECT 1 FROM RolePermissions rp JOIN Roles r ON r.Id=rp.RoleId JOIN Permissions p ON p.Id=rp.PermissionId WHERE r.Name='Moderator' AND p.Code='FINANCE_MANAGE') INSERT INTO RolePermissions(RoleId,PermissionId) SELECT r.Id,p.Id FROM Roles r CROSS JOIN Permissions p WHERE r.Name='Moderator' AND p.Code='FINANCE_MANAGE';
GO
