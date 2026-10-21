import {Capacitor,SystemBars,SystemBarsStyle,SystemBarType} from '@capacitor/core';

// Capacitor calls DARK the style with light icons for a dark background.
// Queue updates so rapid sign-in/sign-out navigation cannot leave an older style.
let pending=Promise.resolve();
export function updateNativeChrome(authenticated:boolean){
 if(!Capacitor.isNativePlatform())return;
 pending=pending.catch(()=>{}).then(async()=>{
  await SystemBars.setStyle({bar:SystemBarType.StatusBar,style:authenticated?SystemBarsStyle.Dark:SystemBarsStyle.Light});
  // iOS ignores the bar selector: a second call would overwrite its status style.
  if(Capacitor.getPlatform()==='android')await SystemBars.setStyle({bar:SystemBarType.NavigationBar,style:SystemBarsStyle.Light});
 });
 void pending.catch(()=>{});
}
