import { Pressable, StyleSheet, Text, View, Platform, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { Button } from '@/components/UI';

export default function Welcome(){
  const {width}=useWindowDimensions();
  const desktop=Platform.OS==='web'&&width>=900;
  return <SafeAreaView style={styles.safe}>
    <View style={[styles.shell,desktop&&styles.shellDesktop]}>
      <View style={[styles.hero,desktop&&styles.heroDesktop]}>
        <View style={styles.logo}><Ionicons name="people" size={42} color="#fff"/></View>
        <Text style={styles.title}>CDA CONNECT</Text>
        <Text style={styles.tagline}>Stronger Communities. Safer Together.</Text>
        <View style={styles.peopleRow}>{[colors.cyan,'#FFFFFF',colors.gold,'#FFFFFF',colors.cyan].map((c,i)=><View key={i} style={[styles.person,{backgroundColor:c,marginLeft:i?-10:0}]}><Ionicons name="person" size={24} color={c==='#FFFFFF'?colors.navy:'#FFFFFF'}/></View>)}</View>
        <View style={styles.waveOne}/><View style={styles.waveTwo}/>
      </View>
      <View style={[styles.bottom,desktop&&styles.bottomDesktop]}>
        {desktop?<><Text style={styles.desktopTitle}>Your community, one connected place.</Text><Text style={styles.desktopBody}>Use CDA Connect on desktop, mobile web, Android and iPhone with the same account, communities and permissions.</Text></>:null}
        <Button title="Get Started" onPress={()=>router.push('/(auth)/register')} />
        <Button title="Login" variant="secondary" onPress={()=>router.push('/(auth)/login')} />
        <Pressable onPress={()=>router.push('/(auth)/register')}><Text style={styles.small}>Don't have an account? <Text style={{color:colors.primary,fontWeight:'800'}}>Sign up</Text></Text></Pressable>
      </View>
    </View>
  </SafeAreaView>
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.navy},shell:{flex:1},shellDesktop:{alignItems:'center'},hero:{flex:1,backgroundColor:colors.navy,alignItems:'center',justifyContent:'center',paddingHorizontal:28,overflow:'hidden'},heroDesktop:{width:'100%',minHeight:520},logo:{width:78,height:78,borderRadius:24,backgroundColor:colors.cyan,alignItems:'center',justifyContent:'center',marginBottom:22,borderWidth:1,borderColor:'rgba(255,255,255,.24)'},title:{fontSize:34,fontWeight:'900',color:'#fff',textAlign:'center'},tagline:{fontSize:15,color:'#BEEFFF',textAlign:'center',marginTop:10,maxWidth:420,lineHeight:22},peopleRow:{flexDirection:'row',marginTop:44,alignItems:'center'},person:{width:58,height:58,borderRadius:29,alignItems:'center',justifyContent:'center',borderWidth:4,borderColor:colors.navy},waveOne:{position:'absolute',bottom:-80,left:-70,width:260,height:170,borderRadius:100,backgroundColor:'rgba(0,210,255,.18)',transform:[{rotate:'-10deg'}]},waveTwo:{position:'absolute',bottom:-100,right:-80,width:300,height:190,borderRadius:110,backgroundColor:'rgba(0,210,255,.10)',transform:[{rotate:'10deg'}]},bottom:{padding:22,gap:6,backgroundColor:colors.navy},bottomDesktop:{width:'100%',maxWidth:520,paddingHorizontal:24,paddingBottom:48},desktopTitle:{fontSize:30,fontWeight:'900',color:'#FFFFFF',textAlign:'center',marginBottom:10},desktopBody:{fontSize:15,lineHeight:23,color:'#BEEFFF',textAlign:'center',marginBottom:24},small:{textAlign:'center',color:'#CBD5E1',marginTop:14,fontSize:13}})
