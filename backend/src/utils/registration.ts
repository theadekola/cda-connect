import jwt from 'jsonwebtoken';
import {env} from '../config/env.js';
import {AppError} from './errors.js';
export function verifyRegistrationIdentity(d:{verificationMethod:'sms'|'email';email:string;phone?:string|null;phoneVerificationToken?:string;emailVerificationToken?:string}){
 const isEmail=d.verificationMethod==='email';
 const token=isEmail?d.emailVerificationToken:d.phoneVerificationToken;
 if(!isEmail&&d.phone&&env.NODE_ENV!=='production'&&env.ALLOW_PHONE_VERIFICATION_BYPASS&&token==='development-bypass')return {emailVerified:false,phoneVerified:false};
 let claim:jwt.JwtPayload;
 try{const decoded=jwt.verify(token||'',env.JWT_ACCESS_SECRET,{algorithms:['HS256']});if(typeof decoded==='string'||typeof decoded.exp!=='number')throw Error();claim=decoded}catch{throw new AppError(400,'Verification has expired. Request a new code.')}
 if(isEmail?(claim.purpose!=='email-verification'||claim.email!==d.email):(!d.phone||claim.purpose!=='phone-verification'||claim.phone!==d.phone))throw new AppError(400,'Verification does not match your registration details.');
 return {emailVerified:isEmail,phoneVerified:!isEmail};
}

