import {test,expect,type Page} from '@playwright/test';
const user={Id:'11111111-1111-4111-8111-111111111111',FirstName:'Jordan',LastName:'Okafor',Email:'member@example.test',Country:'Nigeria',CreatedAt:'2026-01-01T12:00:00Z',Username:'member'};
const community={Id:'22222222-2222-4222-8222-222222222222',Name:'Maple Grove CDA',Description:'Moving forward for progress',MemberCount:2,Role:'Owner'};
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
const pages=[['profile','/profile','.profile-compact-banner'],['account','/profile/account','.account-dashboard'],['community','/community/'+community.Id+'/menu','.community-hero'],['settings','/settings','.settings-list'],['home','/home','.home-activities']] as const;
for(const width of [390,768,1440])for(const [name,path,selector] of pages)test(`${name} at ${width}px`,async({page})=>{await page.setViewportSize({width,height:900});await setup(page);await page.goto(path);await expect(page.locator(selector).first()).toBeVisible();await page.evaluate(()=>document.fonts.ready);await expect(page).toHaveScreenshot(`${name}-${width}.png`,{animations:'disabled'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)});
for(const size of [{width:320,height:800},{width:844,height:390}])test(`long names, enlarged text and missing images ${size.width}`,async({page})=>{await page.setViewportSize(size);await setup(page,true);for(const path of ['/profile','/community/'+community.Id+'/menu']){await page.goto(path);await expect(page.locator('.profile-compact-banner,.community-hero').first()).toBeVisible();await page.addStyleTag({content:':root{font-size:125%;--safe-area-inset-top:24px;--safe-area-inset-bottom:20px}'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}});
test('profile statistics toggle, account navigation and no browser token storage',async({page})=>{await setup(page);await page.goto('/profile');await expect(page.locator('#profile-statistics')).toBeHidden();await page.getByRole('button',{name:'Show profile statistics'}).click();await expect(page.locator('#profile-statistics')).toBeVisible();await page.getByRole('button',{name:'Hide profile statistics'}).click();await expect(page.locator('#profile-statistics')).toBeHidden();await page.getByRole('link',{name:'Account settings',exact:true}).click();await expect(page.getByLabel('Registered email address is locked')).toContainText('member@example.test');await expect(page.getByRole('link',{name:/Registered email address/})).toHaveCount(0);expect(await page.evaluate(()=>[localStorage.getItem('cda-connect-session'),sessionStorage.getItem('cda-connect-session')])).toEqual([null,null])});
test('login password can be shown and hidden',async({page})=>{await page.setViewportSize({width:390,height:844});await page.route('**/api/v1/auth/refresh',r=>r.fulfill({status:401,json:{error:'Signed out'}}));await page.goto('/login');const password=page.locator('#login-password');await password.fill('Secret123!');await expect(password).toHaveAttribute('type','password');await page.getByRole('button',{name:'Show password'}).click();await expect(password).toHaveAttribute('type','text');await expect(password).toHaveValue('Secret123!');await page.getByRole('button',{name:'Hide password'}).click();await expect(password).toHaveAttribute('type','password');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)});
test('browser security settings identify biometric unlock as native-only',async({page})=>{await setup(page);await page.goto('/settings/security/biometric');await expect(page.getByText('Biometric app unlock is available in the installed Android and iOS apps.')).toBeVisible();await expect(page.getByText('Expired or revoked server sessions still require you to sign in again.')).toBeVisible();});
test('cover images extend behind mobile headers with iOS and Android safe areas',async({page})=>{await setup(page);const cover='http://127.0.0.1:4173/test-cover.svg';await page.route('**/test-cover.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#073B78"/><circle cx="400" cy="200" r="100" fill="#078A3A"/></svg>'}));await page.route('**/api/v1/users/me',r=>r.fulfill({json:{...user,CoverImage:cover,ProfileImage:cover},headers:{'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'}}));for(const [width,inset] of [[390,47],[412,24]]){await page.setViewportSize({width,height:850});await page.goto('/profile');await expect(page.locator('.profile-compact-banner')).toBeVisible();await page.addStyleTag({content:`:root{--safe-area-inset-top:${inset}px}`});await expect(page.locator('.profile-avatar img')).toHaveJSProperty('complete',true);expect(await page.locator('.profile-cover-workspace').evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).toContain('test-cover.svg');expect(await page.locator('.topbar').evaluate(el=>parseFloat(getComputedStyle(el).paddingTop))).toBeGreaterThanOrEqual(inset);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}});
for(const width of [390,768,1440])test(`settings subpages have rounded groups without introductions at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await setup(page);
 const removed=['Manage your privacy settings and stay safe on CDA Connect.','Choose what you want to be notified about and how.','Choose your preferred language for the app.','Choose how you communicate and stay connected.','Stay connected your way','Customize your community experience and content.','Your community, your way','Manage your data usage, storage and download preferences.','Manage your account security and keep your data safe.','We’re here to help. Find answers or get in touch.','Connecting communities. Empowering people. Building better lives.'];
 for(const section of ['privacy','notifications','language','communications','community','data','security','support','about']){
  await page.goto('/settings/'+section);await expect(page.locator('.settings-detail .settings-list').first()).toBeVisible();
  for(const text of removed)await expect(page.getByText(text,{exact:true})).toHaveCount(0);
  const radii=await page.locator('.settings-detail .settings-list').evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).borderRadius));expect(radii.every(r=>r==='16px')).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
test('community gutters and compact icons; mobile header stays visible while scrolling',async({page})=>{
 await page.setViewportSize({width:390,height:700});await setup(page);await page.goto('/community/'+community.Id+'/menu');
 const header=page.locator('.workspace>.topbar');await expect(page.locator('.community-menu-grid').first()).toBeVisible();
 const section=page.locator('.community-menu>section:not(.community-hero)').first();expect(await section.evaluate(el=>parseFloat(getComputedStyle(el).paddingLeft))).toBeGreaterThanOrEqual(16);
 expect(await page.locator('.community-menu-grid>a>span').first().evaluate(el=>getComputedStyle(el).width)).toBe('32px');
 await page.evaluate(()=>window.scrollTo(0,300));await expect(header).toHaveAttribute('data-hidden','false');await expect(header).not.toHaveAttribute('inert','');
 await page.evaluate(()=>window.scrollTo(0,240));await expect(header).toHaveAttribute('data-hidden','false');await expect.poll(()=>header.evaluate(el=>el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
 await page.evaluate(()=>window.scrollTo(0,400));await expect(header).toHaveAttribute('data-hidden','false');
 await page.setViewportSize({width:1440,height:700});await expect(header).toHaveAttribute('data-hidden','false');await page.evaluate(()=>window.scrollTo(0,500));await expect(header).toHaveAttribute('data-hidden','false');
 await page.setViewportSize({width:390,height:700});await page.goto('/profile');await expect(header).toHaveAttribute('data-hidden','false');
});

test('community profile header actions open a prefilled protected editor',async({page})=>{
 await page.setViewportSize({width:390,height:900});await setup(page);const details={...community,Country:'Nigeria',State:'Lagos',LGA:'Ikeja',City:'Ikeja',SpecificArea:'Example Estate',Category:'CDA / Residents',CommunityType:'CDA / Residents',Guidelines:'Be respectful',IsPrivate:true,RequireMemberApproval:true,AllowMemberEvents:true,AllowMemberDiscussions:true,JoinCode:'AABBCCDDEEFF0011',LogoUrl:'',BannerUrl:''};let payload:any;
 await page.route('**/api/v1/**',async route=>{const request=route.request(),url=new URL(request.url()),path=url.pathname;let json:any;
  if(path.endsWith('/communities/'+community.Id)&&request.method()==='PATCH'){payload=request.postDataJSON();json={...details,...payload}}
  else if(path.endsWith('/communities/'+community.Id))json=details;
  else if(path.endsWith('/locations'))json=url.searchParams.has('state')?['Ikeja']:url.searchParams.has('country')?[{id:'NG025',name:'Lagos'}]:[{id:'NG',name:'Nigeria'}];
  else return route.fallback();
  return route.fulfill({json,headers:{'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'}});
 });
 await page.goto('/community/'+community.Id+'/profile');await expect(page.getByRole('link',{name:'Edit community'})).toBeVisible();await expect(page.getByRole('button',{name:'Share community'})).toBeVisible();await expect(page.getByRole('button',{name:'Set community map position'})).toHaveCount(0);await expect(page.getByRole('link',{name:'Message',exact:true})).toHaveCount(0);
 await page.getByRole('link',{name:'Edit community'}).click();await expect(page).toHaveURL('/community/'+community.Id+'/edit');await expect(page.getByLabel('Community Name *',{exact:true})).toHaveValue(community.Name);await expect(page.getByRole('textbox',{name:/Description/})).toHaveValue(community.Description);await expect(page.getByLabel('Community rules',{exact:true})).toHaveValue('Be respectful');await expect(page.getByLabel(/State \/ Region/)).toHaveValue('NG025');await expect(page.getByRole('combobox',{name:'LGA *',exact:true})).toHaveValue('Ikeja');
 await page.getByLabel('Community Name *',{exact:true}).fill('Example Estate Updated');await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page).toHaveURL('/community/'+community.Id+'/profile');expect(payload.name).toBe('Example Estate Updated');expect(payload.stateId).toBe('NG025');expect(payload.localArea).toBe('Ikeja');
});

async function meetingSetup(page:Page){
 await setup(page);
 const past={Id:'33333333-3333-4333-8333-333333333333',Title:'Completed meeting',StartDateTime:'2026-09-15T10:00:00Z',EndDateTime:'2026-09-15T12:00:00Z',AllowCalendar:true,IsActive:false,MemberCount:3,PresentCount:2,LateCount:1,AbsentCount:1};
 const next={...past,Id:'44444444-4444-4444-8444-444444444444',Title:'Next meeting',StartDateTime:'2026-09-18T10:00:00Z',EndDateTime:'2026-09-18T12:00:00Z',IsActive:null};
 const participants=[{UserId:'1',FirstName:'Present',LastName:'Member',Status:'PRESENT'},{UserId:'2',FirstName:'Late',LastName:'Member',Status:'LATE'},{UserId:'3',FirstName:'Absent',LastName:'Member',Status:null}];
 await page.route('**/api/v1/**',async r=>{
  const path=new URL(r.request().url()).pathname;let json:any;
  if(path.endsWith('/capabilities'))json={permissions:['ATTENDANCE_MANAGE','MEETING_CREATE']};
  else if(path.endsWith('/attendance/manage'))json={meetings:[past,next]};
  else if(path==='/api/v1/communities/'+community.Id+'/attendance')json={meetings:[past]};
  else if(path==='/api/v1/communities/'+community.Id+'/meetings')json=[past,next];
  else if(path==='/api/v1/meetings/'+past.Id)json={...past,settings:{},agenda:[],attendees:[{FirstName:'RSVP'}]};
  else if(path==='/api/v1/meetings/'+past.Id+'/attendance')json={meeting:past,participants,canManage:true};
  else if(path==='/api/v1/meetings/'+next.Id+'/attendance')json={meeting:{...next,IsActive:true,AttendanceCode:'123456'},participants:[],canManage:true};
  else if(path.endsWith('/attendance/open'))json={success:true};
  else return r.fallback();
  return r.fulfill({json,headers:{'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'}});
 });
 return {past,next};
}
for(const width of [390,768,1440])test(`meeting attendance navigation and export at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const {past}=await meetingSetup(page);const base='/community/'+community.Id+'/meetings';
 await page.goto(base);await page.getByRole('button',{name:'Past',exact:true}).click();await expect(page.getByRole('button',{name:'Add to Calendar'})).toHaveCount(0);
 await page.getByRole('button',{name:'View Details'}).click();await expect(page.getByText('Who’s Attending')).toHaveCount(0);await page.getByRole('link',{name:'See attendance'}).click();
 await expect(page).toHaveURL(new RegExp('view=attendance-detail&meeting='+past.Id));await expect(page.getByText('Present Member',{exact:true})).toBeVisible();await expect(page.getByText('Absent Member',{exact:true})).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export',exact:true}).click();expect((await download).suggestedFilename()).toBe('meeting-attendance.csv');
 await page.getByLabel('Attendance status').selectOption('LATE');await expect(page.getByText('Late Member',{exact:true})).toBeVisible();await expect(page.getByText('Present Member',{exact:true})).toHaveCount(0);
 await page.getByRole('link',{name:'Attendance history',exact:true}).click();await expect(page.getByRole('button',{name:'Export',exact:true})).toHaveCount(0);await expect(page.locator('.attendance-toolbar select')).toHaveValue('newest');
 if(width===390)await page.screenshot({path:test.info().outputPath('attendance-history.png'),fullPage:true});
 const tops=await page.locator('.attendance-counts>span').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().top));expect(new Set(tops).size).toBe(1);
 await page.getByRole('link',{name:/Completed meeting/}).click();await expect(page.getByText('Absent Member',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto(base+'?view=take-attendance');await expect(page.getByRole('heading',{name:'Next meeting'})).toBeVisible();await expect(page.getByText('Completed meeting',{exact:true})).toHaveCount(0);
});
test('ending attendance clears the taking screen and retains history',async({page})=>{
 const {past,next}=await meetingSetup(page);let ended=false;const live={...next,StartDateTime:'2026-09-17T11:00:00Z',EndDateTime:'2026-09-17T13:00:00Z'};
 await page.route('**/api/v1/meetings/'+next.Id+'/attendance',r=>r.fulfill({json:{meeting:{...live,IsActive:!ended,AttendanceCode:'123456'},participants:[],canManage:true},headers:{'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'}}));
 await page.route('**/api/v1/meetings/'+next.Id+'/attendance/end',r=>{ended=true;return r.fulfill({json:{success:true},headers:{'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'}})});
 await page.goto('/community/'+community.Id+'/meetings?view=take-attendance');await page.getByRole('button',{name:'End attendance',exact:true}).click();await page.getByRole('button',{name:'End attendance now',exact:true}).click();
 await expect(page.getByText(/Ready for the next meeting/)).toBeVisible();await expect(page.getByRole('heading',{name:'Recent Check-ins'})).toHaveCount(0);
 await page.goto('/community/'+community.Id+'/meetings?view=attendance-detail&meeting='+past.Id);await expect(page.getByText('Present Member',{exact:true})).toBeVisible();
});

test('scheduled meeting end removes calendar actions and clears the attendance workspace',async({page})=>{
 await meetingSetup(page);const base='/community/'+community.Id+'/meetings';
 await page.goto(base);await expect(page.getByRole('button',{name:'Add to Calendar'})).toBeVisible();
 await page.clock.setFixedTime(new Date('2026-09-18T12:00:01Z'));await expect(page.getByRole('button',{name:'Add to Calendar'})).toHaveCount(0);
 await page.clock.setFixedTime(new Date('2026-09-18T11:00:00Z'));await page.goto(base+'?view=take-attendance');await expect(page.getByRole('heading',{name:'Next meeting'})).toBeVisible();
 await page.clock.setFixedTime(new Date('2026-09-18T12:00:01Z'));await expect(page.getByText(/Ready for the next meeting/)).toBeVisible();await expect(page.locator('.take-members')).toHaveCount(0);
});

for(const width of [390,768,1440])test(`issue page, private evidence, assignment and resolution at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:850});await setup(page);
 const issue={Id:'55555555-5555-4555-8555-555555555555',Title:'Broken streetlight — Road A',Category:'Broken streetlight',Description:'The electric pole is fallen',CreatedAt:'2026-09-15T12:00:00Z',Status:'SUBMITTED',ReportDetails:JSON.stringify({evidence:[{id:'file1',name:'proof.txt'}]})};let patch:any;
 await page.route('**/api/v1/**',async r=>{const path=new URL(r.request().url()).pathname;let json:any;
 if(path.endsWith('/capabilities'))json={permissions:['ISSUE_MANAGE']};
 else if(path.endsWith('/issues'))json=[issue];
 else if(path.endsWith('/issues/'+issue.Id)&&r.request().method()==='PATCH'){patch=r.request().postDataJSON();const details=JSON.parse(issue.ReportDetails);if(patch.assignmentGroup)details.assignmentGroup=patch.assignmentGroup;if(patch.resolutionEvidence)details.resolutionEvidence=patch.resolutionEvidence;issue.ReportDetails=JSON.stringify(details);issue.Status=patch.status;Object.assign(issue,{ResolutionNote:patch.resolutionNote});json={success:true}}
 else if(path.includes('/evidence/'))json={path:'/media/issue-download/token',mimeType:'text/plain',name:'proof.txt'};
 else if(path.endsWith('/media/issue-download/token'))return r.fulfill({body:'Private evidence content',contentType:'text/plain',headers:{'access-control-allow-origin':'http://127.0.0.1:4173'}});
 else if(path.endsWith('/media/upload'))json={storedObjectId:'file2',name:'resolution.txt'};
 else return r.fallback();return r.fulfill({json,headers:{'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'}});
 });
 await page.goto('/community/'+community.Id+'/issues');await page.getByRole('link',{name:/Broken streetlight/}).click();await expect(page).toHaveURL(/report=/);await expect(page.getByRole('heading',{name:issue.Title})).toBeVisible();
 await page.getByRole('button',{name:'Open evidence'}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByText('Private evidence content',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Close evidence'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByLabel('Assign to').selectOption('COMMITTEE');await page.getByRole('button',{name:'Assign',exact:true}).click();await expect(page.getByText('Assigned to: Committee')).toBeVisible();expect(patch.assignmentGroup).toBe('COMMITTEE');
 await page.getByLabel('Resolution note',{exact:true}).fill('Repaired and checked');await page.getByLabel('Add evidence',{exact:true}).setInputFiles({name:'resolution.txt',mimeType:'text/plain',buffer:Buffer.from('Repair complete')});await expect(page.getByText('resolution.txt',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Mark resolved'}).click();await expect(page.getByText('Report resolved.',{exact:true})).toBeVisible();expect(patch.resolutionEvidence).toHaveLength(1);await expect(page.getByRole('button',{name:'Open evidence'})).toHaveCount(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(width===390)await page.screenshot({path:test.info().outputPath('resolved-issue.png'),fullPage:true});
});

for(const width of [390,768,1440])test(`weather uses live device location without a popup at ${width}px`,async({page,context})=>{
 await page.setViewportSize({width,height:900});await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:53.52,longitude:-1.13});await setup(page);const positions:any[]=[];
 await page.route('**/api/v1/me/weather',r=>{positions.push(r.request().postDataJSON());return r.fulfill({json:{temperature:17,code:61,isDay:true,rainChance:75,updatedAt:'2026-09-17T12:00:00Z'},headers:{'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'}})});
 await page.goto('/home');await expect(page.locator('.weather-reading strong')).toHaveText('17°C');expect(positions[0]).toEqual({latitude:53.52,longitude:-1.13});await expect(page.locator('.weather-rain')).toBeVisible();
 await context.setGeolocation({latitude:51.51,longitude:-0.13});await page.getByRole('button',{name:/Refresh local weather/}).click();await expect.poll(()=>positions.at(-1)).toEqual({latitude:51.51,longitude:-0.13});await expect(page.getByRole('dialog')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('weather refreshes automatically and re-reads the current location',async({page,context})=>{
 await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:53.52,longitude:-1.13});await setup(page);await page.clock.install();let calls=0;
 await page.route('**/api/v1/me/weather',r=>{calls++;return r.fulfill({json:{temperature:17,code:0,isDay:true,rainChance:0,updatedAt:'2026-09-17T12:00:00Z'},headers:{'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'}})});
 await page.goto('/home');await expect(page.locator('.weather-reading strong')).toHaveText('17°C');const before=calls;await page.clock.fastForward(600001);await expect.poll(()=>calls).toBeGreaterThan(before);
});

test('weather respects denied device permission without using a profile location',async({page})=>{
 await setup(page);await page.addInitScript(()=>{navigator.geolocation.getCurrentPosition=(_success,error)=>error?.({code:1,message:'Denied',PERMISSION_DENIED:1,POSITION_UNAVAILABLE:2,TIMEOUT:3})});let calls=0;
 await page.route('**/api/v1/me/weather',r=>{calls++;return r.abort()});await page.goto('/home');await expect(page.locator('.weather-reading small')).toHaveText('Allow location');expect(calls).toBe(0);await expect(page.getByRole('dialog')).toHaveCount(0);
});

for(const width of [390,768,1440])test(`community creation privacy and generated invitation at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await setup(page);let payload:any;
 await page.route('**/api/v1/communities**',async r=>{const u=new URL(r.request().url());let json:any;
 if(u.pathname.endsWith('/locations'))json=u.searchParams.has('state')?['Ikeja']:u.searchParams.has('country')?[{id:'NG025',name:'Lagos'}]:[{id:'NG',name:'Nigeria'}];
 else if(u.pathname.endsWith('/communities')&&r.request().method()==='POST'){payload=r.request().postDataJSON();json={...community,Name:payload.name,JoinCode:'AABBCCDDEEFF0011'}}else return r.fallback();
 return r.fulfill({json,headers:{'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'}});
 });
 await page.goto('/communities/create');await expect(page.getByText('Bring your community together')).toHaveCount(0);await expect(page.getByText('Location information',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Invite code',{exact:true})).toHaveCount(0);
 await page.getByLabel('Community Name *',{exact:true}).fill('New community');await page.getByLabel('Description *',{exact:true}).fill('A welcoming community');await page.getByLabel('Community category').selectOption('Sports');await expect(page.getByRole('combobox',{name:'Country *',exact:true})).toHaveCount(0);await page.getByLabel(/State \/ Region/).selectOption('NG025');await page.getByRole('combobox',{name:'LGA *',exact:true}).selectOption('Ikeja');await page.getByLabel('Community rules',{exact:true}).fill('Be respectful');await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.getByRole('switch',{name:/Private community/})).toBeChecked();await page.getByRole('switch',{name:/Public community/}).check();await expect(page.getByRole('switch',{name:/Private community/})).not.toBeChecked();
 const boxes=await page.locator('.create-footer-actions>button').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().top));expect(new Set(boxes).size).toBe(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width===390)await page.screenshot({path:test.info().outputPath('community-preferences.png'),fullPage:true});await page.getByRole('button',{name:'Create Community',exact:true}).click();await expect(page.getByLabel('Invite code',{exact:true})).toHaveValue('AABBCCDDEEFF0011');expect(payload.isPrivate).toBe(false);expect(payload.joinCode).toBeUndefined();expect(payload.category).toBe('Sports');expect(payload.countryCode).toBeUndefined();expect(payload.country).toBeUndefined();
});

for(const width of [390,412,1440])test(`feed announcement navigation and actual photos at ${width}px`,async({page,context})=>{
 await page.setViewportSize({width,height:900});await setup(page);await context.grantPermissions(['clipboard-read','clipboard-write']);
 const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'},root='/community/'+community.Id;
 const memberPhoto='https://cdaconnect.org/member-photo.svg',communityPhoto='https://cdaconnect.org/community-photo.svg';
 await page.route('**/*-photo.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#073b78"/><circle cx="32" cy="32" r="20" fill="#008540"/></svg>'}));
 const post={Id:'post-photo',CreatedBy:user.Id,FirstName:user.FirstName,LastName:user.LastName,ProfileImage:'http://localhost:3000/member-photo.svg',Body:'Member photo post',CreatedAt:'2026-09-17T09:00:00Z'},meeting={Id:'meeting-link',Title:'Meeting card',StartDateTime:'2026-09-18T10:00:00Z',EndDateTime:'2026-09-18T12:00:00Z',CreatedAt:'2026-09-16T09:00:00Z'},poll={Id:'poll-link',Question:'Poll card',settings:{visibility:'FEED',announcement:true},CreatedAt:'2026-09-15T09:00:00Z'},announcement={Id:'announcement-link',Title:'Official card',Body:'Specific announcement text',CreatedAt:'2026-09-14T09:00:00Z'};
 await page.route('**/api/v1/**',async r=>{
  const path=new URL(r.request().url()).pathname;let json:any;
  if(path.endsWith('/communities/'+community.Id))json={...community,LogoUrl:communityPhoto};
  else if(path.endsWith('/communities'))json=[{...community,LogoUrl:communityPhoto}];
  else if(path.endsWith('/users/me'))json={...user,ProfileImage:memberPhoto};
  else if(path.endsWith('/feed'))json=[post];
  else if(path.endsWith('/announcements'))json=[announcement];
  else if(path.endsWith('/polls'))json=[poll];
  else if(path.endsWith('/meetings'))json=[meeting];
  else if(path.endsWith('/meetings/meeting-link'))json={...meeting,settings:{},agenda:[],attendees:[]};
  else if(path.endsWith('/members'))json=[{...user,UserId:user.Id,MembershipId:'membership-photo',ProfileImage:memberPhoto,MembershipStatus:'ACTIVE'}];
  else return r.fallback();
  return r.fulfill({json,headers});
 });
 await page.goto(root+'/feed');
 await expect(page.locator('.feed-post')).toHaveCount(4);
 await expect(page.getByRole('link',{name:'Open poll',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'View meeting',exact:true})).toHaveCount(0);
 await expect(page.locator('.feed-linked-card footer')).toHaveCount(0);
 const photo=page.locator('.feed-post').filter({hasText:'Member photo post'}).locator('.post-avatar img');await expect(photo).toHaveAttribute('src',memberPhoto);await expect.poll(()=>photo.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
 for(const title of ['Meeting card','Poll card','Official card']){
  const card=page.locator('.feed-linked-card').filter({hasText:title});await expect(card.locator('.post-avatar img')).toHaveAttribute('src',communityPhoto);
  await expect.poll(()=>card.locator('.post-avatar img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
  const author=await card.locator('.feed-author').boundingBox(),share=await card.getByRole('button',{name:'Share '+title}).boundingBox();expect(Math.abs(author!.y-share!.y)).toBeLessThan(8);expect(share!.x).toBeGreaterThan(author!.x);
 }
 const pollCard=page.locator('.feed-linked-card').filter({hasText:'Poll card'});await pollCard.getByRole('button',{name:'Share Poll card'}).click();await expect(page).toHaveURL(new RegExp('/feed$'));expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('https://cdaconnect.org/poll/'+community.Id+'/poll-link');
 if(width===390)await page.screenshot({path:test.info().outputPath('feed-cards.png'),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await pollCard.click({position:{x:8,y:80}});await expect(page).toHaveURL(new RegExp('/poll/'+community.Id+'/poll-link$'));
 await page.goto(root+'/feed');await page.getByRole('link',{name:'Meeting card',exact:true}).focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(new RegExp('/meetings\\?meeting=meeting-link$'));
 await page.goto(root+'/feed');await page.getByRole('link',{name:'Official card',exact:true}).click();await expect(page).toHaveURL(new RegExp('announcement=announcement-link'));await expect(page.locator('.announcement-full-detail')).toContainText('Specific announcement text');
 await page.goto(root+'/create-post');await expect(page.locator('.community-post-page .post-avatar img')).toHaveAttribute('src',communityPhoto);
 await page.goto(root+'/members');await expect(page.locator('.member-list-avatar img').first()).toHaveAttribute('src',memberPhoto);
 await page.goto('/profile');await expect(page.locator('.profile-avatar img')).toHaveAttribute('src',memberPhoto);
 await page.goto(root+'/menu');await expect(page.locator('.community-hero-logo img')).toHaveAttribute('src',communityPhoto);
});

for(const width of [390,412,1440])test(`announcement pages and publishing at ${width}px`,async({page})=>{
 await setup(page);await page.setViewportSize({width,height:900});const root='/community/'+community.Id+'/announcements',headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'};
 let submitted:any;const entries=[{Id:'notice-1',Title:'Existing notice',Body:'Read the complete notice',CreatedAt:'2026-09-17T10:00:00Z'}];
 await page.route('**/api/v1/**',async r=>{const path=new URL(r.request().url()).pathname;let json:any;
  if(path.endsWith('/capabilities'))json={permissions:['ANNOUNCEMENT_CREATE']};
  else if(path.endsWith('/announcements')){if(r.request().method()==='POST'){submitted=r.request().postDataJSON();entries.push({Id:'notice-2',Title:submitted.title,Body:submitted.body,CreatedAt:'2026-09-17T12:00:00Z'});json=entries[1]}else json=entries}
  else if(path.endsWith('/polls'))json=[{Id:'poll-1',Question:'Election',settings:{announcement:true}}];
  else if(path.endsWith('/meetings'))json=[{Id:'meeting-1',Title:'Community meeting',AllowCalendar:true}];
  else return r.fallback();return r.fulfill({json,headers});
 });
 await page.goto(root);await expect(page.locator('.announcement-card')).toHaveCount(3);
 await expect(page.locator('.announcements-hero,.announcement-tabs,.announcement-card footer,.announcement-card details')).toHaveCount(0);
 for(const label of ['Share','Open poll','View meeting','Add to Calendar'])await expect(page.getByRole('button',{name:label,exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Election',exact:true})).toHaveAttribute('href','/poll/'+community.Id+'/poll-1');await expect(page.getByRole('link',{name:'Community meeting',exact:true})).toHaveAttribute('href','/community/'+community.Id+'/meetings?meeting=meeting-1');
 await page.locator('.announcement-card').filter({hasText:'Existing notice'}).click({position:{x:8,y:70}});await expect(page.locator('.announcement-full-detail')).toContainText('Read the complete notice');await expect(page.locator('dialog')).toHaveCount(0);
 await page.getByRole('link',{name:'Back to announcements'}).click();const create=page.getByRole('link',{name:'Create announcement',exact:true});await expect(create).toHaveText('');await create.click();await expect(page).toHaveURL(/create=1/);await expect(page.locator('.announcement-list,.announcement-search')).toHaveCount(0);
 await page.getByLabel('Title',{exact:true}).fill('New announcement');await page.getByLabel('Announcement',{exact:true}).fill('Published from the dedicated page');await page.getByLabel('Pin as important').check();
 expect(await page.getByLabel('Pin as important').evaluate(el=>el.getBoundingClientRect().width)).toBe(18);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width===390)await page.screenshot({path:test.info().outputPath('announcement-create.png'),fullPage:true});
 await page.getByRole('button',{name:'Publish announcement',exact:true}).click();await expect(page).toHaveURL(new RegExp('/announcements$'));expect(submitted).toEqual({title:'New announcement',body:'Published from the dedicated page',isPinned:true});await expect(page.getByRole('link',{name:'New announcement',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'New announcement',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.locator('.announcement-full-detail')).toContainText('Published from the dedicated page');
});

for(const width of [390,412,1440])test(`chat composer and voice controls at ${width}px`,async({page})=>{
 await setup(page);await page.setViewportSize({width,height:900});const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'};
 await page.addInitScript(()=>{
  class Recorder{static isTypeSupported(){return true}state='inactive';mimeType='audio/webm';ondataavailable:any;onstop:any;onerror:any;start(){this.state='recording'}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['voice'],{type:this.mimeType})});this.onstop?.()}}
  Object.defineProperty(window,'MediaRecorder',{value:Recorder});Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>({getTracks:()=>[{stop(){}}]})});
 });
 await page.route('**/api/v1/**',async r=>{const path=new URL(r.request().url()).pathname;let json:any;
  if(path.endsWith('/members'))json=[{UserId:user.Id,FirstName:user.FirstName,LastName:user.LastName},{UserId:'other-member',FirstName:'Tobi',LastName:'Hamed'}];
  else if(path.endsWith('/conversations'))json=[{Id:'chat-test',Name:'General',Type:'COMMUNITY'}];
  else if(path.endsWith('/conversations/chat-test'))json={Id:'chat-test',Name:'General',Type:'COMMUNITY',CommunityId:community.Id};
  else if(path.endsWith('/messages'))json=[];
  else return r.fallback();return r.fulfill({json,headers});
 });
 await page.goto('/community/'+community.Id+'/conversations');await expect(page.locator('.chat-conversation-row')).toHaveCount(2);await expect(page.getByText('Your community profile')).toHaveCount(0);await expect(page.locator('.chat-conversation-list')).not.toContainText(user.FirstName);
 await page.getByRole('button',{name:'Direct',exact:true}).click();await expect(page.locator('.chat-conversation-row')).toHaveCount(1);await expect(page.locator('.chat-conversation-row')).toContainText('Tobi');
 await page.goto('/chat/chat-test');const input=page.getByRole('textbox',{name:'Message',exact:true});await expect(input).toBeVisible();const original=await input.evaluate(el=>el.getBoundingClientRect().height);expect(await input.evaluate(el=>getComputedStyle(el).resize)).toBe('none');
 await input.fill('Long message\n'.repeat(30));expect(await input.evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThan(original);expect(await input.evaluate(el=>el.getBoundingClientRect().height)).toBeLessThanOrEqual(180);await input.fill('');expect(await input.evaluate(el=>el.getBoundingClientRect().height)).toBe(original);
 await page.clock.install();await page.getByRole('button',{name:'Record voice message'}).click();await expect(page.getByRole('button',{name:'Stop recording'})).toBeVisible();await page.clock.runFor(121000);await expect(page.getByRole('button',{name:'Stop recording'})).toBeVisible();await expect(page.getByRole('status').filter({hasText:'Recording'})).toContainText('121s');await expect(page.getByText('/ 120s',{exact:false})).toHaveCount(0);
 await page.getByRole('button',{name:'Stop recording'}).click();await expect(page.locator('.chat-voice-preview')).toHaveAttribute('controlslist','nodownload');await expect(page.getByText('Voice message.webm',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Remove attachment'}).click();await expect(page.locator('.chat-voice-preview')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for(const width of [390,412,1440])test(`community activity calendar at ${width}px`,async({page})=>{
 await setup(page);await page.setViewportSize({width,height:900});const root='/community/'+community.Id,headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'};
 await page.route('**/api/v1/**',async r=>{const path=new URL(r.request().url()).pathname;let json:any;
  if(path.endsWith('/capabilities'))json={permissions:['EVENT_CREATE']};
  else if(path.endsWith('/events'))json=[{Id:'event-calendar',Title:'Community cleanup',StartDateTime:'2026-09-17T09:00:00Z',EndDateTime:'2026-09-17T18:00:00Z'}];
  else if(path.endsWith('/meetings'))json=[{Id:'meeting-calendar',Title:'Budget meeting',StartDateTime:'2026-09-17T10:00:00Z',EndDateTime:'2026-09-17T11:00:00Z'}];
  else if(path.endsWith('/polls'))json=[{Id:'poll-calendar',Question:'Choose a project',StartAt:'2026-09-16T08:00:00Z',EndAt:'2026-09-18T18:00:00Z'}];
  else if(path.endsWith('/finance/me'))json={dues:[{Id:'levy-calendar',PlanName:'Community dues',DueDate:'2026-09-17T00:00:00Z'}]};
  else return r.fallback();return r.fulfill({json,headers});
 });
 await page.goto(root+'/events');await expect(page.locator('.events-intro')).toHaveCount(0);await expect(page.getByRole('button',{name:'My Events',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Create event',exact:true}).click();await expect(page.locator('.topbar').getByRole('link',{name:'Back to events'})).toBeVisible();await expect(page.locator('main').getByText('Back to events',{exact:true})).toHaveCount(0);await page.getByRole('link',{name:'Back to events'}).click();
 await page.getByRole('button',{name:'Calendar',exact:true}).click();const today=page.locator('.event-calendar-grid button[aria-current=date]');await expect(today).toHaveAttribute('aria-label',/2026-09-17, 4 activities/);await expect(today.locator('.calendar-dot')).toHaveCount(4);
 await today.click();await expect(page.locator('.calendar-activity')).toHaveCount(4);await expect(page.getByRole('link',{name:/Budget meeting/})).toHaveAttribute('href',root+'/meetings?meeting=meeting-calendar');await expect(page.getByRole('link',{name:/Community dues/})).toHaveAttribute('href',root+'/finance?view=pay&ledger=levy-calendar');
 const colors=await today.locator('.calendar-dot').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));expect(new Set(colors).size).toBe(4);
 await page.getByRole('button',{name:'2026-09-18, 1 activities: Poll',exact:true}).click();await expect(page.locator('.calendar-activity')).toHaveCount(1);await expect(page.locator('.calendar-activity')).toContainText('Choose a project');
 await page.getByRole('button',{name:'Next month',exact:true}).click();await expect(page.locator('.event-calendar>header')).toContainText('October 2026');await expect(page.locator('.calendar-activity')).toHaveCount(0);await page.getByRole('button',{name:'Today',exact:true}).click();await expect(today).toHaveAttribute('aria-pressed','true');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(width===390)await page.screenshot({path:test.info().outputPath('activity-calendar.png'),fullPage:true});
 await page.getByRole('link',{name:/Community cleanup/}).click();await expect(page).toHaveURL(/event=event-calendar/);await expect(page.locator('.topbar').getByRole('link',{name:'Back to events'})).toBeVisible();
});

for(const [width,columns] of [[390,2],[412,2],[768,3],[1440,4]])test(`marketplace shopping and seller chat at ${width}px`,async({page})=>{
 await setup(page);await page.setViewportSize({width,height:900});const root='/community/'+community.Id+'/marketplace',headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'},seller='seller-member',photo='https://cdaconnect.org/seller-test.svg';let contactPath='';
 const listings=Array.from({length:6},(_,i)=>({Id:'product-'+i,CommunityId:community.Id,SellerUserId:seller,Title:'Laptop '+i,Price:300+i,Currency:'GBP',Category:'Electronics',ItemCondition:'FAIR',Description:'Working laptop with charger.',Area:'Community centre',CreatedAt:'2026-09-17T09:00:00Z',ImageUrl:photo,ImageUrls:[photo,photo+'?second=1'],FirstName:'Tobi',LastName:'Hamed',ProfileImage:photo,ContactPreference:'PHONE'}));
 await page.route('**/seller-test.svg*',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#073b78"/></svg>'}));
 await page.route('**/api/v1/**',async r=>{const path=new URL(r.request().url()).pathname;let json:any;
  if(path.endsWith('/communities/'+community.Id+'/marketplace'))json=listings;
  else if(path.endsWith('/marketplace/product-0'))json=listings[0];
  else if(path.includes('/direct-conversations/')){contactPath=path;json={Id:'seller-chat'}}
  else if(path.endsWith('/conversations/seller-chat'))json={Id:'seller-chat',Type:'DIRECT',DirectName:'Tobi Hamed',CommunityId:community.Id};
  else return r.fallback();return r.fulfill({json,headers});
 });
 await page.goto(root);await expect(page.locator('.market-recent>article')).toHaveCount(6);expect(await page.locator('.market-recent').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(columns);
 expect(await page.locator('.market-recent').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');expect(await page.locator('.market-recent').evaluate(el=>getComputedStyle(el).borderTopWidth)).toBe('0px');await page.locator('.market-row-link').first().click();await expect(page.locator('.market-detail')).toBeVisible();await expect(page.locator('main').getByRole('button',{name:'Back to Marketplace',exact:true})).toHaveCount(0);await expect(page.locator('.topbar').getByRole('link',{name:'Back to Marketplace'})).toBeVisible();
 const profile=page.getByRole('link',{name:'View seller profile: Tobi Hamed'});await expect(profile).toHaveAttribute('href','/member/'+seller);await expect(profile.locator('img')).toHaveAttribute('src',photo);await expect.poll(()=>profile.locator('img').evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBeGreaterThan(0);
 await page.getByRole('button',{name:'View photo 2'}).click();await expect(page.locator('.market-main-photo img')).toHaveAttribute('src',photo+'?second=1');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(width===390)await page.screenshot({path:test.info().outputPath('market-product.png'),fullPage:true});
 await page.getByRole('button',{name:'Contact seller',exact:true}).click();await expect(page).toHaveURL(/\/chat\/seller-chat$/);expect(contactPath).toBe('/api/v1/communities/'+community.Id+'/direct-conversations/'+seller);
});

test('single marketplace card and own listing contact',async({page})=>{
 await setup(page);await page.setViewportSize({width:390,height:900});const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'},item={Id:'own-item',SellerUserId:user.Id,Title:'My laptop',Price:300,Currency:'GBP',FirstName:user.FirstName,LastName:user.LastName};let contacted=false;
 await page.route('**/api/v1/**',async r=>{const path=new URL(r.request().url()).pathname;if(path.includes('/direct-conversations/'))contacted=true;if(path.endsWith('/marketplace'))return r.fulfill({json:[item],headers});if(path.endsWith('/marketplace/own-item'))return r.fulfill({json:item,headers});return r.fallback()});
 await page.goto('/community/'+community.Id+'/marketplace');const grid=page.locator('.market-recent'),card=grid.locator('article');await expect(card).toHaveCount(1);expect((await card.boundingBox())!.width).toBeLessThan((await grid.boundingBox())!.width*.55);expect(await grid.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');await card.locator('.market-row-link').click();await expect(page.getByRole('button',{name:'Contact seller',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Contact seller',exact:true})).toBeDisabled();await expect(page.getByText('This is your listing. Other members can contact you here.')).toBeVisible();expect(contacted).toBe(false);
});

test('seller chat advert reference opens original listing',async({page})=>{
 await setup(page);const listing='44444444-4444-4444-8444-444444444444',headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'};
 await page.route('**/api/v1/**',async r=>{const path=new URL(r.request().url()).pathname;let json:any;if(path.endsWith('/conversations/reference-chat'))json={Id:'reference-chat',Name:'Seller',CommunityId:community.Id};else if(path.endsWith('/conversations/reference-chat/messages'))json=[{Id:'reference',SenderUserId:user.Id,MessageText:'Marketplace listing\nhttps://cdaconnect.org/community/'+community.Id+'/marketplace?listing='+listing,CreatedAt:'2026-09-17T12:00:00Z'}];else if(path.endsWith('/marketplace/'+listing))json={Id:listing,Title:'Referenced laptop',SellerUserId:'other',Price:300,Currency:'GBP'};else return r.fallback();return r.fulfill({json,headers})});
 await page.goto('/chat/reference-chat');const reference=page.getByRole('link',{name:/Marketplace advert.*Referenced laptop/});await expect(reference).toBeVisible();await page.reload();await expect(reference).toBeVisible();await reference.click();await expect(page).toHaveURL(new RegExp('listing='+listing));await expect(page.locator('.market-product-info h1')).toHaveText('Referenced laptop');
});

for(const receipts of [false,true])test(`opening chat clears unread with receipts ${receipts}`,async({page})=>{
 await setup(page);await page.setViewportSize({width:390,height:900});let unread=2,marked=false;const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'},cv='read-chat',other='other-user';
 await page.route('**/api/v1/**',async r=>{const path=new URL(r.request().url()).pathname;let json:any;
 if(path.endsWith('/users/communications'))json={ReadReceipts:receipts};
 else if(path.endsWith('/members'))json=[{UserId:other,FirstName:'Tobi',LastName:'Hamed'}];
 else if(path.endsWith('/communities/'+community.Id+'/conversations'))json=[{Id:cv,Type:'DIRECT',DirectUserId:other,DirectName:'Tobi Hamed',UnreadCount:unread}];
 else if(path.endsWith('/conversations/'+cv))json={Id:cv,Type:'DIRECT',DirectName:'Tobi Hamed',CommunityId:community.Id};
 else if(path.endsWith('/conversations/'+cv+'/messages'))json=[{Id:'incoming',SenderUserId:other,MessageText:'Hello',CreatedAt:'2026-09-17T10:00:00Z'},{Id:'last-own-message',SenderUserId:user.Id,MessageText:'OK',CreatedAt:'2026-09-17T10:01:00Z'}];
 else if(path.endsWith('/conversations/'+cv+'/read')){expect(r.request().postDataJSON()).toEqual({});unread=0;marked=true;json={shared:receipts}}
 else return r.fallback();return r.fulfill({json,headers});
 });
 await page.goto('/community/'+community.Id+'/conversations');await expect(page.getByLabel('2 unread messages')).toBeVisible();await page.locator('.chat-conversation-open').click();await expect.poll(()=>marked).toBe(true);await page.getByRole('link',{name:'Back to chats'}).click();await expect(page.getByLabel('2 unread messages')).toHaveCount(0);await page.reload();await expect(page.locator('.chat-conversation-row')).toBeVisible();await expect(page.getByLabel('2 unread messages')).toHaveCount(0);
});

for(const width of [390,768,1440])test(`finance bank directory and evidence review at ${width}px`,async({page})=>{
 await setup(page);await page.setViewportSize({width,height:900});
 const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'};let action='',savedBank='',savedAmount=0;
 await page.route('**/api/v1/communities/*/finance/**',async r=>{const path=new URL(r.request().url()).pathname;let json:any={};
 if(path.endsWith('/me'))json={canReviewPayments:true,canManageLevies:true,canManageBank:true,communityCountry:'Nigeria',currencyCode:'NGN',dues:[],receipts:[]};
 else if(path.endsWith('/unpaid-members'))json=[{Id:'unpaid',UserId:'member-two',FirstName:'Unpaid',LastName:'Member',PlanName:'Building levy',CurrencyCode:'NGN',AmountDue:10000,AmountPaid:1000}];
 else if(path.endsWith('/payment-submissions'))json=[{Id:'submission',UserId:user.Id,FirstName:'Test',LastName:'Member',PlanName:'Building levy',CurrencyCode:'NGN',Amount:10000,PaymentMethod:'BANK_TRANSFER',Reference:'BANK-001',SubmittedAt:'2026-09-17T10:00:00Z',Status:action?'APPROVED':'PENDING',EvidenceUrl:'levy-evidence:proof'}];
 else if(path.endsWith('/evidence/proof'))return r.fulfill({headers,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
 else if(r.request().method()==='PATCH')action=r.request().postDataJSON().action;
 else if(path.endsWith('/bank-account'))savedBank=r.request().postDataJSON().bankName;
 else if(path.endsWith('/dues-plans'))savedAmount=r.request().postDataJSON().amount;
 return r.fulfill({headers,json});});
 await page.route('**/bank-directory.json',r=>r.fulfill({json:{countries:{NG:['Listed community bank']}}}));
 await page.goto('/community/'+community.Id+'/finance');
 await expect(page.locator('.levy-tabs button')).toHaveText(['All (0)','Pending (0)','Paid (0)']);
 await expect(page.getByRole('button',{name:'View All Levy Types'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Test Member Building levy/})).toHaveCount(0);
 await page.getByRole('button',{name:/Payment records/}).click();
 await page.getByRole('button',{name:'Unpaid',exact:true}).click();await expect(page.getByText('Outstanding:',{exact:false})).toBeVisible();await expect(page.getByRole('link',{name:'Unpaid Member'})).toBeVisible();
 await page.getByRole('button',{name:'Submissions',exact:true}).click();
 await page.getByRole('button',{name:/Test Member Building levy/}).click();
 await expect(page).toHaveURL(/view=payment-detail&submission=submission/);await expect(page.getByRole('heading',{name:'Payment details',exact:true})).toBeVisible();await expect(page.getByRole('navigation',{name:'Community payment status'})).toHaveCount(0);await page.reload();await expect(page.getByAltText('Payment evidence')).toBeVisible();await page.getByRole('link',{name:'Back to payments',exact:true}).click();await expect(page).toHaveURL(/view=history/);await page.getByRole('button',{name:/Test Member Building levy/}).click();await expect(page.getByAltText('Payment evidence')).toBeVisible();
 await expect(page.getByRole('link',{name:'Test Member'})).toHaveAttribute('href','/member/'+user.Id);
 await page.getByRole('button',{name:'Approve',exact:true}).click();await expect.poll(()=>action).toBe('APPROVE');
 await page.getByRole('button',{name:'Bank transfer details',exact:true}).click();
 await expect(page.getByLabel('Bank country')).toHaveCount(0);
 await expect(page.getByLabel('Community currency')).toHaveCount(0);
 await expect(page.getByText('NGN',{exact:true})).toBeVisible();
 const bankName=page.getByLabel('Bank Name');await expect(bankName).toHaveJSProperty('tagName','SELECT');await expect(bankName.locator('option')).toHaveCount(3);await bankName.selectOption('__other');
 const customBankName=page.getByLabel('Bank Name');await expect(customBankName).toHaveJSProperty('tagName','INPUT');await customBankName.fill('Community bank');
 await page.getByLabel('Account Name',{exact:true}).fill('Maple Grove CDA');await page.getByLabel('Account Number',{exact:true}).fill('0123456789');await page.getByRole('button',{name:'Save bank details'}).click();await expect.poll(()=>savedBank).toBe('Community bank');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Create levy',exact:true}).click();
 const amount=page.locator('input[name=amount]');await amount.fill('10000');await amount.blur();await expect(amount).toHaveValue('10,000.00');
 await page.getByLabel('Levy Name *',{exact:true}).fill('Building levy');await page.getByLabel('Description *',{exact:true}).fill('Community building');await page.getByRole('button',{name:'Create Levy Type',exact:true}).click();await expect.poll(()=>savedAmount).toBe(10000);
});

for(const width of [390,768,1440])test(`document details page navigation at ${width}px`,async({page})=>{
 await setup(page);await page.setViewportSize({width,height:900});const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'};
 await page.route('**/api/v1/**',async r=>{const path=new URL(r.request().url()).pathname;let json:any;
 if(path.endsWith('/communities/'+community.Id+'/documents'))json=[{Id:'document-one',Title:'Community policy',Category:'Policies',FileName:'policy.pdf',SizeBytes:1024,CurrentVersion:1,UpdatedAt:'2026-09-17T12:00:00Z'}];
 else if(path.endsWith('/documents/document-one'))json={Id:'document-one',Title:'Community policy',Category:'Policies',FileName:'policy.pdf',SizeBytes:1024,CurrentVersion:1};
 else if(path.endsWith('/documents/document-one/download-url'))json={url:'https://cdaconnect.org/fixture-document.pdf'};
 else if(path.endsWith('/documents/document-one/history'))json=[{Id:'version-one',VersionNumber:1,ChangeNotes:'Initial upload',UploadedAt:'2026-09-17T12:00:00Z'}];
 else return r.fallback();return r.fulfill({headers,json});});
 await page.route('https://cdaconnect.org/fixture-document.pdf',r=>r.fulfill({headers,contentType:'application/pdf',body:'%PDF-1.4\n1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj\n2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj\n3 0 obj<</Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources <<>> /Contents 4 0 R>>endobj\n4 0 obj<</Length 0>>stream\n\nendstream\nendobj\ntrailer<</Root 1 0 R>>\n%%EOF'.replaceAll('\\n','\n')}));
 await page.goto('/community/'+community.Id+'/documents?folder=Policies');await page.locator('.doc-row').click();await expect(page).toHaveURL(/document=document-one/);await expect(page.locator('.doc-detail-page h1')).toHaveText('Community policy');await expect(page.locator('.document-reader canvas')).toBeVisible();await expect(page.getByText('Page 1 of 1',{exact:true})).toBeVisible();await expect(page.locator('.doc-download-footer').getByRole('button',{name:'Download document'})).toBeVisible();await expect(page.locator('dialog[open]')).toHaveCount(0);await expect(page.locator('.doc-search')).toHaveCount(0);await expect(page.getByRole('button',{name:'Download document'})).toBeVisible();await expect(page.getByText('Version history',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Upload new version'})).toHaveCount(0);await expect(page.getByText('No description provided.',{exact:true})).toBeVisible();await page.reload();await expect(page.locator('.doc-detail-page')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('link',{name:'Back to documents',exact:true}).click();await expect(page.locator('.doc-row')).toBeVisible();await expect(page.locator('.doc-detail-page')).toHaveCount(0);
});

for(const width of [390,768,1440])test(`emergency dashboard actions at ${width}px`,async({page})=>{
 await setup(page);await page.setViewportSize({width,height:900});const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'};let response='',created=false;const alert={Id:'alert-one',Title:'Flood warning',Message:'Water near the community entrance',Severity:'HIGH',Active:true,RequiresAcknowledgement:true,CreatedAt:'2026-09-17T10:00:00Z'};
 await page.route('**/api/v1/**',async r=>{const path=new URL(r.request().url()).pathname;let json:any;
 if(path.endsWith('/capabilities'))json={permissions:['EMERGENCY_SEND','EMERGENCY_MANAGE']};
 else if(path.endsWith('/emergency/dashboard'))json={alerts:[alert],contacts:[{Id:'contact',Name:'Coordinator',Phone:'+441234567890',ContactType:'community'}]};
 else if(path.endsWith('/alerts')&&r.request().method()==='POST'){created=r.request().postDataJSON().title==='Test incident';json={Id:'new-alert'}}
 else if(path.endsWith('/alerts'))json=[alert];
 else if(path.endsWith('/alerts/alert-one/respond')){response=r.request().postDataJSON().response;json={success:true}}
 else if(path.endsWith('/sos'))json=[];
 else return r.fallback();return r.fulfill({json,headers});});
 await page.goto('/community/'+community.Id+'/alerts');await expect(page.getByRole('heading',{name:'Quick Actions'})).toBeVisible();await expect(page.getByRole('link',{name:'Call Coordinator'})).toHaveAttribute('href','tel:+441234567890');await expect(page.getByRole('link',{name:'Text Coordinator'})).toHaveAttribute('href','sms:+441234567890');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'I’m Safe',exact:true}).click();await page.getByRole('link',{name:/Flood warning/}).click();await page.getByRole('button',{name:'I’m Safe',exact:true}).click();await expect.poll(()=>response).toBe('SAFE');await page.getByRole('link',{name:'Back to emergency'}).click();await page.getByRole('button',{name:'Send Emergency Alert',exact:true}).click();await page.getByLabel('Title',{exact:true}).fill('Test incident');await page.getByLabel('What happened?').fill('Test alert content');await page.locator('input[type=checkbox]').last().check();await page.getByRole('button',{name:'Send alert',exact:true}).click();await expect.poll(()=>created).toBe(true);await expect(page.getByRole('status')).toContainText('notification delivery queued');
});

for(const width of [320,390,768,1440])test(`executive position selector and dates at ${width}px`,async({page})=>{
 await setup(page);await page.setViewportSize({width,height:900});const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'};let saved:any;
 await page.route('**/api/v1/communities/*/excos',async r=>{if(r.request().method()==='POST'){saved=r.request().postDataJSON();return r.fulfill({headers,json:{success:true}})}return r.fulfill({headers,json:{items:[],canManage:true}})});
 await page.route('**/api/v1/communities/*/members',r=>r.fulfill({headers,json:[{UserId:user.Id,FirstName:user.FirstName,LastName:user.LastName,Email:user.Email}]}));
 await page.goto('/community/'+community.Id+'/excos?view=add');await page.getByRole('combobox',{name:'Community member *',exact:true}).selectOption(user.Id);const position=page.getByRole('combobox',{name:'Position / Role *',exact:true});await expect(position).toHaveJSProperty('tagName','SELECT');await position.selectOption('Financial Secretary');await expect(position).toHaveValue('Financial Secretary');await position.selectOption('__other');await page.getByLabel('Custom position *',{exact:true}).fill('Safety Officer');await position.selectOption('Secretary');await expect(page.getByLabel('Custom position *',{exact:true})).toHaveCount(0);
 await page.getByLabel('Date Appointed *',{exact:true}).fill('2026-09-17');await page.getByLabel('Tenure End Date *',{exact:true}).fill('2027-09-17');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const boxes=await page.locator('.exco-dates input').evaluateAll(nodes=>nodes.map(n=>({width:n.getBoundingClientRect().width,parent:n.parentElement!.getBoundingClientRect().width})));expect(boxes.every(b=>b.width<=b.parent+1)).toBe(true);await page.getByRole('button',{name:'Add Exco Member',exact:true}).click();await expect.poll(()=>saved?.position).toBe('Secretary');expect(saved.appointedDate).toBe('2026-09-17');expect(saved.tenureEndDate).toBe('2027-09-17');
});

for(const width of [320,390,768])test(`shared date fields stay inside forms at ${width}px`,async({page})=>{
 await setup(page);await page.setViewportSize({width,height:850});const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'};
 await page.route('**/api/v1/**',async r=>{const path=new URL(r.request().url()).pathname;let json:any;if(path.endsWith('/capabilities'))json={permissions:['EVENT_CREATE','MEETING_CREATE','ATTENDANCE_MANAGE']};else if(path.endsWith('/excos'))json={items:[],canManage:true};else if(path.endsWith('/finance/me'))json={canReviewPayments:true,canManageLevies:true,canManageBank:true,dues:[],receipts:[]};else return r.fallback();return r.fulfill({headers,json});});
 await page.route('**/api/v1/**',r=>r.request().method()==='OPTIONS'?r.fulfill({status:204,headers:{...headers,'access-control-allow-methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','access-control-allow-headers':'authorization,content-type,x-cda-client'}}):r.fallback());
 for(const section of ['excos?view=add','events?create=1','finance?view=create','meetings?view=create']){await page.goto('/community/'+community.Id+'/'+section);const dateFields=page.locator('input[type=date],input[type=datetime-local],input[type=time]');await expect(dateFields.first()).toBeVisible();const boxes=await dateFields.evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect(),p=n.parentElement!.getBoundingClientRect();return{left:b.left,right:b.right,parentLeft:p.left,parentRight:p.right,viewport:innerWidth}}));expect(boxes.every(b=>b.left>=b.parentLeft-1&&b.right<=b.parentRight+1&&b.right<=b.viewport+1),section+JSON.stringify(boxes)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>window.scrollTo(100,0));expect(await page.evaluate(()=>window.scrollX)).toBe(0);}
});

test('analytics stays off until consent and stops after withdrawal',async({page})=>{
 await setup(page);await page.addInitScript(()=>{if(!sessionStorage.getItem('consent-test-started')){localStorage.removeItem('cda-analytics-consent');sessionStorage.setItem('consent-test-started','1')}});let requests=0;
 await page.route('https://www.googletagmanager.com/**',r=>{requests++;return r.fulfill({contentType:'application/javascript',body:''})});
 await page.goto('/login');await expect(page.getByRole('button',{name:'Accept',exact:true})).toBeVisible();expect(requests).toBe(0);await page.getByRole('button',{name:'Accept',exact:true}).click();await expect.poll(()=>requests).toBe(1);await expect(page.getByRole('button',{name:'Cookie preferences',exact:true})).toHaveCount(0);for(const route of ['/home','/community/'+community.Id+'/finance']){await page.goto(route);await expect(page.getByRole('region',{name:'Cookie preferences',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Cookie preferences',exact:true})).toHaveCount(0);expect(await page.evaluate(()=>localStorage.getItem('cda-analytics-consent'))).toBe('granted')}await page.goto('/cookies');const requestsBeforeWithdrawal=requests;await page.getByRole('button',{name:'Cookie preferences',exact:true}).click();await page.getByRole('button',{name:'Reject',exact:true}).click();await page.waitForLoadState();expect(await page.evaluate(()=>localStorage.getItem('cda-analytics-consent'))).toBe('denied');expect(requests).toBe(requestsBeforeWithdrawal);
});

for(const width of [390,1440])test(`payment reviewer cannot open bank or levy controls at ${width}px`,async({page})=>{
 await setup(page);await page.setViewportSize({width,height:900});const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'};
 await page.route('**/api/v1/communities/'+community.Id+'/finance/me',r=>r.fulfill({headers,json:{dues:[],receipts:[],canReviewPayments:true,canManageBank:false,canManageLevies:false,currencyCode:'GBP'}}));
 await page.goto('/community/'+community.Id+'/finance');await expect(page.getByRole('button',{name:/Payment records/})).toBeVisible();await expect(page.getByRole('button',{name:'Bank transfer details',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Create levy',exact:true})).toHaveCount(0);
 for(const view of ['bank','create']){await page.goto('/community/'+community.Id+'/finance?view='+view);await expect(page.locator('.levy-page')).toBeVisible();await expect(page.locator('.levy-form')).toHaveCount(0)}
});

test('informational emergency alert is readable without acknowledgement controls',async({page})=>{
 await setup(page);const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'},alert={Id:'info',Title:'Road reopened',Message:'The road is now open.',Active:true,RequiresAcknowledgement:false,CreatedAt:'2026-09-17T10:00:00Z'};
 await page.route('**/api/v1/**',r=>{const p=new URL(r.request().url()).pathname;if(p.endsWith('/emergency/dashboard'))return r.fulfill({headers,json:{alerts:[alert],contacts:[]}});if(p.endsWith('/alerts'))return r.fulfill({headers,json:[alert]});return r.fallback()});
 await page.goto('/community/'+community.Id+'/alerts');await expect(page.getByRole('button',{name:'I’m Safe',exact:true})).toHaveCount(0);await page.getByRole('link',{name:/Road reopened/}).click();await expect(page.getByText('The road is now open.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'I’m Safe',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'I need help',exact:true})).toHaveCount(0);
});
for(const width of [390,1440])test(`document manager metadata replacement and archive at ${width}px`,async({page})=>{
 await setup(page);await page.setViewportSize({width,height:950});const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'};let archived=false,doc:any={Id:'managed',Title:'Community policy',Summary:'Policy description',Category:'Policies',Visibility:'MEMBERS',CurrentVersion:1,FileName:'policy.docx',MimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',SizeBytes:2048,UploadedAt:'2026-09-17T10:00:00Z',UploaderFirstName:'Test',UploaderLastName:'Manager'},notes='Initial upload';
 await page.route('**/api/v1/**',async r=>{const p=new URL(r.request().url()).pathname;let json:any;
 if(p.endsWith('/capabilities'))json={permissions:['DOCUMENT_MANAGE']};else if(p.endsWith('/documents/managed/history'))json=[{Id:'version',VersionNumber:doc.CurrentVersion,ChangeNotes:notes,UploadedAt:doc.UploadedAt}];else if(p.endsWith('/documents/managed/versions')){doc.CurrentVersion++;notes=r.request().postDataJSON().changeNotes;json={success:true,version:doc.CurrentVersion}}else if(p.endsWith('/documents/managed')){if(r.request().method()==='PATCH'){const data=r.request().postDataJSON();if(data.archived)archived=true;else doc={...doc,Title:data.title,Summary:data.summary,Category:data.category,Visibility:data.visibility}}json=doc}else if(p.endsWith('/media/upload'))json={storedObjectId:'44444444-4444-4444-8444-444444444444'};else if(p.endsWith('/communities/'+community.Id+'/documents'))json=archived?[]:[doc];else return r.fallback();return r.fulfill({headers,json})});
 await page.goto('/community/'+community.Id+'/documents?folder=Policies&document=managed');await expect(page.getByText('Policy description',{exact:true})).toBeVisible();await expect(page.getByText('Test Manager',{exact:true})).toBeVisible();await expect(page.getByText('Initial upload',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Edit metadata',exact:true}).click();await page.locator('.doc-detail-info').getByLabel('Document title',{exact:true}).fill('Updated policy');await page.getByRole('button',{name:'Save metadata'}).click();await expect(page.locator('.doc-detail-page h1')).toHaveText('Updated policy');await page.getByRole('button',{name:'Replace document',exact:true}).click();await page.getByLabel('Replacement document').setInputFiles({name:'replacement.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from('test replacement')});await page.getByLabel('Change notes',{exact:true}).fill('Updated wording');await page.getByRole('button',{name:'Upload new version',exact:true}).click();await expect(page.getByText('Updated wording',{exact:true})).toBeVisible();await expect(page.getByText('Version 2',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Archive document',exact:true}).click();await expect(page.locator('.doc-detail-page')).toHaveCount(0);expect(archived).toBe(true);
});

test('in-app SOS notification card opens its specific status page',async({page})=>{await setup(page);const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'},destination='/community/'+community.Id+'/alerts?view=sos-status&sos=22222222-2222-4222-8222-222222222222';await page.route('**/api/v1/me/notifications',r=>r.fulfill({headers,json:[{Id:'11111111-1111-4111-8111-111111111111',Title:'SOS acknowledged',Body:'Your SOS was updated',CommunityId:community.Id,Destination:destination,NavigationData:{actorUserId:'22222222-2222-4222-8222-222222222222'},NotificationType:'EMERGENCY_ALERT'}]}));await page.goto('/notifications');await expect(page.getByRole('link',{name:/SOS acknowledged/})).toHaveAttribute('href',destination);await expect(page.getByRole('link',{name:'View update',exact:true})).toHaveCount(0)});

test('community activity dot identifies an unread section and clears when opened',async({page})=>{await page.setViewportSize({width:390,height:844});await setup(page);const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'},notification={Id:'11111111-1111-4111-8111-111111111111',Title:'New message',Body:'A new chat message',CommunityId:community.Id,CommunityName:community.Name,NotificationType:'CHAT_MESSAGE',Destination:'/chat/44444444-4444-4444-8444-444444444444',NavigationData:{type:'CHAT_MESSAGE'},IsRead:false};let read=false;await page.route('**/api/v1/me/notifications',r=>r.fulfill({headers,json:[{...notification,IsRead:read,ReadAt:read?'2026-09-17T12:00:00Z':null}]}));await page.route('**/api/v1/me/notifications/read',r=>{read=true;return r.fulfill({headers,json:{success:true}})});await page.goto('/community/'+community.Id+'/menu');const chat=page.getByRole('link',{name:'Chat, new activity'});await expect(chat.locator('.community-activity-dot')).toBeVisible();await chat.click();await expect(page).toHaveURL('/community/'+community.Id+'/conversations');await expect(page.locator('.community-activity-dot')).toHaveCount(0);expect(read).toBe(true)});

test('community invitation shows the full profile before the join action',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'},invited={Id:'99999999-9999-4999-8999-999999999999',Name:'Maple Grove CDA',Description:'Moving forward for progress',MemberCount:12,EventCount:3,AnnouncementCount:4,DocumentCount:2,CommunityType:'Residents',SpecificArea:'Example Estate',State:'Lagos',Country:'Nigeria',IsPrivate:true,Guidelines:'Be kind and respect your neighbours.',CreatedAt:'2024-01-01T00:00:00Z'};
 await page.route('**/api/v1/communities',r=>r.fulfill({headers,json:[]}));await page.route('**/api/v1/communities/invite/ABCDEF',r=>r.fulfill({headers,json:invited}));await page.route('**/api/v1/communities/join',r=>r.fulfill({headers,status:201,json:{...invited,status:'PENDING'}}));
 await page.goto('/home');await expect(page.locator('.home-activities')).toBeVisible();await page.goto('/invite/ABCDEF');await expect(page.getByRole('heading',{name:'Maple Grove CDA'})).toBeVisible();await expect(page.getByRole('navigation',{name:'Community activity'})).toContainText('Announcements');await expect(page.getByText('Community guidelines',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Request to join'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('unread activity is shown on the navigation and clears after marking all read',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await setup(page);const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'};
 let notifications=[{Id:'11111111-1111-4111-8111-111111111111',Title:'Tobi Hamed',Body:'New message',CommunityId:community.Id,CommunityName:community.Name,NotificationType:'CHAT_MESSAGE',NavigationData:{actorUserId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},Destination:'/chat/44444444-4444-4444-8444-444444444444',IsRead:false},{Id:'22222222-2222-4222-8222-222222222222',Title:'Tobi Hamed',Body:'Another message',CommunityId:community.Id,CommunityName:community.Name,NotificationType:'CHAT_MESSAGE',NavigationData:{actorUserId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},Destination:'/chat/44444444-4444-4444-8444-444444444444',IsRead:false},{Id:'33333333-3333-4333-8333-333333333333',Title:'Member joined',Body:'A member joined',CommunityId:community.Id,CommunityName:community.Name,NotificationType:'MEMBER',NavigationData:{actorUserId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},IsRead:true,ReadAt:'2026-09-17T11:00:00Z'}];
 await page.route('**/api/v1/me/notifications',r=>r.fulfill({headers,json:notifications}));
 await page.route('**/api/v1/me/notifications/read-all',r=>{notifications=notifications.map(item=>({...item,IsRead:true,ReadAt:'2026-09-17T12:00:00Z'}));return r.fulfill({headers,json:{success:true}})});
 await page.goto('/home');await expect(page.getByRole('button',{name:'Open notifications, 2 unread'})).toBeVisible();await expect(page.getByRole('link',{name:'Notifications, 2 unread'})).toBeVisible();
 await page.getByRole('button',{name:'Open notifications, 2 unread'}).click();await expect(page.locator('.notification-card')).toHaveCount(2);await expect(page.getByText('2 updates',{exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'View update',exact:true})).toHaveCount(0);await expect(page.getByText('New',{exact:true})).toHaveCount(1);await page.getByRole('button',{name:'Mark all read'}).click();
 await expect(page.locator('.notification-badge')).toHaveCount(0);await expect(page.getByText('New',{exact:true})).toHaveCount(0);
});
