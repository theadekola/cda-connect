import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api,type RecordData} from './api';
import {currentPosition} from './location';
import {ErrorBox,MutationForm} from './ui';
export function CommunityMapPosition({id,community:c}:{id:string;community:RecordData}){
 const cap=useQuery({queryKey:['/communities/'+id+'/capabilities'],queryFn:()=>api.get<{permissions:string[]}>('/communities/'+id+'/capabilities')}),[open,setOpen]=useState(false),[lat,setLat]=useState(c.Latitude==null?'':String(c.Latitude)),[lng,setLng]=useState(c.Longitude==null?'':String(c.Longitude)),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>();
 if(!cap.data?.permissions.includes('MEMBER_ROLE_CHANGE'))return null;
 return <section className="community-map-position"><button aria-expanded={open} onClick={()=>setOpen(!open)}>Set community map position</button>{open&&<><p>Set the community’s meeting point or centre so people can find it in nearby discovery. This is the community location, not your private location.</p><MutationForm label="Save map position" onSubmit={()=>api.send('/communities/'+id+'/location',{latitude:Number(lat),longitude:Number(lng)},'PATCH')}><label>Latitude<input required type="number" min="-90" max="90" step="any" value={lat} onChange={e=>setLat(e.target.value)}/></label><label>Longitude<input required type="number" min="-180" max="180" step="any" value={lng} onChange={e=>setLng(e.target.value)}/></label></MutationForm><button disabled={busy} onClick={async()=>{setBusy(true);setError(undefined);try{const p=await currentPosition();setLat(String(p.latitude));setLng(String(p.longitude))}catch(e){setError(e)}finally{setBusy(false)}}}>{busy?'Finding position…':'Use my current position'}</button><ErrorBox error={error}/></>}</section>
}
