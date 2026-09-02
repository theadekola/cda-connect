import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { storeObject } from '../services/storage.js';
import { getPool, sql } from '../config/db.js';
import sharp from 'sharp';

const allowed = new Set([
  'image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','audio/m4a','audio/mp4','audio/mpeg','audio/wav',
  'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','text/csv','application/rtf','application/json','application/xml','application/zip','application/x-7z-compressed','application/x-rar-compressed','application/epub+zip','application/octet-stream'
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_r, f, cb) => allowed.has(f.mimetype) || f.mimetype.startsWith('text/') ? cb(null, true) : cb(new AppError(400, 'Unsupported file type'))
});

export const mediaRouter = Router();
mediaRouter.use(requireAuth);
mediaRouter.post('/media/upload', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, 'File required');
  const pollImage=req.query.profile==='poll-option'||req.query.profile==='poll';
  if(pollImage&&!req.file.mimetype.startsWith('image/'))throw new AppError(400,'Poll artwork must be an image');
  const processed=pollImage?await sharp(req.file.buffer).rotate().resize(512,512,{fit:'cover',position:'centre',withoutEnlargement:true}).webp({quality:78,effort:4}).toBuffer():req.file.buffer;
  const originalName=pollImage?`${req.file.originalname.replace(/\.[^.]+$/,'')}.webp`:req.file.originalname,mimeType=pollImage?'image/webp':req.file.mimetype;
  const stored = await storeObject({ buffer: processed, originalName, mimeType, prefix: 'media' });
  const pool = await getPool();
  await pool.request().input('u', sql.UniqueIdentifier, req.user!.id).input('k', sql.NVarChar(1000), stored.key).input('url', sql.NVarChar(1500), stored.url).input('name', sql.NVarChar(500), originalName).input('mime', sql.NVarChar(150), mimeType).input('size', sql.BigInt, processed.length).query(`INSERT INTO StoredObjects(UploadedBy,StorageKey,PublicUrl,OriginalName,MimeType,SizeBytes) VALUES(@u,@k,@url,@name,@mime,@size)`);
  res.status(201).json({ url: stored.url, storageKey: stored.key, name: originalName, mimeType, size: processed.length,processed:pollImage });
}));
mediaRouter.post('/media/transcribe', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, 'Audio file required');
  if (!env.LANGUAGE_SERVICE_URL) return res.status(503).json({ message: 'Transcription provider is not configured', transcript: null });
  const fd = new FormData();
  fd.append('task', 'transcribe');
  const audioBytes = Uint8Array.from(req.file.buffer);
  fd.append('file', new Blob([audioBytes], { type: req.file.mimetype }), req.file.originalname);
  const r = await fetch(env.LANGUAGE_SERVICE_URL, { method: 'POST', headers: env.LANGUAGE_SERVICE_API_KEY ? { Authorization: `Bearer ${env.LANGUAGE_SERVICE_API_KEY}` } : {}, body: fd });
  if (!r.ok) throw new AppError(502, 'Transcription provider failed');
  const data: any = await r.json();
  res.json({ transcript: data.transcript ?? data.text ?? '' });
}));
