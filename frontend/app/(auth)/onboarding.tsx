import {Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {router} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {colors} from '@/theme';

const illustration=require('../../assets/branding/onboarding-community.png');
const features=[
  ['people-outline','Stay informed','Get the latest updates and announcements.'],
  ['documents-outline','Work together','Join meetings, make decisions and take action.'],
  ['git-network-outline','Build stronger communities','Connect, support and grow together.'],
];

export default function Onboarding(){
 const{width}=useWindowDimensions();const web=width>560;const proceed=()=>router.push('/(auth)/register');
 return <SafeAreaView style={s.safe}><StatusBar style="dark"/><ScrollView style={s.scroll} contentContainerStyle={[s.page,web&&s.webPage]} showsVerticalScrollIndicator={false}>
  <View><Text style={s.eyebrow}>Welcome to</Text><Text style={s.title}>CDA Connect</Text><Text style={s.intro}>The all-in-one platform for communities to connect, collaborate and grow together.</Text></View>
  <Image source={illustration} resizeMode="contain" style={s.image}/>
  <View style={s.featurePanel}>{features.map(([icon,title,body])=><View key={title} style={s.feature}><View style={s.icon}><Ionicons name={icon as any} size={26} color={colors.primary}/></View><View style={{flex:1}}><Text style={s.featureTitle}>{title}</Text><Text style={s.featureBody}>{body}</Text></View></View>)}</View>
  <View style={s.footer}><Pressable onPress={proceed} accessibilityRole="button"><Text style={s.link}>Skip</Text></Pressable><Pressable onPress={proceed} accessibilityRole="button"><Text style={s.link}>Next</Text></Pressable></View>
 </ScrollView></SafeAreaView>
}
const s=StyleSheet.create({safe:{flex:1,width:'100%',backgroundColor:colors.background},scroll:{flex:1,width:'100%',backgroundColor:colors.background},page:{flexGrow:1,width:'100%',backgroundColor:colors.background,paddingHorizontal:30,paddingTop:58,paddingBottom:24,isolation:'isolate' as any},webPage:{maxWidth:520,alignSelf:'center',borderWidth:1,borderColor:colors.border},eyebrow:{fontSize:27,fontWeight:'800',color:colors.primary},title:{fontSize:40,lineHeight:48,fontWeight:'900',color:colors.textPrimary},intro:{fontSize:17,lineHeight:28,fontWeight:'600',color:colors.textSecondary,marginTop:20,maxWidth:430},image:{width:'100%',height:210,marginTop:12,mixBlendMode:'multiply' as any},featurePanel:{borderTopWidth:2,borderTopColor:colors.primaryLight,borderTopLeftRadius:28,borderTopRightRadius:28,paddingTop:22,gap:19},feature:{flexDirection:'row',alignItems:'center',gap:16},icon:{width:54,height:54,borderRadius:16,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},featureTitle:{fontSize:16,fontWeight:'800',color:colors.textPrimary},featureBody:{fontSize:14,lineHeight:21,color:colors.textSecondary,marginTop:3},footer:{marginTop:'auto',paddingTop:28,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},link:{fontSize:17,fontWeight:'800',color:colors.primary}});
