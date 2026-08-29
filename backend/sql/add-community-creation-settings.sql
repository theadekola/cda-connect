IF COL_LENGTH('dbo.Communities','State') IS NULL ALTER TABLE dbo.Communities ADD State NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Communities','LGA') IS NULL ALTER TABLE dbo.Communities ADD LGA NVARCHAR(150) NULL;
IF COL_LENGTH('dbo.Communities','SpecificArea') IS NULL ALTER TABLE dbo.Communities ADD SpecificArea NVARCHAR(250) NULL;
IF COL_LENGTH('dbo.Communities','Latitude') IS NULL ALTER TABLE dbo.Communities ADD Latitude DECIMAL(10,7) NULL;
IF COL_LENGTH('dbo.Communities','Longitude') IS NULL ALTER TABLE dbo.Communities ADD Longitude DECIMAL(10,7) NULL;
IF COL_LENGTH('dbo.Communities','RequireMemberApproval') IS NULL ALTER TABLE dbo.Communities ADD RequireMemberApproval BIT NOT NULL CONSTRAINT DF_Communities_RequireMemberApproval DEFAULT 1;
IF COL_LENGTH('dbo.Communities','AllowMemberEvents') IS NULL ALTER TABLE dbo.Communities ADD AllowMemberEvents BIT NOT NULL CONSTRAINT DF_Communities_AllowMemberEvents DEFAULT 1;
IF COL_LENGTH('dbo.Communities','AllowMemberDiscussions') IS NULL ALTER TABLE dbo.Communities ADD AllowMemberDiscussions BIT NOT NULL CONSTRAINT DF_Communities_AllowMemberDiscussions DEFAULT 1;
IF COL_LENGTH('dbo.Communities','Guidelines') IS NULL ALTER TABLE dbo.Communities ADD Guidelines NVARCHAR(2000) NULL;
IF COL_LENGTH('dbo.Communities','Tags') IS NULL ALTER TABLE dbo.Communities ADD Tags NVARCHAR(1000) NULL;
GO
