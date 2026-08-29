IF COL_LENGTH('dbo.Users', 'CoverImage') IS NULL
  ALTER TABLE dbo.Users ADD CoverImage NVARCHAR(1000) NULL;
