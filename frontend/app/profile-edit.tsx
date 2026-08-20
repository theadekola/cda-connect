import {useState} from 'react';
import {Alert,Platform,Pressable,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {api} from '@/lib/api';
import {useAuth} from '@/store/auth';
import {Avatar,Button,Card,Input,Muted,Screen,useAppTheme} from '@/components/UI';

export default function ProfileEdit(){
 const{user,accessToken,refreshToken,setSession}=useAuth();const{palette}=useAppTheme();const{width}=useWindowDimensions();const desktop=Platform.OS==='web'&&width>=900;
 const[firstName,setFirstName]=useState(user?.FirstName||'');const[lastName,setLastName]=useState(user?.LastName||'');const[phone,setPhone]=useState(user?.Phone||'');const[profileImage,setProfileImage]=useState((user as any)?.ProfileImage||'');const[loading,setLoading]=useState(false);
 const name=`${firstName} ${lastName}`.trim()||'Community Member';
 async function save(){try{setLoading(true);await api.patch('/me',{firstName:firstName.trim(),lastName:lastName.trim(),phone:phone.trim()||null,profileImage:profileImage.trim()||null});const updated=(await api.get('/me')).data;if(accessToken&&refreshToken)await setSession(updated,accessToken,refreshToken);Alert.alert('Profile updated','Your changes have been saved.');router.replace('/(tabs)/profile')}catch(e:any){Alert.alert('Unable to update profile',e.response?.data?.error??e.message)}finally{setLoading(false)}}
 const cancel=()=>router.canGoBack()?router.back():router.replace('/(tabs)/profile');
 return <Screen scroll contentStyle={styles.page}>
  <View style={styles.top}><Pressable accessibilityLabel="Back to profile" onPress={cancel} style={styles.back}><Ionicons name="chevron-back" size={25} color={palette.text}/></Pressable><View style={{flex:1}}><Text style={[styles.title,{color:palette.text}]}>Edit Profile</Text><Muted>Update your personal information and profile photo.</Muted></View>{!desktop?<Pressable onPress={save} disabled={loading}><Text style={[styles.saveLink,{color:palette.success}]}>Save</Text></Pressable>:null}</View>
  <View style={[styles.layout,!desktop&&styles.stack]}>
   {desktop?<Card style={styles.side}><Text style={[styles.sideTitle,{color:palette.text}]}>Profile Sections</Text>{[['person-outline','Personal Information'],['camera-outline','Profile Photo'],['call-outline','Contact Information']].map(([icon,label],i)=><View key={label} style={[styles.sideRow,i===0&&{backgroundColor:palette.successSoft}]}><Ionicons name={icon as any} size={20} color={i===0?palette.success:palette.muted}/><Text style={{color:i===0?palette.success:palette.text,fontWeight:'800'}}>{label}</Text></View>)}</Card>:null}
   <Card style={styles.form}>
    <Text style={[styles.sectionTitle,{color:palette.text}]}>Personal Information</Text>
    <View style={styles.photoRow}><Avatar name={name} size={desktop?112:92}/><View style={{flex:1}}><Text style={[styles.label,{color:palette.text}]}>Profile photo URL</Text><Input placeholder="https://your-site.com/profile-photo.jpg" value={profileImage} onChangeText={setProfileImage} autoCapitalize="none"/><Pressable onPress={()=>setProfileImage('')}><Text style={[styles.remove,{color:palette.danger}]}>Remove photo</Text></Pressable></View></View>
    <View style={[styles.two,!desktop&&styles.stack]}><View style={{flex:1}}><Text style={[styles.label,{color:palette.text}]}>First Name</Text><Input placeholder="First name" value={firstName} onChangeText={setFirstName}/></View><View style={{flex:1}}><Text style={[styles.label,{color:palette.text}]}>Last Name</Text><Input placeholder="Last name" value={lastName} onChangeText={setLastName}/></View></View>
    <View style={[styles.two,!desktop&&styles.stack]}><View style={{flex:1}}><Text style={[styles.label,{color:palette.text}]}>Email</Text><View style={[styles.readOnly,{borderColor:palette.border,backgroundColor:palette.background}]}><Text style={{color:palette.muted}}>{user?.Email}</Text><Ionicons name="lock-closed" size={16} color={palette.muted}/></View></View><View style={{flex:1}}><Text style={[styles.label,{color:palette.text}]}>Phone Number</Text><Input placeholder="Phone number" keyboardType="phone-pad" value={phone} onChangeText={setPhone}/></View></View>
    <Text style={[styles.label,{color:palette.text}]}>Location</Text><View style={[styles.readOnly,{borderColor:palette.border,backgroundColor:palette.background}]}><Text style={{color:palette.muted}}>{[(user as any)?.City,(user as any)?.State,(user as any)?.Country].filter(Boolean).join(', ')||'Update location from your Profile page'}</Text><Ionicons name="location" size={17} color={palette.success}/></View>
    <Muted style={{marginTop:10}}>Email and registered address changes require account verification. Your Profile page can securely refresh your current display location.</Muted>
    <View style={[styles.actions,!desktop&&styles.actionsMobile]}><Button title="Cancel" variant="secondary" onPress={cancel}/><Button title="Save Changes" icon="checkmark" loading={loading} disabled={firstName.trim().length<2||lastName.trim().length<2} onPress={save}/></View>
   </Card>
  </View>
 </Screen>
}

const styles=StyleSheet.create({page:{width:'100%',maxWidth:1180,alignSelf:'center'},top:{minHeight:76,flexDirection:'row',alignItems:'center',gap:13,marginBottom:16},back:{width:44,height:44,alignItems:'center',justifyContent:'center'},title:{fontSize:26,fontWeight:'900'},saveLink:{fontSize:15,fontWeight:'900'},layout:{flexDirection:'row',gap:18,alignItems:'flex-start'},stack:{flexDirection:'column'},side:{width:270,padding:16},sideTitle:{fontSize:17,fontWeight:'900',marginBottom:12},sideRow:{minHeight:52,borderRadius:11,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:12},form:{flex:1,padding:22},sectionTitle:{fontSize:20,fontWeight:'900',marginBottom:18},photoRow:{flexDirection:'row',alignItems:'center',gap:20,marginBottom:12},label:{fontSize:13,fontWeight:'800',marginBottom:7},remove:{fontSize:12,fontWeight:'800'},two:{flexDirection:'row',gap:14},readOnly:{minHeight:50,borderWidth:1,borderRadius:12,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12},actions:{flexDirection:'row',justifyContent:'flex-end',gap:12,marginTop:22},actionsMobile:{flexDirection:'column-reverse',alignItems:'stretch'}});
