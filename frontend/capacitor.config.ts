import type {CapacitorConfig} from '@capacitor/cli';
const config:CapacitorConfig={appId:'org.cdaconnect.app',appName:'CDA Connect',webDir:'dist',ios:{contentInset:'never'},plugins:{PushNotifications:{presentationOptions:['badge','sound','banner','list']},CapacitorHttp:{enabled:true},SystemBars:{insetsHandling:'css',style:'LIGHT',hidden:false}},server:{androidScheme:'https'}};
export default config;
