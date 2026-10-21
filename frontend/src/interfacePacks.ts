// Separate JSON chunks keep optional specialist translations out of startup JS.
const packs=import.meta.glob<{default:Record<string,string>}>('./interfacePacks/*.json');
export async function loadInterfacePack(language:string){
 const load=packs['./interfacePacks/'+language+'.json'];
 if(!load)return {};
 const {default:strings}=await load();
 if(!strings||typeof strings!=='object'||Array.isArray(strings))throw Error('Invalid interface language pack');
 const result:Record<string,string>=Object.create(null);
 for(const [key,value] of Object.entries(strings)){
  if(typeof value!=='string'||!value.trim()||value.length>50000)throw Error('Invalid interface translation');
  result[key]=value;
 }
 return result;
}
