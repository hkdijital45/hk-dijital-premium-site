import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
// Requires the opt-in LOCAL fixture. Never uses a production test account.
test.describe('Academy server-contract integration',()=>{
 test.skip(process.env.ACADEMY_FIXTURE!=='1','Local academy Supabase contract fixture is not enabled.');
 test.beforeEach(async({page})=>{
 await page.request.post('http://127.0.0.1:54999/test/reset');
 await page.goto('/academy/login');await page.getByLabel('E-posta veya kullanıcı adı').fill('academy-a@example.invalid');await page.getByLabel('Şifre',{exact:true}).fill('academy-fixture-password');await page.getByRole('button',{name:'Akademiye giriş yap'}).click();await expect(page).toHaveURL(/\/academy$/);
 });
 test('login, dashboard, lesson completion, bookmark, note, persistence, logout',async({page})=>{
 await expect(page.getByRole('heading',{name:'Hoş geldin, Akademi.'})).toBeVisible();
 await page.goto('/academy/book/book-7');await page.getByRole('button',{name:'Okudum, tamamla'}).click();await expect(page.getByRole('button',{name:'Tamamlandı',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Yer imi ekle'}).click();await page.getByText('Kişisel notun',{exact:true}).click();await page.getByLabel('Yalnızca hesabında saklanır').fill('Owned kanalları kampanya öncesinde denetle.');await page.getByRole('button',{name:'Notu kaydet',exact:true}).click();
 await page.reload();await expect(page.getByRole('button',{name:'Yer iminde'})).toBeVisible();
 const state=await page.evaluate(async()=> (await fetch('/api/academy')).json());expect(state.state.some((s:{kind:string;value:{text?:string}})=>s.kind==='note'&&s.value.text?.includes('Owned'))).toBe(true);
 await page.goto('/academy/notes');await expect(page.getByText('Owned kanalları kampanya öncesinde denetle.')).toBeVisible();
 if(await page.getByRole('button',{name:'Menüyü aç',exact:true}).isVisible())await page.getByRole('button',{name:'Menüyü aç',exact:true}).click();await page.getByRole('button',{name:'Çıkış yap',exact:true}).click();await expect(page).toHaveURL(/\/academy\/login/);expect((await page.request.get('/api/academy')).status()).toBe(401);
 });
 test('quiz answers remain hidden until completion and are server-graded',async({page})=>{
 await page.goto('/academy/book/book-14');const early=await page.evaluate(async()=> (await fetch('/api/academy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'book-14',action:'solution'})})).status);expect(early).toBe(403);
 await page.getByRole('button',{name:'20 dakikalık sınavı başlat'}).click();
 for(let i=0;i<5;i++){await page.locator('input[type=radio][value="B"]').check();if(i<4)await page.getByRole('button',{name:'Sonraki',exact:true}).click();}
 const solutions=JSON.parse(readFileSync('content/academy/solutions.json','utf8'));const expected=[...String(solutions['book-14']).matchAll(/(?:^|[·\s])([0-9]+)-([A-DY])(?=\s|·|$)/g)].filter(match=>match[2]==='B').length;
 await page.getByRole('button',{name:'Sınavı bitir',exact:true}).click();await expect(page.getByText(`Otomatik değerlendirilen: ${expected} / 5.`,{exact:false})).toBeVisible();
 const state=await page.evaluate(async()=> (await fetch('/api/academy')).json());expect(state.state.some((s:{kind:string})=>s.kind==='review')).toBe(true);
 });
 test('workbook controls submit and self-assessment persists',async({page})=>{
 await page.goto('/academy/workbook/workbook-7');await page.locator('.ac-activities input[type=radio]').nth(1).check();const selects=page.locator('.ac-activities select');
 for(const [i,value] of ['D','Y','Y','D','D','C','B','A'].entries())await selects.nth(i).selectOption(value);
 await page.getByRole('button',{name:'Cevapları gönder',exact:true}).click();await expect(page.getByRole('heading',{name:'Çalışmanı değerlendir'})).toBeVisible();await page.getByRole('button',{name:'4 Profesyonel seviye'}).click();await expect(page.getByText('Öz değerlendirme ve tekrar planı kaydedildi.')).toBeVisible();
 });
 test('case simulation and diagnostic save source-grounded decisions',async({page})=>{
 await page.goto('/academy/cases/cases-9');for(let i=0;i<4;i++){await page.getByLabel('Kararınız ve profesyonel gerekçeniz').fill('Owned kanalları, Google İşletme Profili ve dönüşüm noktasını önce doğrularım; bütçe dağılımını veriyle test ederim.');if(i<3)await page.getByRole('button',{name:'Sonraki',exact:true}).click();}await page.getByRole('button',{name:'Vakayı gönder'}).click();await expect(page.getByRole('heading',{name:'Model cevap ve profesyonel gerekçe'})).toBeVisible();
 await page.goto('/academy/diagnostics/diagnostics-140-1');await page.getByRole('button',{name:'Bu semptomu incele'}).click();await page.getByLabel('Gözlemin ve kontrol ettiğin kırılım').fill('CTR düşüklüğünü kreatif, kitle ve yerleşim kırılımlarında karşılaştırdım.');await page.getByRole('button',{name:'Veri toplandı'}).click();await page.getByRole('button',{name:'Kreatif kırılımı',exact:true}).click();await page.getByRole('button',{name:'Evet, bulguyla uyumlu'}).click();await page.getByLabel('Kontrol metriği, mevcut değer ve karşılaştırma dönemi').fill('Aynı dönemde kreatif bazlı CTR');await page.getByRole('button',{name:'Müdahaleyi planla'}).click();await page.getByLabel('Tek boyutta uygulayacağın değişiklik').fill('Sadece kreatifin giriş mesajını test edeceğim.');await page.getByRole('button',{name:'Yeniden ölçümü planla'}).click();await page.getByLabel('Metrik, süre ve başarı ölçütün').fill('Aynı veri penceresinde CTR ve dönüşüm maliyetini karşılaştıracağım.');await page.getByRole('button',{name:'Teşhis çalışmasını tamamla'}).click();await expect(page.getByText('Teşhis çalışması hesabınıza kaydedildi.')).toBeVisible();
 });
 test('glossary, global search, calculator and final structured draft',async({page})=>{
 await page.goto('/academy/glossary');await page.getByRole('textbox',{name:'İçerik ara'}).fill('PERSONA');await expect(page.locator('.ac-content-card')).toHaveCount(1);
 await page.goto('/academy/formulas');await page.locator('.ac-tool select').selectOption('roas');await page.getByLabel('Reklama atfedilen gelir').fill('12000');await page.getByLabel('Reklam harcaması',{exact:true}).fill('3000');await expect(page.locator('output.ac-result')).toContainText('4 ×');
 await page.keyboard.press('Control+k');await page.getByRole('textbox',{name:'Tüm akademi içeriklerinde ara'}).fill('frequency');await expect(page.locator('.ac-search-results a').first()).toBeVisible();await page.getByRole('button',{name:'Aramayı kapat'}).click();
 await page.goto('/academy/final/final-168');await page.locator('.ac-workflow textarea').fill('Dijital varlıkları ve kaynaktaki çelişkili yorum sayısını doğrulayarak audit başlatırım.');await page.locator('.ac-workflow').getByRole('button',{name:'Taslağı kaydet',exact:true}).click();await expect(page.getByText('Taslak hesabınıza kaydedildi.')).toBeVisible();await page.reload();await expect(page.locator('.ac-workflow textarea')).toHaveValue(/Dijital varlıkları/);
 });
 test('final submission requires every field and persists rubric; ordinary member cannot administer',async({page})=>{
 await page.goto('/academy/final/final-168');const workflow=page.locator('.ac-workflow');await expect(workflow.getByRole('button',{name:'Tamamını gönder'})).toBeDisabled();
 const count=await workflow.locator('.ac-question-nav button').count();
 for(let i=0;i<count;i++){await workflow.locator('.ac-question-nav button').nth(i).click();await workflow.locator('textarea').fill('Kaynak senaryodaki veriyi doğrular, ölçüm planını ve uygulanabilir karar gerekçesini belgelendiririm.');}
 await workflow.getByRole('button',{name:'Tamamını gönder'}).click();await expect(workflow.getByRole('heading',{name:'Profesyonel örnek çözüm'})).toBeVisible();
 for(const select of await workflow.locator('select').all())await select.selectOption('3');
 await workflow.getByRole('button',{name:'Değerlendirmeyi kaydet'}).click();await expect(workflow.getByText('Kategori puanları ve öz değerlendirme kaydedildi.')).toBeVisible();
 const result=await page.evaluate(async()=>({state:await(await fetch('/api/academy')).json(),admin:(await fetch('/api/academy/admin')).status}));
 expect(result.admin).toBe(403);expect(result.state.state.some((s:{content_id:string;kind:string})=>s.content_id==='final-168'&&s.kind==='assessment')).toBe(true);
 });
 test('conversation follows branches and persists computed scores',async({page})=>{
 await page.goto('/academy/lab/lab-117');const conversation=page.locator('.ac-conversation');await conversation.getByRole('button',{name:'Görüşmeyi başlat / sürdür'}).click();await expect(conversation.locator('.ac-conversation-options button').first()).toBeVisible();
 for(let step=0;step<15;step++){const options=conversation.locator('.ac-conversation-options button');if(await options.count()===0)break;await options.first().click();await expect(conversation.locator('button').first()).toBeEnabled();}
 await expect(conversation.getByText('Seçimlerden hesaplanan eğitim puanı hesabınıza kaydedildi.')).toBeVisible();
 const state=await page.evaluate(async()=> (await fetch('/api/academy')).json());expect(state.state.some((s:{content_id:string;kind:string})=>s.content_id==='lab-117'&&s.kind==='assessment')).toBe(true);
 });

 test('member data stays isolated across accounts and client scores cannot be forged',async({page})=>{
 await page.goto('/academy/book/book-7');
 const saved=await page.evaluate(async()=> (await fetch('/api/academy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'book-7',action:'note',text:'Only account A may read this.',user_id:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'})})).status);expect(saved).toBe(200);
 await page.evaluate(async()=>{await fetch('/api/auth/logout',{method:'POST'});});
 await page.goto('/academy/login');await page.getByLabel('E-posta veya kullanıcı adı').fill('academy-b@example.invalid');await page.getByLabel('Şifre',{exact:true}).fill('academy-fixture-password');await page.getByRole('button',{name:'Akademiye giriş yap'}).click();await expect(page).toHaveURL(/\/academy$/);
 const state=await page.evaluate(async()=> (await fetch('/api/academy')).json());expect(state.state).toHaveLength(0);
 const forged=await page.evaluate(async()=> (await fetch('/api/academy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'book-14',action:'assess',score:4,correct:100,total:100})})).status);expect(forged).toBe(409);
 });

 test('academy admin can revoke an existing membership and cannot remove their own access',async({page})=>{
 await page.evaluate(async()=>{await fetch('/api/auth/logout',{method:'POST'});});await page.goto('/academy/login');await page.getByLabel('E-posta veya kullanıcı adı').fill('academy-c@example.invalid');await page.getByLabel('Şifre',{exact:true}).fill('academy-fixture-password');await page.getByRole('button',{name:'Akademiye giriş yap'}).click();await expect(page).toHaveURL(/\/academy$/);
 await page.goto('/academy/admin');await expect(page.getByRole('heading',{name:'Üyelik ve öğrenme sonuçları'})).toBeVisible();await expect(page.getByRole('cell').filter({hasText:'academy-b@example.invalid'})).toBeVisible();
 await page.getByLabel('Kullanıcının e-postası').fill('academy-b@example.invalid');await page.getByLabel('Üyelik etkin').uncheck();await page.getByRole('button',{name:'Üyeliği kaydet'}).click();await expect(page.getByText('Akademi üyeliği güncellendi.')).toBeVisible();
 const own=await page.evaluate(async()=> (await fetch('/api/academy/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'academy-c@example.invalid',role:'academy_user',active:false})})).status);expect(own).toBe(409);
 const loginStatus=await page.evaluate(async()=>{await fetch('/api/auth/logout',{method:'POST'});return (await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'academy-b@example.invalid',password:'academy-fixture-password'})})).status;});expect(loginStatus).toBe(200);
 const denied=await page.evaluate(async()=> (await fetch('/api/academy')).status);expect(denied).toBe(401);
 });

});
