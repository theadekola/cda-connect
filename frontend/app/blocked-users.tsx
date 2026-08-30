import {Alert,Platform,Pressable,StyleSheet,Text,View} from 'react-native';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {api} from '@/lib/api';
import {Avatar,EmptyState,Muted,Screen,useAppTheme} from '@/components/UI';

type BlockedUser={Id:string;FirstName:string;LastName:string;ProfileImage?:string;Email?:string};

export default function BlockedUsers(){
 const{palette}=useAppTheme(),queryClient=useQueryClient();
 const users=useQuery<BlockedUser[]>({queryKey:['blocked-users'],queryFn:async()=>(await api.get('/me/blocked-users')).data});
 const unblock=useMutation({mutationFn:async(id:string)=>api.post(`/me/blocked-users/${id}`),onSuccess:()=>queryClient.invalidateQueries({queryKey:['blocked-users']}),onError:(e:any)=>Alert.alert('Unable to unblock user',e.response?.data?.error||e.message)});
 const confirm=(user:BlockedUser)=>{const message=`${user.FirstName} ${user.LastName} will be able to interact with you again.`;if(Platform.OS==='web'){if(globalThis.confirm(`Unblock user?\n\n${message}`))unblock.mutate(user.Id);return}Alert.alert('Unblock user?',message,[{text:'Cancel',style:'cancel'},{text:'Unblock',onPress:()=>unblock.mutate(user.Id)}])};
 return <Screen scroll contentStyle={s.page}><Muted>Review people you have blocked and unblock them when you choose.</Muted><View style={[s.list,{borderColor:palette.border,backgroundColor:palette.surface}]}>{users.isLoading?<Muted style={s.empty}>Loading blocked users…</Muted>:users.data?.length?users.data.map(user=><View key={user.Id} style={[s.row,{borderBottomColor:palette.border}]}><Avatar name={`${user.FirstName} ${user.LastName}`} uri={user.ProfileImage} size={48}/><View style={{flex:1}}><Text style={[s.name,{color:palette.text}]}>{user.FirstName} {user.LastName}</Text><Muted>{user.Email||'CDA Connect member'}</Muted></View><Pressable disabled={unblock.isPending} accessibilityRole="button" accessibilityLabel={`Unblock ${user.FirstName} ${user.LastName}`} onPress={()=>confirm(user)} style={[s.button,{borderColor:palette.danger}]}><Text style={{color:palette.danger,fontWeight:'900'}}>Unblock</Text></Pressable></View>):<EmptyState icon="person-remove-outline" title="No blocked users" body="People you block will appear here."/>}</View></Screen>;
}

const s=StyleSheet.create({page:{width:'100%',maxWidth:760,alignSelf:'center',paddingTop:18,paddingBottom:30},list:{borderWidth:1,borderRadius:14,overflow:'hidden',marginTop:18},row:{minHeight:78,padding:13,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1},name:{fontWeight:'900',marginBottom:3},button:{minHeight:40,borderWidth:1,borderRadius:10,paddingHorizontal:12,alignItems:'center',justifyContent:'center'},empty:{padding:22,textAlign:'center'}});
