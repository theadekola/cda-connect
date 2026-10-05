IF OBJECT_ID('dbo.CommunityExecutiveMembers','U') IS NULL
BEGIN
  CREATE TABLE dbo.CommunityExecutiveMembers(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CommunityExecutiveMembers PRIMARY KEY DEFAULT NEWID(), CommunityId UNIQUEIDENTIFIER NOT NULL, UserId UNIQUEIDENTIFIER NOT NULL,
    Position NVARCHAR(100) NOT NULL, Department NVARCHAR(150) NULL, AppointedDate DATE NOT NULL, TenureEndDate DATE NULL, Notes NVARCHAR(500) NULL,
    Status NVARCHAR(20) NOT NULL CONSTRAINT DF_CommunityExecutiveMembers_Status DEFAULT 'ACTIVE', CreatedBy UNIQUEIDENTIFIER NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_CommunityExecutiveMembers_CreatedAt DEFAULT SYSUTCDATETIME(), UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_CommunityExecutiveMembers_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_CommunityExecutiveMembers_Community FOREIGN KEY(CommunityId) REFERENCES dbo.Communities(Id), CONSTRAINT FK_CommunityExecutiveMembers_User FOREIGN KEY(UserId) REFERENCES dbo.Users(Id),
    CONSTRAINT FK_CommunityExecutiveMembers_CreatedBy FOREIGN KEY(CreatedBy) REFERENCES dbo.Users(Id),
    CONSTRAINT CK_CommunityExecutiveMembers_Status CHECK(Status IN('ACTIVE','INACTIVE'))
  );
END;
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_CommunityExecutiveMembers_Active_User' AND object_id=OBJECT_ID('dbo.CommunityExecutiveMembers'))
  CREATE UNIQUE INDEX UX_CommunityExecutiveMembers_Active_User ON dbo.CommunityExecutiveMembers(CommunityId,UserId) WHERE Status='ACTIVE';
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_CommunityExecutiveMembers_Community_Status' AND object_id=OBJECT_ID('dbo.CommunityExecutiveMembers'))
  CREATE INDEX IX_CommunityExecutiveMembers_Community_Status ON dbo.CommunityExecutiveMembers(CommunityId,Status,Position) INCLUDE(UserId,Department,AppointedDate,TenureEndDate);
GO
