import {test,expect,type Page} from '@playwright/test';
const community='22222222-2222-4222-8222-222222222222',chat='44444444-4444-4444-8444-444444444444';
async function setup(page:Page,width:number){
 await page.setViewportSize({width,height:844});
 await page.addInitScript(()=>{
  localStorage.setItem('cda-analytics-consent','denied');
  const viewport=window.visualViewport!,state={height:window.innerHeight,offsetTop:0,scale:1};
  Object.defineProperty(window.navigator,'standalone',{value:true});
  for(const key of ['height','offsetTop','scale'] as const)Object.defineProperty(viewport,key,{configurable:true,get:()=>state[key]});
  (window as any).testChatViewport=(next:Partial<typeof state>)=>{Object.assign(state,next);viewport.dispatchEvent(new Event('resize'));viewport.dispatchEvent(new Event('scroll'))};
 });
 await page.route('**/socket.io/**',route=>route.abort());
 await page.route(/^https:\/\/(fonts\.|www\.googletagmanager|.*google-analytics)/,route=>route.abort());
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;let json:unknown=[];
  if(path.endsWith('/auth/refresh'))json={accessToken:'fixture-access',user:{Id:'member',FirstName:'Test',LastName:'Member',Email:'member@example.test'}};
  else if(path.endsWith('/conversations/'+chat))json={Id:chat,Name:'Community chat',CommunityId:community,CommunityName:'Example CDA'};
  else if(path.endsWith('/messages'))json={items:Array.from({length:80},(_,index)=>({Id:'message-'+index,MessageText:'Chat message '+index,MessageType:'TEXT',SenderUserId:'member',CreatedAt:'2026-10-15T09:00:00Z'})),nextCursor:null};
  else if(path.endsWith('/communities/'+community))json={Id:community,Name:'Example CDA'};
  else if(path.endsWith('/capabilities'))json={permissions:[]};
  return route.fulfill({json,headers:{'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'}});
 });
}
for(const width of [390,412])test(`installed chat retains its header and composer across keyboard pan at ${width}px`,async({page})=>{
 await setup(page,width);await page.goto('/chat/'+chat);
 const header=page.locator('.conversation-header'),thread=page.locator('.chat-thread'),input=page.getByRole('textbox',{name:'Message',exact:true});
 await expect(page.getByText('Chat message 79',{exact:true})).toBeVisible();await input.click();
 await page.evaluate(()=>(window as any).testChatViewport({height:460,offsetTop:180}));
 await expect.poll(()=>header.evaluate(element=>element.getBoundingClientRect().top)).toBe(180);
 const composer=page.locator('.chat-composer-area');expect((await composer.boundingBox())!.y+(await composer.boundingBox())!.height).toBeLessThanOrEqual(641);
 await expect.poll(()=>thread.evaluate(element=>element.scrollHeight-element.scrollTop-element.clientHeight)).toBeLessThan(2);
 await input.fill('Typing while the keyboard is open');await expect(input).toHaveValue('Typing while the keyboard is open');
 await thread.evaluate(element=>{element.scrollTop=300});await page.evaluate(()=>new Promise(requestAnimationFrame));
 await page.evaluate(()=>(window as any).testChatViewport({height:420,offsetTop:210}));
 await expect.poll(()=>header.evaluate(element=>element.getBoundingClientRect().top)).toBe(210);expect(await thread.evaluate(element=>element.scrollTop)).toBe(300);
 await input.blur();await page.evaluate(()=>(window as any).testChatViewport({height:844,offsetTop:210}));
 await expect.poll(()=>header.evaluate(element=>element.getBoundingClientRect().top)).toBe(0);await expect(input).toHaveValue('Typing while the keyboard is open');
 await page.getByRole('link',{name:'Back to chats'}).click();await expect(page).toHaveURL('/community/'+community+'/conversations');await expect(page.locator('.conversation-page')).toHaveCount(0);await expect.poll(()=>page.evaluate(()=>document.documentElement.classList.contains('chat-viewport-active'))).toBe(false);expect(await page.evaluate(()=>getComputedStyle(document.body).position)).not.toBe('fixed');
});
test('desktop chat keeps its sidebar and normal document positioning',async({page})=>{
 await setup(page,1440);await page.goto('/chat/'+chat);await expect(page.getByText('Chat message 79',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>getComputedStyle(document.body).position)).not.toBe('fixed');expect(await page.locator('.conversation-page').evaluate(element=>getComputedStyle(element).position)).not.toBe('fixed');expect((await page.locator('.conversation-header').boundingBox())!.x).toBeGreaterThan(0);
});
