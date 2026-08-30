import {Platform} from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import {api} from './api';

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
  const projectId=Constants.easConfig?.projectId??Constants.expoConfig?.extra?.eas?.projectId;
  const token=(await Notifications.getExpoPushTokenAsync(projectId?{projectId}:undefined)).data;
  await api.post('/users/devices',{
    deviceToken:token,
    platform:Platform.OS,
    deviceName:Device.modelName??undefined,
  });
  return token;
}

export function notificationPath(data:Record<string,unknown>){
  const communityId=typeof data.communityId==='string'?data.communityId:null;
  const type=String(data.type??'').toUpperCase();
  if(communityId&&type.includes('CHAT'))return `/community/${communityId}/chat`;
  if(communityId&&type.includes('EVENT'))return `/community/${communityId}/events`;
  if(communityId&&type.includes('MEETING'))return `/community/${communityId}/meetings`;
  if(communityId)return `/community/${communityId}/feed`;
  return '/notifications';
}
