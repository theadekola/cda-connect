IF COL_LENGTH('dbo.Users', 'Country') IS NULL ALTER TABLE dbo.Users ADD Country NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Users', 'State') IS NULL ALTER TABLE dbo.Users ADD State NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Users', 'LGA') IS NULL ALTER TABLE dbo.Users ADD LGA NVARCHAR(150) NULL;
IF COL_LENGTH('dbo.Users', 'Address') IS NULL ALTER TABLE dbo.Users ADD Address NVARCHAR(500) NULL;
IF COL_LENGTH('dbo.Users', 'DateOfBirth') IS NULL ALTER TABLE dbo.Users ADD DateOfBirth DATE NULL;
IF COL_LENGTH('dbo.Users', 'Postcode') IS NULL ALTER TABLE dbo.Users ADD Postcode NVARCHAR(30) NULL;
