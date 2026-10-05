import {z} from 'zod';
import {AppError} from '../utils/errors.js';
const schema=z.object({at:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?$/),kind:z.string().min(1).max(20),id:z.string().uuid()});
export function decodeActivityCursor(value?:string){if(!value)return null;try{const key=schema.parse(JSON.parse(Buffer.from(value,'base64url').toString('utf8')));if(new Date(key.at+'Z').toISOString().slice(0,19)!==key.at.slice(0,19))throw Error('Invalid timestamp');return key}catch{throw new AppError(400,'Invalid activity cursor')}}
export function activityPage(items:any[]){const page=items.slice(0,20),last=page.at(-1);return {items:page,nextCursor:items.length>20?Buffer.from(JSON.stringify({at:last.CursorAt,kind:last.Kind,id:last.Id})).toString('base64url'):null}}
export const activityAfter=`(@at IS NULL OR CreatedAt<CONVERT(datetime2(7),@at,126) OR (CreatedAt=CONVERT(datetime2(7),@at,126) AND (Kind>@cursorKind OR (Kind=@cursorKind AND Id>@cursorId))))`;
