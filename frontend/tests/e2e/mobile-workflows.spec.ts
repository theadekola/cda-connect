import {test,expect,type Page} from '@playwright/test';
const user={Id:'11111111-1111-4111-8111-111111111111',FirstName:'Test',LastName:'Member',Email:'member@example.test'},community='22222222-2222-4222-8222-222222222222',proposal='33333333-3333-4333-8333-333333333333',chat='44444444-4444-4444-8444-444444444444';
const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'};
async function setup(page:Page,signedIn=true){
 await page.addInitScript(()=>localStorage.setItem('cda-analytics-consent','denied'));
 await page.route('**/socket.io/**',route=>route.abort());
 await page.route(/^https:\/\/(fonts\.|www\.googletagmanager|.*google-analytics)/,route=>route.abort());
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;let json:unknown=[];
  if(path.endsWith('/auth/refresh'))return route.fulfill({headers,status:signedIn?200:401,json:signedIn?{accessToken:'fixture-access',user}:{error:'Signed out'}});
  if(path.endsWith('/auth/login'))json={accessToken:'fixture-access',user};
  else if(path.endsWith('/users/me')||path.endsWith('/users/account'))json=user;
  else if(path.endsWith('/communities'))json=[{Id:community,Name:'Example CDA'}];
  else if(path.endsWith('/communities/'+community))json={Id:community,Name:'Example CDA'};
  else if(path.endsWith('/recent-activity'))json={items:[],nextCursor:null};
  else if(path.endsWith('/capabilities'))json={permissions:['GOVERNANCE_MANAGE','FORMAL_VOTE_MANAGE']};
  else if(path.endsWith('/conversations/'+chat))json={Id:chat,Name:'Community chat',CommunityId:community};
  else if(path.endsWith('/conversations/'+chat+'/messages'))json={items:[{Id:'newest',MessageText:'Latest message',MessageType:'TEXT',SenderUserId:user.Id,CreatedAt:'2026-10-15T09:00:00Z'}],nextCursor:'55555555-5555-4555-8555-555555555555'};
  return route.fulfill({headers,json});
 });
}
test('signed-out shared post returns to the post after login',async({page})=>{
 await setup(page,false);await page.goto('/post/'+proposal+'#comments');await expect(page).toHaveURL(/\/login\?returnTo=/);
 await page.getByLabel('Email address').fill(user.Email);await page.getByLabel('Password',{exact:true}).fill('Password123!');await page.getByRole('button',{name:'Log in',exact:true}).click();await expect(page).toHaveURL('/post/'+proposal+'#comments');
});
test('older messages load above the latest messages',async({page})=>{
 await setup(page);await page.route('**/api/v1/conversations/'+chat+'/messages?**',route=>{
  const before=new URL(route.request().url()).searchParams.get('before');return route.fulfill({headers,json:before?{items:[{Id:'old',MessageText:'Older history',MessageType:'TEXT',SenderUserId:user.Id,CreatedAt:'2026-10-14T09:00:00Z'}],nextCursor:null}:{items:[{Id:'new',MessageText:'Latest message',MessageType:'TEXT',SenderUserId:user.Id,CreatedAt:'2026-10-15T09:00:00Z'}],nextCursor:'55555555-5555-4555-8555-555555555555'}});
 });
 await page.goto('/chat/'+chat);await expect(page.getByText('Latest message',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Load older messages'}).click();await expect(page.getByText('Older history',{exact:true})).toBeVisible();await expect(page.locator('.chat-message-group .message>div').first()).toContainText('Older history');await expect(page.getByRole('button',{name:'Load older messages'})).toHaveCount(0);
});
for(const width of [390,1440])test(`governance proposal, decision and progress flows fit at ${width}px`,async({page},testInfo)=>{
 await setup(page);await page.setViewportSize({width,height:900});const requests:{path:string;data:any}[]=[];
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;let json:unknown;
  if(path.includes('/governance/')&&['POST','PATCH'].includes(route.request().method())){requests.push({path,data:route.request().postDataJSON()});return route.fulfill({headers,json:{success:true}})}
  if(path.endsWith('/governance/proposals'))json=[{Id:proposal,CommunityId:community,Title:'Improve street lighting',Status:'DISCUSSION'}];
  else if(path.endsWith('/governance/proposals/'+proposal))json={proposal:{Id:proposal,CommunityId:community,Title:'Improve street lighting',Body:'Repair streetlights on our road.',Status:'DISCUSSION'},discussions:[],amendments:[]};
  else if(path.endsWith('/decisions'))json=[{Id:'decision',ProposalId:proposal,Title:'Lighting approved',DecisionText:'Replace damaged lights.',ActionCount:1}];
  else return route.fallback();return route.fulfill({headers,json});
 });
 await page.goto('/community/'+community+'/governance');await expect(page.getByRole('heading',{name:'Community governance'})).toBeVisible();await page.getByRole('button',{name:'Open proposal',exact:true}).click();await expect(page.getByRole('heading',{name:'Improve street lighting'})).toBeVisible();await page.screenshot({path:testInfo.outputPath('governance.png'),fullPage:true});
 await page.getByLabel('Your comment').fill('Please include the entrance.');await page.getByRole('button',{name:'Add comment',exact:true}).click();await expect.poll(()=>requests.some(request=>request.path.endsWith('/discussion')&&request.data.body==='Please include the entrance.')).toBe(true);
 await page.getByRole('combobox',{name:'Stage',exact:true}).selectOption('DECIDED');await page.getByLabel('Decision text',{exact:true}).fill('Approve the lighting repairs.');await page.getByRole('button',{name:'Save stage & decision'}).click();await expect.poll(()=>requests.some(request=>request.path.endsWith('/status')&&request.data.status==='DECIDED')).toBe(true);
 await page.getByRole('link',{name:'Decision register',exact:true}).first().click();await expect(page.getByText('Replace damaged lights.',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('biometric locking preserves the mounted chat draft across background and unlock',async({page})=>{
 await setup(page);await page.addInitScript(()=>{
  const w=window as any,callbacks=new Map<string,Set<Function>>();w.CapacitorCustomPlatform={name:'android'};
  localStorage.setItem('cda-biometric-unlock','true');
  w.Capacitor={PluginHeaders:['App','BiometricAuthNative'].map(name=>({name,methods:[...['getLaunchUrl','checkBiometry','internalAuthenticate'].map(name=>({name,rtype:'promise'})),{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'callback'}]})),nativeCallback:(plugin:string,method:string,args:any,callback:Function)=>{const key=plugin+args.eventName;if(!callbacks.has(key))callbacks.set(key,new Set());if(method==='addListener')callbacks.get(key)!.add(callback);else callbacks.get(key)!.delete(callback);return args.eventName},nativePromise:async(_plugin:string,method:string)=>{if(method==='checkBiometry')return{isAvailable:true,deviceIsSecure:true,biometryType:1};return {}}};
  w.testAppState=(isActive:boolean)=>{for(const callback of callbacks.get('AppappStateChange')||[])callback({isActive})};
 });
 await page.goto('/chat/'+chat);await expect(page.getByLabel('Message',{exact:true})).toBeVisible();await page.getByLabel('Message',{exact:true}).fill('Unsent message to keep');
 await page.evaluate(()=>(window as any).testAppState(false));await expect(page.getByLabel('Message',{exact:true})).toBeHidden();await page.evaluate(()=>(window as any).testAppState(true));await expect(page.getByLabel('Message',{exact:true})).toBeVisible();await expect(page.getByLabel('Message',{exact:true})).toHaveValue('Unsent message to keep');
});
test('native cold and warm links navigate once and ignore unrelated domains',async({page})=>{
 await setup(page);await page.addInitScript(({proposal})=>{
  const w=window as any;let onLink:Function|undefined;w.CapacitorCustomPlatform={name:'android'};
  w.Capacitor={PluginHeaders:[{name:'App',methods:[{name:'getLaunchUrl',rtype:'promise'},{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'callback'}]}],nativeCallback:(_plugin:string,method:string,args:any,callback:Function)=>{if(method==='addListener'&&args.eventName==='appUrlOpen')onLink=callback;return args.eventName},nativePromise:async()=>({url:'https://cdaconnect.org/post/'+proposal+'#comments'})};
  w.testOpenLink=(url:string)=>onLink?.({url});
 },{proposal});
 await page.goto('/');await expect(page).toHaveURL('/post/'+proposal+'#comments');await page.getByRole('link',{name:'Home',exact:true}).first().click();await expect(page).toHaveURL('/home');
 await page.evaluate(({community})=>(window as any).testOpenLink('https://cdaconnect.org/community/'+community+'/governance'),{community});await expect(page).toHaveURL('/community/'+community+'/governance');
 await page.evaluate(()=>(window as any).testOpenLink('https://unrelated.example/post/123'));await expect(page).toHaveURL('/community/'+community+'/governance');
});
test('an eligible ordinary member can cast one formal vote without manager controls',async({page})=>{
 await setup(page);let voted=false;
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;let json:unknown;
  if(path.endsWith('/capabilities'))json={permissions:[]};
  else if(path.endsWith('/formal-ballots'))json=[{Id:proposal}];
  else if(path.endsWith('/formal-ballots/'+proposal))json={Id:proposal,Title:'Community lighting vote',Status:'OPEN',IsAnonymous:true,Eligible:true,HasVoted:voted,OpensAt:'2026-01-01T00:00:00Z',ClosesAt:'2099-01-01T00:00:00Z',QuorumPercent:50,options:[{Id:community,Label:'Approve'},{Id:chat,Label:'Decline'}]};
  else if(path.endsWith('/formal-ballots/'+proposal+'/vote')){expect(route.request().postDataJSON()).toEqual({optionId:community});voted=true;json={success:true,receipt:'vote-receipt'}}
  else return route.fallback();return route.fulfill({headers,json});
 });
 await page.goto('/community/'+community+'/governance');await page.getByRole('radio',{name:'Approve',exact:true}).check();await page.getByRole('button',{name:'Cast vote',exact:true}).click();await expect(page.getByText('Your vote has been recorded.',{exact:true})).toBeVisible();await expect(page.getByText('Vote receipt: vote-receipt',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Cast vote',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Finalize results'})).toHaveCount(0);
});
