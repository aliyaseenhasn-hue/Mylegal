// يتحقق من وجود نسخة أحدث من التطبيق عند العودة إليه، ويعيد التحميل تلقائياً
const current = () => [...document.scripts].map((s) => s.src).find((s) => /assets\/index-.*\.js/.test(s)) || '';

async function latest() {
  const res = await fetch(`./index.html?v=${Date.now()}`, { cache: 'no-store' });
  const html = await res.text();
  const m = html.match(/assets\/index-[^"']+\.js/);
  return m ? m[0] : '';
}

export function watchForUpdates() {
  let checking = false;
  const check = async () => {
    if (checking || document.visibilityState !== 'visible') return;
    checking = true;
    try {
      const l = await latest();
      if (l && !current().endsWith(l)) {
        // لا نعيد التحميل إذا كانت نافذة إدخال مفتوحة كي لا تضيع البيانات
        if (!document.querySelector('.modal')) window.location.reload();
      }
    } catch { /* بدون إنترنت */ } finally { checking = false; }
  };
  document.addEventListener('visibilitychange', check);
  setInterval(check, 5 * 60 * 1000);
}
