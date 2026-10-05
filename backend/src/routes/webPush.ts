import {Router} from 'express';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {env} from '../config/env.js';
import {getPool,sql} from '../config/db.js';
import {asyncHandler,AppError} from '../utils/errors.js';
import {pushSubscriptionSchema,webPushReady,sendWebPush} from '../services/webPush.js';
export const webPushRouter=Router();
webPushRouter.get('/web-push/key',asyncHandler(async(_req,res)=>{res.json({publicKey:webPushReady()?env.VAPID_PUBLIC_KEY:null})}));
webPushRouter.post('/web-push/subscribe',asyncHandler(async(req,res)=>{
  if(!webPushReady())throw new AppError(503,'Push notifications are not configured on the server yet');
  const s=pushSubscriptionSchema.parse(req.body),pool=await getPool();
  const result=await pool.request().input('id',sql.UniqueIdentifier,randomUUID()).input('u',sql.UniqueIdentifier,req.user!.id)
    .input('hash',sql.VarBinary(32),createHash('sha256').update(s.endpoint).digest()).input('endpoint',sql.NVarChar(2048),s.endpoint)
    .input('p',sql.VarChar(100),s.keys.p256dh).input('a',sql.VarChar(100),s.keys.auth).query(`
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @existing UNIQUEIDENTIFIER;
SELECT @existing=Id FROM WebPushSubscriptions WITH(UPDLOCK,HOLDLOCK) WHERE EndpointHash=@hash;
IF @existing IS NOT NULL SET @id=@existing;
DELETE FROM UserDevices WHERE DeviceToken=N'webpush:'+CONVERT(NVARCHAR(36),@id);
IF @existing IS NULL INSERT INTO WebPushSubscriptions(Id,UserId,EndpointHash,Endpoint,P256dh,Auth) VALUES(@id,@u,@hash,@endpoint,@p,@a);
ELSE UPDATE WebPushSubscriptions SET UserId=@u,P256dh=@p,Auth=@a WHERE Id=@id;
INSERT INTO UserDevices(UserId,DeviceToken,Platform,DeviceName,LastActiveAt) VALUES(@u,N'webpush:'+CONVERT(NVARCHAR(36),@id),N'web',N'Home screen / browser',SYSUTCDATETIME());
COMMIT;
SELECT @id Id;`);
  res.status(201).json({id:result.recordset[0].Id});
}));
webPushRouter.delete('/web-push/subscribe',asyncHandler(async(req,res)=>{
  const {endpoint}=z.object({endpoint:z.string().max(2048)}).parse(req.body),pool=await getPool();
  await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).input('hash',sql.VarBinary(32),createHash('sha256').update(endpoint).digest()).query(`SET XACT_ABORT ON; BEGIN TRANSACTION;
DELETE d FROM UserDevices d JOIN WebPushSubscriptions s ON d.DeviceToken=N'webpush:'+CONVERT(NVARCHAR(36),s.Id) WHERE s.UserId=@u AND s.EndpointHash=@hash;
DELETE FROM WebPushSubscriptions WHERE UserId=@u AND EndpointHash=@hash; COMMIT;`);
  res.status(204).end();
}));
webPushRouter.post('/web-push/test',asyncHandler(async(req,res)=>{
  const {endpoint}=z.object({endpoint:z.string().max(2048)}).parse(req.body),pool=await getPool();
  const r=await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).input('hash',sql.VarBinary(32),createHash('sha256').update(endpoint).digest()).query('SELECT Id FROM WebPushSubscriptions WHERE UserId=@u AND EndpointHash=@hash');
  if(!r.recordset[0])throw new AppError(404,'Enable notifications on this device first');
  const ticket=await sendWebPush('webpush:'+r.recordset[0].Id);
  if(ticket.status!=='ok')throw new AppError(410,'Subscription expired. Enable notifications again');
  res.json({success:true});
}));
