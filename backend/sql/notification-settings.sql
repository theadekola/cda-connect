USE CDAConnect;
GO
IF COL_LENGTH('dbo.NotificationPreferences','Enabled') IS NULL
 ALTER TABLE dbo.NotificationPreferences ADD Enabled bit NOT NULL CONSTRAINT DF_NotificationPreferences_Enabled DEFAULT(1) WITH VALUES;
GO
IF COL_LENGTH('dbo.NotificationPreferences','CommunityUpdates') IS NULL
 ALTER TABLE dbo.NotificationPreferences ADD CommunityUpdates bit NOT NULL CONSTRAINT DF_NotificationPreferences_CommunityUpdates DEFAULT(1) WITH VALUES;
GO
IF COL_LENGTH('dbo.NotificationPreferences','Comments') IS NULL
 ALTER TABLE dbo.NotificationPreferences ADD Comments bit NOT NULL CONSTRAINT DF_NotificationPreferences_Comments DEFAULT(1) WITH VALUES;
GO
IF COL_LENGTH('dbo.NotificationPreferences','Invitations') IS NULL
 ALTER TABLE dbo.NotificationPreferences ADD Invitations bit NOT NULL CONSTRAINT DF_NotificationPreferences_Invitations DEFAULT(1) WITH VALUES;
GO
IF COL_LENGTH('dbo.NotificationPreferences','EmergencyEnabled') IS NULL
 ALTER TABLE dbo.NotificationPreferences ADD EmergencyEnabled bit NOT NULL CONSTRAINT DF_NotificationPreferences_EmergencyEnabled DEFAULT(1) WITH VALUES;
GO
