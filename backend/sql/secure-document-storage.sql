SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.StoredObjects','UploadState') IS NULL ALTER TABLE dbo.StoredObjects ADD UploadState NVARCHAR(30) NOT NULL CONSTRAINT DF_StoredObjects_UploadState DEFAULT 'AVAILABLE';
IF COL_LENGTH('dbo.StoredObjects','IsPrivate') IS NULL ALTER TABLE dbo.StoredObjects ADD IsPrivate BIT NOT NULL CONSTRAINT DF_StoredObjects_IsPrivate DEFAULT 0;
IF COL_LENGTH('dbo.StoredObjects','DeletedAt') IS NULL ALTER TABLE dbo.StoredObjects ADD DeletedAt DATETIME2 NULL;
IF COL_LENGTH('dbo.KnowledgeDocumentVersions','StoredObjectId') IS NULL ALTER TABLE dbo.KnowledgeDocumentVersions ADD StoredObjectId UNIQUEIDENTIFIER NULL;
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_KnowledgeDocumentVersions_StoredObject') EXEC(N'ALTER TABLE dbo.KnowledgeDocumentVersions ADD CONSTRAINT FK_KnowledgeDocumentVersions_StoredObject FOREIGN KEY(StoredObjectId) REFERENCES dbo.StoredObjects(Id)');
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_StoredObjects_PublicUrl' AND object_id=OBJECT_ID('dbo.StoredObjects')) EXEC(N'CREATE UNIQUE INDEX UX_StoredObjects_PublicUrl ON dbo.StoredObjects(PublicUrl)');
EXEC(N'UPDATE versionRow SET StoredObjectId=stored.Id FROM dbo.KnowledgeDocumentVersions versionRow JOIN dbo.StoredObjects stored ON stored.PublicUrl=versionRow.FileUrl WHERE versionRow.StoredObjectId IS NULL');

COMMIT TRANSACTION;
