import {Router} from 'express';
import {AppError,asyncHandler} from '../utils/errors.js';

export const emailChangeRouter=Router();
const registeredEmailLocked=asyncHandler(async()=>{
 throw new AppError(403,'Your registered email address is locked and cannot be changed');
});

emailChangeRouter.post('/account/email/start',registeredEmailLocked);
emailChangeRouter.post('/account/email/verify',registeredEmailLocked);
