SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

INSERT INTO dbo.CommunityPosts
  (CommunityId, CreatedBy, Body, PostType, MediaUrl, MediaType, CreatedAt, UpdatedAt)
SELECT
  o.CommunityId,
  o.CreatedBy,
  CONCAT(
    REPLACE(o.OpportunityType, '_', ' '), ': ', o.Title,
    CHAR(13), CHAR(10), CHAR(13), CHAR(10), o.Description,
    CASE WHEN NULLIF(o.Organisation, '') IS NULL THEN '' ELSE CONCAT(CHAR(13), CHAR(10), CHAR(13), CHAR(10), 'Organisation: ', o.Organisation) END,
    CASE WHEN NULLIF(o.Location, '') IS NULL THEN '' ELSE CONCAT(CHAR(13), CHAR(10), CHAR(13), CHAR(10), 'Location: ', o.Location) END,
    CASE WHEN o.Deadline IS NULL THEN '' ELSE CONCAT(CHAR(13), CHAR(10), CHAR(13), CHAR(10), 'Deadline: ', CONVERT(varchar(10), o.Deadline, 23)) END
  ),
  'OPPORTUNITY',
  o.ApplyUrl,
  CASE WHEN o.ApplyUrl IS NULL THEN NULL ELSE 'text/uri-list' END,
  o.CreatedAt,
  o.CreatedAt
FROM dbo.CommunityOpportunities o
WHERE NOT EXISTS (
  SELECT 1
  FROM dbo.CommunityPosts p
  WHERE p.CommunityId = o.CommunityId
    AND p.CreatedBy = o.CreatedBy
    AND p.PostType = 'OPPORTUNITY'
    AND p.CreatedAt = o.CreatedAt
);

DECLARE @Added int = @@ROWCOUNT;

COMMIT TRANSACTION;

SELECT @Added AS OpportunitiesAddedToFeed;
