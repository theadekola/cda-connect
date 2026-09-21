import {test,expect,type Page} from '@playwright/test';
const user={Id:'11111111-1111-4111-8111-111111111111',FirstName:'Adekola',LastName:'Ayannuga',Email:'member@example.test',CreatedAt:'2026-01-01T12:00:00Z',Username:'member'};
const community={Id:'22222222-2222-4222-8222-222222222222',Name:'Royal View CDA',Description:'Moving forward for progress',MemberCount:2,Role:'Owner'};
async function setup(page:Page,long=false){
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
test('profile statistics toggle, account navigation and no browser token storage',async({page})=>{await setup(page);await page.goto('/profile');await expect(page.locator('#profile-statistics')).toBeHidden();await page.getByRole('button',{name:'Show profile statistics'}).click();await expect(page.locator('#profile-statistics')).toBeVisible();await page.getByRole('button',{name:'Hide profile statistics'}).click();await expect(page.locator('#profile-statistics')).toBeHidden();await page.getByRole('link',{name:'Account settings',exact:true}).click();await page.getByRole('link',{name:/Email address/}).click();await expect(page.getByLabel('Current password')).toBeVisible();expect(await page.evaluate(()=>[localStorage.getItem('cda-connect-session'),sessionStorage.getItem('cda-connect-session')])).toEqual([null,null])});
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
test('community gutters and compact icons; mobile header follows scroll direction',async({page})=>{
 await page.setViewportSize({width:390,height:700});await setup(page);await page.goto('/community/'+community.Id+'/menu');
 const header=page.locator('.workspace>.topbar');await expect(page.locator('.community-menu-grid').first()).toBeVisible();
 const section=page.locator('.community-menu>section:not(.community-hero)').first();expect(await section.evaluate(el=>parseFloat(getComputedStyle(el).paddingLeft))).toBeGreaterThanOrEqual(16);
 expect(await page.locator('.community-menu-grid>a>span').first().evaluate(el=>getComputedStyle(el).width)).toBe('32px');
 await page.evaluate(()=>window.scrollTo(0,300));await expect(header).toHaveAttribute('data-hidden','true');await expect(header).toHaveAttribute('inert','');
 await page.evaluate(()=>window.scrollTo(0,240));await expect(header).toHaveAttribute('data-hidden','false');await expect.poll(()=>header.evaluate(el=>el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
 await page.evaluate(()=>window.scrollTo(0,400));await expect(header).toHaveAttribute('data-hidden','true');
 await page.setViewportSize({width:1440,height:700});await expect(header).toHaveAttribute('data-hidden','false');await page.evaluate(()=>window.scrollTo(0,500));await expect(header).toHaveAttribute('data-hidden','false');
 await page.setViewportSize({width:390,height:700});await page.goto('/profile');await expect(header).toHaveAttribute('data-hidden','false');
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
 await page.getByLabel('Community Name *',{exact:true}).fill('New community');await page.getByLabel('Description *',{exact:true}).fill('A welcoming community');await page.getByLabel('Community category').selectOption('Sports');await page.getByRole('combobox',{name:'Country *',exact:true}).selectOption('NG');await page.getByLabel(/State \/ Region/).selectOption('NG025');await page.getByRole('combobox',{name:'LGA *',exact:true}).selectOption('Ikeja');await page.getByLabel('Community rules',{exact:true}).fill('Be respectful');await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.getByRole('switch',{name:/Private community/})).toBeChecked();await page.getByRole('switch',{name:/Public community/}).check();await expect(page.getByRole('switch',{name:/Private community/})).not.toBeChecked();
 const boxes=await page.locator('.create-footer-actions>button').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().top));expect(new Set(boxes).size).toBe(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width===390)await page.screenshot({path:test.info().outputPath('community-preferences.png'),fullPage:true});await page.getByRole('button',{name:'Create Community',exact:true}).click();await expect(page.getByLabel('Invite code',{exact:true})).toHaveValue('AABBCCDDEEFF0011');expect(payload.isPrivate).toBe(false);expect(payload.joinCode).toBeUndefined();expect(payload.category).toBe('Sports');
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
