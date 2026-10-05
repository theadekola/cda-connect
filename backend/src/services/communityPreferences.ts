import {getPool,sql} from '../config/db.js';
export const contentTypes=['TEXT','PHOTO','VIDEO','DOCUMENT','POLL','EVENT','OPPORTUNITY','LOST_FOUND','RECOMMENDATION','QUESTION','ALERT','LOCAL_NEWS','VOICE','INITIATIVE'] as const;
export async function readCommunityPreferences(userId:string){const row=(await(await getPool()).request().input('u',sql.UniqueIdentifier,userId).query('SELECT * FROM CommunityPreferences WHERE UserId=@u')).recordset[0]??{};for(const key of ['Interests','ContentTypes','FollowedTags','MutedTags']){try{row[key]=JSON.parse(row[key]??'[]')}catch{row[key]=[]}}return{HideSensitive:true,...row}}
export function applyCommunityPreferences(posts:Record<string,any>[],p:Record<string,any>){
 const tags=(post:Record<string,any>)=>String(post.Hashtags??'').toLowerCase().split(',');
 const score=(post:Record<string,any>)=>(p.Interests.includes(post.PostType)?2:0)+(tags(post).some(t=>p.FollowedTags.includes(t))?1:0);
 return posts.filter(post=>(!p.HideSensitive||!post.IsSensitive)&&(!p.ContentTypes.length||p.ContentTypes.includes(post.PostType))&&!tags(post).some(t=>p.MutedTags.includes(t))).sort((a,b)=>Number(b.IsPinned)-Number(a.IsPinned)||score(b)-score(a));
}
