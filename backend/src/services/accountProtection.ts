import type { ConnectionPool } from 'mssql';
import { getPool, sql as mssql } from '../config/db.js';
import { AppError } from '../utils/errors.js';

export async function assertAccountCanClose(userId:string,pool?:ConnectionPool){
 const connection=pool??await getPool();
 const result=await connection.request().input('u',mssql.UniqueIdentifier,userId)
  .query('SELECT IsProtectedAccount FROM Users WHERE Id=@u');
 if(result.recordset[0]?.IsProtectedAccount)throw new AppError(403,'The protected super-admin account cannot be deleted or deactivated');
}
