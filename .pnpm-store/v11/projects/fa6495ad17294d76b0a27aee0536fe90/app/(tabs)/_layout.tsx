import {useState} from 'react';
import {Platform,Pressable,StyleSheet,View,useWindowDimensions} from 'react-native';
import {Tabs} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from '@/components/UI';

const iconMap:any={home:'home',communities:'people',calendar:'calendar',profile:'person',settings:'settings'};

export default function TabsLayout(){
  const{width}=useWindowDimensions();
  const{palette}=useAppTheme();
  const desktop=Platform.OS==='web'&&width>=980;
  const[menuOpen,setMenuOpen]=useState(false);

  return <View style={styles.shell}>
    <Tabs screenOptions={({route})=>({
      headerShown:false,
      tabBarPosition:desktop?'left':'bottom',
      tabBarActiveTintColor:desktop?(menuOpen?'#FFFFFF':palette.primary):palette.primary,
      tabBarInactiveTintColor:desktop?(menuOpen?'#CBD5E1':palette.navy):palette.muted,
      tabBarActiveBackgroundColor:desktop?(menuOpen?palette.cyan:palette.primarySoft):undefined,
      tabBarStyle:desktop?(menuOpen?styles.desktopMenu:styles.desktopMenuClosed):{height:72,paddingTop:8,paddingBottom:8,borderTopColor:palette.border,backgroundColor:palette.surface,shadowColor:palette.navy,shadowOpacity:.08,shadowRadius:10},
      tabBarItemStyle:desktop?(menuOpen?styles.desktopMenuItem:styles.desktopIconItem):undefined,
      tabBarLabelPosition:desktop?'beside-icon':'below-icon',
      tabBarShowLabel:desktop?menuOpen:true,
      tabBarLabelStyle:{fontSize:desktop?14:11,fontWeight:'700'},
      tabBarIcon:({color,size,focused}:{color:string;size:number;focused:boolean})=><Ionicons name={(focused?iconMap[route.name]:`${iconMap[route.name]}-outline`) as any} color={color} size={focused?size+1:size}/>,
    } as any)}>
      <Tabs.Screen name="home" options={{title:'Home'}}/>
      <Tabs.Screen name="communities" options={{title:'Communities'}}/>
      <Tabs.Screen name="calendar" options={{title:'Calendar'}}/>
      <Tabs.Screen name="profile" options={{title:'Profile'}}/>
      <Tabs.Screen name="settings" options={{title:'Settings'}}/>
      <Tabs.Screen name="chat" options={{href:null}}/>
    </Tabs>
    {desktop?<Pressable accessibilityRole="button" accessibilityLabel={menuOpen?'Close navigation menu':'Open navigation menu'} onPress={()=>setMenuOpen(open=>!open)} style={[styles.menuButton,{backgroundColor:menuOpen?'rgba(255,255,255,.14)':palette.navy}]}><Ionicons name={menuOpen?'close':'menu'} size={27} color="#FFFFFF"/></Pressable>:null}
  </View>
}

const styles=StyleSheet.create({
  shell:{flex:1,width:'100%',position:'relative'},
  desktopMenu:{width:238,borderRightWidth:0,borderTopWidth:0,backgroundColor:'#0F2537',paddingTop:76,paddingHorizontal:10},
  desktopMenuClosed:{width:76,minWidth:76,maxWidth:76,borderRightWidth:1,borderRightColor:'#E2E8F0',borderTopWidth:0,paddingTop:76,paddingHorizontal:8,backgroundColor:'#FFFFFF'},
  desktopMenuItem:{maxHeight:58,borderRadius:12,marginVertical:3},
  desktopIconItem:{maxHeight:58,borderRadius:12,marginVertical:3},
  menuButton:{position:'absolute',top:18,left:17,zIndex:1000,width:46,height:46,borderRadius:12,alignItems:'center',justifyContent:'center',shadowColor:'#0F2537',shadowOpacity:.18,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:12},
});
