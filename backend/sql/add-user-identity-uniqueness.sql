SET NOCOUNT ON;

IF COL_LENGTH('dbo.Users', 'Country') IS NULL ALTER TABLE dbo.Users ADD Country NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Users', 'State') IS NULL ALTER TABLE dbo.Users ADD State NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Users', 'LGA') IS NULL ALTER TABLE dbo.Users ADD LGA NVARCHAR(150) NULL;
IF COL_LENGTH('dbo.Users', 'Postcode') IS NULL ALTER TABLE dbo.Users ADD Postcode NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.Users', 'Address') IS NULL ALTER TABLE dbo.Users ADD Address NVARCHAR(500) NULL;
IF COL_LENGTH('dbo.Users', 'DateOfBirth') IS NULL ALTER TABLE dbo.Users ADD DateOfBirth DATE NULL;
IF COL_LENGTH('dbo.Users', 'PhoneVerified') IS NULL ALTER TABLE dbo.Users ADD PhoneVerified BIT NOT NULL DEFAULT (0);

IF EXISTS(SELECT LOWER(LTRIM(RTRIM(Email))) FROM dbo.Users GROUP BY LOWER(LTRIM(RTRIM(Email))) HAVING COUNT(*)>1)
  THROW 51001, 'Duplicate email addresses exist in Users. Resolve them before applying identity uniqueness.', 1;

IF EXISTS(SELECT LTRIM(RTRIM(Phone)) FROM dbo.Users WHERE Phone IS NOT NULL AND LTRIM(RTRIM(Phone))<>'' GROUP BY LTRIM(RTRIM(Phone)) HAVING COUNT(*)>1)
  THROW 51002, 'Duplicate phone numbers exist in Users. Resolve them before applying identity uniqueness.', 1;

UPDATE dbo.Users SET Email=LOWER(LTRIM(RTRIM(Email))) WHERE Email<>LOWER(LTRIM(RTRIM(Email)));
UPDATE dbo.Users SET Phone=NULLIF(LTRIM(RTRIM(Phone)), N'') WHERE Phone IS NOT NULL AND Phone<>LTRIM(RTRIM(Phone));

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.Users') AND name='UX_Users_Phone')
  CREATE UNIQUE INDEX UX_Users_Phone ON dbo.Users(Phone) WHERE Phone IS NOT NULL;
