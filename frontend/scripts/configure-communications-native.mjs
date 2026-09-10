import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=path.join(root,'android/app/src/main/AndroidManifest.xml');
if(fs.existsSync(manifest)){
 let xml=fs.readFileSync(manifest,'utf8');
 for(const permission of ['READ_CONTACTS','WRITE_CONTACTS'])if(!xml.includes('android.permission.'+permission))xml=xml.replace(/<manifest\b[^>]*>/,match=>match+`\n    <uses-permission android:name="android.permission.${permission}" />`);
 fs.writeFileSync(manifest,xml);console.log('Android contacts permissions configured. The app only reads phone numbers.');
}else console.log('Android project not generated; run this script after adding the Android platform.');
const plist=path.join(root,'ios/App/App/Info.plist');
if(fs.existsSync(plist)){
 let xml=fs.readFileSync(plist,'utf8');
 if(!xml.includes('<key>NSContactsUsageDescription</key>')){const index=xml.lastIndexOf('</dict>');if(index<0)throw Error('Expected an XML Info.plist dictionary');xml=xml.slice(0,index)+'\t<key>NSContactsUsageDescription</key>\n\t<string>CDA Connect uses phone numbers from contacts you allow to find eligible members in your communities. Unmatched numbers are not saved.</string>\n'+xml.slice(index);fs.writeFileSync(plist,xml)}
 console.log('iOS contacts permission description configured.');
}else console.log('iOS project not generated; run this script after adding the iOS platform.');
