SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name='UQ_CommunityExecutiveMembers_Community_User' AND parent_object_id=OBJECT_ID('dbo.CommunityExecutiveMembers'))
  ALTER TABLE dbo.CommunityExecutiveMembers DROP CONSTRAINT UQ_CommunityExecutiveMembers_Community_User;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_CommunityExecutiveMembers_Active_User' AND object_id=OBJECT_ID('dbo.CommunityExecutiveMembers'))
  CREATE UNIQUE INDEX UX_CommunityExecutiveMembers_Active_User ON dbo.CommunityExecutiveMembers(CommunityId,UserId) WHERE Status='ACTIVE';

COMMIT TRANSACTION;
