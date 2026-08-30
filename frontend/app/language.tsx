import {Pressable,StyleSheet,Text,View} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {AppLanguage,useAccessibility} from '@/store/accessibility';
import {languageNames} from '@/i18n';
import {Muted,Screen,useAppTheme} from '@/components/UI';

const languages:{code:AppLanguage;region:string;symbol:string}[]=[
 {code:'en',region:'English (UK)',symbol:'GB'},{code:'fr',region:'Français',symbol:'FR'},{code:'es',region:'Español',symbol:'ES'},{code:'pt',region:'Português',symbol:'PT'},
 {code:'ar',region:'العربية',symbol:'SA'},{code:'yo',region:'Yorùbá',symbol:'NG'},{code:'ig',region:'Igbo',symbol:'NG'},{code:'ha',region:'Hausa',symbol:'NG'},
];

export default function Language(){
 const a=useAccessibility(),{palette}=useAppTheme();
 const choose=async(code:AppLanguage)=>{await a.update({language:code});router.replace('/(tabs)/profile' as any)};
 return <Screen scroll contentStyle={s.page}><Muted style={s.subtitle}>Choose the language used for supported text throughout CDA Connect.</Muted><View style={[s.list,{borderColor:palette.border,backgroundColor:palette.surface}]}>{languages.map(item=>{const selected=a.language===item.code;return <Pressable key={item.code} accessibilityRole="radio" accessibilityState={{checked:selected}} accessibilityLabel={languageNames[item.code]} onPress={()=>void choose(item.code)} style={[s.row,{borderBottomColor:palette.border},selected&&{backgroundColor:palette.primarySoft}]}><Text style={[s.code,{color:palette.text}]}>{item.symbol}</Text><View style={{flex:1}}><Text style={[s.name,{color:selected?palette.primary:palette.text}]}>{languageNames[item.code]}</Text><Muted>{item.region}</Muted></View><Ionicons name={selected?'radio-button-on':'radio-button-off'} size={24} color={selected?palette.primary:palette.muted}/></Pressable>})}</View></Screen>;
}

const s=StyleSheet.create({page:{width:'100%',maxWidth:720,alignSelf:'center',paddingTop:18,paddingBottom:30},subtitle:{marginBottom:16},list:{borderWidth:1,borderRadius:14,overflow:'hidden'},row:{minHeight:76,borderBottomWidth:1,paddingHorizontal:16,flexDirection:'row',alignItems:'center',gap:14},code:{width:48,fontSize:21,textAlign:'center'},name:{fontSize:16,fontWeight:'900',marginBottom:3}});
