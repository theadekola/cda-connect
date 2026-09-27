import type {NextFunction,Request,Response} from 'express';
import {getPool,sql} from '../config/db.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function requireActiveCommunityMutation(req:Request,res:Response,next:NextFunction){
 try{
  if(['GET','HEAD','OPTIONS'].includes(req.method)||/\/(sos|emergenc)/i.test(req.path))return next();
  const pathMatch=req.path.match(/\/communities\/([0-9a-f-]{36})(?:\/|$)/i);
  const candidate=pathMatch?.[1]??null;
  if(!candidate||!uuid.test(candidate))return next();
  const row=(await(await getPool()).request().input('id',sql.UniqueIdentifier,candidate).query('SELECT PlatformStatus FROM Communities WHERE Id=@id')).recordset[0];
  if(!row)return next();
  if(row.PlatformStatus!=='ACTIVE')return res.status(423).json({error:`This community is ${String(row.PlatformStatus).toLowerCase()}. New posts, chats, polls, meetings, documents, payments and membership changes are unavailable.`,code:'COMMUNITY_PLATFORM_RESTRICTED',platformStatus:row.PlatformStatus});
  next();
 }catch(error){next(error)}
}
