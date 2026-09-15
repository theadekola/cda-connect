import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { S3Client, PutObjectCommand,GetObjectCommand,DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';

let s3: S3Client | null = null;
function client() {
  if (!s3) {
    s3 = new S3Client({
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
      credentials: env.STORAGE_ACCESS_KEY_ID && env.STORAGE_SECRET_ACCESS_KEY ? {
        accessKeyId: env.STORAGE_ACCESS_KEY_ID,
        secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY
      } : undefined
    });
  }
  return s3;
}

export type StoredObject = { key: string; url: string };

export async function storeObject(input: { buffer: Buffer; originalName: string; mimeType: string; prefix?: string;private?:boolean }): Promise<StoredObject> {
  const ext = path.extname(input.originalName).slice(0, 12);
  const key = `${input.prefix ?? 'media'}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}${ext}`;
  if (env.STORAGE_DRIVER === 's3') {
    await client().send(new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: key,
      Body: input.buffer,
      ContentType: input.mimeType,
      Metadata: { originalName: input.originalName.slice(0, 500) }
    }));
    const base = (env.STORAGE_PUBLIC_BASE_URL ?? `${env.STORAGE_ENDPOINT?.replace(/\/$/,'')}/${env.STORAGE_BUCKET}`).replace(/\/$/, '');
    return { key, url: input.private?`private://${key}`:`${base}/${key}` };
  }
  const root = path.resolve(input.private?'private-uploads':'uploads');
  const target = path.join(root, key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, input.buffer);
  return { key, url: input.private?`private://${key}`:`${env.PUBLIC_BASE_URL.replace(/\/$/,'')}/uploads/${key}` };
}

export async function readObject(key:string):Promise<Buffer>{
 if(env.STORAGE_DRIVER==='s3'){const result=await client().send(new GetObjectCommand({Bucket:env.STORAGE_BUCKET,Key:key}));if(!result.Body)throw new Error('Stored object is empty');return Buffer.from(await result.Body.transformToByteArray())}
 return fs.readFile(path.join(path.resolve((key.startsWith('private-documents/')||key.startsWith('private-chat/')||key.startsWith('private-issues/')||key.startsWith('private-levies/'))?'private-uploads':'uploads'),key));
}

export async function deleteObject(key:string){
 if(env.STORAGE_DRIVER==='s3'){await client().send(new DeleteObjectCommand({Bucket:env.STORAGE_BUCKET,Key:key}));return}
 await fs.unlink(path.join(path.resolve((key.startsWith('private-documents/')||key.startsWith('private-chat/')||key.startsWith('private-issues/')||key.startsWith('private-levies/'))?'private-uploads':'uploads'),key)).catch(error=>{if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error});
}

