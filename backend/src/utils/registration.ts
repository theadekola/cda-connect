import jwt from 'jsonwebtoken';
import {env} from '../config/env.js';
import {AppError} from './errors.js';
export function verifyRegistrationIdentity(d:{verificationMethod:'email';email:string;emailVerificationToken?:string}){
 const token=d.emailVerificationToken;
 let claim:jwt.JwtPayload;
 try{const decoded=jwt.verify(token||'',env.JWT_ACCESS_SECRET,{algorithms:['HS256']});if(typeof decoded==='string'||typeof decoded.exp!=='number')throw Error();claim=decoded}catch{throw new AppError(400,'Verification has expired. Request a new code.')}
 if(claim.purpose!=='email-verification'||claim.email!==d.email)throw new AppError(400,'Verification does not match your registration details.');
 return {emailVerified:true,phoneVerified:false};
}

