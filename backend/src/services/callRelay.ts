import {createHmac} from 'node:crypto';
import {z} from 'zod';
import {AppError} from '../utils/errors.js';

type RelayConfig={NODE_ENV:string;RTC_ICE_SERVERS:string;RTC_TURN_URLS?:string;RTC_TURN_SECRET?:string;RTC_TURN_TTL_SECONDS:number};
const serverSchema=z.array(z.object({urls:z.union([z.string().min(1),z.array(z.string().min(1)).min(1)]),username:z.string().optional(),credential:z.string().optional()})).min(1).max(8);
const turnUrl=/^turns?:[a-z0-9.-]+:\d{1,5}(?:\?transport=(?:udp|tcp))?$/i;
export function callRelayServers(config:RelayConfig,userId:string,now=Date.now()){
  let servers:z.infer<typeof serverSchema>;
  try{servers=serverSchema.parse(JSON.parse(config.RTC_ICE_SERVERS))}catch{throw new AppError(503,'Call relay configuration is invalid')}
  if(config.RTC_TURN_URLS||config.RTC_TURN_SECRET){
    const urls=config.RTC_TURN_URLS?.split(',').map(value=>value.trim()).filter(Boolean)??[];
    if(!urls.length||!urls.every(url=>turnUrl.test(url)&&!url.includes('example.')&&Number(url.split(':').at(-1)?.split('?')[0])>0&&Number(url.split(':').at(-1)?.split('?')[0])<=65535)||!config.RTC_TURN_SECRET||!/^[a-f0-9]{64}$/i.test(config.RTC_TURN_SECRET)||!Number.isInteger(config.RTC_TURN_TTL_SECONDS)||config.RTC_TURN_TTL_SECONDS<300||config.RTC_TURN_TTL_SECONDS>86400)throw new AppError(503,'Call relay configuration is invalid');
    const username=String(Math.floor(now/1000)+config.RTC_TURN_TTL_SECONDS)+':'+userId;
    // Coturn TURN REST authentication. The shared secret never reaches the client.
    const credential=createHmac('sha1',config.RTC_TURN_SECRET).update(username).digest('base64');
    servers=servers.filter(server=>[server.urls].flat().every(url=>url.startsWith('stun:')));
    servers.push({urls,username,credential});
  }
  const relay=servers.some(server=>[server.urls].flat().some(url=>turnUrl.test(url)&&!url.includes('example.'))&&Boolean(server.username&&server.credential)&&!/(replace.with|change.me)/i.test(server.credential!));
  if(config.NODE_ENV==='production'&&!relay)throw new AppError(503,'Call relay is not configured');
  return servers;
}
