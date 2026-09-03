import {Image, ImageBackground, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {router} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors} from '@/theme';

const logo = require('../../assets/branding/cda-connect-logo.png');
const communityBackground = require('../../assets/branding/welcome-community.png');

function ImageDissolve(){return <View pointerEvents="none" style={styles.dissolve}>{[.08,.18,.32,.5,.7,.86,.96,1].map((opacity,i)=><View key={i} style={{flex:1,backgroundColor:colors.background,opacity}}/>)}</View>}

export default function Welcome(){
  const {width,height}=useWindowDimensions();
  const web=Platform.OS==='web';
  const compactHeight=height<700;
  const shellWidth=Math.min(width,520);

  const register=()=>router.push('/(auth)/onboarding' as any);
  const signIn=()=>router.push('/(auth)/login');

  return <SafeAreaView style={styles.safe} edges={['top','bottom']}>
    <StatusBar style="dark"/>
    <View style={[styles.shell,web&&{width:shellWidth},web&&width>560&&styles.webShell]}>
      <ImageBackground source={communityBackground} resizeMode="cover" style={[styles.hero,compactHeight&&styles.heroCompact]} imageStyle={styles.heroImage}>
        <View style={styles.heroWash}/><ImageDissolve/>
        <View style={[styles.logoFrame,compactHeight&&styles.logoFrameCompact]}>
          <Image source={logo} resizeMode="contain" style={styles.logo}/>
        </View>
      </ImageBackground>

      <View style={[styles.content,compactHeight&&styles.contentCompact]}>
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={[styles.title,compactHeight&&styles.titleCompact]}>CDA Connect</Text>
          <Text style={styles.tagline}>Stronger communities,{`\n`}better together.</Text>
        </View>

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Get Started" onPress={register} style={({pressed})=>[styles.primaryButton,pressed&&styles.primaryButtonPressed]}>
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Sign in" onPress={signIn} style={({pressed})=>[styles.signInRow,pressed&&styles.signInPressed]}>
            <Text style={styles.accountText}>Already have an account? <Text style={styles.signInText}>Sign in</Text></Text>
          </Pressable>
        </View>
      </View>
    </View>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  safe:{flex:1,width:'100%',backgroundColor:colors.backgroundSoft,alignItems:'center'},
  shell:{flex:1,width:'100%',backgroundColor:colors.background,overflow:'hidden'},
  webShell:{marginVertical:18,borderRadius:32,borderWidth:1,borderColor:colors.border,shadowColor:colors.textPrimary,shadowOpacity:.12,shadowRadius:28,shadowOffset:{width:0,height:10}},
  hero:{height:'59%',minHeight:350,width:'100%',alignItems:'center'},
  heroCompact:{height:'55%',minHeight:300},
  heroImage:{width:'100%',height:'100%'},
  heroWash:{...StyleSheet.absoluteFill,backgroundColor:'rgba(255,255,255,.08)'},
  dissolve:{position:'absolute',left:0,right:0,bottom:0,height:118},
  logoFrame:{position:'absolute',left:'50%',marginLeft:-60,top:'22%',width:120,height:120,alignItems:'center',justifyContent:'center'},
  logoFrameCompact:{width:108,height:108,marginLeft:-54},
  logo:{width:'100%',height:'100%'},
  content:{flex:1,marginTop:-64,borderTopLeftRadius:52,borderTopRightRadius:52,backgroundColor:colors.background,paddingHorizontal:30,paddingTop:64,paddingBottom:22,justifyContent:'space-between'},
  contentCompact:{marginTop:-54,borderTopLeftRadius:42,borderTopRightRadius:42,paddingTop:48,paddingBottom:14},
  copy:{alignItems:'center'},
  title:{fontSize:38,lineHeight:46,fontWeight:'800',letterSpacing:.1,color:colors.primaryDark,textAlign:'center'},
  titleCompact:{fontSize:32,lineHeight:39},
  tagline:{marginTop:14,fontSize:18,lineHeight:27,fontWeight:'700',color:colors.textPrimary,textAlign:'center'},
  actions:{width:'100%',gap:10},
  primaryButton:{width:'100%',minHeight:58,borderRadius:14,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center',paddingHorizontal:20,shadowColor:colors.primaryDark,shadowOpacity:.18,shadowRadius:10,shadowOffset:{width:0,height:5},elevation:3},
  primaryButtonPressed:{backgroundColor:colors.primaryDark,transform:[{scale:.99}]},
  primaryButtonText:{fontSize:18,fontWeight:'800',color:colors.white},
  signInRow:{minHeight:48,alignItems:'center',justifyContent:'center',paddingHorizontal:8},
  signInPressed:{opacity:.65},
  accountText:{fontSize:15,color:colors.textSecondary,textAlign:'center',fontWeight:'600'},
  signInText:{color:colors.primary,fontWeight:'800'},
});
