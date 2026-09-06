import type {NextFunction,Request,Response} from 'express';
import {getPool,sql} from '../config/db.js';

declare global { namespace Express { interface Request { systemAdmin?:{role:string;permissions:string[];protected:boolean} } } }

export async function requireSystemAdmin(req:Request,res:Response,next:NextFunction){
 try{
  if(!req.user?.id)return res.status(401).json({error:'Authentication required'});
  const pool=await getPool();
  const result=await pool.request().input('id',sql.UniqueIdentifier,req.user.id).query(`
   SELECT u.SystemRole,u.IsProtectedAccount,u.AccountStatus,u.TwoFactorEnabled,p.PermissionCode
   FROM Users u LEFT JOIN SystemAdminPermissions p ON p.UserId=u.Id WHERE u.Id=@id`);
  const rows=result.recordset;
  if(!rows.length||!['SUPER_ADMIN','SYSTEM_ADMIN'].includes(rows[0].SystemRole)||rows[0].AccountStatus!=='ACTIVE')return res.status(403).json({error:'System administrator access required'});
  if(!rows[0].TwoFactorEnabled)return res.status(403).json({error:'Two-factor authentication must be enabled',code:'MFA_REQUIRED'});
  req.systemAdmin={role:rows[0].SystemRole,protected:Boolean(rows[0].IsProtectedAccount),permissions:rows.map((r:any)=>r.PermissionCode).filter(Boolean)};
  next();
 }catch(error){next(error)}
}

export const requirePermission=(permission:string)=>(req:Request,res:Response,next:NextFunction)=>{
 if(req.systemAdmin?.role==='SUPER_ADMIN'||req.systemAdmin?.permissions.includes(permission))return next();
 return res.status(403).json({error:`Missing system permission: ${permission}`});
};
