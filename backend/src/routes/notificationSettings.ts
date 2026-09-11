import {Router} from 'express';
import {z} from 'zod';
import {getPool,sql} from '../config/db.js';
import {asyncHandler,AppError} from '../utils/errors.js';
import {notificationColumns,readNotificationSettings} from '../services/notificationSettings.js';
export const notificationSettingsRouter=Router();
notificationSettingsRouter.get('/notification-settings',asyncHandler(async(req,res)=>{res.set('Cache-Control','no-store').json(await readNotificationSettings(req.user!.id))}));
export const notificationChange=z.object({key:z.enum(['initiatives','enabled','communityUpdates','newPosts','comments','mentions','messages','events','invitations','polls','emergency','marketplace','businessPromotions']),value:z.boolean()}).strict();
notificationSettingsRouter.patch('/notification-settings',asyncHandler(async(req,res)=>{
 const d=notificationChange.parse(req.body),column=notificationColumns[d.key],bit=['Initiatives','Enabled','CommunityUpdates','Comments','Invitations','EmergencyEnabled'].includes(column);
 await(await getPool()).request().input('u',sql.UniqueIdentifier,req.user!.id).input('v',bit?sql.Bit:sql.NVarChar(20),bit?d.value:d.value?'ON':'OFF').query(`MERGE NotificationPreferences WITH(HOLDLOCK) t USING(SELECT @u UserId)s ON t.UserId=s.UserId WHEN MATCHED THEN UPDATE SET ${column}=@v,UpdatedAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(UserId,${column}) VALUES(@u,@v);`);res.json({success:true});
}));
export const quietChange=z.object({enabled:z.boolean(),start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),end:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),timeZone:z.string().min(1).max(100)}).strict().refine(d=>!d.enabled||d.start!==d.end,'Choose different start and end times');
notificationSettingsRouter.put('/notification-settings/quiet-hours',asyncHandler(async(req,res)=>{
 const d=quietChange.parse(req.body);try{new Intl.DateTimeFormat('en',{timeZone:d.timeZone}).format()}catch{throw new AppError(400,'Choose a valid time zone')}
 await(await getPool()).request().input('u',sql.UniqueIdentifier,req.user!.id).input('on',sql.Bit,d.enabled).input('start',sql.VarChar(5),d.start).input('end',sql.VarChar(5),d.end).input('tz',sql.NVarChar(100),d.timeZone).query(`SET XACT_ABORT ON;BEGIN TRANSACTION;
 MERGE NotificationPreferences WITH(HOLDLOCK) t USING(SELECT @u UserId)s ON t.UserId=s.UserId WHEN MATCHED THEN UPDATE SET QuietHoursEnabled=@on,QuietStart=CONVERT(time,@start),QuietEnd=CONVERT(time,@end),UpdatedAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(UserId,QuietHoursEnabled,QuietStart,QuietEnd) VALUES(@u,@on,CONVERT(time,@start),CONVERT(time,@end));
 MERGE UserAppPreferences WITH(HOLDLOCK) t USING(SELECT @u UserId)s ON t.UserId=s.UserId WHEN MATCHED THEN UPDATE SET TimeZone=@tz,UpdatedAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(UserId,TimeZone) VALUES(@u,@tz);COMMIT;`);res.json({success:true});
}));
