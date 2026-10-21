import {test,expect,type Page} from '@playwright/test';
const user={Id:'11111111-1111-4111-8111-111111111111',FirstName:'Jordan',LastName:'Okafor',Email:'member@example.test'},community='22222222-2222-4222-8222-222222222222';
const headers={'access-control-allow-origin':'http://127.0.0.1:4173','access-control-allow-credentials':'true'};
async function setup(page:Page){
 await page.addInitScript(()=>localStorage.setItem('cda-analytics-consent','denied'));
 await page.route('**/socket.io/**',r=>r.abort());await page.route(/^https:\/\/fonts\./,r=>r.abort());
 await page.route('**/api/v1/**',async r=>{const p=new URL(r.request().url()).pathname;let json:unknown=[];
 if(p.endsWith('/auth/refresh'))json={accessToken:'fixture-access',user};else if(p.endsWith('/users/me'))json=user;else if(p.endsWith('/communities/'+community))json={Id:community,Name:'Example CDA'};else if(p.endsWith('/capabilities'))json={permissions:[]};else if(p.endsWith('/language-preferences'))json={AppLanguage:'en-GB',TranslationLanguage:'en-GB',translationAvailable:false};else if(p.endsWith('/recent-activity'))json={items:[],nextCursor:null};
 return r.fulfill({headers,json});});
}
for(const width of [390,768,1440])test(`language changes immediately, persists, and supports RTL at ${width}px`,async({page})=>{
 await setup(page);await page.setViewportSize({width,height:900});let code='en-GB';
 await page.route('**/api/v1/users/language-preferences',async r=>{if(r.request().method()==='PATCH'){code=r.request().postDataJSON().value;await new Promise(resolve=>setTimeout(resolve,350));return r.fulfill({headers,json:{success:true}})}return r.fulfill({headers,json:{AppLanguage:code,translationAvailable:false}})});
 await page.goto('/settings/language/app');await page.getByRole('radio',{name:/Français/}).check();
 await expect(page.locator('html')).toHaveAttribute('lang','fr');await expect(page.getByRole('heading',{name:'Langue de l’application'})).toBeVisible();await expect(page.getByRole('link',{name:'Accueil',exact:true}).first()).toBeVisible();
 await expect(page.getByRole('radio',{name:/Français/})).toBeChecked();await expect(page.getByText('Enregistrement…',{exact:true})).toBeVisible();
 await page.getByRole('radio',{name:/العربية/}).check();await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.getByRole('radio',{name:/العربية/})).toBeChecked();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','ar');await expect(page.locator('html')).toHaveAttribute('dir','rtl');
});
test('feed renders available posts while linked requests are slow and loads another page',async({page})=>{
 await setup(page);await page.setViewportSize({width:390,height:844});let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>release=resolve),requests:string[]=[];
 await page.route('**/api/v1/communities/'+community+'/**',async r=>{const url=new URL(r.request().url()),p=url.pathname;if(p.endsWith('/feed')){requests.push(url.search);const next=url.searchParams.get('offset')!=='0';return r.fulfill({headers,json:{items:[{Id:next?'post-2':'post-1',CreatedBy:user.Id,FirstName:'Jordan',Body:next?'Second page post':'First page immediately',PostType:'TEXT',CreatedAt:'2026-10-16T09:00:00Z'}],nextOffset:next?null:20}})}if(p.endsWith('/meetings')){await gate;return r.fulfill({headers,json:[]})}return r.fallback()});
 try{await page.goto('/community/'+community+'/feed');await expect(page.getByText('First page immediately')).toBeVisible();await page.getByRole('button',{name:'Load more posts',exact:true}).click();await expect(page.getByText('Second page post')).toBeVisible();expect(requests.some(url=>url.includes('limit=20')&&url.includes('offset=20'))).toBe(true)}finally{release()}
});
