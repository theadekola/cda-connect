// A public sample only. Never print the API key or environment values.
try{
 if(process.argv[2])process.loadEnvFile(process.argv[2]);
 const {translationAvailable,transformText}=await import('../dist/services/language.js');
 if(!translationAvailable())throw Error('No translation provider is configured.');
 await transformText('Welcome to our community','translate','yo');
 console.log('PASS: server translation provider returned a Yoruba translation.');
}catch(error){
 console.error('FAIL: translation provider check. Verify the key, enabled API, billing, server IP restrictions and quotas.');
 process.exitCode=1;
}
