import {test,expect,type Page} from '@playwright/test';
const user={Id:'11111111-1111-4111-8111-111111111111',FirstName:'Adekola',LastName:'Ayannuga',Email:'member@example.test',CreatedAt:'2026-01-01T12:00:00Z',Username:'member'};
const community={Id:'22222222-2222-4222-8222-222222222222',Name:'Royal View CDA',Description:'Moving forward for progress',MemberCount:2,Role:'Owner'};
async function setup(page:Page,long=false){
 await page.addInitScript(()=>{if(!localStorage.getItem("cda-analytics-consent"))localStorage.setItem("cda-analytics-consent","denied")});
 await page.route(/^https:\/\/(www\.googletagmanager\.com|([a-z0-9-]+\.)?google-analytics\.com)\//,r=>r.abort());
 await page.clock.setFixedTime(new Date('2026-09-17T12:00:00Z'));
 await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
 await page.route('**/socket.io/**',r=>r.abort());
 await page.route('**/api/v1/**',async r=>{const path=new URL(r.request().url()).pathname;let json:any=[];const u=long?{...user,FirstName:'Alexandria-Margaret',LastName:'A very long family name with several words'}:user;
 if(path.endsWith('/auth/refresh'))json={accessToken:'fixture-access',user:u};
 else if(path.endsWith('/users/me')||path.endsWith('/users/account'))json=u;
 else if(path.endsWith('/communities'))json=[community];
 else if(path.endsWith('/communities/'+community.Id))json=long?{...community,Name:'A community with an unusually long descriptive name'}:community;
 else if(path.endsWith('/capabilities'))json={permissions:['MEMBER_ROLE_CHANGE']};
 else if(path.endsWith('/personal-activity'))json={stats:{},items:[],nextCursor:null};
 else if(path.endsWith('/recent-activity'))json={items:Array.from({length:6},(_,i)=>({Id:'activity-'+i,Kind:'feed',CommunityId:community.Id,CommunityName:community.Name,Title:'Community update '+(i+1),Body:'Latest news from your community.',CreatedAt:'2026-09-17T10:00:00Z'})),nextCursor:null};
 else if(path.includes('/weather'))json={available:false};
 else if(path.includes('/settings'))json={};
 return r.fulfill({json,headers:{'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'}});});
}

async function nativeSetup(page:Page,platform:string,configured=true,denied=false){
 await setup(page);await page.setViewportSize({width:390,height:850});
 await page.addInitScript(({platform,configured,denied})=>{
  const w=window as any;w.CapacitorCustomPlatform={name:platform};const callbacks=new Map<string,Function>();
  const methods={CdaDevice:['storage','pushConfiguration'],Network:['getStatus'],Filesystem:['readdir'],PushNotifications:['checkPermissions','requestPermissions','register','unregister','removeAllDeliveredNotifications','createChannel']};
  w.Capacitor={PluginHeaders:Object.entries(methods).map(([name,names])=>({name,methods:[...names.map(name=>({name,rtype:'promise'})),{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'callback'}]})),nativeCallback:(plugin:string,method:string,args:any,callback:Function)=>{if(method==='addListener')callbacks.set(plugin+args.eventName,callback);else callbacks.delete(plugin+args.eventName);return args.eventName},nativePromise:async(plugin:string,method:string)=>{
   if(method==='storage')return {total:128*1024**3,free:32*1024**3};if(method==='pushConfiguration')return {configured,environment:'sandbox'};
   if(method==='getStatus')return {connected:true,connectionType:'wifi'};if(method==='readdir')return {files:[]};
   if(method==='checkPermissions'||method==='requestPermissions')return {receive:denied?'denied':'granted'};
   if(method==='register')setTimeout(()=>callbacks.get('PushNotificationsregistration')?.({value:'native-test-token-123456'}),0);return {};
  }};
 },{platform,configured,denied});
 const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'};
 const requests:{method:string;body:any}[]=[];
 await page.route('**/api/v1/users/devices**',async r=>{const method=r.request().method();if(method==='OPTIONS')return r.fulfill({status:204,headers:{...headers,'access-control-allow-methods':'GET,POST,DELETE,OPTIONS','access-control-allow-headers':'authorization,content-type,x-cda-client'}});if(new URL(r.request().url()).pathname.endsWith('/push-config'))return r.fulfill({headers,json:{android:configured,ios:configured}});requests.push({method,body:r.request().postDataJSON()});return r.fulfill({headers,json:{success:true}})});
 return requests;
}
for(const platform of ['android','ios'])test(`native ${platform} phone storage, network and push registration`,async({page})=>{
 const requests=await nativeSetup(page,platform);await page.goto('/settings/data');await expect(page.getByText('Phone Storage Used',{exact:true})).toBeVisible();await expect(page.locator('.storage-hero')).toContainText('96.0 GB');await expect(page.locator('.storage-hero')).toContainText('32.0 GB available');await expect(page.getByText(/Network: wifi/)).toBeVisible();await page.getByRole('link',{name:/Manage Storage/}).click();await expect(page.getByText('Total capacity: 128.0 GB')).toBeVisible();
 await page.goto('/settings/notifications');const toggle=page.locator('.notification-push input');await expect(toggle).toBeEnabled();await expect(toggle).toBeChecked();expect(requests.some(r=>r.method==='POST'&&r.body.deviceToken===(platform==='android'?'fcm:':'apns-sandbox:')+'native-test-token-123456')).toBe(true);await expect(page.getByRole('button',{name:'Send test notification'})).toHaveCount(0);
 await toggle.click();await expect(toggle).not.toBeChecked();expect(requests.some(r=>r.method==='DELETE')).toBe(true);expect(await page.evaluate(()=>localStorage.getItem('cda-native-push'))).toBeNull();
});
test('native push reports missing setup without claiming success',async({page})=>{
 const requests=await nativeSetup(page,'android',false);await page.goto('/settings/notifications');const toggle=page.locator('.notification-push input');await expect(toggle).toBeEnabled();await expect(page.locator('.notification-push')).toContainText('Android push setup is pending');await expect(toggle).not.toBeChecked();expect(requests).toEqual([]);
});
test('native push permission denial does not save a device registration',async({page})=>{
 const requests=await nativeSetup(page,'android',true,true);await page.goto('/settings/notifications');const toggle=page.locator('.notification-push input');await expect(toggle).toBeEnabled();await expect(page.locator('.notification-push')).toContainText('Allow notifications for CDA Connect');await expect(toggle).not.toBeChecked();expect(requests).toEqual([]);
});
for(const platform of ['android','ios'])test(`native ${platform} profile and community media load from the server`,async({page})=>{
 await nativeSetup(page,platform);const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'},photo='/uploads/native-profile.png',cover='/uploads/native-cover.png',logo='/uploads/native-community.png';const images:string[]=[];
 await page.route('**/api/v1/**',r=>{const path=new URL(r.request().url()).pathname;let json:any;if(path.endsWith('/users/me'))json={...user,ProfileImage:photo,CoverImage:cover};else if(path.endsWith('/communities')||path.endsWith('/communities/mine/status'))json=[{...community,LogoUrl:logo,BannerUrl:cover}];else if(path.endsWith('/communities/'+community.Id))json={...community,LogoUrl:logo,BannerUrl:cover};else return r.fallback();return r.fulfill({headers,json})});
 await page.route('https://cdaconnect.org/uploads/**',r=>{images.push(r.request().url());return r.fulfill({contentType:'image/png',headers:{'cross-origin-resource-policy':'cross-origin'},body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1cAAAAASUVORK5CYII=','base64')})});
 await page.goto('/profile');await expect.poll(()=>page.locator('.profile-avatar img').evaluate((e:HTMLImageElement)=>e.naturalWidth)).toBeGreaterThan(0);expect(images.some(url=>url.endsWith(cover))).toBe(true);
 await page.goto('/community/'+community.Id+'/menu');await expect.poll(()=>page.locator('.community-hero-logo img').evaluate((e:HTMLImageElement)=>e.naturalWidth)).toBeGreaterThan(0);
 await page.goto('/communities');await expect.poll(()=>page.locator('img[src$="native-community.png"]').first().evaluate((e:HTMLImageElement)=>e.naturalWidth)).toBeGreaterThan(0);
 await page.route('https://cdaconnect.org/uploads/**',r=>r.abort());await page.goto('/profile');await expect(page.locator('.profile-avatar')).toHaveText('AA');expect(await page.locator('.workspace').evaluate(e=>getComputedStyle(e,'::before').backgroundColor)).toBe('rgb(7, 59, 120)');await page.goto('/community/'+community.Id+'/menu');await expect(page.locator('.community-hero-logo')).toHaveText('R');
});
for(const width of [390,1440])test(`community image menu dismisses outside and with Escape at ${width}px`,async({page})=>{
 await setup(page);await page.setViewportSize({width,height:850});await page.goto('/community/'+community.Id+'/menu');const trigger=page.getByRole('button',{name:'Change community images'}),menu=page.locator('.community-image-menu');await trigger.click();await expect(menu).toBeVisible();await page.getByRole('heading',{name:'Connect',exact:true}).click();await expect(menu).toHaveCount(0);await trigger.click();await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(trigger).toBeFocused();
});
test('mobile navigation keeps its dimensions at both scroll boundaries',async({page})=>{
 await setup(page);await page.setViewportSize({width:390,height:700});for(const path of ['/home','/profile','/community/'+community.Id+'/menu','/settings']){await page.goto(path);const header=page.locator('.workspace>.topbar'),nav=page.locator('.mobile-bottom-nav');await expect(header).toBeVisible();const before=await header.boundingBox(),bottom=await nav.boundingBox();await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await page.mouse.move(200,450);await page.mouse.wheel(0,1500);await expect.poll(()=>header.evaluate(e=>e.getBoundingClientRect().top)).toBe(0);expect((await header.boundingBox())!.height).toBe(before!.height);expect(await nav.boundingBox()).toEqual(bottom);await page.evaluate(()=>window.scrollTo(0,0));await page.mouse.wheel(0,-1500);await expect.poll(()=>header.evaluate(e=>e.getBoundingClientRect().top)).toBe(0);expect(await page.evaluate(()=>getComputedStyle(document.documentElement).overscrollBehaviorY)).toBe('none')}
});
