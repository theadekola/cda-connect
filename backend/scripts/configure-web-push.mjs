import fs from 'node:fs';
import webpush from 'web-push';
const target='/etc/cda-connect/backend.env';
if(process.platform!=='linux'||process.getuid?.()!==0)throw Error('Run with sudo on the Ubuntu application VM');
const original=fs.readFileSync(target,'utf8');
const publicPresent=/^VAPID_PUBLIC_KEY=.+$/m.test(original),privatePresent=/^VAPID_PRIVATE_KEY=.+$/m.test(original);
if(publicPresent&&privatePresent){console.log('Existing push keys preserved.');process.exit(0)}
if(publicPresent||privatePresent)throw Error('Only one VAPID key is configured. Repair the pair manually; existing subscriptions depend on it.');
const keys=webpush.generateVAPIDKeys();
const next=original.replace(/^VAPID_(PUBLIC_KEY|PRIVATE_KEY|SUBJECT)=.*\r?\n?/gm,'')+`\nVAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_SUBJECT=mailto:support@cdaconnect.org\n`;
fs.copyFileSync(target,target+'.before-web-push');fs.chmodSync(target+'.before-web-push',0o600);
fs.writeFileSync(target+'.push-tmp',next,{mode:0o600,flag:'wx'});fs.renameSync(target+'.push-tmp',target);
console.log('Push keys saved in the protected backend environment file. Restart cda-api and cda-worker.');
