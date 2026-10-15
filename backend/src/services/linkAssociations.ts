export const appLinkPaths=['/invite/*','/post/*','/community/*','/chat/*','/poll/*'];
export function appleAssociation(appId:string){
 if(!/^[A-Z0-9]+\.[A-Za-z0-9.-]+$/.test(appId))throw Error('Configure IOS_APP_ID or APNS_TEAM_ID for iOS app links');
 return {applinks:{apps:[],details:[{appID:appId,paths:appLinkPaths}]}};
}
export function androidAssociation(fingerprints:string,bundleId='org.cdaconnect.app'){
 const values=[...new Set(fingerprints.split(',').map(value=>value.trim().toUpperCase()).filter(Boolean))];
 if(!values.length||values.some(value=>!/^([A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(value)))throw Error('Configure ANDROID_APP_LINK_SHA256 with the app signing certificate fingerprints');
 return [{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:bundleId,sha256_cert_fingerprints:values}}];
}
