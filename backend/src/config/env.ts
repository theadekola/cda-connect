import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('*'),
  DB_SERVER: z.string().min(1),
  DB_PORT: z.coerce.number().default(1433),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_ENCRYPT: z.string().default('false').transform(v => v === 'true'),
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
  PUSH_PROVIDER_URL: z.string().optional(),
  PUSH_PROVIDER_TOKEN: z.string().optional(),
  EMAIL_PROVIDER_URL: z.string().optional(),
  EMAIL_PROVIDER_TOKEN: z.string().optional(),
  EMERGENCY_BATCH_SIZE: z.coerce.number().default(1000)
});

export const env = schema.parse(process.env);
