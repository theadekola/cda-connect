-- Run once on the existing CDAConnect database before deploying this update.
IF COL_LENGTH('Users','LoginAlerts') IS NULL
 ALTER TABLE Users ADD LoginAlerts BIT NOT NULL CONSTRAINT DF_Users_LoginAlerts DEFAULT 0;
IF COL_LENGTH('Users','PasswordChangedAt') IS NULL
 ALTER TABLE Users ADD PasswordChangedAt DATETIME2 NULL;
IF COL_LENGTH('Users','LastLoginAlertAt') IS NULL
 ALTER TABLE Users ADD LastLoginAlertAt DATETIME2 NULL;
IF COL_LENGTH('Users','LastLoginAlertStatus') IS NULL
 ALTER TABLE Users ADD LastLoginAlertStatus NVARCHAR(20) NULL;
