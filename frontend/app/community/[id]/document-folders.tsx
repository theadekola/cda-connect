import {Pressable,StyleSheet,Text,View} from '@/platform/react-native';
import {router,useLocalSearchParams} from '@/router';
import {useQuery} from '@tanstack/react-query';
import {Ionicons} from '@/platform/icons';
import {api} from '@/lib/api';
import {Card,Header,Muted,Screen,useAppTheme} from '@/components/UI';

type Category='Constitution'|'Policies'|'Meeting minutes'|'Financial reports'|'Forms'|'Newsletters'|'Community rules'|'Emergency procedures'|'Archives'|'Other';
type Doc={Id:string;Category:string};
type Folder={key:string;label:string;description:string;icon:keyof typeof Ionicons.glyphMap;categories:Category[];color:string;background:string};
const folders:Folder[]=[
 {key:'All',label:'All Documents',description:'Every document shared with the community',icon:'folder-outline',categories:['Constitution','Policies','Meeting minutes','Financial reports','Forms','Newsletters','Community rules','Emergency procedures','Archives','Other'],color:'#149447',background:'#EAF7EE'},
 {key:'Policies',label:'Policies',description:'Policies, constitution and community rules',icon:'document-text-outline',categories:['Policies','Constitution','Community rules'],color:'#2374EA',background:'#EAF1FF'},
 {key:'Reports',label:'Reports',description:'Minutes, financial reports and newsletters',icon:'people-outline',categories:['Meeting minutes','Financial reports','Newsletters'],color:'#8B4DE8',background:'#F2EAFE'},
 {key:'Forms',label:'Forms',description:'Community forms and applications',icon:'reader-outline',categories:['Forms'],color:'#F28A00',background:'#FFF2DF'},
 {key:'Archives',label:'Archives',description:'Archived community documents',icon:'archive-outline',categories:['Archives'],color:'#08979C',background:'#E7F6F6'},
];

export default function DocumentFolders(){
 const{id}=useLocalSearchParams<{id:string}>();const{palette}=useAppTheme();
 const docs=useQuery<Doc[]>({queryKey:['documents',id],queryFn:async()=>(await api.get(`/communities/${id}/documents`)).data});
 const count=(folder:Folder)=>folder.key==='All'?(docs.data||[]).length:(docs.data||[]).filter(doc=>folder.categories.some(category=>category===doc.Category)).length;
 return <Screen scroll contentStyle={s.page}><Header page title="Document Folders" subtitle="Browse community files by category"/>
  {docs.isError?<Muted>Document folder counts could not be loaded. Try again shortly.</Muted>:null}
  <View style={s.grid}>{folders.map(folder=><Pressable key={folder.key} accessibilityRole="button" accessibilityLabel={`Open ${folder.label}`} onPress={()=>router.push(`/community/${id}/document-folder/${encodeURIComponent(folder.key)}` as any)} style={s.cell}><Card style={[s.folder,{borderColor:palette.border}]}><View style={[s.icon,{backgroundColor:folder.background}]}><Ionicons name={folder.icon} size={28} color={folder.color}/></View><Text style={[s.title,{color:palette.text}]}>{folder.label}</Text><Muted style={s.description}>{folder.description}</Muted><View style={s.footer}><Text style={[s.count,{color:folder.color}]}>{docs.isLoading?'—':count(folder)} documents</Text><Ionicons name="chevron-forward" size={18} color={folder.color}/></View></Card></Pressable>)}</View>
 </Screen>;
}
const s=StyleSheet.create({page:{width:'100%',maxWidth:760,alignSelf:'center',paddingBottom:125},grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:10},cell:{width:'48%',minWidth:145},folder:{minHeight:190,padding:15},icon:{width:50,height:50,borderRadius:14,alignItems:'center',justifyContent:'center'},title:{fontSize:17,fontWeight:'900',marginTop:12},description:{fontSize:12,lineHeight:17,marginTop:5},footer:{marginTop:'auto',paddingTop:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:5},count:{fontSize:12,fontWeight:'800'}});
