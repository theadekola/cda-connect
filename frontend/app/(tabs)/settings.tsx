import {Pressable,StyleSheet,Text,View} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {Header,Screen,useAppTheme} from '@/components/UI';

const rows:[keyof typeof Ionicons.glyphMap,string,string][]=[['accessibility-outline','Accessibility & Language','/accessibility'],['notifications-outline','Notification Settings','/notifications-settings'],['lock-closed-outline','Privacy Centre','/privacy'],['cloud-offline-outline','Offline & Data Saver','/data-usage'],['heart-outline','Trusted Contacts','/trusted-contacts'],['help-circle-outline','Help & Support','/help'],['information-circle-outline','About CDA Connect','/about']];
export default function Settings(){const{palette}=useAppTheme();return <Screen scroll><Header title="Settings" subtitle="Control accessibility, privacy, notifications and app preferences"/><View style={[s.menu,{backgroundColor:palette.surface,borderColor:palette.border}]}>{rows.map(([icon,label,path])=><Pressable accessibilityRole="button" key={label} style={[s.row,{borderBottomColor:palette.border}]} onPress={()=>router.push(path as any)}><Ionicons name={icon} size={22} color={palette.muted}/><Text style={[s.label,{color:palette.text}]}>{label}</Text><Ionicons name="chevron-forward" size={19} color={palette.muted}/></Pressable>)}</View></Screen>}
const s=StyleSheet.create({menu:{borderWidth:1,borderRadius:18,overflow:'hidden'},row:{minHeight:64,flexDirection:'row',alignItems:'center',gap:13,paddingHorizontal:17,borderBottomWidth:1},label:{flex:1,fontWeight:'800',fontSize:15}});
