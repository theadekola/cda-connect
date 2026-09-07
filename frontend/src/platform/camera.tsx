import {useState} from 'react';
export function useCameraPermissions(){const[state,setState]=useState<any>({granted:false,status:'undetermined'});return [state,async()=>{const next={granted:true,status:'granted'};setState(next);return next}] as const}
export function CameraView({style,children}:any){return <div style={style}><video autoPlay playsInline style={{width:'100%',height:'100%',objectFit:'cover'}}/>{children}</div>}
