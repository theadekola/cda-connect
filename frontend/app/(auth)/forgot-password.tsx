import {useEffect,useRef,useState} from 'react';
import {Alert,Image,KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View,useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {SafeAreaView} from 'react-native-safe-area-context';
import {StatusBar} from 'expo-status-bar';
import {api} from '@/lib/api';
import {colors} from '@/theme';
import {CountryPhoneField} from '@/components/CountryPhoneField';

const requestArt=require('../../assets/branding/forgot-password.png');
const resetArt=require('../../assets/branding/reset-password.png');

const passwordRules=(value:string)=>[
  {label:'At least 8 characters',ok:value.length>=8},
  {label:'One uppercase letter',ok:/[A-Z]/.test(value)},
  {label:'One lowercase letter',ok:/[a-z]/.test(value)},
  {label:'One number',ok:/\d/.test(value)},
  {label:'One special character',ok:/[^A-Za-z0-9]/.test(value)},
];

export default function ForgotPassword(){
  const{width}=useWindowDimensions();
  const[step,setStep]=useState<'request'|'reset'>('request');
  const[phone,setPhone]=useState('');
  const[token,setToken]=useState('');
  const[code,setCode]=useState('');
  const[password,setPassword]=useState('');
  const[confirm,setConfirm]=useState('');
  const[showPassword,setShowPassword]=useState(false);
  const[showConfirm,setShowConfirm]=useState(false);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');
  const[seconds,setSeconds]=useState(0);
  const codeInput=useRef<TextInput>(null);
  const rules=passwordRules(password);
  const validPassword=rules.every(rule=>rule.ok)&&password===confirm;
  const normalisedPhone=()=>`+${phone.replace(/\D/g,'')}`;

  useEffect(()=>{if(seconds<=0)return;const timer=setInterval(()=>setSeconds(value=>Math.max(0,value-1)),1000);return()=>clearInterval(timer)},[seconds]);

  async function requestCode(){
    const mobile=normalisedPhone();setError('');
    if(!/^\+[1-9]\d{6,14}$/.test(mobile)){setError('Select a country and enter a valid mobile number.');return}
    try{setLoading(true);const response=await api.post('/auth/password-reset/request',{phone:mobile});setToken(response.data.resetToken);setSeconds(response.data.resendAfterSeconds||60);setCode('');setStep('reset');setTimeout(()=>codeInput.current?.focus(),250)}catch(e:any){setError(e.response?.data?.error||e.response?.data?.message||(e.code==='ERR_NETWORK'?'Cannot connect to the CDA Connect server.':'Unable to send the reset code.'))}finally{setLoading(false)}
  }

  async function resetPassword(){
    setError('');
    if(code.length!==6){setError('Enter the six-digit reset code.');return}
    if(!rules.every(rule=>rule.ok)){setError('Your new password does not meet all security requirements.');return}
    if(password!==confirm){setError('The passwords do not match.');return}
    try{setLoading(true);await api.post('/auth/password-reset/complete',{resetToken:token,code,newPassword:password});Alert.alert('Password reset','Your password has been changed. Log in with your new password.',[{text:'Log in',onPress:()=>router.replace('/(auth)/login' as any)}])}catch(e:any){setError(e.response?.data?.error||e.response?.data?.message||'Unable to reset your password. Check the code and try again.')}finally{setLoading(false)}
  }

  function back(){if(step==='reset'){setStep('request');setError('');setCode('');return}router.canGoBack()?router.back():router.replace('/(auth)/login' as any)}
  const masked=normalisedPhone();

  return <SafeAreaView style={s.safe}><StatusBar style="dark"/><KeyboardAvoidingView style={s.flex} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView contentContainerStyle={[s.shell,width>560&&s.webShell]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <Pressable accessibilityLabel="Back" onPress={back} style={s.back}><Ionicons name="chevron-back" size={28} color={colors.textPrimary}/></Pressable>
    {step==='request'?<>
      <View style={[s.artCrop,{backgroundColor:colors.background,isolation:'isolate' as any}]}><Image source={requestArt} resizeMode="cover" style={[s.art,{mixBlendMode:'multiply'} as any]}/></View>
      <Text accessibilityRole="header" style={s.title}>Forgot password?</Text>
      <Text style={s.subtitle}>No worries! Enter your registered mobile number and we’ll send you a reset code.</Text>
      <Text style={s.label}>Mobile number</Text>
      <CountryPhoneField value={phone} onChange={setPhone}/>
      <Info icon="shield-checkmark-outline" title="Secure & private" body="We’ll send a secure reset code to your registered mobile number. Your account is safe with us."/>
      {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
      <PrimaryButton title={loading?'Sending…':'Send reset code'} disabled={loading} press={requestCode}/>
      <View style={s.help}><View style={s.helpIcon}><Ionicons name="help" size={20} color={colors.primary}/></View><View style={s.helpText}><Text style={s.infoTitle}>Need help?</Text><Text style={s.infoBody}>Contact our support team if you’re still having trouble accessing your account.</Text></View><Pressable accessibilityRole="button" onPress={()=>Alert.alert('CDA Connect support','Please contact your CDA Connect administrator or support team.')}><Text style={s.helpLink}>Contact support ›</Text></Pressable></View>
    </>:<>
      <View style={[s.artCropSmall,{backgroundColor:colors.background,isolation:'isolate' as any}]}><Image source={resetArt} resizeMode="cover" style={[s.artSmall,{mixBlendMode:'multiply'} as any]}/></View>
      <Text accessibilityRole="header" style={s.title}>Let’s reset your password</Text>
      <Text style={[s.subtitle,{marginBottom:4}]}>Enter the 6-digit code we sent to</Text>
      <View style={s.editRow}><Text style={s.phoneText}>{masked}</Text><Pressable onPress={()=>{setStep('request');setError('')}}><Text style={s.edit}>Edit</Text></Pressable></View>
      <Text style={s.label}>Enter reset code</Text>
      <Pressable onPress={()=>codeInput.current?.focus()} style={s.codeRow}>{Array.from({length:6},(_,index)=><View key={index} style={[s.codeBox,index===code.length&&s.codeActive]}><Text style={s.codeDigit}>{code[index]||''}</Text></View>)}<TextInput ref={codeInput} accessibilityLabel="Six-digit reset code" value={code} onChangeText={value=>setCode(value.replace(/\D/g,'').slice(0,6))} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} style={s.hiddenCode}/></Pressable>
      <View style={s.resendRow}><Text style={s.resendMuted}>Didn’t receive the code? </Text><Pressable disabled={seconds>0||loading} onPress={requestCode}><Text style={[s.resend,seconds>0&&s.resendDisabled]}>{seconds>0?`Resend code (00:${String(seconds).padStart(2,'0')})`:'Resend code'}</Text></Pressable></View>
      <Text style={s.label}>Create new password</Text><PasswordInput label="New password" value={password} setValue={setPassword} visible={showPassword} setVisible={setShowPassword}/>
      <View style={s.rules}>{rules.map(rule=><View key={rule.label} style={s.rule}><Ionicons name={rule.ok?'checkmark-circle':'ellipse-outline'} size={18} color={rule.ok?colors.primary:colors.textMuted}/><Text style={[s.ruleText,rule.ok&&s.ruleTextDone]}>{rule.label}</Text></View>)}</View>
      <Text style={s.label}>Confirm new password</Text><PasswordInput label="Confirm new password" value={confirm} setValue={setConfirm} visible={showConfirm} setVisible={setShowConfirm}/>
      <Info icon="shield-checkmark-outline" title="Keep your account secure" body="Use a strong password that you don’t use for other accounts."/>
      {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
      <PrimaryButton title={loading?'Resetting…':'Reset password'} disabled={loading||!validPassword||code.length!==6} press={resetPassword}/>
    </>}
    <Pressable onPress={()=>router.replace('/(auth)/login' as any)} style={s.login}><Text style={s.loginText}>Remember your password? <Text style={s.loginLink}>Log in</Text></Text></Pressable>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>
}

function Info({icon,title,body}:{icon:any;title:string;body:string}){return <View style={s.info}><View style={s.infoIcon}><Ionicons name={icon} size={31} color={colors.primary}/></View><View style={{flex:1}}><Text style={s.infoTitle}>{title}</Text><Text style={s.infoBody}>{body}</Text></View></View>}
function PrimaryButton({title,disabled,press}:{title:string;disabled:boolean;press:()=>void}){return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={press} style={({pressed})=>[s.button,disabled&&s.buttonDisabled,pressed&&!disabled&&s.buttonPressed]}><Text style={s.buttonText}>{title}</Text></Pressable>}
function PasswordInput({label,value,setValue,visible,setVisible}:{label:string;value:string;setValue:(value:string)=>void;visible:boolean;setVisible:(value:boolean)=>void}){return <View style={s.passwordInput}><Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary}/><TextInput accessibilityLabel={label} value={value} onChangeText={setValue} placeholder={label} placeholderTextColor={colors.textMuted} secureTextEntry={!visible} autoCapitalize="none" style={s.input}/><Pressable accessibilityLabel={visible?'Hide password':'Show password'} onPress={()=>setVisible(!visible)} style={s.eye}><Ionicons name={visible?'eye-off-outline':'eye-outline'} size={24} color={colors.textSecondary}/></Pressable></View>}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.background},flex:{flex:1},shell:{flexGrow:1,width:'100%',paddingHorizontal:24,paddingTop:66,paddingBottom:24,backgroundColor:colors.background},webShell:{maxWidth:520,alignSelf:'center',marginVertical:16,borderWidth:1,borderColor:colors.border,borderRadius:32},back:{position:'absolute',left:18,top:18,width:46,height:46,borderRadius:23,alignItems:'center',justifyContent:'center',zIndex:2},artCrop:{height:225,width:290,alignSelf:'center',overflow:'hidden',marginBottom:2},art:{width:290,height:290},artCropSmall:{height:190,width:280,alignSelf:'center',overflow:'hidden'},artSmall:{width:280,height:280},title:{fontSize:28,lineHeight:35,fontWeight:'900',color:colors.textPrimary,textAlign:'center',marginTop:8},subtitle:{fontSize:15,lineHeight:23,color:colors.textSecondary,textAlign:'center',marginTop:10,marginBottom:22,paddingHorizontal:10},label:{fontSize:15,fontWeight:'800',color:colors.textPrimary,marginTop:20,marginBottom:9},phoneInput:{minHeight:60,borderWidth:1.5,borderColor:colors.border,borderRadius:15,backgroundColor:colors.surface,paddingHorizontal:15,flexDirection:'row',alignItems:'center'},flag:{fontSize:23},prefix:{fontSize:17,fontWeight:'800',color:colors.textPrimary,marginLeft:10},divider:{height:34,width:1,backgroundColor:colors.border,marginHorizontal:14},input:{flex:1,minWidth:0,fontSize:16,color:colors.textPrimary,paddingVertical:15,outlineStyle:'none' as any},info:{flexDirection:'row',alignItems:'center',gap:13,padding:17,borderWidth:1,borderColor:'#D6EBDD',borderRadius:16,backgroundColor:'#EFF8F1',marginTop:20},infoIcon:{width:46,height:46,borderRadius:23,backgroundColor:'#E0F2E5',alignItems:'center',justifyContent:'center'},infoTitle:{fontSize:15,fontWeight:'900',color:colors.primaryDark},infoBody:{fontSize:13,lineHeight:20,color:colors.textSecondary,marginTop:3},error:{fontSize:13,fontWeight:'700',color:colors.danger,marginTop:12,textAlign:'center'},button:{minHeight:58,borderRadius:14,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center',marginTop:20,shadowColor:colors.primaryDark,shadowOpacity:.14,shadowRadius:9,shadowOffset:{width:0,height:4},elevation:3},buttonDisabled:{backgroundColor:colors.disabled},buttonPressed:{backgroundColor:colors.primaryDark,transform:[{scale:.99}]},buttonText:{fontSize:17,fontWeight:'900',color:'#fff'},help:{flexDirection:'row',alignItems:'center',gap:10,padding:16,borderWidth:1,borderColor:'#D6EBDD',borderRadius:16,backgroundColor:'#EFF8F1',marginTop:22},helpIcon:{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center',backgroundColor:'#DDEFE3'},helpText:{flex:1},helpLink:{fontSize:12,fontWeight:'900',color:colors.primary},login:{minHeight:58,alignItems:'center',justifyContent:'center',marginTop:8},loginText:{fontSize:14,color:colors.textSecondary,fontWeight:'600'},loginLink:{fontWeight:'900',color:colors.primary},editRow:{flexDirection:'row',justifyContent:'center',gap:12,alignItems:'center',marginBottom:14},phoneText:{fontSize:16,fontWeight:'900',color:colors.primary},edit:{fontSize:15,fontWeight:'800',color:colors.primary},codeRow:{height:62,flexDirection:'row',gap:8,position:'relative'},codeBox:{flex:1,borderWidth:1.5,borderColor:colors.border,borderRadius:13,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},codeActive:{borderColor:colors.primary},codeDigit:{fontSize:23,fontWeight:'900',color:colors.textPrimary},hiddenCode:{position:'absolute',width:1,height:1,opacity:.01},resendRow:{flexDirection:'row',justifyContent:'center',alignItems:'center',flexWrap:'wrap',marginTop:13},resendMuted:{fontSize:13,color:colors.textSecondary},resend:{fontSize:13,fontWeight:'900',color:colors.primary},resendDisabled:{color:colors.textSecondary},passwordInput:{minHeight:60,borderWidth:1.5,borderColor:colors.border,borderRadius:15,backgroundColor:colors.surface,paddingLeft:16,flexDirection:'row',alignItems:'center',gap:10},eye:{width:50,height:56,alignItems:'center',justifyContent:'center'},rules:{flexDirection:'row',flexWrap:'wrap',marginTop:12,rowGap:8},rule:{width:'50%',flexDirection:'row',alignItems:'center',gap:7},ruleText:{fontSize:12,color:colors.textSecondary},ruleTextDone:{color:colors.primaryDark,fontWeight:'700'},
});
