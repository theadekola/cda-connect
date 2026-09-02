// Product rule: postcode is not collected for African countries.
const countriesWithoutPostcodes = new Set([
  'DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CG','CD','CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW',
]);

const countryNamesWithoutPostcodes = new Set([
  'algeria','angola','benin','botswana','burkina faso','burundi','cabo verde','cape verde','cameroon','central african republic','chad','comoros','republic of the congo','congo','democratic republic of the congo','dr congo','ivory coast','côte d’ivoire','côte d\'ivoire','djibouti','egypt','equatorial guinea','eritrea','eswatini','swaziland','ethiopia','gabon','gambia','ghana','guinea','guinea-bissau','kenya','lesotho','liberia','libya','madagascar','malawi','mali','mauritania','mauritius','morocco','mozambique','namibia','niger','nigeria','rwanda','sao tome and principe','são tomé and príncipe','senegal','seychelles','sierra leone','somalia','south africa','south sudan','sudan','tanzania','togo','tunisia','uganda','zambia','zimbabwe',
]);

export function countryUsesPostcode(country?:string|null){
  const value=String(country||'').trim();
  if(!value)return true;
  if(value.length===2)return !countriesWithoutPostcodes.has(value.toUpperCase());
  return !countryNamesWithoutPostcodes.has(value.toLocaleLowerCase());
}
