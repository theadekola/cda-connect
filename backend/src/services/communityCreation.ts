import {sql} from '../config/db.js';
import {AppError} from '../utils/errors.js';
export async function protectCommunityCreation(tx:sql.Transaction,userId:string,name:string,state:string,area:string){
 await new sql.Request(tx).input('lock',sql.NVarChar(255),'community-create:'+userId).query(`DECLARE @result int;EXEC @result=sys.sp_getapplock @Resource=@lock,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;IF @result<0 THROW 50001,'Community creation is busy, retry',1;`);
 const account=(await new sql.Request(tx).input('u',sql.UniqueIdentifier,userId).query("SELECT Id FROM Users WHERE Id=@u AND AccountStatus='ACTIVE' AND EmailVerified=1")).recordset[0];
 if(!account)throw new AppError(403,'Verify your email before creating a community');
 const counts=(await new sql.Request(tx).input('u',sql.UniqueIdentifier,userId).query(`SELECT COUNT(CASE WHEN CreatedAt>DATEADD(hour,-24,SYSUTCDATETIME()) THEN 1 END) RecentCount,COUNT(CASE WHEN IsVerified=0 THEN 1 END) UnverifiedCount FROM Communities WHERE OwnerUserId=@u`)).recordset[0];
 if(Number(counts?.RecentCount)>=1)throw new AppError(429,'You can create one community in 24 hours');
 if(Number(counts?.UnverifiedCount)>=3)throw new AppError(403,'Verify an existing community before creating another. You can own up to 3 unverified communities');
 const duplicate=(await new sql.Request(tx).input('name',sql.NVarChar(200),name).input('state',sql.NVarChar(100),state).input('area',sql.NVarChar(150),area).query(`SELECT Id FROM Communities WITH(UPDLOCK,HOLDLOCK) WHERE LOWER(LTRIM(RTRIM(Name)))=LOWER(@name) AND State=@state AND LGA=@area`)).recordset[0];
 if(duplicate)throw new AppError(409,'A community with this name already exists in this area. Request to join it or contact support');
}
