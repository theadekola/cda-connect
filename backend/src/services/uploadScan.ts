import {createConnection} from 'node:net';
import {env} from '../config/env.js';
import {AppError} from '../utils/errors.js';
// Nothing reaches object storage until the original upload receives a clean verdict.
// clamd is reached over a local Unix socket, never a public unauthenticated port.
export async function scanUpload(buffer:Buffer){
 if(!env.CLAMAV_SOCKET){if(env.NODE_ENV==='production')throw new AppError(503,'Upload scanning is not configured. Contact support.');return}
 await new Promise<void>((resolve,reject)=>{
  const socket=createConnection({path:env.CLAMAV_SOCKET!});let result='';let settled=false;
  const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);socket.destroy();error?reject(error):resolve()};
  const unavailable=()=>finish(new AppError(503,'Upload scanning is unavailable. Please try again later.'));
  const timer=setTimeout(unavailable,25000);
  socket.on('error',unavailable);socket.on('close',()=>{if(!settled)unavailable()});
  socket.on('data',chunk=>{result+=chunk.toString('utf8');if(result.length>4096)return unavailable();if(!/[\0\n]/.test(result))return;const verdict=result.replace(/[\0\r\n]+$/,'');if(verdict==='stream: OK')finish();else if(/^stream: .+ FOUND$/.test(verdict))finish(new AppError(400,'This file failed the security scan. Choose another file.'));else unavailable()});
  socket.once('connect',()=>{const size=Buffer.alloc(4);size.writeUInt32BE(buffer.length);socket.write('zINSTREAM\0');socket.write(size);socket.write(buffer);socket.write(Buffer.alloc(4))});
 });
}
