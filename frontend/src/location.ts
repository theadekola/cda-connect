import {Geolocation} from '@capacitor/geolocation';
export async function currentPosition(){
 try{const {coords}=await Geolocation.getCurrentPosition({enableHighAccuracy:false,timeout:15000,maximumAge:60000});return {latitude:coords.latitude,longitude:coords.longitude}}
 catch{throw Error('Location is unavailable. Allow location access in your browser or device settings, then try again. You can also search by city or area.')}
}
