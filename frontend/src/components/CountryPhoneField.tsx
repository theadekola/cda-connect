import {useMemo,useState} from 'react';
import {FlatList,Image,Modal,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {Country,type ICountry} from 'country-state-city';
import {useAppTheme} from '@/components/UI';

function dialCode(country:ICountry){return `+${String(country.phonecode).replace(/[^0-9]/g,'')}`}
function flagUrl(iso:string){return `https://flagcdn.com/w80/${iso.toLowerCase()}.png`}
function findCountry(countries:ICountry[],value:string,defaultIso:string){const digits=value.replace(/\D/g,'');return [...countries].sort((a,b)=>String(b.phonecode).length-String(a.phonecode).length).find(c=>digits.startsWith(String(c.phonecode).replace(/\D/g,'')))||countries.find(c=>c.isoCode===defaultIso)||countries[0]}

export function CountryPhoneField({value,onChange,defaultCountry='NG',placeholder='801 234 5678'}:{value:string;onChange:(value:string)=>void;defaultCountry?:string;placeholder?:string}){
 const{palette}=useAppTheme();const countries=useMemo(()=>Country.getAllCountries().filter(c=>c.phonecode),[]);const[selected,setSelected]=useState(()=>findCountry(countries,value,defaultCountry));const[open,setOpen]=useState(false);const[search,setSearch]=useState('');
 const code=dialCode(selected),codeDigits=code.replace(/\D/g,''),allDigits=value.replace(/\D/g,''),national=allDigits.startsWith(codeDigits)?allDigits.slice(codeDigits.length):allDigits.replace(/^0/,'');
 const shown=countries.filter(c=>`${c.name} ${c.isoCode} ${dialCode(c)}`.toLowerCase().includes(search.trim().toLowerCase()));
 function choose(country:ICountry){setSelected(country);onChange(`${dialCode(country)}${national}`);setOpen(false);setSearch('')}
 return <>
  <View style={[s.field,{backgroundColor:palette.surface,borderColor:palette.border}]}>
   <Pressable accessibilityRole="button" accessibilityLabel={`Country code ${selected.name} ${code}`} onPress={()=>setOpen(true)} style={s.countryButton}>
    <Image source={{uri:flagUrl(selected.isoCode)}} style={s.flag}/><Text style={[s.code,{color:palette.text}]}>{code}</Text><Ionicons name="chevron-down" size={17} color={palette.muted}/>
   </Pressable><View style={[s.divider,{backgroundColor:palette.border}]}/>
   <TextInput accessibilityLabel="Phone number" value={national} onChangeText={text=>onChange(`${code}${text.replace(/\D/g,'').replace(/^0/,'').slice(0,15-codeDigits.length)}`)} placeholder={placeholder} placeholderTextColor={palette.muted} keyboardType="phone-pad" style={[s.input,{color:palette.text}]}/>
  </View>
  <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setOpen(false)}><SafeAreaView style={[s.modal,{backgroundColor:palette.background}]}>
   <View style={s.head}><Text style={[s.title,{color:palette.text}]}>Select country code</Text><Pressable onPress={()=>setOpen(false)} style={s.close}><Ionicons name="close" size={27} color={palette.text}/></Pressable></View>
   <View style={[s.search,{borderColor:palette.border,backgroundColor:palette.surface}]}><Ionicons name="search" size={20} color={palette.muted}/><TextInput value={search} onChangeText={setSearch} placeholder="Search country or code" placeholderTextColor={palette.muted} style={[s.searchInput,{color:palette.text}]}/></View>
   <FlatList data={shown} keyExtractor={item=>item.isoCode} keyboardShouldPersistTaps="handled" renderItem={({item})=><Pressable onPress={()=>choose(item)} style={[s.option,{borderBottomColor:palette.border}]}><Image source={{uri:flagUrl(item.isoCode)}} style={s.optionFlag}/><Text style={[s.countryName,{color:palette.text}]}>{item.name}</Text><Text style={[s.optionCode,{color:palette.textSecondary}]}>{dialCode(item)}</Text>{item.isoCode===selected.isoCode?<Ionicons name="checkmark-circle" size={22} color={palette.primary}/>:null}</Pressable>}/>
  </SafeAreaView></Modal>
 </>
}

const s=StyleSheet.create({field:{minHeight:58,borderWidth:1.5,borderRadius:15,flexDirection:'row',alignItems:'center',marginBottom:12,overflow:'hidden'},countryButton:{minHeight:56,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:13},flag:{width:30,height:20,borderRadius:3,resizeMode:'cover'},code:{fontSize:16,fontWeight:'900'},divider:{width:1,height:34},input:{flex:1,minWidth:0,fontSize:16,paddingHorizontal:14,paddingVertical:14,outlineStyle:'none' as any},modal:{flex:1,padding:18},head:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:14},title:{fontSize:22,fontWeight:'900'},close:{width:44,height:44,alignItems:'center',justifyContent:'center'},search:{minHeight:52,borderWidth:1,borderRadius:14,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:9,marginBottom:8},searchInput:{flex:1,fontSize:16},option:{minHeight:60,borderBottomWidth:1,flexDirection:'row',alignItems:'center',gap:12},optionFlag:{width:36,height:24,borderRadius:3,resizeMode:'cover'},countryName:{fontSize:15,fontWeight:'800',flex:1},optionCode:{fontSize:15,fontWeight:'800'}});
