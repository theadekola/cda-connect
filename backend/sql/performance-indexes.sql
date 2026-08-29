/*
  CDA Connect production indexes for Microsoft SQL Server.

  Safe to rerun: every index is guarded by table and index existence checks.
  Run in the CDA Connect application database, preferably during a quiet period.
  These indexes match the WHERE/JOIN/ORDER BY patterns used by the backend API.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.UserSessions', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.UserSessions') AND name=N'IX_UserSessions_User_Active')
 EXEC(N'CREATE INDEX IX_UserSessions_User_Active ON dbo.UserSessions(UserId,RevokedAt,ExpiresAt DESC) INCLUDE(CreatedAt);');

IF OBJECT_ID(N'dbo.CommunityMembers', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.CommunityMembers') AND name=N'IX_CommunityMembers_Community_Status')
 EXEC(N'CREATE INDEX IX_CommunityMembers_Community_Status ON dbo.CommunityMembers(CommunityId,Status,UserId) INCLUDE(Id,JoinedAt);');

IF OBJECT_ID(N'dbo.CommunityMemberRoles', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.CommunityMemberRoles') AND name=N'IX_CommunityMemberRoles_Role_Member')
 EXEC(N'CREATE INDEX IX_CommunityMemberRoles_Role_Member ON dbo.CommunityMemberRoles(RoleId,CommunityMemberId);');

IF OBJECT_ID(N'dbo.Conversations', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Conversations') AND name=N'IX_Conversations_Community_Created')
 EXEC(N'CREATE INDEX IX_Conversations_Community_Created ON dbo.Conversations(CommunityId,CreatedAt DESC) INCLUDE(Name,Type,CreatedBy);');

IF OBJECT_ID(N'dbo.ConversationMembers', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.ConversationMembers') AND name=N'IX_ConversationMembers_User_Conversation')
 EXEC(N'CREATE INDEX IX_ConversationMembers_User_Conversation ON dbo.ConversationMembers(UserId,ConversationId) INCLUDE(JoinedAt);');

IF OBJECT_ID(N'dbo.Polls', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Polls') AND name=N'IX_Polls_Community_Created')
 EXEC(N'CREATE INDEX IX_Polls_Community_Created ON dbo.Polls(CommunityId,CreatedAt DESC) INCLUDE(StartAt,EndAt,CreatedBy);');

IF OBJECT_ID(N'dbo.PollOptions', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.PollOptions') AND name=N'IX_PollOptions_Poll_Order')
 EXEC(N'CREATE INDEX IX_PollOptions_Poll_Order ON dbo.PollOptions(PollId,SortOrder) INCLUDE(OptionText);');

IF OBJECT_ID(N'dbo.PollVotes', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.PollVotes') AND name=N'IX_PollVotes_User_Poll')
 EXEC(N'CREATE INDEX IX_PollVotes_User_Poll ON dbo.PollVotes(UserId,PollId) INCLUDE(OptionId,CreatedAt);');

IF OBJECT_ID(N'dbo.EmergencyAlerts', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.EmergencyAlerts') AND name=N'IX_EmergencyAlerts_Community_Active_Created')
 EXEC(N'CREATE INDEX IX_EmergencyAlerts_Community_Active_Created ON dbo.EmergencyAlerts(CommunityId,Active,CreatedAt DESC) INCLUDE(Severity,RequiresAcknowledgement,ResolvedAt);');

IF OBJECT_ID(N'dbo.AuditLogs', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.AuditLogs') AND name=N'IX_AuditLogs_Community_Created')
 EXEC(N'CREATE INDEX IX_AuditLogs_Community_Created ON dbo.AuditLogs(CommunityId,CreatedAt DESC) INCLUDE(UserId,Action,EntityType,EntityId);');

IF OBJECT_ID(N'dbo.CommunityVerificationRequests', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.CommunityVerificationRequests') AND name=N'IX_VerificationRequests_Community_Created')
 EXEC(N'CREATE INDEX IX_VerificationRequests_Community_Created ON dbo.CommunityVerificationRequests(CommunityId,CreatedAt DESC) INCLUDE(Status,SubmittedBy,ReviewedAt);');

IF OBJECT_ID(N'dbo.TrustedContacts', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.TrustedContacts') AND name=N'IX_TrustedContacts_User_Name')
 EXEC(N'CREATE INDEX IX_TrustedContacts_User_Name ON dbo.TrustedContacts(UserId,Name) INCLUDE(Phone,Relationship);');

IF OBJECT_ID(N'dbo.SOSRequests', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.SOSRequests') AND name=N'IX_SOSRequests_Community_Status_Created')
 EXEC(N'CREATE INDEX IX_SOSRequests_Community_Status_Created ON dbo.SOSRequests(CommunityId,Status,CreatedAt DESC) INCLUDE(UserId,ResolvedAt);');

IF OBJECT_ID(N'dbo.CommunityIssueUpdates', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.CommunityIssueUpdates') AND name=N'IX_CommunityIssueUpdates_Issue_Created')
 EXEC(N'CREATE INDEX IX_CommunityIssueUpdates_Issue_Created ON dbo.CommunityIssueUpdates(IssueId,CreatedAt) INCLUDE(CreatedBy,Status);');

IF OBJECT_ID(N'dbo.ServiceProviders', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.ServiceProviders') AND name=N'IX_ServiceProviders_Community_Status_Category')
 EXEC(N'CREATE INDEX IX_ServiceProviders_Community_Status_Category ON dbo.ServiceProviders(CommunityId,Status,Category,CreatedAt DESC) INCLUDE(Name,IsVerified,Phone,Area);');

IF OBJECT_ID(N'dbo.MarketplaceListings', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.MarketplaceListings') AND name=N'IX_Marketplace_Active_Approved')
 EXEC(N'CREATE INDEX IX_Marketplace_Active_Approved ON dbo.MarketplaceListings(CommunityId,ListingType,CreatedAt DESC) INCLUDE(SellerUserId,Title,Price,Currency,Area) WHERE Status=N''ACTIVE'' AND ModerationStatus=N''APPROVED'';');

IF OBJECT_ID(N'dbo.MarketplaceReports', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.MarketplaceReports') AND name=N'IX_MarketplaceReports_Listing_Status')
 EXEC(N'CREATE INDEX IX_MarketplaceReports_Listing_Status ON dbo.MarketplaceReports(ListingId,Status,CreatedAt DESC) INCLUDE(ReportedBy,Reason);');

IF OBJECT_ID(N'dbo.SavedOpportunities', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.SavedOpportunities') AND name=N'IX_SavedOpportunities_User')
 EXEC(N'CREATE INDEX IX_SavedOpportunities_User ON dbo.SavedOpportunities(UserId,OpportunityId) INCLUDE(CreatedAt);');

IF OBJECT_ID(N'dbo.EventAttendees', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.EventAttendees') AND name=N'IX_EventAttendees_Event_Status')
 EXEC(N'CREATE INDEX IX_EventAttendees_Event_Status ON dbo.EventAttendees(EventId,Status) INCLUDE(UserId,CheckedInAt,CreatedAt);');

IF OBJECT_ID(N'dbo.EventPhotos', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.EventPhotos') AND name=N'IX_EventPhotos_Event_Created')
 EXEC(N'CREATE INDEX IX_EventPhotos_Event_Created ON dbo.EventPhotos(EventId,CreatedAt DESC) INCLUDE(PhotoUrl,UploadedBy);');

IF OBJECT_ID(N'dbo.FormalBallots', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FormalBallots') AND name=N'IX_FormalBallots_Community_Status')
 EXEC(N'CREATE INDEX IX_FormalBallots_Community_Status ON dbo.FormalBallots(CommunityId,Status,ClosesAt) INCLUDE(OpensAt,ProposalId,CreatedAt);');

IF OBJECT_ID(N'dbo.FormalBallotOptions', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FormalBallotOptions') AND name=N'IX_FormalBallotOptions_Ballot_Order')
 EXEC(N'CREATE INDEX IX_FormalBallotOptions_Ballot_Order ON dbo.FormalBallotOptions(BallotId,SortOrder) INCLUDE(Label);');

IF OBJECT_ID(N'dbo.FormalBallotVotes', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.FormalBallotVotes') AND name=N'IX_FormalBallotVotes_Ballot_Option')
 EXEC(N'CREATE INDEX IX_FormalBallotVotes_Ballot_Option ON dbo.FormalBallotVotes(BallotId,OptionId) INCLUDE(VoterUserId,CastAt);');

IF OBJECT_ID(N'dbo.MemberDuesLedger', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.MemberDuesLedger') AND name=N'IX_DuesLedger_User_Community_Status')
 EXEC(N'CREATE INDEX IX_DuesLedger_User_Community_Status ON dbo.MemberDuesLedger(UserId,CommunityId,Status) INCLUDE(PlanId,AmountDue,AmountPaid,UpdatedAt);');

IF OBJECT_ID(N'dbo.LevyPaymentSubmissions', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.LevyPaymentSubmissions') AND name=N'IX_LevySubmissions_Community_Status')
 EXEC(N'CREATE INDEX IX_LevySubmissions_Community_Status ON dbo.LevyPaymentSubmissions(CommunityId,Status,SubmittedAt DESC) INCLUDE(LedgerId,UserId,Amount,Reference);');

IF OBJECT_ID(N'dbo.AiAssistantSessions', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.AiAssistantSessions') AND name=N'IX_AiSessions_User_Updated')
 EXEC(N'CREATE INDEX IX_AiSessions_User_Updated ON dbo.AiAssistantSessions(UserId,UpdatedAt DESC) INCLUDE(CommunityId,Title,CreatedAt);');

IF OBJECT_ID(N'dbo.AiAssistantMessages', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.AiAssistantMessages') AND name=N'IX_AiMessages_Session_Created')
 EXEC(N'CREATE INDEX IX_AiMessages_Session_Created ON dbo.AiAssistantMessages(SessionId,CreatedAt) INCLUDE(Role);');

IF OBJECT_ID(N'dbo.DataExportRequests', N'U') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.DataExportRequests') AND name=N'IX_DataExports_User_Status_Created')
 EXEC(N'CREATE INDEX IX_DataExports_User_Status_Created ON dbo.DataExportRequests(UserId,Status,CreatedAt DESC) INCLUDE(ExpiresAt,CompletedAt);');

SELECT t.name AS TableName,i.name AS IndexName
FROM sys.indexes i
JOIN sys.tables t ON t.object_id=i.object_id
WHERE i.name LIKE N'IX[_]%'
ORDER BY t.name,i.name;
