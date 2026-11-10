import { useState } from 'react';
import { Scale, ShieldCheck, CalendarClock, Wallet, FolderLock, Users } from 'lucide-react';
import { supabase, callFunction, translateError } from '../lib/supabase';
import { Field } from '../components/ui';

function Art() {
  return (
    <div className="auth-art">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Scale size={40} color="var(--gold-400)" />
          <h1>ميزان</h1>
        </div>
        <p className="lead">النظام المتكامل لإدارة مكاتب المحاماة — من فتح الملف حتى صدور الحكم وتحصيل الأتعاب.</p>
        <ul>
          <li><CalendarClock size={20} /> تقويم الجلسات مع جدولة الجلسة القادمة تلقائياً</li>
          <li><Users size={20} /> ملفات الموكلين والقضايا والوكالات في مكان واحد</li>
          <li><Wallet size={20} /> سندات قبض مطبوعة، مصاريف، ومتابعة الأتعاب المتبقية</li>
          <li><FolderLock size={20} /> أرشيف مستندات محمي لا يصل إليه إلا فريق المكتب</li>
          <li><ShieldCheck size={20} /> صلاحيات حسب الدور: مدير، محامٍ، محاسب، سكرتير</li>
        </ul>
      </div>
      <div className="small" style={{ color: '#8d9ab3' }}>بياناتك معزولة ومشفّرة، ولا يطّلع عليها أي مكتب آخر.</div>
      <Scale size={340} className="scale" />
    </div>
  );
}

export function Login() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', full_name: '', office_name: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      if (mode === 'register') {
        if (form.password.length < 8) throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
        await callFunction('register-office', form);
      }
      const { error } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
      if (error) throw translateError(error);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <Art />
      <div className="auth-panel">
        <form className="auth-box" onSubmit={submit}>
          {mode === 'login' ? (
            <>
              <h2>مرحباً بعودتك</h2>
              <p>سجّل الدخول إلى حساب مكتبك</p>
            </>
          ) : (
            <>
              <h2>تسجيل مكتب جديد</h2>
              <p>أنشئ حساب مكتبك مجاناً، وستكون أنت مالك المكتب ومديره.</p>
              <Field label="اسم المكتب" required>
                <input value={form.office_name} onChange={set('office_name')} required minLength={2} placeholder="مثال: مكتب المحامي علي ياسين" />
              </Field>
              <Field label="اسمك الكامل" required>
                <input value={form.full_name} onChange={set('full_name')} required minLength={2} />
              </Field>
              <Field label="رقم الهاتف">
                <input value={form.phone} onChange={set('phone')} dir="ltr" inputMode="tel" placeholder="07xx xxx xxxx" />
              </Field>
            </>
          )}
          <Field label="البريد الإلكتروني" required>
            <input type="email" value={form.email} onChange={set('email')} required dir="ltr" autoComplete="email" />
          </Field>
          <Field label="كلمة المرور" required hint={mode === 'register' ? '8 أحرف على الأقل' : undefined}>
            <input type="password" value={form.password} onChange={set('password')} required dir="ltr" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </Field>
          {err && <div className="form-error" style={{ marginBottom: 14 }}>{err}</div>}
          <button className="btn btn-primary btn-block" style={{ height: 46 }} disabled={busy}>
            {busy ? 'لحظة…' : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء المكتب والدخول'}
          </button>
          <div className="auth-switch">
            {mode === 'login' ? (
              <>ليس لديك حساب؟ <span className="link" onClick={() => { setMode('register'); setErr(''); }}>سجّل مكتبك الآن</span></>
            ) : (
              <>لديك حساب؟ <span className="link" onClick={() => { setMode('login'); setErr(''); }}>تسجيل الدخول</span></>
            )}
          </div>
          {mode === 'login' && (
            <p className="small muted" style={{ textAlign: 'center', marginTop: 16 }}>
              أعضاء الفريق يحصلون على حساباتهم من مدير المكتب. نسيت كلمة المرور؟ اطلب من مدير المكتب إعادة تعيينها.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

export function NoOffice({ onSignOut }) {
  return (
    <div className="auth-panel" style={{ minHeight: '100%' }}>
      <div className="auth-box" style={{ textAlign: 'center' }}>
        <Scale size={44} color="var(--accent)" />
        <h2 style={{ marginTop: 12 }}>الحساب غير مرتبط بمكتب</h2>
        <p>هذا الحساب غير مفعّل أو أُوقف من قبل مدير المكتب. تواصل مع مدير مكتبك.</p>
        <button className="btn btn-ghost" onClick={onSignOut}>تسجيل الخروج</button>
      </div>
    </div>
  );
}
