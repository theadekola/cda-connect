import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=path.join(root,'android/app/src/main/AndroidManifest.xml');
if(fs.existsSync(manifest)){
 let xml=fs.readFileSync(manifest,'utf8');
 for(const permission of ['RECORD_AUDIO','CAMERA','MODIFY_AUDIO_SETTINGS','READ_CONTACTS','WRITE_CONTACTS','ACCESS_COARSE_LOCATION','ACCESS_FINE_LOCATION'])if(!xml.includes('android.permission.'+permission))xml=xml.replace(/<manifest\b[^>]*>/,match=>match+`\n    <uses-permission android:name="android.permission.${permission}" />`);
 fs.writeFileSync(manifest,xml);console.log('Android contacts, location, microphone and camera permissions configured.');
}else console.log('Android project not generated; run this script after adding the Android platform.');
const plist=path.join(root,'ios/App/App/Info.plist');
if(fs.existsSync(plist)){
 let xml=fs.readFileSync(plist,'utf8');
 if(!xml.includes('<key>NSContactsUsageDescription</key>')){const index=xml.lastIndexOf('</dict>');if(index<0)throw Error('Expected an XML Info.plist dictionary');xml=xml.slice(0,index)+'\t<key>NSContactsUsageDescription</key>\n\t<string>CDA Connect uses phone numbers from contacts you allow to find eligible members in your communities. Unmatched numbers are not saved.</string>\n'+xml.slice(index);fs.writeFileSync(plist,xml)}
 for(const key of ['NSLocationWhenInUseUsageDescription','NSLocationAlwaysAndWhenInUseUsageDescription'])if(!xml.includes('<key>'+key+'</key>'))xml=xml.replace(/<\/dict>\s*<\/plist>/,'\t<key>'+key+'</key>\n\t<string>CDA Connect uses your location only when requested to find nearby communities or set a community map position.</string>\n</dict>\n</plist>');
 for(const [key,description] of [['NSMicrophoneUsageDescription','CDA Connect uses your microphone when you record voice messages or join calls.'],['NSCameraUsageDescription','CDA Connect uses your camera when you join video calls.']])if(!xml.includes('<key>'+key+'</key>'))xml=xml.replace(/<\/dict>\s*<\/plist>/,'<key>'+key+'</key><string>'+description+'</string>\n</dict>\n</plist>');
 fs.writeFileSync(plist,xml);
 console.log('iOS contacts, location, microphone and camera permission descriptions configured.');
}else console.log('iOS project not generated; run this script after adding the iOS platform.');
