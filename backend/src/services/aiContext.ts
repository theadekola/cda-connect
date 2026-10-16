// Fit authorised source excerpts inside the private AI adapter's request budget.
export function boundedAIContext(context:Record<string,Record<string,unknown>[]>){
 const result:Record<string,Record<string,unknown>[]>=Object.fromEntries(Object.keys(context).map(key=>[key,[]]));
 for(const [kind,items]of Object.entries(context))for(const item of items.slice(0,12)){
  const excerpt=Object.fromEntries(Object.entries(item).map(([key,value])=>[key,typeof value==='string'?value.slice(0,4000):value]));
  result[kind].push(excerpt);
  if(Buffer.byteLength(JSON.stringify(result),'utf8')>100000)result[kind].pop();
 }
 return result;
}
