import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { Button, Input, Muted, Screen } from '@/components/UI';
import { colors } from '@/theme';

export default function Login(){
  const[email,setEmail]=useState(''); const[password,setPassword]=useState(''); const[loading,setLoading]=useState(false); const setSession=useAuth(s=>s.setSession);
  async function submit(){try{setLoading(true);const r=await api.post('/auth/login',{email,password});await setSession(r.data.user,r.data.accessToken,r.data.refreshToken);router.replace('/(tabs)/home');}catch(e:any){Alert.alert('Login failed',e.response?.data?.error??e.message)}finally{setLoading(false)}}
  return <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><Screen scroll contentStyle={{maxWidth:560,width:'100%',alignSelf:'center'}}>
    <Pressable onPress={()=>(router.canGoBack()?router.back():router.replace('/'))} style={styles.back}><Ionicons name="chevron-back" size={24} color={colors.text}/></Pressable>
    <View style={styles.logo}><Ionicons name="people" size={30} color="#fff"/></View>
    <Text style={styles.title}>Welcome Back! 👋</Text><Muted>Login to continue to your communities.</Muted>
    <Text style={styles.label}>Email</Text><Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com"/>
    <Text style={styles.label}>Password</Text>
    <Input value={password} onChangeText={setPassword} secureTextEntry placeholder="Enter your password"/>
    <Button title="Login" loading={loading} onPress={submit}/>
    <Pressable onPress={()=>router.push('/(auth)/register')}><Text style={styles.signup}>Don't have an account? <Text style={styles.link}>Sign up</Text></Text></Pressable>
  </Screen></KeyboardAvoidingView>
}
const styles=StyleSheet.create({back:{marginTop:8,marginBottom:24,width:40},logo:{width:58,height:58,borderRadius:18,backgroundColor:colors.cyan,alignItems:'center',justifyContent:'center',marginBottom:22},title:{fontSize:30,fontWeight:'900',color:colors.text,marginBottom:4},label:{fontSize:13,fontWeight:'700',color:colors.text,marginBottom:7,marginTop:18},labelRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end'},link:{color:colors.primary,fontWeight:'800'},divider:{flexDirection:'row',alignItems:'center',gap:12,marginVertical:20},line:{height:1,backgroundColor:colors.border,flex:1},or:{color:colors.muted,fontSize:12},signup:{textAlign:'center',marginTop:22,color:colors.muted,fontSize:13}})
