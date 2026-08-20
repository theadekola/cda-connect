import {Platform,StyleSheet,View,useWindowDimensions} from 'react-native';
import {Tabs} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from '@/components/UI';

const iconMap:any={home:'home',communities:'people',calendar:'calendar',profile:'person',settings:'settings'};

export default function TabsLayout(){
  const{width}=useWindowDimensions();
  const{palette}=useAppTheme();
  const desktop=Platform.OS==='web'&&width>=980;

  return <View style={styles.shell}>
    <Tabs screenOptions={({route})=>({
      headerShown:false,
      tabBarPosition:'bottom',
      tabBarActiveTintColor:palette.primary,
      tabBarInactiveTintColor:palette.muted,
      tabBarStyle:desktop?{display:'none'}:{height:72,paddingTop:8,paddingBottom:8,borderTopColor:palette.border,backgroundColor:palette.surface,shadowColor:palette.navy,shadowOpacity:.08,shadowRadius:10},
      tabBarLabelPosition:'below-icon',
      tabBarShowLabel:!desktop,
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
  </View>
}

const styles=StyleSheet.create({
  shell:{flex:1,width:'100%',position:'relative'},
});
