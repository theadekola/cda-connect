import {Redirect,useLocalSearchParams} from 'expo-router';

// Backward-compatible redirect for old notifications, bookmarks and cached app links.
// Community administration now lives in Govern & Protect on the community page.
export default function RemovedAdminPanel(){
 const{id}=useLocalSearchParams<{id:string}>();
 return <Redirect href={`/community/${id}` as never}/>;
}
