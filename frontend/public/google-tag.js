// Optional analytics only starts following an explicit choice on this device.
(function(){
 const id='G-HT1Y2WF4S7';
 function apply(){let allowed=false;try{allowed=localStorage.getItem('cda-analytics-consent')==='granted'}catch{}
 window['ga-disable-'+id]=!allowed;
 if(!allowed){document.querySelectorAll('script[data-cda-analytics]').forEach(s=>s.remove());for(const item of document.cookie.split(';')){const name=item.trim().split('=')[0];if(!/^_ga($|_)/.test(name))continue;const parts=location.hostname.split('.');for(let i=0;i<parts.length;i++)document.cookie=name+'=; Max-Age=0; path=/; domain=.'+parts.slice(i).join('.');document.cookie=name+'=; Max-Age=0; path=/'}return}
 if(document.querySelector('script[data-cda-analytics]'))return;
 window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments)};window.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});window.gtag('js',new Date());window.gtag('config',id,{allow_google_signals:false,allow_ad_personalization_signals:false});const script=document.createElement('script');script.async=true;script.dataset.cdaAnalytics='true';script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);document.head.append(script);
 }apply();window.addEventListener('cda-analytics-consent',apply);
})();
