import {readFile} from 'node:fs/promises';
import {getPool} from './config/db.js';
const pool=await getPool();try{
 const ready=(await pool.request().query(`SELECT CASE WHEN COL_LENGTH('NotificationOutbox','DispatchComplete') IS NOT NULL AND COL_LENGTH('NotificationDeliveries','JobId') IS NOT NULL AND COL_LENGTH('EmergencyNotificationDeliveries','UpdatedAt') IS NOT NULL AND EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name='FK_FormalBallotVotes_BallotOption') THEN 1 ELSE 0 END Ready`)).recordset[0]?.Ready;
 if(!ready)await pool.request().batch(await readFile(new URL('../sql/delivery-integrity.sql',import.meta.url),'utf8'));
 console.log('Delivery integrity schema ready');
}catch(e){console.error('Apply backend/sql/delivery-integrity.sql as a database administrator before deploying.',e);process.exitCode=1}finally{await pool.close()}
