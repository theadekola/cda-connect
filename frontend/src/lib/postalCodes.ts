type PostalRequirement='USED'|'NOT_USED'|'UNKNOWN';

// Canonical ISO codes, names, aliases and address behavior live in one source.
// Unknown countries keep an optional postcode field visible.
const countries=[
  {iso:'NG',names:['nigeria'],postal:'USED'},
  {iso:'GB',names:['united kingdom','uk','great britain'],postal:'USED'},
  {iso:'ZA',names:['south africa'],postal:'USED'},
  {iso:'KE',names:['kenya'],postal:'USED'},
  {iso:'MA',names:['morocco'],postal:'USED'},
  {iso:'HK',names:['hong kong'],postal:'NOT_USED'},
  {iso:'MO',names:['macao','macau'],postal:'NOT_USED'},
] as const satisfies ReadonlyArray<{iso:string;names:readonly string[];postal:PostalRequirement}>;

const lookup=new Map<string,PostalRequirement>();
for(const country of countries){lookup.set(country.iso,country.postal);for(const name of country.names)lookup.set(name.toLocaleLowerCase(),country.postal)}

export function countryUsesPostcode(country?:string|null){
  const key=String(country||'').trim();
  if(!key)return true;
  return lookup.get(key.length===2?key.toUpperCase():key.toLocaleLowerCase())!=='NOT_USED';
}
