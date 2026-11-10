import { useState } from 'react';
import { Scale, ShieldCheck, CalendarClock, Wallet, FolderLock, Users, KeyRound, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
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

function BackLink({ onClick }) {
  return <div className="auth-switch"><span className="link" onClick={onClick}><ArrowRight size={14} /> العودة لتسجيل الدخول</span></div>;
}

/** استعادة كلمة المرور برمز يصل على البريد */
function ForgotPassword({ onBack, initialEmail }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState(initialEmail || '');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState({ a: '', b: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = (fn) => async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await fn(); } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  if (step === 'done') return (
    <div className="auth-box" style={{ textAlign: 'center' }}>
      <CheckCircle2 size={48} color="var(--success)" />
      <h2 style={{ marginTop: 10 }}>تم تغيير كلمة المرور</h2>
      <p>يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.</p>
      <button className="btn btn-primary btn-block" onClick={onBack}>تسجيل الدخول</button>
    </div>
  );
  return step === 'email' ? (
    <form className="auth-box" onSubmit={run(async () => {
      await callFunction('account', { action: 'request_reset', email });
      setStep('code');
    })}>
      <KeyRound size={36} color="var(--accent)" />
      <h2 style={{ marginTop: 10 }}>نسيت كلمة المرور؟</h2>
      <p>أدخل بريدك المسجّل وسنرسل لك رمزاً من 6 أرقام لتعيين كلمة مرور جديدة.</p>
      <Field label="البريد الإلكتروني" required><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" autoFocus /></Field>
      {err && <div className="form-error" style={{ marginBottom: 14 }}>{err}</div>}
      <button className="btn btn-primary btn-block" style={{ height: 46 }} disabled={busy}>{busy ? 'جارٍ الإرسال…' : 'إرسال الرمز'}</button>
      <BackLink onClick={onBack} />
    </form>
  ) : (
    <form className="auth-box" onSubmit={run(async () => {
      if (pw.a.length < 8) throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      if (pw.a !== pw.b) throw new Error('كلمتا المرور غير متطابقتين');
      await callFunction('account', { action: 'confirm_reset', email, code, password: pw.a });
      setStep('done');
    })}>
      <Mail size={36} color="var(--accent)" />
      <h2 style={{ marginTop: 10 }}>أدخل الرمز</h2>
      <p>إذا كان البريد <b dir="ltr">{email}</b> مسجّلاً فستصلك رسالة خلال دقيقة. تحقق من مجلد الرسائل غير المرغوبة (Spam) أيضاً.</p>
      <Field label="الرمز (6 أرقام)" required>
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required dir="ltr" inputMode="numeric" autoComplete="one-time-code"
          style={{ fontSize: 22, letterSpacing: 8, textAlign: 'center' }} autoFocus />
      </Field>
      <Field label="كلمة المرور الجديدة" required><input type="password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} required dir="ltr" autoComplete="new-password" /></Field>
      <Field label="تأكيد كلمة المرور" required><input type="password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} required dir="ltr" autoComplete="new-password" /></Field>
      {err && <div className="form-error" style={{ marginBottom: 14 }}>{err}</div>}
      <button className="btn btn-primary btn-block" style={{ height: 46 }} disabled={busy}>{busy ? 'لحظة…' : 'تعيين كلمة المرور'}</button>
      <div className="auth-switch"><span className="link" onClick={() => { setStep('email'); setErr(''); }}>لم يصلك الرمز؟ أعد الإرسال</span></div>
      <BackLink onClick={onBack} />
    </form>
  );
}

/** معرفة البريد المسجّل من رقم الهاتف */
function FindEmail({ onBack, onUse }) {
  const [phone, setPhone] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <form className="auth-box" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(''); setRes(null);
      try { const r = await callFunction('account', { action: 'find_email', phone }); setRes(r.emails || []); } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
    }}>
      <Mail size={36} color="var(--accent)" />
      <h2 style={{ marginTop: 10 }}>نسيت البريد الإلكتروني؟</h2>
      <p>أدخل رقم الهاتف المسجّل في حسابك وسنعرض لك جزءاً من بريدك لتتذكره.</p>
      <Field label="رقم الهاتف" required><input value={phone} onChange={(e) => setPhone(e.target.value)} required dir="ltr" inputMode="tel" placeholder="07xx xxx xxxx" autoFocus /></Field>
      {err && <div className="form-error" style={{ marginBottom: 14 }}>{err}</div>}
      {res && (res.length ? (
        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div className="small muted" style={{ marginBottom: 6 }}>الحسابات المرتبطة بهذا الرقم:</div>
          {res.map((m) => <div key={m} dir="ltr" style={{ fontWeight: 600, textAlign: 'left' }}>{m}</div>)}
        </div>
      ) : <div className="form-error" style={{ marginBottom: 14 }}>لا يوجد حساب مرتبط بهذا الرقم. تواصل مع مدير مكتبك.</div>)}
      <button className="btn btn-primary btn-block" style={{ height: 46 }} disabled={busy}>{busy ? 'جارٍ البحث…' : 'بحث'}</button>
      {res?.length > 0 && <div className="auth-switch"><span className="link" onClick={onUse}>تذكرت البريد؟ سجّل الدخول</span></div>}
      <BackLink onClick={onBack} />
    </form>
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
        {mode === 'forgot' && <ForgotPassword initialEmail={form.email} onBack={() => setMode('login')} />}
        {mode === 'find' && <FindEmail onBack={() => setMode('login')} onUse={() => setMode('login')} />}
        {(mode === 'login' || mode === 'register') && <form className="auth-box" onSubmit={submit}>
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
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 13.5 }}>
                <span className="link" onClick={() => { setMode('forgot'); setErr(''); }}>نسيت كلمة المرور؟</span>
                <span className="link" onClick={() => { setMode('find'); setErr(''); }}>نسيت البريد الإلكتروني؟</span>
              </div>
              <p className="small muted" style={{ textAlign: 'center', marginTop: 16 }}>
                أعضاء الفريق يحصلون على حساباتهم من مدير المكتب، ويمكن للمدير أيضاً تعيين كلمة مرور جديدة لهم.
              </p>
            </>
          )}
        </form>}
      </div>
    </div>
  );
}

export function NoOffice({ onSignOut }) {
  return (
    <div className="auth-panel" style={{ minHeight: '100%' }}>
      <div className="auth-box" style={{ textAlign: 'center' }}>
        <Scale size={44} color="var(--accent)" />
        <h2 style={{ marginTop: 12 }}>الحساب غير مفعّل</h2>
        <p>هذا الحساب أو المكتب المرتبط به موقوف حالياً، أو أنه غير مرتبط بأي مكتب. تواصل مع مدير مكتبك.</p>
        <button className="btn btn-ghost" onClick={onSignOut}>تسجيل الخروج</button>
      </div>
    </div>
  );
}
