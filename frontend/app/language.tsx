import {Pressable,StyleSheet,Text,View} from '@/platform/react-native';
import {Ionicons} from '@/platform/icons';
import {AppLanguage,useAccessibility} from '@/store/accessibility';
import {languageNames} from '@/i18n';
import {Muted,Screen,useAppTheme} from '@/components/UI';

const languages:{code:AppLanguage;region:string;flag:string}[]=[
 {code:'en',region:'English (UK)',flag:'🇬🇧'},{code:'fr',region:'Français',flag:'🇫🇷'},{code:'es',region:'Español',flag:'🇪🇸'},{code:'pt',region:'Português',flag:'🇵🇹'},
 {code:'ar',region:'العربية',flag:'🇸🇦'},{code:'yo',region:'Yorùbá',flag:'🇳🇬'},{code:'ig',region:'Igbo',flag:'🇳🇬'},{code:'ha',region:'Hausa',flag:'🇳🇬'},
];

export default function Language(){
 const a=useAccessibility(),{palette}=useAppTheme();
 const selectedLanguage=a.draftLanguage??a.language;
 return <Screen scroll contentStyle={s.page}><Muted style={s.subtitle}>Choose the language used throughout CDA Connect, then press the Save icon in the header.</Muted><View style={[s.list,{borderColor:palette.border,backgroundColor:palette.surface}]}>{languages.map(item=>{const selected=selectedLanguage===item.code;return <Pressable key={item.code} accessibilityRole="radio" accessibilityState={{checked:selected}} accessibilityLabel={languageNames[item.code]} onPress={()=>a.selectLanguage(item.code)} style={[s.row,{borderBottomColor:palette.border},selected&&{backgroundColor:palette.primarySoft}]}><Text accessibilityLabel={`${languageNames[item.code]} flag`} style={s.flag}>{item.flag}</Text><View style={{flex:1}}><Text style={[s.name,{color:selected?palette.primary:palette.text}]}>{languageNames[item.code]}</Text><Muted>{item.region}</Muted></View><Ionicons name={selected?'radio-button-on':'radio-button-off'} size={24} color={selected?palette.primary:palette.muted}/></Pressable>})}</View></Screen>;
}

const s=StyleSheet.create({page:{width:'100%',maxWidth:720,alignSelf:'center',paddingTop:18,paddingBottom:30},subtitle:{marginBottom:16},list:{borderWidth:1,borderRadius:14,overflow:'hidden'},row:{minHeight:76,borderBottomWidth:1,paddingHorizontal:16,flexDirection:'row',alignItems:'center',gap:14},flag:{width:48,fontSize:31,textAlign:'center'},name:{fontSize:16,fontWeight:'900',marginBottom:3}});
