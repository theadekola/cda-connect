import {Capacitor} from '@capacitor/core';
import {BiometricAuth,BiometryType,type CheckBiometryResult} from '@aparajita/capacitor-biometric-auth';

const TIMEOUT_KEY='cda-auto-logout-minutes';
const LAST_ACTIVITY_KEY='cda-session-last-activity';
const BIOMETRIC_KEY='cda-biometric-unlock';
export const AUTO_LOGOUT_OPTIONS=[5,15,30,60] as const;
export type AutoLogoutMinutes=typeof AUTO_LOGOUT_OPTIONS[number];

function read(key:string){try{return localStorage.getItem(key)}catch{return null}}
function write(key:string,value:string){try{localStorage.setItem(key,value)}catch{/* Device preferences are best effort. */}}

export function getAutoLogoutMinutes():AutoLogoutMinutes{
 const value=Number(read(TIMEOUT_KEY));
 return AUTO_LOGOUT_OPTIONS.includes(value as AutoLogoutMinutes)?value as AutoLogoutMinutes:15;
}
export function setAutoLogoutMinutes(value:AutoLogoutMinutes){write(TIMEOUT_KEY,String(value));recordSessionActivity(true)}

let lastActivityWrite=0;
export function recordSessionActivity(force=false){
 const now=Date.now();
 if(force||now-lastActivityWrite>=15000){lastActivityWrite=now;write(LAST_ACTIVITY_KEY,String(now))}
}
export function getLastSessionActivity(){const value=Number(read(LAST_ACTIVITY_KEY));if(Number.isFinite(value)&&value>0)return value;const now=Date.now();recordSessionActivity(true);return now}
export function sessionHasExpired(now=Date.now(),lastActivity=getLastSessionActivity(),minutes=getAutoLogoutMinutes()){return now-lastActivity>=minutes*60_000}

export function nativeBiometricsSupported(){return Capacitor.isNativePlatform()}
export function getBiometricEnabled(){return nativeBiometricsSupported()&&read(BIOMETRIC_KEY)==='true'}

let locked=getBiometricEnabled();
const lockListeners=new Set<()=>void>();
function publishLock(){lockListeners.forEach(listener=>listener())}
export const biometricLock={
 get:()=>locked,
 subscribe:(listener:()=>void)=>{lockListeners.add(listener);return()=>lockListeners.delete(listener)},
 lock:()=>{if(getBiometricEnabled()&&!locked){locked=true;publishLock()}},
 unlock:()=>{if(locked){locked=false;publishLock()}},
};

export function setBiometricEnabled(enabled:boolean){
 write(BIOMETRIC_KEY,String(enabled));
 if(!enabled)biometricLock.unlock();
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

let authentication:Promise<void>|null=null;
export function authenticateBiometric(){
 if(!authentication)authentication=(async()=>{
  const info=await checkBiometricAvailability();
  if(!info||( !info.isAvailable&&!info.deviceIsSecure))throw new Error(info?.reason||'Set up a screen lock or biometric unlock in your phone settings first.');
  await BiometricAuth.authenticate({reason:'Unlock CDA Connect',cancelTitle:'Cancel',allowDeviceCredential:true,iosFallbackTitle:'Use device passcode',androidTitle:'Unlock CDA Connect',androidSubtitle:'Confirm your identity',androidConfirmationRequired:false});
  biometricLock.unlock();
 })().finally(()=>{authentication=null});
 return authentication;
}
