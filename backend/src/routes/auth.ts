import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getPool, sql } from '../config/db.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { hashToken, signAccess, signRefresh, verifyRefresh } from '../utils/auth.js';
import { env } from '../config/env.js';

export const authRouter=Router();
const registerSchema=z.object({firstName:z.string().min(2).max(100),lastName:z.string().min(2).max(100),email:z.string().email(),phone:z.string().max(30).optional(),country:z.string().min(2).max(100),state:z.string().min(1).max(100),lga:z.string().min(1).max(150).optional(),postcode:z.string().min(1).max(30).optional(),address:z.string().min(5).max(500),dateOfBirth:z.coerce.date().max(new Date()),password:z.string().min(8).max(200)});
authRouter.post('/register',asyncHandler(async(req,res)=>{
  const d=registerSchema.parse(req.body); const pool=await getPool(); const email=d.email.toLowerCase();
  const exists=await pool.request().input('email',sql.NVarChar(255),email).query('SELECT Id FROM Users WHERE Email=@email');
  if(exists.recordset[0]) throw new AppError(409,'Email already registered');
  const passwordHash=await bcrypt.hash(d.password,12);
  const r=await pool.request().input('first',sql.NVarChar(100),d.firstName).input('last',sql.NVarChar(100),d.lastName).input('email',sql.NVarChar(255),email).input('phone',sql.NVarChar(30),d.phone??null).input('country',sql.NVarChar(100),d.country).input('state',sql.NVarChar(100),d.state).input('lga',sql.NVarChar(150),d.lga??null).input('postcode',sql.NVarChar(30),d.postcode??null).input('address',sql.NVarChar(500),d.address).input('dob',sql.Date,d.dateOfBirth).input('hash',sql.NVarChar(500),passwordHash).query(`INSERT INTO Users(FirstName,LastName,Email,Phone,Country,State,LGA,Postcode,Address,DateOfBirth,PasswordHash) OUTPUT INSERTED.Id,INSERTED.FirstName,INSERTED.LastName,INSERTED.Email VALUES(@first,@last,@email,@phone,@country,@state,@lga,@postcode,@address,@dob,@hash)`);
  const user={id:r.recordset[0].Id,email:r.recordset[0].Email}; const accessToken=signAccess(user); const refreshToken=signRefresh(user);
  await pool.request().input('uid',sql.UniqueIdentifier,user.id).input('hash',sql.NVarChar(64),hashToken(refreshToken)).input('exp',sql.DateTime2,new Date(Date.now()+env.JWT_REFRESH_EXPIRES_DAYS*86400000)).query('INSERT INTO UserSessions(UserId,RefreshTokenHash,ExpiresAt) VALUES(@uid,@hash,@exp)');
  res.status(201).json({user:r.recordset[0],accessToken,refreshToken});
}));
const loginSchema=z.object({email:z.string().email(),password:z.string().min(1)});
authRouter.post('/login',asyncHandler(async(req,res)=>{
  const d=loginSchema.parse(req.body); const pool=await getPool(); const r=await pool.request().input('email',sql.NVarChar(255),d.email.toLowerCase()).query(`SELECT TOP 1 Id,FirstName,LastName,Email,PasswordHash,ProfileImage,AccountStatus FROM Users WHERE Email=@email`);
  const row=r.recordset[0]; if(!row||!(await bcrypt.compare(d.password,row.PasswordHash))) throw new AppError(401,'Invalid email or password'); if(row.AccountStatus!=='ACTIVE') throw new AppError(403,'Account is not active');
  const user={id:row.Id,email:row.Email}; const accessToken=signAccess(user); const refreshToken=signRefresh(user);
  await pool.request().input('uid',sql.UniqueIdentifier,user.id).input('hash',sql.NVarChar(64),hashToken(refreshToken)).input('exp',sql.DateTime2,new Date(Date.now()+env.JWT_REFRESH_EXPIRES_DAYS*86400000)).query('INSERT INTO UserSessions(UserId,RefreshTokenHash,ExpiresAt) VALUES(@uid,@hash,@exp)');
  delete row.PasswordHash; res.json({user:row,accessToken,refreshToken});
}));
authRouter.post('/refresh',asyncHandler(async(req,res)=>{
  const token=z.object({refreshToken:z.string()}).parse(req.body).refreshToken; const payload=verifyRefresh(token); const pool=await getPool();
  const r=await pool.request().input('hash',sql.NVarChar(64),hashToken(token)).query('SELECT Id,RevokedAt,ExpiresAt FROM UserSessions WHERE RefreshTokenHash=@hash');
  const s=r.recordset[0]; if(!s||s.RevokedAt||new Date(s.ExpiresAt)<new Date()) throw new AppError(401,'Refresh token invalid');
  res.json({accessToken:signAccess({id:payload.id,email:payload.email})});
}));
authRouter.post('/logout',asyncHandler(async(req,res)=>{const token=z.object({refreshToken:z.string()}).parse(req.body).refreshToken; const pool=await getPool(); await pool.request().input('hash',sql.NVarChar(64),hashToken(token)).query('UPDATE UserSessions SET RevokedAt=SYSUTCDATETIME() WHERE RefreshTokenHash=@hash');res.status(204).end();}));
