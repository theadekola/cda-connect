USE CDAConnect;
GO
IF OBJECT_ID('dbo.LanguagePreferences','U') IS NULL
 CREATE TABLE dbo.LanguagePreferences(UserId uniqueidentifier NOT NULL PRIMARY KEY REFERENCES dbo.Users(Id),AppLanguage nvarchar(20) NOT NULL DEFAULT 'en-GB',TranslationLanguage nvarchar(20) NOT NULL DEFAULT 'en-GB',TranslatePosts bit NOT NULL DEFAULT 0,TranslateMessages bit NOT NULL DEFAULT 0,UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
GO
