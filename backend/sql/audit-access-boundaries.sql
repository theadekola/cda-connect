SET XACT_ABORT ON;

GO

CREATE OR ALTER VIEW dbo.AuditUsers
AS
 SELECT u.AuditId AS UserId,u.AccountStatus,u.IsSuperAdmin,u.IsProtectedAccount,u.EmailVerified,u.PhoneVerified,u.CreatedAt,u.UpdatedAt
 FROM dbo.Users u;

GO

CREATE OR ALTER VIEW dbo.AuditUserPII
AS
 SELECT u.AuditId AS UserId,u.Id AS InternalId,u.FirstName,u.LastName,u.Email,u.Phone,u.Country,u.State,u.LGA,u.Postcode,u.Address,u.DateOfBirth
 FROM dbo.Users u;

GO

CREATE OR ALTER VIEW dbo.AuditSecurity
AS
 SELECT s.Id AS SessionId,u.AuditId AS UserId,s.CreatedAt,s.ExpiresAt,s.RevokedAt,s.RotatedAt,s.ReauthenticatedAt,
  CASE WHEN s.TrustedName IS NULL THEN CAST(0 AS BIT) ELSE CAST(1 AS BIT) END IsTrusted
 FROM dbo.UserSessions s
 JOIN dbo.Users u ON u.Id=s.UserId;

GO

IF DATABASE_PRINCIPAL_ID('cda_platform_audit_reader') IS NULL CREATE ROLE cda_platform_audit_reader AUTHORIZATION dbo;
IF DATABASE_PRINCIPAL_ID('cda_user_pii_reader') IS NULL CREATE ROLE cda_user_pii_reader AUTHORIZATION dbo;
IF DATABASE_PRINCIPAL_ID('cda_finance_audit_reader') IS NULL CREATE ROLE cda_finance_audit_reader AUTHORIZATION dbo;
IF DATABASE_PRINCIPAL_ID('cda_security_audit_reader') IS NULL CREATE ROLE cda_security_audit_reader AUTHORIZATION dbo;

REVOKE SELECT ON dbo.AuditContributions FROM cda_audit_reader;
GRANT SELECT ON dbo.AuditUsers TO cda_audit_reader;
GRANT SELECT ON dbo.AuditCommunities TO cda_audit_reader;
GRANT SELECT ON dbo.AuditUsers TO cda_platform_audit_reader;
GRANT SELECT ON dbo.AuditCommunities TO cda_platform_audit_reader;
GRANT SELECT ON dbo.AuditUserPII TO cda_user_pii_reader;
GRANT SELECT ON dbo.AuditContributions TO cda_finance_audit_reader;
GRANT SELECT ON dbo.AuditSecurity TO cda_security_audit_reader;
