import sql from 'mssql';
import { env } from './env.js';

const config: sql.config = {
  server: env.DB_SERVER,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  pool: { max: 20, min: 1, idleTimeoutMillis: 30000 },
  options: { encrypt: env.DB_ENCRYPT, trustServerCertificate: env.DB_TRUST_CERT }
};

let pool: sql.ConnectionPool | null = null;
let connecting: Promise<sql.ConnectionPool> | null = null;
export async function getPool() {
  if (pool?.connected) return pool;
  if (!connecting) {
    connecting = (async () => {
      const candidate = new sql.ConnectionPool(config);
      candidate.on('error', (error: Error) => console.error('SQL pool error', error));
      try { pool = await candidate.connect(); return pool; }
      catch (error) { await candidate.close().catch(() => {}); throw error; }
      finally { connecting = null; }
    })();
  }
  return connecting;
}
export { sql };
