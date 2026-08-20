import {useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useAppTheme} from '@/components/UI';

type Props={label:string;value:string;options:string[];onChange:(value:string)=>void;icon?:keyof typeof Ionicons.glyphMap};

export function ExpandableSelect({label,value,options,onChange,icon}:Props){
 const{palette}=useAppTheme();const[open,setOpen]=useState(false);
 return <View style={[styles.wrap,{borderBottomColor:palette.border}]}>
  <Pressable accessibilityRole="button" accessibilityState={{expanded:open}} accessibilityLabel={`${label}, ${value}`} onPress={()=>setOpen(x=>!x)} style={styles.trigger}>
   {icon?<View style={[styles.icon,{backgroundColor:palette.successSoft}]}><Ionicons name={icon} size={19} color={palette.success}/></View>:null}
   <Text style={[styles.label,{color:palette.text}]}>{label}</Text><Text numberOfLines={1} style={[styles.value,{color:palette.text}]}>{value}</Text>
   <Ionicons name={open?'chevron-up':'chevron-down'} size={18} color={palette.muted}/>
  </Pressable>
  {open?<View style={[styles.options,{borderColor:palette.border,backgroundColor:palette.surface}]}>{options.map(option=><Pressable key={option} accessibilityRole="button" onPress={()=>{onChange(option);setOpen(false)}} style={[styles.option,{borderBottomColor:palette.border},option===value&&{backgroundColor:palette.successSoft}]}><Text style={[styles.optionText,{color:option===value?palette.success:palette.text}]}>{option}</Text>{option===value?<Ionicons name="checkmark-circle" size={20} color={palette.success}/>:null}</Pressable>)}</View>:null}
 </View>
}

const styles=StyleSheet.create({wrap:{borderBottomWidth:1},trigger:{minHeight:60,flexDirection:'row',alignItems:'center',gap:10},icon:{width:39,height:39,borderRadius:12,alignItems:'center',justifyContent:'center'},label:{flex:1,fontWeight:'900'},value:{maxWidth:'43%',fontWeight:'800'},options:{borderWidth:1,borderRadius:12,overflow:'hidden',marginBottom:10},option:{minHeight:46,paddingHorizontal:13,borderBottomWidth:1,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},optionText:{fontWeight:'800'}});
