SET XACT_ABORT ON;
BEGIN TRANSACTION;
INSERT INTO Permissions(Code,Description)
SELECT v.Code,v.Description FROM (VALUES
('PAYMENT_REVIEW','View submissions and unpaid members; approve or decline payments'),
('PAYMENT_EVIDENCE_VIEW','Inspect community payment evidence'),
('LEVY_MANAGE','Create and manage levy plans'),
('FINANCE_MANAGE','Create manual finance transactions'),
('FINANCE_VIEW','View the full community finance summary'),
('BANK_ACCOUNT_MANAGE','Change community bank transfer details')
)v(Code,Description) WHERE NOT EXISTS(SELECT 1 FROM Permissions p WITH(UPDLOCK,HOLDLOCK) WHERE p.Code=v.Code);
-- No blanket grants: the application checks owner/admin, current EXCO positions,
-- or explicit RolePermissions assigned through community role management.
COMMIT;
