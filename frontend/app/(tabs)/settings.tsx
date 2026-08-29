import {Alert,Pressable,StyleSheet,Text,View} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {api} from '@/lib/api';
import {useAuth} from '@/store/auth';
import {Avatar,Muted,Screen,useAppTheme} from '@/components/UI';

type Item={icon:keyof typeof Ionicons.glyphMap;title:string;body:string;path?:string;tone:string;action?:()=>void;danger?:boolean};

export default function Settings(){
 const{palette}=useAppTheme(),{user,logout}=useAuth(),name=`${user?.FirstName||''} ${user?.LastName||''}`.trim()||'Community Member',username=String(user?.Email||'member').split('@')[0],since=user?.CreatedAt?new Date(user.CreatedAt).toLocaleDateString(undefined,{month:'short',year:'numeric'}):'Not available';
 const open=(path?:string)=>path&&router.push(path as any);
 const deactivate=()=>Alert.alert('Deactivate account?','Your account will be disabled and you will be signed out. Contact support when you want to reactivate it.',[{text:'Cancel',style:'cancel'},{text:'Deactivate',style:'destructive',onPress:async()=>{try{await api.post('/me/deactivate');await logout();router.replace('/(auth)/welcome')}catch(e:any){Alert.alert('Unable to deactivate account',e.response?.data?.error||e.message)}}}]);
 const account:Item[]=[
  {icon:'shield-checkmark-outline',title:'Privacy & Safety',body:'Manage your privacy and safety',path:'/privacy',tone:'#08723A'},
  {icon:'notifications-outline',title:'Notifications',body:'Control your notifications',path:'/notifications-settings',tone:'#0F8A43'},
  {icon:'color-palette-outline',title:'Appearance',body:'Theme, display and accessibility',path:'/accessibility',tone:'#0F1F44'},
  {icon:'globe-outline',title:'Language',body:'App language and translations',path:'/language',tone:'#0F8A43'},
 ];
 const communication:Item[]=[
  {icon:'chatbubble-ellipses-outline',title:'Communications',body:'Email, SMS and messaging',path:'/communications',tone:'#16A34A'},
  {icon:'people-outline',title:'Community Preferences',body:'Your community experience',path:'/community-preferences',tone:'#0F1F44'},
 ];
 const data:Item[]=[
  {icon:'cloud-outline',title:'Data & Storage',body:'Manage your data and storage',path:'/data-usage',tone:'#0F8A43'},
  {icon:'lock-closed-outline',title:'Security',body:'Password, 2FA and active sessions',path:'/security',tone:'#0F8A43'},
  {icon:'help-circle-outline',title:'Help & Support',body:'Get help and contact support',path:'/help',tone:'#0F1F44'},
  {icon:'information-circle-outline',title:'About CDA Connect',body:'App version and information',path:'/about',tone:'#64748B'},
 ];
 const actions:Item[]=[
  {icon:'key-outline',title:'Change Password',body:'Update your password',path:'/change-password',tone:'#0F1F44'},
  {icon:'shield-checkmark-outline',title:'Two-Factor Authentication',body:'Add extra security to your account',path:'/two-factor',tone:'#16A34A'},
  {icon:'desktop-outline',title:'Active Sessions',body:'Manage your active sessions',path:'/security',tone:'#08723A'},
 ];
 return <Screen scroll contentStyle={s.page}><Muted style={s.subtitle}>Manage your account, preferences and community experience.</Muted>
  <View style={[s.profile,{borderColor:palette.border,backgroundColor:palette.surface}]}><Avatar name={name} uri={user?.ProfileImage} size={78}/><View style={{flex:1}}><View style={s.nameRow}><Text style={[s.name,{color:palette.text}]}>{name}</Text><Ionicons name="checkmark-circle" size={19} color={palette.primary}/></View><Muted>@{username}　·　Member since {since}</Muted><View style={[s.active,{backgroundColor:palette.primarySoft}]}><View style={s.dot}/><Text style={{color:palette.primary,fontWeight:'800'}}>Active Member</Text></View></View></View>
  <Group label="Preferences" items={account} open={open} palette={palette}/><Group label="Communication" items={communication} open={open} palette={palette}/><Group label="Data & Security" items={data} open={open} palette={palette}/><Group label="Account Actions" items={actions} open={open} palette={palette}/>
  <View style={s.dangerActions}><Pressable accessibilityRole="button" accessibilityLabel="Deactivate Account" onPress={deactivate} style={[s.dangerButton,{borderColor:palette.warning,backgroundColor:palette.warningSoft}]}><Ionicons name="time-outline" size={24} color={palette.warning}/><Text style={[s.dangerButtonText,{color:palette.warning}]}>Deactivate Account</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Delete Account" onPress={()=>router.push('/delete-account')} style={[s.dangerButton,{borderColor:palette.danger,backgroundColor:palette.dangerSoft}]}><Ionicons name="trash-outline" size={24} color={palette.danger}/><Text style={[s.dangerButtonText,{color:palette.danger}]}>Delete Account</Text></Pressable></View>
 </Screen>
}
function Group({label,items,open,palette}:{label:string;items:Item[];open:(p?:string)=>void;palette:any}){return <View><Text style={[s.groupLabel,{color:palette.muted}]}>{label}</Text><View style={[s.group,{borderColor:palette.border,backgroundColor:palette.surface}]}>{items.map((item,i)=><Pressable accessibilityRole="button" accessibilityLabel={item.title} key={item.title} onPress={item.action||(()=>open(item.path))} style={[s.row,i<items.length-1&&{borderBottomColor:palette.border,borderBottomWidth:1},item.danger&&{borderColor:palette.danger,borderWidth:1,borderRadius:12}]}><View style={[s.icon,{backgroundColor:`${item.tone}16`}]}><Ionicons name={item.icon} size={23} color={item.tone}/></View><View style={{flex:1}}><Text style={[s.rowTitle,{color:item.danger?palette.danger:palette.text}]}>{item.title}</Text><Muted>{item.body}</Muted></View><Ionicons name="chevron-forward" size={20} color={palette.text}/></Pressable>)}</View></View>}
const s=StyleSheet.create({page:{width:'100%',maxWidth:900,alignSelf:'center',paddingBottom:28},header:{minHeight:82,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},brand:{flexDirection:'row',alignItems:'center',gap:8},logo:{width:58,height:58,resizeMode:'contain'},brandName:{fontSize:19,fontWeight:'900'},tagline:{fontSize:9},headerRight:{flexDirection:'row',alignItems:'center',gap:16},online:{position:'absolute',right:-1,bottom:0,width:11,height:11,borderRadius:6,backgroundColor:'#33B51B',borderWidth:2,borderColor:'#fff'},subtitle:{marginTop:17,marginBottom:20},profile:{minHeight:145,borderWidth:1,borderRadius:15,padding:18,flexDirection:'row',alignItems:'center',gap:18},nameRow:{flexDirection:'row',alignItems:'center',gap:7},name:{fontSize:20,fontWeight:'900'},active:{alignSelf:'flex-start',marginTop:10,paddingHorizontal:11,paddingVertical:5,borderRadius:14,flexDirection:'row',alignItems:'center',gap:7},dot:{width:8,height:8,borderRadius:4,backgroundColor:'#0F8A43'},groupLabel:{fontSize:13,fontWeight:'800',marginTop:20,marginBottom:9,marginLeft:13},group:{borderWidth:1,borderRadius:14,overflow:'hidden'},row:{minHeight:72,paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:13},icon:{width:43,height:43,borderRadius:22,alignItems:'center',justifyContent:'center'},rowTitle:{fontSize:15,fontWeight:'900',marginBottom:2},dangerActions:{flexDirection:'row',gap:10,marginTop:14},dangerButton:{flex:1,minHeight:64,borderWidth:1.5,borderRadius:13,paddingHorizontal:8,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},dangerButtonText:{fontSize:13,fontWeight:'900',textAlign:'center',flexShrink:1}});
