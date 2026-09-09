import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('127.0.0.1'),
  CORS_ORIGIN: z.string().default('*'),
  DB_SERVER: z.string().min(1),
  DB_PORT: z.coerce.number().default(1433),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_ENCRYPT: z.string().default('true').transform(v => v.toLowerCase() === 'true'),
  DB_TRUST_CERT: z.string().default('true').transform(v => v === 'true'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().default(30),
  PUBLIC_BASE_URL: z.string().default('http://localhost:4000'),
  LANGUAGE_SERVICE_URL: z.string().optional(),
  LANGUAGE_SERVICE_API_KEY: z.string().optional(),
  PLATFORM_ADMIN_EMAILS: z.string().default(''),
  AI_SERVICE_URL: z.string().optional(),
  AI_SERVICE_API_KEY: z.string().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(180),
  STORAGE_DRIVER: z.enum(['local','s3']).default('local'),
  STORAGE_BUCKET: z.string().default('cda-connect'),
  STORAGE_REGION: z.string().default('us-east-1'),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_FORCE_PATH_STYLE: z.string().default('true').transform(v => v === 'true'),
  STORAGE_PUBLIC_BASE_URL: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:support@cdaconnect.org'),
  PUSH_PROVIDER_URL: z.string().optional(),
  PUSH_PROVIDER_TOKEN: z.string().optional(),
  EMAIL_PROVIDER_URL: z.string().optional(),
  EMAIL_PROVIDER_TOKEN: z.string().optional(),
  EMAIL_PROVIDER: z.enum(['http','smtp']).default('http'),
  SMTP_HOST: z.string().default('mail.privateemail.com'),
  SMTP_PORT: z.coerce.number().refine(v=>v===465||v===587).default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('support@cdaconnect.org'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  SMS_PROVIDER: z.enum(['twilio','termii']).default('twilio'),
  TERMII_API_KEY: z.string().optional(),
  TERMII_BASE_URL: z.string().optional(),
  TERMII_SENDER_ID: z.string().optional(),
  SMS_CODE_EXPIRES_MINUTES: z.coerce.number().int().min(2).max(30).default(10),
  SMS_RESEND_SECONDS: z.coerce.number().int().min(30).max(600).default(60),
  ALLOW_PHONE_VERIFICATION_BYPASS: z.string().default('false').transform(v => v === 'true'),
  EMERGENCY_BATCH_SIZE: z.coerce.number().default(1000)
});

export const env = schema.parse(process.env);

if (env.NODE_ENV === 'production') {
  if (env.CORS_ORIGIN === '*' || !env.CORS_ORIGIN.trim()) throw new Error('Set explicit production CORS origins');
  if (!env.PUBLIC_BASE_URL.startsWith('https://')) throw new Error('Production PUBLIC_BASE_URL must use HTTPS');
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) throw new Error('Use different access and refresh secrets');
  if (!env.DB_ENCRYPT) throw new Error('Production SQL connections must be encrypted');
  if (env.DB_PASSWORD.length < 8 || [env.DB_PASSWORD,env.JWT_ACCESS_SECRET,env.JWT_REFRESH_SECRET].some(value=>/replace.with|change.me/i.test(value))) throw new Error('Configure strong non-placeholder production credentials');
}
