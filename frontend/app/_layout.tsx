import { Stack, usePathname, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/store/auth';
import { colors } from '@/theme';
import { useAccessibility } from '@/store/accessibility';

const qc=new QueryClient();

const desktopLinks=[
  ['home-outline','Home','/(tabs)/home'],
  ['people-outline','Communities','/(tabs)/communities'],
  ['calendar-outline','Calendar','/(tabs)/calendar'],
  ['person-outline','Profile','/(tabs)/profile'],
  ['settings-outline','Settings','/(tabs)/settings'],
] as const;

function DesktopShell({children}:{children:React.ReactNode}){
  const{width}=useWindowDimensions();
  const pathname=usePathname();
  const router=useRouter();
  const{accessToken}=useAuth();
  const[open,setOpen]=useState(true);
  const desktop=Platform.OS==='web'&&width>=980;
  const publicPage=pathname==='/'||pathname.startsWith('/login')||pathname.startsWith('/register')||pathname.startsWith('/forgot-password');
  if(!desktop||!accessToken||publicPage)return <>{children}</>;
  const sidebarWidth=open?238:76;
  const active=(path:string)=>pathname===path.replace('/(tabs)','')||(path.includes('/home')&&pathname==='/home');
  return <View style={shellStyles.shell}>
    <View style={[shellStyles.sidebar,{width:sidebarWidth}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={open?'Collapse navigation':'Expand navigation'} accessibilityState={{expanded:open}} onPress={()=>setOpen(value=>!value)} style={shellStyles.menuButton}>
        <Ionicons name={open?'close':'menu'} size={27} color="#FFFFFF"/>
      </Pressable>
      <View style={shellStyles.links}>{desktopLinks.map(([icon,label,path])=>{
        const selected=active(path);
        return <Pressable key={label} accessibilityRole="link" accessibilityLabel={label} onPress={()=>router.push(path as any)} style={[shellStyles.link,selected&&shellStyles.linkActive,!open&&shellStyles.linkClosed]}>
          <Ionicons name={icon} size={25} color={selected?'#FFFFFF':'#CBD5E1'}/>
          {open?<Text style={[shellStyles.label,selected&&shellStyles.labelActive]}>{label}</Text>:null}
        </Pressable>;
      })}</View>
    </View>
    <View style={[shellStyles.content,{marginLeft:sidebarWidth}]}>{children}</View>
  </View>;
}

export default function Root(){
  const {hydrated,load}=useAuth();
  const a=useAccessibility();
  useEffect(()=>{load();a.load()},[]);
  if(!hydrated||!a.hydrated)return <View style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.background}}><ActivityIndicator color={colors.primary}/></View>;
  return <QueryClientProvider client={qc}><DesktopShell><Stack screenOptions={{headerShown:false}}><Stack.Screen name="index"/><Stack.Screen name="(auth)"/><Stack.Screen name="(tabs)"/><Stack.Screen name="community/[id]"/><Stack.Screen name="chat/[id]"/></Stack></DesktopShell></QueryClientProvider>;
}

const shellStyles=StyleSheet.create({
  shell:{flex:1,width:'100%',minHeight:'100%' as any},
  sidebar:{position:'fixed' as any,left:0,top:0,bottom:0,zIndex:2000,backgroundColor:'#0F2537',paddingHorizontal:10,paddingTop:84,overflow:'hidden',shadowColor:'#0F172A',shadowOpacity:.14,shadowRadius:16,shadowOffset:{width:3,height:0}},
  menuButton:{position:'absolute',top:18,left:15,width:48,height:48,borderRadius:12,backgroundColor:'rgba(255,255,255,.14)',alignItems:'center',justifyContent:'center'},
  links:{gap:7},
  link:{height:56,borderRadius:12,paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:14},
  linkClosed:{paddingHorizontal:15,justifyContent:'center'},
  linkActive:{backgroundColor:'#15803D'},
  label:{fontSize:16,fontWeight:'800',color:'#CBD5E1'},
  labelActive:{color:'#FFFFFF'},
  content:{flex:1,minWidth:0,minHeight:'100vh' as any},
});
