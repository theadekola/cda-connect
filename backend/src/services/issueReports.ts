import {z} from 'zod';
import {getPool,sql} from '../config/db.js';
import {AppError} from '../utils/errors.js';
export const reportDetailsSchema=z.object({additionalDetails:z.string().max(500).default(''),involvedUserIds:z.array(z.string().uuid()).max(10).default([]),evidence:z.array(z.object({id:z.string().uuid(),name:z.string().max(180)})).max(4).default([])});
export async function validateReportDetails(userId:string,communityId:string,details:z.infer<typeof reportDetailsSchema>){
 const pool=await getPool();
 for(const id of details.involvedUserIds){const r=await pool.request().input('u',sql.UniqueIdentifier,id).input('c',sql.UniqueIdentifier,communityId).query("SELECT Id FROM CommunityMembers WHERE UserId=@u AND CommunityId=@c AND Status='ACTIVE'");if(!r.recordset.length)throw new AppError(400,'Select a current community member')}
 for(const file of details.evidence){const r=await pool.request().input('i',sql.UniqueIdentifier,file.id).input('u',sql.UniqueIdentifier,userId).input('c',sql.UniqueIdentifier,communityId).query("SELECT OriginalName FROM StoredObjects WHERE Id=@i AND UploadedBy=@u AND CommunityId=@c AND IsPrivate=1 AND StorageKey LIKE 'private-issues/%' AND UploadState='AVAILABLE' AND DeletedAt IS NULL");if(!r.recordset.length)throw new AppError(400,'Evidence upload is unavailable');file.name=r.recordset[0].OriginalName}
 return details;
}
