import {Geolocation} from '@capacitor/geolocation';
export async function currentPosition(precise=false){
 try{const {coords}=await Geolocation.getCurrentPosition({enableHighAccuracy:precise,timeout:15000,maximumAge:precise?0:60000});return {latitude:coords.latitude,longitude:coords.longitude,accuracy:coords.accuracy}}
 catch{throw Error('Location is unavailable. Allow location access in your browser or device settings, then try again. You can also search by city or area.')}
}

// Only current coordinates from this device are sent directly to the lookup provider.
export async function currentNamedPosition(precise=false){
 const position=await currentPosition(precise);
 const response=await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?'+new URLSearchParams({latitude:String(position.latitude),longitude:String(position.longitude),localityLanguage:'en'}),{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('Your location name could not be found. Please try again or enter your city.');
 const data=await response.json();
 const label=[data.locality||data.city,data.city,data.principalSubdivision,data.countryName].filter((v,i,a)=>typeof v==='string'&&v&&a.indexOf(v)===i).join(', ');
 if(!label)throw Error('No place name was found for your position. Enter your city instead.');
 return {...position,label};
}
