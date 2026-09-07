import {Pressable,StyleSheet,Text,View} from '@/platform/react-native';
import {router,useLocalSearchParams} from '@/router';
import {useQuery} from '@tanstack/react-query';
import {Ionicons} from '@/platform/icons';
import {api} from '@/lib/api';
import {Card,EmptyState,Header,Muted,Screen,useAppTheme} from '@/components/UI';

export default function CommunityAnnouncements(){
  const{id,announcementId}=useLocalSearchParams<{id:string;announcementId?:string}>();const{palette}=useAppTheme();
  const community=useQuery<any>({queryKey:['community',id],queryFn:async()=>(await api.get(`/communities/${id}`)).data});
  const announcements=useQuery<any[]>({queryKey:['announcements',id],queryFn:async()=>(await api.get(`/communities/${id}/announcements`)).data});
  const ordered=[...(announcements.data||[])].sort((a,b)=>String(a.Id)===String(announcementId)?-1:String(b.Id)===String(announcementId)?1:new Date(b.CreatedAt).getTime()-new Date(a.CreatedAt).getTime());
  return <Screen scroll><Header title={`${community.data?.Name||'Community'} Announcements`} subtitle="Official notices and updates" right={<Pressable accessibilityLabel="Go back" onPress={()=>(router.canGoBack()?router.back():router.replace('/'))}><Ionicons name="close" size={24} color={palette.text}/></Pressable>}/>{announcements.isLoading?<Muted>Loading announcements…</Muted>:ordered.length?ordered.map(item=>{const selected=String(item.Id)===String(announcementId);return <Card key={item.Id} style={[styles.card,selected&&{borderColor:palette.success,borderWidth:2}]}><View style={styles.heading}><View style={[styles.icon,{backgroundColor:palette.successSoft}]}><Ionicons name="megaphone" size={22} color={palette.success}/></View><View style={{flex:1}}><Text style={[styles.title,{color:palette.text}]}>{item.Title}</Text><Muted>{new Date(item.CreatedAt).toLocaleString()}</Muted></View>{selected?<Text style={[styles.selected,{color:palette.success}]}>Selected</Text>:null}</View><Text style={[styles.body,{color:palette.text}]}>{item.Body}</Text></Card>}):<EmptyState icon="megaphone-outline" title="No announcements" body="Official community announcements will appear here."/>}</Screen>
}
const styles=StyleSheet.create({card:{padding:18},heading:{flexDirection:'row',alignItems:'center',gap:11},icon:{width:44,height:44,borderRadius:13,alignItems:'center',justifyContent:'center'},title:{fontSize:17,fontWeight:'900'},selected:{fontSize:12,fontWeight:'900'},body:{fontSize:15,lineHeight:23,marginTop:15}})
