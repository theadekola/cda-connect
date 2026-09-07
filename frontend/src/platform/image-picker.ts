import {Camera,CameraResultType,CameraSource} from '@capacitor/camera';
export const MediaTypeOptions={Images:'Images',Videos:'Videos',All:'All'};
export type MediaType='images'|'videos'|'livePhotos';
export async function requestMediaLibraryPermissionsAsync(){return {status:'granted',granted:true}}
export async function requestCameraPermissionsAsync(){try{await Camera.requestPermissions();return {status:'granted',granted:true}}catch{return {status:'denied',granted:false}}}
async function pick(source:CameraSource,_options?:any){try{const photo=await Camera.getPhoto({source,resultType:CameraResultType.Uri,quality:85});const uri=photo.webPath||photo.path||'';return {canceled:false,assets:[{uri,width:0,height:0,type:'image',fileName:`photo.${photo.format||'jpeg'}`,mimeType:`image/${photo.format||'jpeg'}`,fileSize:0}]}}catch{return {canceled:true,assets:[] as any[]}}}
export const launchImageLibraryAsync=(options?:any)=>pick(CameraSource.Photos,options);
export const launchCameraAsync=(options?:any)=>pick(CameraSource.Camera,options);
