import {useEffect,useState} from 'react';
import {Linking,Platform,Pressable,StyleSheet,Text,View} from '@/platform/react-native';
import * as Notifications from '@/platform/notifications';
import {router} from '@/router';
import {Ionicons} from '@/platform/icons';
import {useAuth} from '@/store/auth';
import {Avatar,Muted,Screen,useAppTheme} from '@/components/UI';

type Item={icon:keyof typeof Ionicons.glyphMap;title:string;body:string;path?:string;tone:string;action?:()=>void;danger?:boolean};

export default function Settings(){
 const{palette}=useAppTheme(),{user}=useAuth(),name=`${user?.FirstName||''} ${user?.LastName||''}`.trim()||'Community Member',since=user?.CreatedAt?new Date(user.CreatedAt).toLocaleDateString(undefined,{month:'short',year:'numeric'}):'Not available';
 const[pushPermission,setPushPermission]=useState<Notifications.PermissionStatus|null>(null);
 useEffect(()=>{if(Platform.OS!=='web')void Notifications.getPermissionsAsync().then(result=>setPushPermission(result.status))},[]);
 const open=(path?:string)=>path&&router.push(path as any);
 const account:Item[]=[
  {icon:'shield-checkmark-outline',title:'Privacy & Safety',body:'Manage your privacy and safety',path:'/privacy',tone:'#08723A'},
  {icon:'notifications-outline',title:'Notifications',body:'Control your notifications',path:'/notifications-settings',tone:'#0F8A43'},
 ];
 const communication:Item[]=[
  {icon:'chatbubble-ellipses-outline',title:'Communications',body:'Email, SMS and messaging',path:'/communications',tone:'#0F8A43'},
  {icon:'people-outline',title:'Community Preferences',body:'Your community experience',path:'/community-preferences',tone:'#11243F'},
 ];
 const data:Item[]=[
  {icon:'cloud-outline',title:'Data & Storage',body:'Manage your data and storage',path:'/data-usage',tone:'#0F8A43'},
  {icon:'lock-closed-outline',title:'Security',body:'Password, 2FA and active sessions',path:'/security',tone:'#0F8A43'},
  {icon:'help-circle-outline',title:'Help & Support',body:'Get help and contact support',path:'/help',tone:'#11243F'},
  {icon:'information-circle-outline',title:'About CDA Connect',body:'App version and information',path:'/about',tone:'#64748B'},
 ];
 return <Screen scroll contentStyle={s.page}><Muted style={s.subtitle}>Manage your account, preferences and community experience.</Muted>
  <View style={[s.profile,{borderColor:palette.border,backgroundColor:palette.surface}]}><Avatar name={name} uri={user?.ProfileImage} size={78}/><View style={{flex:1}}><View style={s.nameRow}><Text style={[s.name,{color:palette.text}]}>{name}</Text><Ionicons name="checkmark-circle" size={19} color={palette.primary}/></View><Muted>Member since {since}</Muted><View style={[s.active,{backgroundColor:palette.primarySoft}]}><View style={s.dot}/><Text style={{color:palette.primary,fontWeight:'800'}}>Active Member</Text></View></View></View>
  {Platform.OS!=='web'?<View style={[s.permission,{borderColor:palette.border,backgroundColor:palette.surface}]}><Ionicons name={pushPermission==='granted'?'notifications':'notifications-off-outline'} size={24} color={pushPermission==='granted'?palette.primary:palette.danger}/><View style={{flex:1}}><Text style={[s.rowTitle,{color:palette.text}]}>Push notifications</Text><Muted>{pushPermission==='granted'?'Allowed on this device':pushPermission==='denied'?'Denied in system settings':'Permission has not been decided'}</Muted></View>{pushPermission==='denied'?<Pressable accessibilityRole="link" accessibilityLabel="Open notification system settings" onPress={()=>void Linking.openSettings()} style={[s.systemSettings,{borderColor:palette.primary}]}><Text style={{color:palette.primary,fontWeight:'900'}}>Settings</Text></Pressable>:null}</View>:null}
  <Group label="Preferences" items={account} open={open} palette={palette}/><Group label="Communication" items={communication} open={open} palette={palette}/><Group label="Data & Security" items={data} open={open} palette={palette}/>
 </Screen>
}
function Group({label,items,open,palette}:{label:string;items:Item[];open:(p?:string)=>void;palette:any}){return <View><Text style={[s.groupLabel,{color:palette.muted}]}>{label}</Text><View style={[s.group,{borderColor:palette.border,backgroundColor:palette.surface}]}>{items.map((item,i)=><Pressable accessibilityRole="button" accessibilityLabel={item.title} key={item.title} onPress={item.action||(()=>open(item.path))} style={[s.row,i<items.length-1&&{borderBottomColor:palette.border,borderBottomWidth:1},item.danger&&{borderColor:palette.danger,borderWidth:1,borderRadius:12}]}><View style={[s.icon,{backgroundColor:`${item.tone}16`}]}><Ionicons name={item.icon} size={23} color={item.tone}/></View><View style={{flex:1}}><Text style={[s.rowTitle,{color:item.danger?palette.danger:palette.text}]}>{item.title}</Text><Muted>{item.body}</Muted></View><Ionicons name="chevron-forward" size={20} color={palette.text}/></Pressable>)}</View></View>}
const s=StyleSheet.create({page:{width:'100%',maxWidth:900,alignSelf:'center',paddingBottom:28},header:{minHeight:82,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},brand:{flexDirection:'row',alignItems:'center',gap:8},logo:{width:58,height:58,resizeMode:'contain'},brandName:{fontSize:19,fontWeight:'900'},tagline:{fontSize:9},headerRight:{flexDirection:'row',alignItems:'center',gap:16},online:{position:'absolute',right:-1,bottom:0,width:11,height:11,borderRadius:6,backgroundColor:'#0F8A43',borderWidth:2,borderColor:'#fff'},subtitle:{marginTop:17,marginBottom:20},profile:{minHeight:145,borderWidth:1,borderRadius:15,padding:18,flexDirection:'row',alignItems:'center',gap:18},permission:{minHeight:72,borderWidth:1,borderRadius:14,paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:13,marginTop:12},systemSettings:{minHeight:44,paddingHorizontal:13,borderWidth:1,borderRadius:10,alignItems:'center',justifyContent:'center'},nameRow:{flexDirection:'row',alignItems:'center',gap:7},name:{fontSize:20,fontWeight:'900'},active:{alignSelf:'flex-start',marginTop:10,paddingHorizontal:11,paddingVertical:5,borderRadius:14,flexDirection:'row',alignItems:'center',gap:7},dot:{width:8,height:8,borderRadius:4,backgroundColor:'#0F8A43'},groupLabel:{fontSize:13,fontWeight:'800',marginTop:20,marginBottom:9,marginLeft:13},group:{borderWidth:1,borderRadius:14,overflow:'hidden'},row:{minHeight:72,paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:13},icon:{width:43,height:43,borderRadius:22,alignItems:'center',justifyContent:'center'},rowTitle:{fontSize:15,fontWeight:'900',marginBottom:2},dangerActions:{flexDirection:'row',gap:10,marginTop:14},dangerButton:{flex:1,minHeight:64,borderWidth:1.5,borderRadius:13,paddingHorizontal:8,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},dangerButtonText:{fontSize:13,fontWeight:'900',textAlign:'center',flexShrink:1}});
