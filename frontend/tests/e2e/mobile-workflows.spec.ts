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
 page.on('pageerror',error=>console.error('Biometric workflow page error:',error));
 page.on('console',message=>{if(message.type()==='error'&&!message.text().startsWith('Failed to load resource:'))console.error('Biometric workflow browser error:',message.text())});
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

test('inactive installed app signs out on resume and requires credentials',async({page})=>{
 await setup(page);await page.addInitScript(()=>localStorage.setItem('cda-last-activity',String(Date.now()-31*60*1000)));
 await page.route('**/api/v1/auth/logout',route=>route.fulfill({status:204}));
 await page.goto('/home');await expect(page).toHaveURL(/\/login/);
 await expect(page.getByLabel('Email address')).toBeVisible();
 await expect(page.getByText('Your session has ended. Sign in with your email and password.')).toBeVisible();
});

test('login retains its new session when startup restoration finishes late',async({page})=>{
 await setup(page,false);let release:()=>void=()=>{};const delayed=new Promise<void>(resolve=>{release=resolve});
 await page.route('**/api/v1/auth/refresh',async route=>{await delayed;await route.fulfill({status:401,json:{error:'Signed out'}})});
 await page.goto('/login');await page.getByLabel('Email address').fill(user.Email);await page.getByLabel('Password',{exact:true}).fill('Password123!');
 await page.getByRole('button',{name:'Log in',exact:true}).click();await expect(page).toHaveURL('/home');
 release();await expect(page.locator('.app')).toBeVisible();await expect(page).toHaveURL('/home');
});

test('unknown community section shows navigation instead of calling an absent API',async({page})=>{
 await setup(page);const missing:string[]=[];page.on('request',request=>{if(request.url().includes('/api/v1/communities/'+community+'/missing-section'))missing.push(request.url())});
 await page.goto('/community/'+community+'/missing-section');await expect(page.getByRole('heading',{name:'Community page not found'})).toBeVisible();expect(missing).toEqual([]);
 await page.getByRole('link',{name:'Return to community menu'}).click();await expect(page).toHaveURL('/community/'+community+'/menu');
});

test('saved direct conversations remain visible when the member list fails',async({page})=>{
 await setup(page);await page.route('**/api/v1/communities/'+community+'/conversations',r=>r.fulfill({headers,json:[{Id:chat,Type:'DIRECT',DirectUserId:'other',DirectName:'Known Contact',LastMessage:'Existing conversation'}]}));await page.route('**/api/v1/communities/'+community+'/members',r=>r.fulfill({headers,status:503,json:{error:'Roster unavailable'}}));
 await page.goto('/community/'+community+'/conversations');await expect(page.getByText('Known Contact',{exact:true})).toBeVisible();await page.getByText('Known Contact',{exact:true}).click();await expect(page).toHaveURL('/chat/'+chat);
});

test('AI fallback shows authorised sources when generation is not configured',async({page})=>{
 await setup(page);await page.route('**/api/v1/communities/'+community+'/assistant/ask',r=>r.fulfill({headers,json:{answer:'Read the authorised sources below.',providerConfigured:false,context:{documents:[{Title:'Community rules',Body:'Keep our neighbourhood clean.'}]}}}));
 await page.goto('/ai');await page.getByRole('combobox').selectOption(community);await page.getByLabel('What would you like to know?').fill('What are the rules?');await page.getByRole('button',{name:'Ask AI'}).click();await expect(page.getByText('Community rules',{exact:true})).toBeVisible();await expect(page.getByText('Keep our neighbourhood clean.',{exact:true})).toBeVisible();
});

test('service contacts, verification, editing and removal are connected',async({page})=>{
 await setup(page);let provider:any={Id:proposal,Name:'Test Electrician',Description:'Local help',CreatedBy:user.Id,Phone:'+441234567890',Email:'provider@example.test',Website:'https://provider.example.test',Category:'Electrical',Area:'Test area',Rating:4,ReviewCount:1,IsVerified:false},removed=false;const calls:any[]=[];
 await page.route('**/api/v1/communities/'+community+'/capabilities',r=>r.fulfill({headers,json:{permissions:['DIRECTORY_MANAGE']}}));
 await page.route('**/api/v1/communities/'+community+'/services**',async r=>{const method=r.request().method();if(method==='GET')return r.fulfill({headers,json:removed?[]:[provider]});calls.push({method,path:new URL(r.request().url()).pathname,body:r.request().postDataJSON()});if(method==='DELETE'){removed=true;return r.fulfill({headers,status:204})}const data=r.request().postDataJSON();provider=new URL(r.request().url()).pathname.endsWith('/verification')?{...provider,IsVerified:data.isVerified}:{...provider,Name:data.name,IsVerified:false};return r.fulfill({headers,json:provider})});
 await page.goto('/community/'+community+'/services');await expect(page.getByRole('link',{name:'Call +441234567890'})).toHaveAttribute('href','tel:+441234567890');await expect(page.getByRole('link',{name:'Email provider'})).toHaveAttribute('href','mailto:provider@example.test');await expect(page.getByRole('link',{name:'Visit website'})).toHaveAttribute('href','https://provider.example.test');
 await page.getByRole('button',{name:'Verify service',exact:true}).click();await expect(page.getByText('Verified by community')).toBeVisible();await page.getByRole('button',{name:'Edit service',exact:true}).click();await page.getByLabel('Service name',{exact:true}).fill('Updated Electrician');await page.getByRole('button',{name:'Save service',exact:true}).click();await expect(page.getByRole('heading',{name:'Updated Electrician'})).toBeVisible();
 page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Remove service',exact:true}).click();await expect(page.getByText('No services listed yet.')).toBeVisible();expect(calls.map(c=>c.method)).toEqual(['PATCH','PATCH','DELETE']);
});

test('service ratings call the review API and display reviews',async({page})=>{
 await setup(page);let saved:any;await page.route('**/api/v1/communities/'+community+'/services',r=>r.fulfill({headers,json:[{Id:proposal,Name:'Test provider',CreatedBy:'another-member',Category:'Plumbing'}]}));await page.route('**/api/v1/services/'+proposal+'/reviews',async r=>{if(r.request().method()==='POST'){saved=r.request().postDataJSON();return r.fulfill({headers,json:{success:true}})}return r.fulfill({headers,json:[{Id:'review',FirstName:'Test',LastName:'Reviewer',Rating:4,Comment:'Helpful service'}]})});
 await page.goto('/community/'+community+'/services');await page.getByRole('button',{name:'Reviews & rating'}).click();await expect(page.getByText('Helpful service')).toBeVisible();await page.getByRole('combobox',{name:'Rating',exact:true}).selectOption('4');await page.getByLabel('Review',{exact:true}).fill('Reliable and helpful');await page.getByRole('button',{name:'Save my review'}).click();await expect.poll(()=>saved?.rating).toBe(4);expect(saved.comment).toBe('Reliable and helpful');
});
