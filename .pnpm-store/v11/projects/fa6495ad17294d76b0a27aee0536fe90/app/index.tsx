import { Redirect } from 'expo-router';
import { useAuth } from '@/store/auth';
export default function Index(){
  return <Redirect href={useAuth().accessToken?'/(tabs)/home':'/(auth)/welcome'}/>;
}
