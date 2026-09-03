SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name='UQ_CommunityExecutiveMembers_Community_User' AND parent_object_id=OBJECT_ID('dbo.CommunityExecutiveMembers'))
  ALTER TABLE dbo.CommunityExecutiveMembers DROP CONSTRAINT UQ_CommunityExecutiveMembers_Community_User;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_CommunityExecutiveMembers_Active_User' AND object_id=OBJECT_ID('dbo.CommunityExecutiveMembers'))
  CREATE UNIQUE INDEX UX_CommunityExecutiveMembers_Active_User ON dbo.CommunityExecutiveMembers(CommunityId,UserId) WHERE Status='ACTIVE';

DECLARE @membershipConstraint sysname;
DECLARE @dropConstraintSql nvarchar(max);
SELECT @membershipConstraint=kc.name
FROM sys.key_constraints kc
JOIN sys.index_columns ic ON ic.object_id=kc.parent_object_id AND ic.index_id=kc.unique_index_id
JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
WHERE kc.parent_object_id=OBJECT_ID('dbo.MembershipCards') AND kc.type='UQ' AND c.name='MembershipId';
IF @membershipConstraint IS NOT NULL
BEGIN
  SET @dropConstraintSql=N'ALTER TABLE dbo.MembershipCards DROP CONSTRAINT '+QUOTENAME(@membershipConstraint)+N';';
  EXEC sys.sp_executesql @dropConstraintSql;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_MembershipCards_Active_Membership' AND object_id=OBJECT_ID('dbo.MembershipCards'))
  CREATE UNIQUE INDEX UX_MembershipCards_Active_Membership ON dbo.MembershipCards(MembershipId) WHERE IsActive=1;

COMMIT TRANSACTION;
