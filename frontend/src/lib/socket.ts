import {io} from 'socket.io-client'; import {useAuth} from '../store/auth';
export const socket=io(process.env.EXPO_PUBLIC_SOCKET_URL!,{autoConnect:false,transports:['websocket']});
export function connectSocket(){socket.auth={token:useAuth.getState().accessToken};if(!socket.connected)socket.connect();}
