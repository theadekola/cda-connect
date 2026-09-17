import type {CapacitorConfig} from '@capacitor/cli';
const config:CapacitorConfig={appId:'org.cdaconnect.app',appName:'CDA Connect',webDir:'dist',ios:{contentInset:'never'},plugins:{CapacitorHttp:{enabled:true},SystemBars:{insetsHandling:'css',style:'LIGHT',hidden:false}},server:{androidScheme:'https'}};
export default config;
