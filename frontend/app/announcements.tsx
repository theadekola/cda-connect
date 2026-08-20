import {Pressable,StyleSheet,Text,View} from 'react-native';
import {router} from 'expo-router';
import {useQuery} from '@tanstack/react-query';
import {Ionicons} from '@expo/vector-icons';
import {api} from '@/lib/api';
import {Card,EmptyState,Header,Muted,Screen,useAppTheme} from '@/components/UI';
export default function Announcements(){const{palette}=useAppTheme();const q=useQuery<any[]>({queryKey:['all-announcements'],queryFn:async()=>(await api.get('/me/announcements')).data});return <Screen scroll><Header title="Community Announcements" subtitle="Notices from all your communities, newest first"/>{q.data?.length?q.data.map(x=><Pressable key={x.Id} onPress={()=>router.push(`/community/${x.CommunityId}/announcements?announcementId=${x.Id}` as any)}><Card><View style={s.row}><View style={[s.icon,{backgroundColor:palette.successSoft}]}><Ionicons name="megaphone" size={21} color={palette.success}/></View><View style={{flex:1}}><Text style={[s.title,{color:palette.text}]}>{x.Title}</Text><Muted>{x.CommunityName} · {new Date(x.CreatedAt).toLocaleString()}</Muted></View><Ionicons name="chevron-forward" size={19} color={palette.muted}/></View><Muted style={{marginTop:10}}>{x.Body}</Muted></Card></Pressable>):q.isLoading?<Muted>Loading announcements…</Muted>:<EmptyState icon="megaphone-outline" title="No announcements" body="Community notices will appear here."/>}</Screen>}
const s=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',gap:11},icon:{width:43,height:43,borderRadius:13,alignItems:'center',justifyContent:'center'},title:{fontWeight:'900'}})
