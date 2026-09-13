-- Meeting wizard preferences. Existing meetings retain community-wide access.
IF COL_LENGTH('Meetings','SettingsJson') IS NULL ALTER TABLE Meetings ADD SettingsJson nvarchar(max) NULL;
GO
IF OBJECT_ID('MeetingContributions','U') IS NULL
CREATE TABLE MeetingContributions(Id uniqueidentifier NOT NULL DEFAULT NEWID() PRIMARY KEY,MeetingId uniqueidentifier NOT NULL REFERENCES Meetings(Id),UserId uniqueidentifier NOT NULL REFERENCES Users(Id),Kind nvarchar(20) NOT NULL,Body nvarchar(3000) NOT NULL,CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
GO
IF OBJECT_ID('MeetingAgendaVotes','U') IS NULL
CREATE TABLE MeetingAgendaVotes(AgendaId uniqueidentifier NOT NULL REFERENCES MeetingAgendaItems(Id),UserId uniqueidentifier NOT NULL REFERENCES Users(Id),Choice nvarchar(10) NOT NULL,PRIMARY KEY(AgendaId,UserId));
GO
CREATE OR ALTER FUNCTION dbo.CanViewMeeting(@meeting uniqueidentifier,@user uniqueidentifier)
RETURNS bit AS BEGIN
 DECLARE @allowed bit=0;
 SELECT @allowed=1 FROM Meetings m JOIN CommunityMembers cm ON cm.CommunityId=m.CommunityId AND cm.UserId=@user AND cm.Status='ACTIVE'
 WHERE m.Id=@meeting AND (COALESCE(JSON_VALUE(m.SettingsJson,'$.visibility'),'MEMBERS')='MEMBERS' OR m.CreatedBy=@user OR EXISTS(SELECT 1 FROM Communities c WHERE c.Id=m.CommunityId AND c.OwnerUserId=@user) OR EXISTS(SELECT 1 FROM CommunityMemberRoles mr JOIN Roles r ON r.Id=mr.RoleId WHERE mr.CommunityMemberId=cm.Id AND r.Name IN ('Owner','Admin')));
 RETURN @allowed;
END;
GO

CREATE OR ALTER FUNCTION dbo.CanAttendMeeting(@meeting uniqueidentifier,@user uniqueidentifier)
RETURNS bit AS BEGIN
 DECLARE @allowed bit=0;
 SELECT @allowed=1 FROM Meetings m JOIN CommunityMembers cm ON cm.CommunityId=m.CommunityId AND cm.UserId=@user AND cm.Status='ACTIVE'
 WHERE m.Id=@meeting AND dbo.CanViewMeeting(@meeting,@user)=1 AND (COALESCE(JSON_VALUE(m.SettingsJson,'$.attendance'),'MEMBERS')='MEMBERS' OR m.CreatedBy=@user OR EXISTS(SELECT 1 FROM Communities c WHERE c.Id=m.CommunityId AND c.OwnerUserId=@user) OR EXISTS(SELECT 1 FROM CommunityMemberRoles mr JOIN Roles r ON r.Id=mr.RoleId WHERE mr.CommunityMemberId=cm.Id AND r.Name IN ('Owner','Admin')));
 RETURN @allowed;
END;
GO

IF COL_LENGTH('Meetings','CreateRequestId') IS NULL ALTER TABLE Meetings ADD CreateRequestId uniqueidentifier NULL;
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('Meetings') AND name='UX_Meetings_CreateRequest')
CREATE UNIQUE INDEX UX_Meetings_CreateRequest ON Meetings(CommunityId,CreatedBy,CreateRequestId) WHERE CreateRequestId IS NOT NULL;
GO
