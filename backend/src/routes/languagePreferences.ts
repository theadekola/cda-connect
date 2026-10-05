import {getRedis} from '../config/redis.js';
import {Router} from 'express';
import {z} from 'zod';
import {getPool,sql} from '../config/db.js';
import {env} from '../config/env.js';
import {asyncHandler,AppError} from '../utils/errors.js';
import {requireCommunityMember} from '../services/permissions.js';
import {requireConversationContact,visibleContent} from '../services/privacy.js';
import {transformText} from '../services/language.js';
export const languagePreferencesRouter=Router();
export const languageChange=z.discriminatedUnion('key',[z.object({key:z.literal('appLanguage'),value:z.enum(['en-GB','en-US'])}).strict(),z.object({key:z.literal('translationLanguage'),value:z.enum(['en-GB','en-US','fr','es','ar','ha','yo','ig','pt','de'])}).strict(),z.object({key:z.enum(['translatePosts','translateMessages']),value:z.boolean()}).strict()]);
languagePreferencesRouter.get('/language-preferences',asyncHandler(async(req,res)=>{const p=(await(await getPool()).request().input('u',sql.UniqueIdentifier,req.user!.id).query('SELECT * FROM LanguagePreferences WHERE UserId=@u')).recordset[0]??{};res.set('Cache-Control','no-store').json({AppLanguage:'en-GB',TranslationLanguage:'en-GB',TranslatePosts:false,TranslateMessages:false,...p,translationAvailable:!!env.LANGUAGE_SERVICE_URL})}));
languagePreferencesRouter.patch('/language-preferences',asyncHandler(async(req,res)=>{const d=languageChange.parse(req.body);if((d.key==='translatePosts'||d.key==='translateMessages')&&d.value&&!env.LANGUAGE_SERVICE_URL)throw new AppError(503,'A translation provider must be configured before automatic translation can be enabled');const column={appLanguage:'AppLanguage',translationLanguage:'TranslationLanguage',translatePosts:'TranslatePosts',translateMessages:'TranslateMessages'}[d.key];await(await getPool()).request().input('u',sql.UniqueIdentifier,req.user!.id).input('v',typeof d.value==='boolean'?sql.Bit:sql.NVarChar(20),d.value).query(`MERGE LanguagePreferences WITH(HOLDLOCK) t USING(SELECT @u UserId)s ON t.UserId=s.UserId WHEN MATCHED THEN UPDATE SET ${column}=@v,UpdatedAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(UserId,${column}) VALUES(@u,@v);`);res.json({success:true})}));
languagePreferencesRouter.post('/language-preferences/reset',asyncHandler(async(req,res)=>{await(await getPool()).request().input('u',sql.UniqueIdentifier,req.user!.id).query('DELETE FROM LanguagePreferences WHERE UserId=@u');res.json({success:true})}));
// Read original content from the database after authorisation; never trust text supplied by a client.
languagePreferencesRouter.post('/language-preferences/translate',asyncHandler(async(req,res)=>{
 const d=z.object({type:z.enum(['post','message']),id:z.string().uuid()}).strict().parse(req.body),pool=await getPool();
 const pref=(await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).query('SELECT * FROM LanguagePreferences WHERE UserId=@u')).recordset[0];if(!pref?.[d.type==='post'?'TranslatePosts':'TranslateMessages'])throw new AppError(403,'Automatic translation is disabled');
 const row=(await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).input('id',sql.UniqueIdentifier,d.id).query(d.type==='post'?`SELECT p.Body Text,p.CommunityId FROM CommunityPosts p WHERE p.Id=@id AND p.IsDeleted=0 AND ${visibleContent('p.CreatedBy','p.Body')}`:`SELECT m.MessageText Text,c.CommunityId,c.Id ConversationId FROM Messages m JOIN Conversations c ON c.Id=m.ConversationId JOIN ConversationMembers cm ON cm.ConversationId=c.Id AND cm.UserId=@u AND cm.IsActive=1 WHERE m.Id=@id AND m.IsDeleted=0`)).recordset[0];if(!row)throw new AppError(404,'Content unavailable');await requireCommunityMember(req.user!.id,row.CommunityId);if(d.type==='message')await requireConversationContact(req.user!.id,row.ConversationId);
 if(!row.Text)return res.json({text:''});const redis=getRedis(),key='translation-rate:'+req.user!.id,attempts=await redis.incr(key);if(attempts===1)await redis.expire(key,60);if(attempts>30)throw new AppError(429,'Please wait before translating more content');res.set('Cache-Control','no-store').json({text:await transformText(String(row.Text).slice(0,10000),'translate',pref.TranslationLanguage||'en-GB')});
}));
