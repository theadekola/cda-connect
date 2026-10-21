import {test,expect,type Page} from '@playwright/test';

async function publicPage(page:Page){
 await page.addInitScript(()=>localStorage.setItem('cda-analytics-consent','denied'));
 await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//,route=>route.abort());
 await page.route('**/api/v1/auth/refresh',route=>route.fulfill({status:401,json:{message:'Signed out'}}));
}

test('Apple install icon is served as PNG and status bar uses standard mode',async({page})=>{
 await publicPage(page);await page.goto('/');
 await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content','default');
 const icon=page.locator('link[rel="apple-touch-icon"]');
 await expect(icon).toHaveAttribute('href','/apple-touch-icon-v2.png');
 const response=await page.request.get((await icon.getAttribute('href'))!);
 expect(response.ok()).toBe(true);expect(response.headers()['content-type']).toContain('image/png');
 expect((await response.body()).subarray(1,4).toString()).toBe('PNG');
 const fallback=await page.request.get('/apple-touch-icon.png');expect(fallback.ok()).toBe(true);
 expect(await fallback.body()).toEqual(await response.body());
});

test('desktop welcome and login branding sit in the white content panel',async({page})=>{
 await publicPage(page);await page.setViewportSize({width:1440,height:900});
 for(const path of ['/','/login']){
  await page.goto(path);
  const visual=page.locator(path==='/'?'.welcome-story':'.login-page .auth-visual');
  const panel=page.locator(path==='/'?'.welcome-entry':'.login-page .auth-panel');
  const brand=panel.locator('.desktop-auth-brand');
  await expect(brand).toBeVisible();
  await expect(visual.locator('.brand')).toHaveCount(0);
  const panelBox=await panel.boundingBox(),brandBox=await brand.boundingBox();
  expect(brandBox!.x).toBeGreaterThanOrEqual(panelBox!.x);
  expect(brandBox!.x+brandBox!.width).toBeLessThanOrEqual(panelBox!.x+panelBox!.width);
 }
 const pills=page.locator('.welcome-points a');await page.goto('/');await expect(pills).toHaveCount(3);
 const tops=await pills.evaluateAll(nodes=>nodes.map(node=>Math.round(node.getBoundingClientRect().top)));
 expect(new Set(tops).size).toBe(1);
});

for(const width of [390,430])test(`mobile login hero reaches screen edges at ${width}px`,async({page})=>{
 await publicPage(page);await page.setViewportSize({width,height:844});await page.goto('/login');
 const box=await page.locator('.login-mobile-hero').boundingBox();
 expect(box!.x).toBe(0);expect(Math.round(box!.width)).toBe(width);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
});

test('password recovery submits a normalized email address',async({page})=>{
 await publicPage(page);await page.setViewportSize({width:390,height:844});let body:any;
 await page.route('**/api/v1/auth/password-reset/request',async route=>{body=route.request().postDataJSON();await route.fulfill({status:202,json:{resetToken:'test-reset-token'}})});
 await page.goto('/forgot-password');const email=page.getByLabel('Registered email address');await expect(email).toHaveAttribute('type','email');await email.fill('  MEMBER@Example.COM  ');await page.getByRole('button',{name:'Send reset code'}).click();await expect(page.getByLabel('Verification code')).toBeVisible();expect(body).toEqual({email:'member@example.com'});
});

test('registration uses email verification only and separates its actions',async({page})=>{
 await publicPage(page);await page.setViewportSize({width:390,height:844});let body:any;
 await page.route('**/api/v1/auth/email-verification/request',async route=>{body=route.request().postDataJSON();await route.fulfill({status:202,json:{success:true}})});
 await page.goto('/register');await expect(page.getByRole('button',{name:'SMS',exact:true})).toHaveCount(0);
 await page.getByLabel('Email address').fill('MEMBER@Example.COM');await page.getByRole('button',{name:'Send verification code'}).click();
 expect(body).toEqual({email:'member@example.com'});const verify=page.getByRole('button',{name:'Verify email'}),change=page.getByRole('button',{name:'Change email or request another code'});
 await expect(verify).toBeVisible();await expect(change).toBeVisible();const first=await verify.boundingBox(),second=await change.boundingBox();expect(second!.y-(first!.y+first!.height)).toBeGreaterThanOrEqual(10);
});

for(const width of [390,430])test(`installed iOS authentication has an opaque status edge and readable registration heading at ${width}px`,async({page})=>{
 await publicPage(page);await page.setViewportSize({width,height:844});await page.addInitScript(()=>{Object.defineProperty(navigator,'standalone',{value:true});Object.defineProperty(navigator,'userAgent',{value:'Mozilla/5.0 (iPhone; CPU iPhone OS 27_2 like Mac OS X)'})});
 for(const path of ['/','/login','/register','/forgot-password']){
  await page.goto(path);await page.addStyleTag({content:'html.ios-installed{--app-status-height:54px!important}'});
  const edge=page.locator('.app-status-surface');await expect(edge).toBeVisible();
  expect(await edge.evaluate(el=>{const css=getComputedStyle(el);return {position:css.position,background:css.backgroundColor,filter:css.backdropFilter,opacity:css.opacity}})).toEqual({position:'fixed',background:'rgb(255, 255, 255)',filter:'none',opacity:'1'});
  const bounds=await edge.boundingBox();expect(bounds!.y).toBe(0);expect(bounds!.height).toBe(54);expect(bounds!.width).toBe(width);
  if(path==='/register'){
   const heading=page.locator('.mobile-auth-heading'),hero=page.locator('.auth-visual');await expect(heading).toBeVisible();await expect(hero.locator('h1')).toBeHidden();
   expect((await heading.boundingBox())!.y).toBeGreaterThan((await hero.boundingBox())!.y+(await hero.boundingBox())!.height);
   await expect(page.getByRole('button',{name:'Send verification code'})).toBeVisible();
  }
  await page.evaluate(()=>window.scrollTo(0,500));expect((await edge.boundingBox())!.y).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});

test('translated two-factor login keeps verification separate from the welcome screen',async({page})=>{
 await publicPage(page);await page.addInitScript(()=>localStorage.setItem('cda-interface-language','fr'));
 await page.route('**/api/v1/auth/login',route=>route.fulfill({json:{requiresTwoFactor:true,challengeToken:'fixture-challenge'}}));
 await page.goto('/login');await page.locator('input[name="email"]').fill('member@example.test');await page.locator('input[name="password"]').fill('Password123!');
 await page.getByRole('button',{name:'Connexion',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Vérifiez votre connexion',exact:true})).toBeVisible();await expect(page.locator('.login-intro')).toHaveCount(0);await expect(page.locator('.verification-digits input')).toHaveCount(6);await expect(page.locator('.verification-digits input').first()).toBeVisible();await page.locator('.verification-digits input').first().fill('123456');await expect(page.locator('input[name="code"]')).toHaveValue('123456');
});
