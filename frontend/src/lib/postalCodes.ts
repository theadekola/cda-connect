const countriesWithoutPostcodes = new Set([
  'AO','BJ','BF','BI','CM','CF','TD','KM','CG','CD','CI','DJ','GQ','ER','GA','GM','GH','GN','GW','LR','LY','ML','MR','NG','RW','ST','SC','SL','SO','SS','TG','UG','ZW',
]);

const countryNamesWithoutPostcodes = new Set([
  'angola','benin','burkina faso','burundi','cameroon','central african republic','chad','comoros','republic of the congo','congo','democratic republic of the congo','dr congo','ivory coast','côte d’ivoire','côte d\'ivoire','djibouti','equatorial guinea','eritrea','gabon','gambia','ghana','guinea','guinea-bissau','liberia','libya','mali','mauritania','nigeria','rwanda','sao tome and principe','são tomé and príncipe','seychelles','sierra leone','somalia','south sudan','togo','uganda','zimbabwe',
]);

export function countryUsesPostcode(country?:string|null){
  const value=String(country||'').trim();
  if(!value)return true;
  if(value.length===2)return !countriesWithoutPostcodes.has(value.toUpperCase());
  return !countryNamesWithoutPostcodes.has(value.toLocaleLowerCase());
}
