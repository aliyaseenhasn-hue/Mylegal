import { useEffect, useState } from 'react';
import { BellRing, BellOff, Share, PlusSquare, Smartphone, Send } from 'lucide-react';
import { pushStatus, enablePush, disablePush, sendTestPush } from '../lib/push';
import { useToast } from './ui';

export default function PushCard({ compact }) {
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => pushStatus().then(setStatus).catch(() => setStatus('unsupported'));
  useEffect(() => { refresh(); }, []);
  const run = (fn, ok) => async () => {
    setBusy(true);
    try { await fn(); if (ok) toast(ok); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); refresh(); }
  };
  if (!status) return null;
  if (compact && status === 'on') return null;

  return (
    <div className="card push-card">
      <div className="push-ico">{status === 'on' ? <BellRing size={22} /> : status === 'denied' ? <BellOff size={22} /> : <Smartphone size={22} />}</div>
      <div className="grow">
        {status === 'on' && (<>
          <b>الإشعارات مفعّلة على هذا الجهاز</b>
          <div className="small muted">تصلك تذكيرات الجلسات والمهام حتى والتطبيق مغلق.</div>
        </>)}
        {status === 'off' && (<>
          <b>فعّل الإشعارات على هذا الجهاز</b>
          <div className="small muted">لتصلك تذكيرات الجلسات والمهام المستحقة والمهام الجديدة المسندة إليك، حتى والتطبيق مغلق.</div>
        </>)}
        {status === 'denied' && (<>
          <b>الإشعارات مرفوضة على هذا الجهاز</b>
          <div className="small muted">في الآيفون: الإعدادات ← الإشعارات ← ميزان ← السماح بالإشعارات. ثم أعد فتح التطبيق.</div>
        </>)}
        {status === 'ios-install' && (<>
          <b>لاستقبال الإشعارات على الآيفون، ثبّت التطبيق أولاً</b>
          <ol className="small muted push-steps">
            <li>افتح هذا الرابط في <b>Safari</b>.</li>
            <li>اضغط زر المشاركة <Share size={14} /> أسفل الشاشة.</li>
            <li>اختر <b>"إضافة إلى الشاشة الرئيسية"</b> <PlusSquare size={14} />.</li>
            <li>افتح "ميزان" من الأيقونة الجديدة، وارجع لهذه الصفحة واضغط "تفعيل الإشعارات".</li>
          </ol>
          <div className="small muted">يتطلب iOS 16.4 أو أحدث.</div>
        </>)}
        {status === 'unsupported' && (<>
          <b>هذا المتصفح لا يدعم الإشعارات</b>
          <div className="small muted">استخدم Safari على الآيفون (بعد الإضافة للشاشة الرئيسية) أو Chrome على الأندرويد والحاسبة.</div>
        </>)}
      </div>
      <div className="actions">
        {status === 'off' && <button className="btn btn-gold" disabled={busy} onClick={run(enablePush, 'تم تفعيل الإشعارات على هذا الجهاز')}><BellRing size={16} />{busy ? 'لحظة…' : 'تفعيل الإشعارات'}</button>}
        {status === 'on' && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={run(sendTestPush, 'أُرسل إشعار تجريبي، سيصلك خلال ثوانٍ')}><Send size={14} />إشعار تجريبي</button>}
        {status === 'on' && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={run(disablePush, 'أُوقفت الإشعارات على هذا الجهاز')}>إيقاف</button>}
      </div>
    </div>
  );
}
