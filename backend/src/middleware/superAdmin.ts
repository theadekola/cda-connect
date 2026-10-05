import type {NextFunction,Request,Response} from 'express';
import {getPool,sql} from '../config/db.js';

export type SuperAdminPermission='PLATFORM_AUDIT_VIEW'|'USER_PII_VIEW'|'FINANCE_AUDIT_VIEW'|'SECURITY_AUDIT_VIEW'|'SUPER_ADMIN_MANAGE'|'COMMUNITY_MANAGE';
export type SuperAdminAccessMode='NORMAL'|'SUPPORT'|'BREAK_GLASS';

async function activeSuperAdmin(userId:string){
 const result=await (await getPool()).request().input('u',sql.UniqueIdentifier,userId)
  .query("SELECT TOP 1 Id FROM Users WHERE Id=@u AND AccountStatus='ACTIVE' AND IsSuperAdmin=1");
 return !!result.recordset[0];
}

export async function requireSuperAdmin(req:Request,res:Response,next:NextFunction){
 try{
  if(!req.user||!(await activeSuperAdmin(req.user.id)))return res.status(403).json({error:'Super Admin access required'});
  next();
 }catch(error){next(error)}
}

export async function requireRecentAuthentication(req:Request,res:Response,next:NextFunction){
 try{
  if(!req.user)return res.status(401).json({error:'Authentication required'});
  const result=await (await getPool()).request().input('u',sql.UniqueIdentifier,req.user.id).input('family',sql.UniqueIdentifier,req.user.sessionId??null)
   .query("SELECT TOP 1 Id FROM UserSessions WHERE UserId=@u AND FamilyId=@family AND RevokedAt IS NULL AND ExpiresAt>SYSUTCDATETIME() AND ReauthenticatedAt>=DATEADD(minute,-10,SYSUTCDATETIME())");
  if(!result.recordset[0])return res.status(401).json({error:'Complete MFA verification before this sensitive action',code:'MFA_REQUIRED'});
  next();
 }catch(error){next(error)}
}

export async function requireRecentPassword(req:Request,res:Response,next:NextFunction){
 try{
  if(!req.user)return res.status(401).json({error:'Authentication required'});
  const result=await (await getPool()).request().input('u',sql.UniqueIdentifier,req.user.id).input('family',sql.UniqueIdentifier,req.user.sessionId??null)
   .query("SELECT TOP 1 Id FROM UserSessions WHERE UserId=@u AND FamilyId=@family AND RevokedAt IS NULL AND ExpiresAt>SYSUTCDATETIME() AND PasswordConfirmedAt>=DATEADD(minute,-10,SYSUTCDATETIME())");
  if(!result.recordset[0])return res.status(401).json({error:'Confirm your password before this sensitive action',code:'RECENT_PASSWORD_REQUIRED'});
  next();
 }catch(error){next(error)}
}

export async function hasSuperAdminPermission(userId:string,permission:SuperAdminPermission){
 const result=await (await getPool()).request().input('u',sql.UniqueIdentifier,userId).input('permission',sql.NVarChar(100),permission)
  .query("SELECT TOP 1 1 ok FROM Users u JOIN SuperAdminPermissionAssignments p ON p.UserId=u.Id AND p.PermissionCode=@permission WHERE u.Id=@u AND u.AccountStatus='ACTIVE' AND u.IsSuperAdmin=1");
 return Boolean(result.recordset[0]);
}

export function requireSuperAdminPermission(permission:SuperAdminPermission,minimumMode:SuperAdminAccessMode='NORMAL'){
 return async(req:Request,res:Response,next:NextFunction)=>{
  try{
   if(!req.user)return res.status(401).json({error:'Authentication required'});
   const communityId=typeof req.params.communityId==='string'?req.params.communityId:null;
   const modeClause=minimumMode==='NORMAL'?'':minimumMode==='SUPPORT'
    ?"AND EXISTS(SELECT 1 FROM SuperAdminAccessGrants g WHERE g.UserId=@u AND g.AccessMode IN('SUPPORT','BREAK_GLASS') AND g.RevokedAt IS NULL AND g.ExpiresAt>SYSUTCDATETIME() AND (g.CommunityId IS NULL OR g.CommunityId=@c))"
    :"AND EXISTS(SELECT 1 FROM SuperAdminAccessGrants g WHERE g.UserId=@u AND g.AccessMode='BREAK_GLASS' AND g.RevokedAt IS NULL AND g.ExpiresAt>SYSUTCDATETIME() AND g.CommunityId=@c)";
   const result=await (await getPool()).request().input('u',sql.UniqueIdentifier,req.user.id).input('permission',sql.NVarChar(100),permission).input('c',sql.UniqueIdentifier,communityId)
    .query(`SELECT TOP 1 1 ok FROM Users u JOIN SuperAdminPermissionAssignments p ON p.UserId=u.Id AND p.PermissionCode=@permission WHERE u.Id=@u AND u.AccountStatus='ACTIVE' AND u.IsSuperAdmin=1 ${modeClause}`);
   if(!result.recordset[0])return res.status(403).json({error:`Missing Super Admin permission or active ${minimumMode.toLowerCase()} access: ${permission}`});
   next();
  }catch(error){next(error)}
 };
}
