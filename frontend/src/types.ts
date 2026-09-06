export type User={Id:string;FirstName:string;LastName:string;Email:string;Phone?:string;ProfileImage?:string;CoverImage?:string;Country?:string;State?:string;LGA?:string;Postcode?:string;Address?:string;DateOfBirth?:string;CreatedAt?:string;SystemRole?:'MEMBER'|'SYSTEM_ADMIN'|'SUPER_ADMIN';IsProtectedAccount?:boolean;TwoFactorEnabled?:boolean};
export type Community={Id:string;Name:string;Description?:string;LogoUrl?:string;CommunityType?:string;Category?:string;City?:string;Postcode?:string;Country?:string;JoinCode?:string;IsVerified?:boolean;VerifiedAt?:string};
export type Announcement={Id:string;Title:string;Body:string;IsPinned:boolean;CreatedAt:string;FirstName?:string;LastName?:string};
export type Meeting={Id:string;Title:string;Description?:string;Location?:string;StartDateTime:string;EndDateTime:string;MeetingType?:string;MyResponse?:string};
export type Poll={Id:string;Question:string;Description?:string;AllowMultiple:boolean;AllowChangeVote:boolean;EndAt?:string;options:{Id:string;OptionText:string;VoteCount:number;MyVote:boolean}[]};
export type Alert={Id:string;Title:string;Message:string;Severity:string;AlertType?:string;RequiresAcknowledgement:boolean;MyResponse?:string;CreatedAt:string};
export type Conversation={Id:string;Name:string;Type:string;LastMessage?:string;DirectImage?:string;CommunityImage?:string;MutedUntil?:string|null};
