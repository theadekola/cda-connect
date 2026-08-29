import {Redirect} from 'expo-router';

/** Legacy route retained for old bookmarks and cached navigation state. */
export default function LegacyDiscoveryPreferences(){
  return <Redirect href="/(tabs)/communities"/>;
}
