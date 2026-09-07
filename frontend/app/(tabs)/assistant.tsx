import {useEffect,useMemo,useState} from 'react';
import {Alert,Pressable,StyleSheet,Text,View} from '@/platform/react-native';
import {useQuery} from '@tanstack/react-query';
import {api} from '@/lib/api';
import {useCommunity} from '@/store/community';
import {Button,Card,EmptyState,Input,Muted,Screen,useAppTheme} from '@/components/UI';

type Community={Id:string;Name:string};
const suggestions=['When is our next meeting?','What decisions were made recently?','Find the latest community announcement.','Explain the latest community policy.'];

export default function AssistantTab(){
 const{palette}=useAppTheme(),current=useCommunity(s=>s.current),setCurrent=useCommunity(s=>s.setCurrent);const[q,setQ]=useState(''),[result,setResult]=useState<any>(null),[loading,setLoading]=useState(false);
 const communities=useQuery<Community[]>({queryKey:['communities'],queryFn:async()=>(await api.get('/communities')).data});
 const selected=useMemo(()=>communities.data?.find(c=>c.Id===current?.Id)||communities.data?.[0],[communities.data,current?.Id]);
 useEffect(()=>{if(selected&&selected.Id!==current?.Id)setCurrent(selected as any)},[selected,current?.Id,setCurrent]);
 async function ask(text=q){if(!selected||!text.trim())return;setLoading(true);try{const response=await api.post(`/communities/${selected.Id}/assistant/ask`,{question:text.trim(),mode:'MEMBER'});setResult(response.data);setQ(text.trim())}catch(e:any){Alert.alert('CDA Assistant',e.response?.data?.error||e.response?.data?.message||'The assistant could not complete this request.')}finally{setLoading(false)}}
 if(communities.isLoading)return <Screen contentStyle={s.page}><Muted>Loading CDA Assistant…</Muted></Screen>;
 if(!selected)return <Screen contentStyle={s.page}><EmptyState icon="sparkles-outline" title="CDA Assistant" body="Join a community before asking questions about its meetings, decisions and records."/></Screen>;
 return <Screen scroll contentStyle={s.page}><View style={s.intro}><Text style={[s.title,{color:palette.text}]}>CDA Assistant</Text><Muted>Ask permission-aware questions about {selected.Name}.</Muted></View><View style={s.chips}>{suggestions.map(text=><Pressable key={text} accessibilityRole="button" onPress={()=>void ask(text)} style={[s.chip,{borderColor:palette.border,backgroundColor:palette.surface}]}><Text style={{color:palette.text}}>{text}</Text></Pressable>)}</View><Input value={q} onChangeText={setQ} placeholder="Ask about meetings, decisions, posts or policies"/><Button title="Ask CDA Assistant" icon="sparkles-outline" loading={loading} disabled={!q.trim()||loading} onPress={()=>void ask()}/>{result?<Card style={s.answer}><Text style={[s.answerTitle,{color:palette.text}]}>{result.answer||'Authorised community information'}</Text>{result.context?.decisions?.map((x:any)=><Muted key={x.Id}>• Decision: {x.Title} — {x.DecisionText}</Muted>)}{result.context?.documents?.map((x:any)=><Muted key={x.Id}>• Document: {x.Title} ({x.Category})</Muted>)}{result.context?.announcements?.slice(0,3).map((x:any)=><Muted key={x.Id}>• Announcement: {x.Title}</Muted>)}{result.context?.meetings?.slice(0,3).map((x:any)=><Muted key={x.Id}>• Meeting: {x.Title} · {new Date(x.StartDateTime).toLocaleString()}</Muted>)}</Card>:null}</Screen>
}

const s=StyleSheet.create({page:{width:'100%',maxWidth:760,alignSelf:'center',paddingBottom:120},intro:{marginBottom:12},title:{fontSize:23,fontWeight:'900'},chips:{gap:7,marginBottom:10},chip:{borderWidth:1,borderRadius:12,padding:10},answer:{marginTop:10,gap:6},answerTitle:{fontWeight:'900',marginBottom:4}});
