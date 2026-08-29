import {Platform,StyleSheet,View,useWindowDimensions} from 'react-native';
import {Tabs} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from '@/components/UI';
import {useI18n} from '@/i18n';

const iconMap:any={home:'home',communities:'people',chat:'chatbubbles',notifications:'notifications',profile:'person',calendar:'calendar',settings:'settings'};

export default function TabsLayout(){
  const{width}=useWindowDimensions();
  const{palette}=useAppTheme();
  const{t}=useI18n();
  const desktop=Platform.OS==='web'&&width>=980;

  return <View style={styles.shell}>
    <Tabs screenOptions={({route})=>({
      headerShown:false,
      tabBarPosition:'bottom',
      tabBarActiveTintColor:palette.primary,
      tabBarInactiveTintColor:palette.muted,
      tabBarStyle:{display:'none'},
      tabBarLabelPosition:'below-icon',
      tabBarShowLabel:!desktop,
      tabBarLabelStyle:{fontSize:desktop?14:11,fontWeight:'700'},
      tabBarIcon:({color,size,focused}:{color:string;size:number;focused:boolean})=><Ionicons name={(focused?iconMap[route.name]:`${iconMap[route.name]}-outline`) as any} color={color} size={focused?size+1:size}/>,
    } as any)}>
      <Tabs.Screen name="home" options={{title:t('home')}}/>
      <Tabs.Screen name="communities" options={{title:t('communities')}}/>
      <Tabs.Screen name="calendar" options={{title:t('calendar')}}/>
      <Tabs.Screen name="profile" options={{title:t('profile')}}/>
      <Tabs.Screen name="settings" options={{title:t('settings')}}/>
      <Tabs.Screen name="chat" options={{href:null}}/>
      <Tabs.Screen name="notifications" options={{href:null}}/>
    </Tabs>
  </View>
}

const styles=StyleSheet.create({
  shell:{flex:1,width:'100%',position:'relative'},
});
