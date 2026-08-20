import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { storeObject } from '../services/storage.js';
import { getPool, sql } from '../config/db.js';

const allowed = new Set([
  'image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','audio/m4a','audio/mp4','audio/mpeg','audio/wav',
  'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_r, f, cb) => allowed.has(f.mimetype) ? cb(null, true) : cb(new AppError(400, 'Unsupported file type'))
});

export const mediaRouter = Router();
mediaRouter.use(requireAuth);
mediaRouter.post('/media/upload', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, 'File required');
  const stored = await storeObject({ buffer: req.file.buffer, originalName: req.file.originalname, mimeType: req.file.mimetype, prefix: 'media' });
  const pool = await getPool();
  await pool.request().input('u', sql.UniqueIdentifier, req.user!.id).input('k', sql.NVarChar(1000), stored.key).input('url', sql.NVarChar(1500), stored.url).input('name', sql.NVarChar(500), req.file.originalname).input('mime', sql.NVarChar(150), req.file.mimetype).input('size', sql.BigInt, req.file.size).query(`INSERT INTO StoredObjects(UploadedBy,StorageKey,PublicUrl,OriginalName,MimeType,SizeBytes) VALUES(@u,@k,@url,@name,@mime,@size)`);
  res.status(201).json({ url: stored.url, storageKey: stored.key, name: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size });
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
