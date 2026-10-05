SET NOCOUNT ON;
IF COL_LENGTH('dbo.MarketplaceListings','ItemCondition') IS NULL ALTER TABLE dbo.MarketplaceListings ADD ItemCondition NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.MarketplaceListings','DeliveryOption') IS NULL ALTER TABLE dbo.MarketplaceListings ADD DeliveryOption NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.MarketplaceListings','ContactPreference') IS NULL ALTER TABLE dbo.MarketplaceListings ADD ContactPreference NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.MarketplaceListings','IsNegotiable') IS NULL ALTER TABLE dbo.MarketplaceListings ADD IsNegotiable BIT NOT NULL CONSTRAINT DF_MarketplaceListings_IsNegotiable DEFAULT 0;
IF OBJECT_ID('dbo.SavedMarketplaceListings','U') IS NULL
BEGIN
 CREATE TABLE dbo.SavedMarketplaceListings(
  ListingId UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.MarketplaceListings(Id) ON DELETE CASCADE,
  UserId UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.Users(Id),
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_SavedMarketplaceListings PRIMARY KEY(ListingId,UserId)
 );
END;
IF OBJECT_ID('dbo.MarketplaceListingImages','U') IS NULL
BEGIN
 CREATE TABLE dbo.MarketplaceListingImages(
  Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  ListingId UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.MarketplaceListings(Id) ON DELETE CASCADE,
  ImageUrl NVARCHAR(1000) NOT NULL,
  Position INT NOT NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_MarketplaceListingImages_Position UNIQUE(ListingId,Position)
 );
END;
