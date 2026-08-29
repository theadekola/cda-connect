import {Pressable,StyleSheet,Text,View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {useQuery} from '@tanstack/react-query';
import {Ionicons} from '@expo/vector-icons';
import {api} from '@/lib/api';
import {Button,Card,EmptyState,Muted,Screen,useAppTheme} from '@/components/UI';

export default function TakeAttendance(){
  const {id}=useLocalSearchParams<{id:string}>();
  const {palette}=useAppTheme();
  const q=useQuery<any>({queryKey:['attendance',id],enabled:Boolean(id),retry:1,queryFn:async()=>(await api.get(`/communities/${id}/attendance`)).data});
  const meetings=Array.isArray(q.data?.meetings)?q.data.meetings:[];
  const upcoming=meetings.filter((meeting:any)=>new Date(meeting.EndDateTime).getTime()>Date.now());

  return <Screen scroll contentStyle={s.page}>
    {q.isLoading?<Card style={s.statusCard}><Muted>Loading active meetings…</Muted></Card>
      :q.isError?<Card style={s.statusCard}><EmptyState icon="cloud-offline-outline" title="Attendance unavailable" body="The active meetings could not be loaded. Check your connection and try again."/><Button title="Try Again" variant="secondary" icon="refresh-outline" loading={q.isFetching} onPress={()=>q.refetch()}/></Card>
      :!q.data?.canManage?<EmptyState icon="lock-closed-outline" title="Restricted access" body="Only community administrators and moderators can take attendance."/>
      :upcoming.length?upcoming.map((meeting:any)=><Pressable key={meeting.Id} accessibilityRole="button" accessibilityLabel={`Take attendance for ${meeting.Title}`} onPress={()=>router.push(`/community/${id}/attendance/${meeting.Id}` as any)}><Card style={s.card}><View style={[s.icon,{backgroundColor:palette.primarySoft}]}><Ionicons name="calendar-outline" size={28} color={palette.primary}/></View><View style={s.copy}><Text style={[s.meeting,{color:palette.text}]}>{meeting.Title}</Text><Muted>{new Date(meeting.StartDateTime).toLocaleString()}</Muted><Muted numberOfLines={2}>{meeting.Location||'Online meeting'}</Muted><Text style={[s.checkedIn,{color:palette.primary}]}>{meeting.PresentCount||0} checked in</Text></View><Ionicons name="chevron-forward" size={21} color={palette.muted}/></Card></Pressable>)
      :<EmptyState icon="calendar-outline" title="No active meetings" body="Schedule a meeting first. Its attendance code will be generated automatically."/>}
  </Screen>;
}

const s=StyleSheet.create({page:{width:'100%',maxWidth:800,alignSelf:'center',paddingHorizontal:16,paddingTop:16,paddingBottom:120},statusCard:{gap:16},card:{flexDirection:'row',alignItems:'center',gap:14},icon:{width:56,height:56,borderRadius:18,alignItems:'center',justifyContent:'center',flexShrink:0},copy:{flex:1,minWidth:0,gap:2},meeting:{fontSize:17,fontWeight:'900'},checkedIn:{fontWeight:'800',marginTop:5}});
