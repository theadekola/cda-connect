export const RecordingPresets={HIGH_QUALITY:{}};export const AudioModule={requestRecordingPermissionsAsync:async()=>({granted:true,status:'granted'})};
export async function setAudioModeAsync(_options?:any){}
export function useAudioPlayer(source?:any){const audio=typeof Audio!=='undefined'?new Audio(typeof source==='string'?source:source?.uri):null;return {play:()=>audio?.play(),pause:()=>audio?.pause(),seekTo:(v:number)=>{if(audio)audio.currentTime=v},remove:()=>audio?.pause(),get currentTime(){return audio?.currentTime||0},get playing(){return !!audio&&!audio.paused}}}
export function useAudioRecorder(_preset?:any){return {uri:null as string|null,record:async()=>{},stop:async()=>{},prepareToRecordAsync:async()=>{}}}
export function useAudioRecorderState(_recorder?:any){return {isRecording:false,durationMillis:0}}
