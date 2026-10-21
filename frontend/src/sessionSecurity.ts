import {session} from './api';
import {Capacitor} from '@capacitor/core';
import {BiometricAuth,BiometryType,type CheckBiometryResult} from '@aparajita/capacitor-biometric-auth';

const BIOMETRIC_KEY='cda-biometric-unlock';

function read(key:string){try{return localStorage.getItem(key)}catch{return null}}
function write(key:string,value:string){try{localStorage.setItem(key,value)}catch{/* Device preferences are best effort. */}}

export function nativeBiometricsSupported(){return Capacitor.isNativePlatform()}
export function getBiometricEnabled(){return nativeBiometricsSupported()&&read(BIOMETRIC_KEY)==='true'}

let locked=getBiometricEnabled(),foreground=true,lockVersion=0;
let authentication:Promise<void>|null=null;
type Verification={version:number;userId:string;at:number};
let verified:Verification|null=null;
const lockListeners=new Set<()=>void>();
function publishLock(){lockListeners.forEach(listener=>listener())}
function showLock(value:boolean){if(locked!==value){locked=value;publishLock()}}
function invalidateVerification(){lockVersion++;verified=null}
function accountActive(userId:string){
 const current=session.get(),expires=current?.sessionExpiresAt;
 return current?.user.Id===userId&&(!expires||(Number.isFinite(Date.parse(expires))&&Date.now()<Date.parse(expires)));
}
function finishVerification(){
 if(!verified)return;
 if(verified.version!==lockVersion||!accountActive(verified.userId)||Date.now()-verified.at>30000){verified=null;return}
 if(foreground){invalidateVerification();showLock(false)}
}
export const biometricLock={
 get:()=>locked,
 subscribe:(listener:()=>void)=>{lockListeners.add(listener);return()=>lockListeners.delete(listener)},
 // Explicit locks revoke older in-flight results, even when already locked.
 lock:()=>{invalidateVerification();if(getBiometricEnabled())showLock(true)},
 unlock:()=>{invalidateVerification();showLock(false)},
 setForeground:(active:boolean)=>{
  foreground=active;
  if(!active){
   // Native authentication itself can make the app inactive. Keep its result
   // pending, with private content covered, until the same account resumes.
   if(!authentication)invalidateVerification();
   if(getBiometricEnabled())showLock(true);
  }else finishVerification();
 },
};

export function setBiometricEnabled(enabled:boolean){
 write(BIOMETRIC_KEY,String(enabled));
 if(!enabled)biometricLock.unlock();
 else if(!foreground)showLock(true);
}

export async function checkBiometricAvailability(){
 if(!nativeBiometricsSupported())return null;
 return BiometricAuth.checkBiometry();
}

export function biometryLabel(info:CheckBiometryResult|null){
 if(!info)return 'Device unlock';
 const labels:Partial<Record<BiometryType,string>>={
  [BiometryType.touchId]:'Touch ID',
  [BiometryType.faceId]:'Face ID',
  [BiometryType.fingerprintAuthentication]:'Fingerprint',
  [BiometryType.faceAuthentication]:'Face unlock',
  [BiometryType.irisAuthentication]:'Iris unlock',
 };
 return labels[info.biometryType]||(info.deviceIsSecure?'Device unlock':'Biometric unlock');
}

export function authenticateBiometric(){
 if(!authentication){const version=lockVersion,userId=session.get()?.user.Id;authentication=(async()=>{
  if(!userId||!accountActive(userId))throw new Error('Your session has ended. Sign in with your email and password.');
  const info=await checkBiometricAvailability();
  if(!info||( !info.isAvailable&&!info.deviceIsSecure))throw new Error(info?.reason||'Set up a screen lock or biometric unlock in your phone settings first.');
  if(version!==lockVersion||!accountActive(userId))throw new Error('Your sign-in changed. Unlock again or sign in with your email and password.');
  if(!foreground)throw new Error('Return to CDA Connect to unlock the app.');
  await BiometricAuth.authenticate({reason:'Unlock CDA Connect',cancelTitle:'Cancel',allowDeviceCredential:true,iosFallbackTitle:'Use device passcode',androidTitle:'Unlock CDA Connect',androidSubtitle:'Confirm your identity',androidConfirmationRequired:false});
  if(version!==lockVersion||!accountActive(userId))throw new Error('Your sign-in changed. Unlock again or sign in with your email and password.');
  verified={version,userId,at:Date.now()};finishVerification();
 })().finally(()=>{authentication=null})}
 return authentication;
}
