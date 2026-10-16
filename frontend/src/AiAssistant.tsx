import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api,str,rows,type RecordData} from './api';
import {Page,Field,MutationForm,ErrorBox,Loading,Empty} from './ui';
export function AiAssistant(){
 const communities=useQuery({queryKey:['/communities'],queryFn:({signal})=>api.get<RecordData[]>('/communities',signal)}),[answer,setAnswer]=useState<RecordData|null>(null);
 return <Page title="CDA Connect AI" subtitle="Ask questions using information you are authorised to see in your communities."><div className="card narrow ai-card">
 {communities.isPending?<Loading/>:communities.error?<ErrorBox error={communities.error}/>:communities.data?.length?<MutationForm label="Ask AI" onSubmit={async data=>{setAnswer(null);setAnswer(await api.send<RecordData>('/communities/'+data.communityId+'/assistant/ask',{question:data.question}))}}><label>Community<select name="communityId" required defaultValue=""><option value="" disabled>Select a community</option>{communities.data.map(c=><option key={str(c.Id)} value={str(c.Id)}>{str(c.Name)}</option>)}</select></label><Field name="question" label="What would you like to know?" type="textarea"/></MutationForm>:<Empty text="Join a community to use CDA Connect AI."/>}
 {answer&&<section className="ai-answer" aria-live="polite"><h2>Answer</h2><p className="prose">{str(answer.answer)}</p>{answer.providerConfigured===false&&<><p className="muted">Generated answers are unavailable until the server AI provider is configured. You can read the authorised source information below.</p>{Object.entries((answer.context||{}) as RecordData).map(([kind,items])=>rows(items).length>0&&<section key={kind}><h3>{kind[0].toUpperCase()+kind.slice(1)}</h3>{rows(items).map((item,i)=><article className="card" key={str(item.Id)||i}><h4>{str(item.Title)}</h4><p className="prose">{str(item.DecisionText||item.Body||item.Location)}</p>{!!(item.StartDateTime||item.DecisionDate)&&<time>{new Date(str(item.StartDateTime||item.DecisionDate)).toLocaleString()}</time>}</article>)}</section>)}</>}</section>}
 </div></Page>;
}
