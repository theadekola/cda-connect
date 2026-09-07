import {useRef,useState} from 'react';
import {Alert,Pressable,StyleSheet,Text,TextInput,View} from '@/platform/react-native';
import {router,useLocalSearchParams} from '@/router';
import {useMutation} from '@tanstack/react-query';
import {Ionicons} from '@/platform/icons';
import {api} from '@/lib/api';
import {Button,Card,Muted,Screen,useAppTheme} from '@/components/UI';

export default function MarkAttendance(){
  const{id}=useLocalSearchParams<{id:string}>();
  const{palette}=useAppTheme();
  const[code,setCode]=useState('');
  const inputRef=useRef<TextInput>(null);
  const mark=useMutation({
    mutationFn:()=>api.post(`/communities/${id}/attendance/mark`,{code}),
    onSuccess:r=>Alert.alert('Attendance recorded',`You have been marked ${String(r.data.status).toLowerCase()}.`,[{text:'Done',onPress:()=>router.back()}]),
    onError:(e:any)=>Alert.alert('Unable to mark attendance',e.response?.data?.message||e.response?.data?.error||'Check the meeting code and try again.'),
  });
  const updateCode=(value:string)=>setCode(value.replace(/\D/g,'').slice(0,6));
  return <Screen scroll contentStyle={s.page}>
    <Card style={[s.hero,{backgroundColor:palette.primarySoft}]}>
      <View style={[s.shield,{backgroundColor:palette.surface}]}><Ionicons name="shield-checkmark-outline" size={35} color={palette.primary}/></View>
      <Text style={[s.heroTitle,{color:palette.primary}]}>Enter Meeting Code</Text>
      <Muted style={s.centerText}>Enter the 6-digit code shown by the meeting organiser.</Muted>
      <Pressable accessibilityRole="button" accessibilityLabel="Enter six digit meeting code" onPress={()=>inputRef.current?.focus()} style={s.codeEntry}>
        <View pointerEvents="none" style={s.boxes}>{Array.from({length:6},(_,i)=><View key={i} style={[s.box,{borderColor:i===code.length?palette.primary:palette.border,backgroundColor:palette.surface}]}><Text style={[s.digit,{color:palette.text}]}>{code[i]||''}</Text></View>)}</View>
        <TextInput ref={inputRef} value={code} onChangeText={updateCode} keyboardType="number-pad" inputMode="numeric" textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={6} autoFocus caretHidden style={s.codeInput} onSubmitEditing={()=>code.length===6&&!mark.isPending&&mark.mutate()}/>
      </Pressable>
      <Muted style={s.centerText}>Your attendance will be securely recorded.</Muted>
    </Card>
    <Card style={s.notice}><Ionicons name="people-outline" size={29} color={palette.primary}/><View style={s.noticeCopy}><Text style={[s.noticeTitle,{color:palette.text}]}>Registered members only</Text><Muted>You must be signed in with an active community membership.</Muted></View></Card>
    <Button title="Mark My Attendance" icon="checkmark-circle-outline" disabled={code.length!==6} loading={mark.isPending} onPress={()=>mark.mutate()}/>
  </Screen>
}
const s=StyleSheet.create({page:{width:'100%',maxWidth:760,alignSelf:'center',paddingBottom:120},hero:{paddingVertical:28,paddingHorizontal:16,alignItems:'center'},shield:{width:72,height:72,borderRadius:36,alignItems:'center',justifyContent:'center',marginBottom:12},heroTitle:{fontSize:25,fontWeight:'900',marginBottom:8,textAlign:'center'},centerText:{textAlign:'center'},codeEntry:{width:'100%',maxWidth:360,alignSelf:'center',marginVertical:24,position:'relative'},boxes:{width:'100%',flexDirection:'row',justifyContent:'center',gap:6},box:{flex:1,maxWidth:50,minWidth:38,height:58,borderRadius:10,borderWidth:1.5,alignItems:'center',justifyContent:'center'},digit:{fontSize:27,fontWeight:'900'},codeInput:{...StyleSheet.absoluteFill,color:'transparent',backgroundColor:'transparent',opacity:0.02},notice:{flexDirection:'row',alignItems:'center',gap:14},noticeCopy:{flex:1},noticeTitle:{fontSize:16,fontWeight:'900'}})
