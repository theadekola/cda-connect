import {createElement,useState} from 'react';
import {ActivityIndicator,Modal,Pressable,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from './UI';

type Props={visible:boolean;url:string;title:string;onEnd:()=>void};

export function InAppAudioCall({visible,url,title,onEnd}:Props){
 const{palette}=useAppTheme();const[loading,setLoading]=useState(true);
 return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onEnd}>
  <View style={[s.screen,{backgroundColor:palette.background}]}>
   <View style={[s.header,{borderBottomColor:palette.border}]}><View style={s.heading}><Text numberOfLines={1} style={[s.title,{color:palette.text}]}>{title}</Text><Text style={[s.status,{color:palette.success}]}>Audio call</Text></View><Pressable accessibilityRole="button" accessibilityLabel="End call" onPress={onEnd} style={s.end}><Ionicons name="call" size={20} color="#fff"/><Text style={s.endText}>End</Text></Pressable></View>
   <View style={s.call}>{loading?<View style={s.loading}><ActivityIndicator size="large" color={palette.primary}/><Text style={[s.loadingText,{color:palette.muted}]}>Connecting call…</Text></View>:null}{createElement('iframe',{src:url,title:`${title} audio call`,allow:'microphone; camera; autoplay; fullscreen; display-capture',onLoad:()=>setLoading(false),style:{border:0,width:'100%',height:'100%',display:'block'},referrerPolicy:'strict-origin-when-cross-origin'})}</View>
  </View>
 </Modal>
}
const s=StyleSheet.create({screen:{flex:1},header:{minHeight:70,paddingHorizontal:16,paddingVertical:10,borderBottomWidth:1,flexDirection:'row',alignItems:'center',gap:12},heading:{flex:1,minWidth:0},title:{fontSize:18,fontWeight:'900'},status:{fontSize:12,fontWeight:'700',marginTop:2},end:{height:44,paddingHorizontal:17,borderRadius:22,backgroundColor:'#DC2626',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},endText:{color:'#fff',fontWeight:'900'},call:{flex:1,position:'relative'},loading:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',zIndex:1},loadingText:{marginTop:12,fontWeight:'700'}});
