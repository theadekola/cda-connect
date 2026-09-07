import {Platform} from '@/platform/react-native';
import * as Device from '@/platform/device';
import * as Notifications from '@/platform/notifications';
import {api} from './api';
import {secureDelete,secureGet,secureSet} from './storage';

Notifications.setNotificationHandler({
  handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:true}),
});

export async function registerForPushNotifications(){
  if(Platform.OS==='web'||!Device.isDevice)return null;
  if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('default',{
    name:'CDA Connect',
    importance:Notifications.AndroidImportance.HIGH,
    vibrationPattern:[0,250,250,250],
    lightColor:'#0F8A43',
    sound:'default',
  });
  let permission=await Notifications.getPermissionsAsync();
  if(permission.status!=='granted')permission=await Notifications.requestPermissionsAsync();
  if(permission.status!=='granted')return null;
  const token=(await Notifications.getPushTokenAsync()).data;
  await api.post('/users/devices',{
    deviceToken:token,
    platform:Platform.OS,
    deviceName:Device.modelName??undefined,
  });
  await api.post('/users/devices/timezone',{timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'});
  await secureSet('push-device-token',token);
  return token;
}

export async function removePushDevice(){
  const token=await secureGet('push-device-token');
  if(!token)return;
  try{await api.delete('/users/devices',{data:{deviceToken:token}})}finally{await secureDelete('push-device-token')}
}

export function notificationPath(data:Record<string,unknown>){
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const communityId=typeof data.communityId==='string'&&uuid.test(data.communityId)?data.communityId:null;
  const type=String(data.type??'').toUpperCase();
  const entity=(key:string)=>typeof data[key]==='string'&&uuid.test(String(data[key]))?String(data[key]):null;
  if(communityId&&type.includes('CHAT'))return entity('conversationId')?`/chat/${entity('conversationId')}`:`/community/${communityId}/chat`;
  if(communityId&&type.includes('EVENT'))return `/community/${communityId}/events`;
  if(communityId&&type.includes('MEETING'))return `/community/${communityId}/meetings`;
  if(communityId&&type.includes('POLL'))return entity('pollId')?`/community/${communityId}/poll/${entity('pollId')}`:`/community/${communityId}/polls`;
  if(communityId&&type.includes('POST')||communityId&&type.includes('COMMENT'))return entity('postId')?`/community/${communityId}/post/${entity('postId')}`:`/community/${communityId}/feed`;
  if(communityId&&type.includes('EMERGENCY'))return `/community/${communityId}/alerts`;
  if(communityId&&['ANNOUNCEMENT','DOCUMENT','MARKETPLACE'].some(value=>type.includes(value)))return `/community/${communityId}/feed`;
  return '/notifications';
}
