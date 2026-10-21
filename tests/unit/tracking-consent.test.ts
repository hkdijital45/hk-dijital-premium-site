import assert from 'node:assert/strict';
import test from 'node:test';
import { pushGaEvent, fireGoogleAdsConversion } from '../../src/lib/ga-events.ts';
import { CONSENT_KEY, readConsent } from '../../src/lib/tracking-consent.ts';
function browser(choice: unknown, mode?: 'gtm' | 'direct') {
  const calls: unknown[][] = [];
  const layer: unknown[] = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: { getItem: (key: string) => key === CONSENT_KEY ? JSON.stringify(choice) : null },
    dataLayer: layer, hkGaMode: mode, gtag: (...args: unknown[]) => calls.push(args)
  }});
  return { calls, layer };
}
test('unknown, rejected and expired consent never queue GA events', () => {
  for (const choice of [null, {analytics:false,marketing:false,expires:Date.now()+10000}, {analytics:true,marketing:true,expires:1}]) {
    const {calls,layer} = browser(choice, 'gtm');
    pushGaEvent('page_view'); assert.equal(calls.length,0); assert.equal(layer.length,0);
  }
});
test('direct GA sends a real gtag event command exactly once', () => {
  const {calls,layer} = browser({analytics:true,marketing:false,expires:Date.now()+10000}, 'direct');
  pushGaEvent('navigation_click',{link_text:'Hizmetler'});
  assert.deepEqual(calls,[['event','navigation_click',{link_text:'Hizmetler'}]]);
  assert.equal(layer.length,0);
});
test('GTM receives a custom event with isolated parameters, without gtag duplication', () => {
  const {calls,layer} = browser({analytics:true,marketing:false,expires:Date.now()+10000}, 'gtm');
  pushGaEvent('page_view',{page_path:'/hizmetler'});
  assert.deepEqual(layer,[{event_params:null},{event:'page_view',event_params:{page_path:'/hizmetler'}}]);
  assert.equal(calls.length,0);
});
test('malformed storage fails closed and an uninitialized loader does not send', () => {
  browser({analytics:'yes',marketing:false,expires:Date.now()+10000});
  assert.equal(readConsent(),null);
  const {calls,layer}=browser({analytics:true,marketing:false,expires:Date.now()+10000});
  pushGaEvent('page_view'); assert.equal(calls.length,0); assert.equal(layer.length,0);
});
test('Google Ads conversion fires exactly once, only with marketing consent and direct mode', () => {
  const sendTo = 'AW-17670817544/cldVCND5xd4bEIiOjepB';
  const { calls } = browser({ analytics: true, marketing: true, expires: Date.now() + 10000 }, 'direct');
  fireGoogleAdsConversion(sendTo);
  assert.deepEqual(calls, [['event', 'conversion', { send_to: sendTo }]]);
});
test('Google Ads conversion never fires without marketing consent', () => {
  const { calls } = browser({ analytics: true, marketing: false, expires: Date.now() + 10000 }, 'direct');
  fireGoogleAdsConversion('AW-17670817544/cldVCND5xd4bEIiOjepB');
  assert.equal(calls.length, 0);
});
test('Google Ads conversion never fires in GTM mode (direct-gtag only)', () => {
  const { calls } = browser({ analytics: true, marketing: true, expires: Date.now() + 10000 }, 'gtm');
  fireGoogleAdsConversion('AW-17670817544/cldVCND5xd4bEIiOjepB');
  assert.equal(calls.length, 0);
});
