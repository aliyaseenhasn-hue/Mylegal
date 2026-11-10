import { supabase, callFunction } from './supabase';

export const VAPID_PUBLIC_KEY = 'BDBFAqzmiakTUUr-roNtiiWc3gDxtPQU6s1d6xPkwK2-D_ehO-dYpLfyS9kH7Mv80Ty1LX8rIpl3R0DJ7HG8Uic';

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((e) => console.warn('SW', e));
  });
}

function keyToBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** الحالة: 'ios-install' | 'unsupported' | 'denied' | 'off' | 'on' */
export async function pushStatus() {
  if (isIOS() && !isStandalone()) return 'ios-install';
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('./');
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

export async function enablePush() {
  // يجب أن يُستدعى مباشرة من ضغطة زر (شرط آبل)
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'تم رفض الإذن. فعّله من إعدادات الجهاز' : 'لم يُمنح الإذن');
  const reg = (await navigator.serviceWorker.getRegistration('./')) || (await navigator.serviceWorker.register('./sw.js', { scope: './' }));
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) });
  const j = sub.toJSON();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 300),
  }, { onConflict: 'endpoint' });
  if (error) throw new Error('تعذر حفظ الاشتراك: ' + error.message);
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration('./');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
}

export const sendTestPush = () => callFunction('send-push', { action: 'test' });

export function clearBadge() {
  try { navigator.clearAppBadge?.(); } catch { /* ignore */ }
}
