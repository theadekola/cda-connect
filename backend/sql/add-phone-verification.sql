IF OBJECT_ID('PhoneVerificationCodes','U') IS NULL
BEGIN
  CREATE TABLE PhoneVerificationCodes(
    Phone NVARCHAR(30) NOT NULL PRIMARY KEY,
    CodeHash NVARCHAR(64) NOT NULL,
    Attempts TINYINT NOT NULL DEFAULT 0,
    SentAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ExpiresAt DATETIME2 NOT NULL,
    ConsumedAt DATETIME2 NULL
  );
  CREATE INDEX IX_PhoneVerificationCodes_Expiry ON PhoneVerificationCodes(ExpiresAt) INCLUDE(ConsumedAt);
END;
