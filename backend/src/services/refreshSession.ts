import crypto from 'node:crypto';
import {getPool,sql} from '../config/db.js';
import {hashToken,signAccess,signRefresh,verifyRefresh} from '../utils/auth.js';
import {env} from '../config/env.js';
import {AppError} from '../utils/errors.js';
export async function rotateSession(token:string){
 try{verifyRefresh(token)}catch{throw new AppError(401,'Refresh token invalid')}
 const tx=new sql.Transaction(await getPool());await tx.begin();let committed=false;
 try{const row=(await new sql.Request(tx).input('hash',sql.NVarChar(64),hashToken(token)).query(`SELECT s.*,u.Email,u.FirstName,u.LastName,u.ProfileImage,u.AccountStatus,u.IsSuperAdmin,u.IsProtectedAccount FROM UserSessions s WITH(UPDLOCK,HOLDLOCK) JOIN Users u ON u.Id=s.UserId WHERE s.RefreshTokenHash=@hash`)).recordset[0];
 if(!row||!row.FamilyId||row.AccountStatus!=='ACTIVE'||new Date(row.ExpiresAt)<=new Date())throw new AppError(401,'Refresh token invalid');
 if(row.RevokedAt){if(row.RotatedAt)await new sql.Request(tx).input('family',sql.UniqueIdentifier,row.FamilyId).query(`UPDATE UserSessions SET RevokedAt=COALESCE(RevokedAt,SYSUTCDATETIME()) WHERE FamilyId=@family`);await tx.commit();committed=true;throw new AppError(401,'Session reuse detected. Sign in again');}
 const identity={id:row.UserId,email:row.Email,sessionId:row.FamilyId},refreshToken=signRefresh(identity);
 await new sql.Request(tx).input('id',sql.UniqueIdentifier,row.Id).query(`UPDATE UserSessions SET RevokedAt=SYSUTCDATETIME(),RotatedAt=SYSUTCDATETIME() WHERE Id=@id`);
 await new sql.Request(tx).input('id',sql.UniqueIdentifier,crypto.randomUUID()).input('u',sql.UniqueIdentifier,row.UserId).input('family',sql.UniqueIdentifier,row.FamilyId).input('hash',sql.NVarChar(64),hashToken(refreshToken)).input('exp',sql.DateTime2,new Date(row.ExpiresAt)).input('name',sql.NVarChar(80),row.TrustedName??null).query(`INSERT INTO UserSessions(Id,UserId,FamilyId,RefreshTokenHash,ExpiresAt,TrustedName) VALUES(@id,@u,@family,@hash,@exp,@name)`);
 await tx.commit();committed=true;return {refreshToken,accessToken:signAccess(identity),user:{Id:row.UserId,Email:row.Email,FirstName:row.FirstName,LastName:row.LastName,ProfileImage:row.ProfileImage,IsSuperAdmin:Boolean(row.IsSuperAdmin),IsProtectedAccount:Boolean(row.IsProtectedAccount)}};
 }catch(e){if(!committed)await tx.rollback();throw e}
}
