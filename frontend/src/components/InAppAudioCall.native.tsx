import {useState} from 'react';
import {ActivityIndicator,Modal,Pressable,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {WebView} from 'react-native-webview';
import {useAppTheme} from './UI';

type Props={visible:boolean;url:string;title:string;onEnd:()=>void};

export function InAppAudioCall({visible,url,title,onEnd}:Props){
 const{palette}=useAppTheme();const[loading,setLoading]=useState(true);
 return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onEnd} statusBarTranslucent>
  <View style={[s.screen,{backgroundColor:palette.background}]}>
   <View style={[s.header,{borderBottomColor:palette.border}]}><View style={s.heading}><Text numberOfLines={1} style={[s.title,{color:palette.text}]}>{title}</Text><Text style={[s.status,{color:palette.success}]}>Audio call</Text></View><Pressable accessibilityRole="button" accessibilityLabel="End call" onPress={onEnd} style={s.end}><Ionicons name="call" size={20} color="#fff"/><Text style={s.endText}>End</Text></Pressable></View>
   <WebView source={{uri:url}} style={s.call} javaScriptEnabled domStorageEnabled mediaPlaybackRequiresUserAction={false} allowsInlineMediaPlayback allowsFullscreenVideo onLoadEnd={()=>setLoading(false)} startInLoadingState renderLoading={()=><View style={s.loading}><ActivityIndicator size="large" color={palette.primary}/><Text style={[s.loadingText,{color:palette.muted}]}>Connecting call…</Text></View>} onError={()=>setLoading(false)}/>
   {loading?null:null}
  </View>
 </Modal>
}
const s=StyleSheet.create({screen:{flex:1},header:{minHeight:70,paddingHorizontal:16,paddingTop:14,paddingBottom:10,borderBottomWidth:1,flexDirection:'row',alignItems:'center',gap:12},heading:{flex:1,minWidth:0},title:{fontSize:18,fontWeight:'900'},status:{fontSize:12,fontWeight:'700',marginTop:2},end:{height:44,paddingHorizontal:17,borderRadius:22,backgroundColor:'#DC2626',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},endText:{color:'#fff',fontWeight:'900'},call:{flex:1},loading:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center'},loadingText:{marginTop:12,fontWeight:'700'}});
