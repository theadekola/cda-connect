IF COL_LENGTH('Meetings','AllowRegistration') IS NULL
  ALTER TABLE Meetings ADD AllowRegistration BIT NOT NULL CONSTRAINT DF_Meetings_AllowRegistration DEFAULT 1;
GO
IF COL_LENGTH('Meetings','AllowCalendar') IS NULL
  ALTER TABLE Meetings ADD AllowCalendar BIT NOT NULL CONSTRAINT DF_Meetings_AllowCalendar DEFAULT 1;
GO
