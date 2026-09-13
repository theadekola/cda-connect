IF COL_LENGTH('dbo.MarketplaceListings','Category') IS NULL ALTER TABLE dbo.MarketplaceListings ADD Category NVARCHAR(80) NOT NULL CONSTRAINT DF_Marketplace_Category DEFAULT 'Other';
