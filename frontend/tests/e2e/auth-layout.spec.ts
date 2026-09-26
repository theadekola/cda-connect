import {test,expect,type Page} from '@playwright/test';

async function publicPage(page:Page){
 await page.addInitScript(()=>localStorage.setItem('cda-analytics-consent','denied'));
 await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//,route=>route.abort());
 await page.route('**/api/v1/auth/refresh',route=>route.fulfill({status:401,json:{message:'Signed out'}}));
}

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
