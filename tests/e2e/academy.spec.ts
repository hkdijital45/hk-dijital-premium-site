import {test,expect} from '@playwright/test';
test('academy blocks unauthenticated pages and API content',async({page,request})=>{
 const response=await request.get('/api/academy?q=frequency');expect(response.status()).toBe(401);expect(await response.text()).not.toContain('Creative');
 await page.goto('/academy/book/book-14');await expect(page).toHaveURL(/\/academy\/login/);await expect(page.getByRole('button',{name:'Akademiye giriş yap'})).toBeVisible();
 const html=await page.content();expect(html).not.toContain('Earned Media');expect(html).not.toContain('Cevap Anahtarı:');
});
test('academy login is private and accessible on mobile',async({page})=>{
 const response=await page.goto('/academy/login');expect(response?.headers()['x-robots-tag']).toContain('noindex');
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content',/noindex.*nofollow/);
 await expect(page.getByLabel('E-posta veya kullanıcı adı')).toBeVisible();await expect(page.getByLabel('Şifre',{exact:true})).toHaveAttribute('type','password');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('hidden shortcut uses physical digit codes with both OS modifiers',async({page})=>{
 for(const modifier of ['Control','Meta']){
 await page.goto('/gizlilik-politikasi');
 await page.waitForLoadState('networkidle');
 await page.keyboard.down(modifier);await page.keyboard.down('Shift');await page.keyboard.press('Digit1');await page.keyboard.press('Digit1');await page.keyboard.press('Digit2');await page.keyboard.up('Shift');await page.keyboard.up(modifier);
 await expect(page).toHaveURL(/\/academy\/login/);
 }
});
test('public sitemap does not list academy',async({request})=>{const response=await request.get('/sitemap.xml');expect(await response.text()).not.toContain('/academy');});
