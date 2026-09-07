import {useEffect,useState} from 'react';
import {Modal,Pressable,ScrollView,StyleSheet,Text,View} from '@/platform/react-native';
import {Ionicons} from '@/platform/icons';
import {useAppTheme} from '@/components/UI';

type Period='AM'|'PM';
type TimeParts={hour:number;minute:number;period:Period};

const pad=(value:number)=>String(value).padStart(2,'0');
function parseTime(value:string):TimeParts{
 const match=/^(\d{1,2}):(\d{2})$/.exec(value||'');
 const now=new Date();
 const hour24=match&&Number(match[1])<24?Number(match[1]):now.getHours();
 const minute=match&&Number(match[2])<60?Number(match[2]):now.getMinutes();
 return{hour:hour24%12||12,minute,period:hour24>=12?'PM':'AM'};
}
function serializeTime(parts:TimeParts){const hour24=(parts.hour%12)+(parts.period==='PM'?12:0);return `${pad(hour24)}:${pad(parts.minute)}`}
export function displayTime(value:string){const p=parseTime(value);return `${pad(p.hour)}:${pad(p.minute)} ${p.period}`}

export function TimeField({value,onChange,placeholder='Select time',showIcon=true}:{value:string;onChange:(value:string)=>void;placeholder?:string;showIcon?:boolean}){
 const{palette}=useAppTheme();const[open,setOpen]=useState(false);const[draft,setDraft]=useState<TimeParts>(()=>parseTime(value));
 useEffect(()=>{if(!open)setDraft(parseTime(value))},[value,open]);
 function show(){setDraft(parseTime(value));setOpen(true)}
 return <>
  <Pressable accessibilityRole="button" accessibilityLabel={value?`Selected time ${displayTime(value)}`:placeholder} onPress={show} style={[s.field,{backgroundColor:palette.surface,borderColor:palette.border}]}>
   <Text numberOfLines={1} style={[s.fieldText,{color:value?palette.text:palette.muted}]}>{value?displayTime(value):placeholder}</Text>{showIcon?<Ionicons name="time-outline" size={21} color={palette.primary}/>:null}
  </Pressable>
  <Modal visible={open} transparent animationType="fade" onRequestClose={()=>setOpen(false)}>
   <View style={s.overlay}><View style={[s.modal,{backgroundColor:palette.background}]}> 
    <Text style={[s.title,{color:palette.text}]}>Select time</Text>
    <Text style={[s.preview,{color:palette.primary}]}>{pad(draft.hour)}:{pad(draft.minute)} {draft.period}</Text>
    <View style={s.pickers}>
     <Picker values={Array.from({length:12},(_,i)=>i+1)} selected={draft.hour} label={v=>String(v)} change={hour=>setDraft(x=>({...x,hour}))} palette={palette}/>
     <Picker values={Array.from({length:60},(_,i)=>i)} selected={draft.minute} label={pad} change={minute=>setDraft(x=>({...x,minute}))} palette={palette}/>
     <Picker values={['AM','PM'] as Period[]} selected={draft.period} label={v=>v} change={period=>setDraft(x=>({...x,period}))} palette={palette}/>
    </View>
    <View style={s.actions}><Pressable onPress={()=>setOpen(false)} style={[s.action,{borderColor:palette.primary}]}><Text style={{color:palette.primary,fontWeight:'900'}}>Cancel</Text></Pressable><Pressable onPress={()=>{onChange(serializeTime(draft));setOpen(false)}} style={[s.action,{backgroundColor:palette.primary,borderColor:palette.primary}]}><Text style={{color:'#fff',fontWeight:'900'}}>Set time</Text></Pressable></View>
   </View></View>
  </Modal>
 </>
}

function Picker<T extends string|number>({values,selected,label,change,palette}:{values:T[];selected:T;label:(value:T)=>string;change:(value:T)=>void;palette:any}){
 return <ScrollView style={[s.picker,{borderColor:palette.border}]} contentContainerStyle={s.pickerContent} showsVerticalScrollIndicator={false}>{values.map(value=><Pressable key={String(value)} onPress={()=>change(value)} style={[s.option,selected===value&&{backgroundColor:palette.primarySoft}]}><Text style={[s.optionText,{color:selected===value?palette.primary:palette.text}]}>{label(value)}</Text></Pressable>)}</ScrollView>
}

const s=StyleSheet.create({field:{minHeight:52,borderWidth:1,borderRadius:14,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12},fieldText:{flex:1,fontSize:16,fontWeight:'700'},overlay:{flex:1,backgroundColor:'rgba(8,24,45,.48)',alignItems:'center',justifyContent:'center',padding:20},modal:{width:'100%',maxWidth:390,borderRadius:24,padding:20,shadowColor:'#000',shadowOpacity:.18,shadowRadius:24,elevation:12},title:{fontSize:22,fontWeight:'900',textAlign:'center'},preview:{fontSize:30,fontWeight:'900',textAlign:'center',marginVertical:14},pickers:{height:238,flexDirection:'row',gap:10},picker:{flex:1,borderWidth:1,borderRadius:14},pickerContent:{padding:6},option:{height:44,alignItems:'center',justifyContent:'center',borderRadius:10},optionText:{fontSize:17,fontWeight:'800'},actions:{flexDirection:'row',gap:10,marginTop:18},action:{flex:1,minHeight:50,borderWidth:1,borderRadius:14,alignItems:'center',justifyContent:'center'}});
