import { useState } from 'react';
import { Building2, Users, UserCog, Plus, KeyRound, Upload, ShieldCheck, Power } from 'lucide-react';
import { supabase, must, callFunction } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ROLES, CURRENCIES, opts } from '../lib/labels';
import { initials, date } from '../lib/format';
import { PageHead } from '../components/Layout';
import PushCard from '../components/PushCard';
import { Tabs, Field, Select, FormShell, useForm, Modal, Badge, useToast, Confirm } from '../components/ui';

const ROLE_HELP = {
  admin: 'صلاحيات كاملة عدا نقل ملكية المكتب',
  lawyer: 'القضايا والجلسات والمهام والمستندات، وعرض مالية قضاياه',
  accountant: 'سندات القبض والمصاريف والتقارير المالية',
  secretary: 'الموكلون والقضايا والجلسات والمواعيد، بدون المالية',
};

function OfficeTab() {
  const { office, can, reload } = useAuth();
  const toast = useToast();
  const editable = can('manageOffice');
  const { values, set } = useForm({
    name: office.name || '', phone: office.phone || '', email: office.email || '', address: office.address || '', city: office.city || '',
    bar_number: office.bar_number || '', receipt_footer: office.receipt_footer || '', default_currency: office.default_currency, lawyers_see_all: office.lawyers_see_all,
  });
  const [uploading, setUploading] = useState(false);

  const uploadLogo = async (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('الحد الأقصى لحجم الشعار 2 ميغابايت', 'error'); return; }
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${office.id}/logo-${Date.now()}.${ext}`;
      const up = await supabase.storage.from('branding').upload(path, file, { contentType: file.type });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from('branding').getPublicUrl(path);
      must(await supabase.from('offices').update({ logo_url: data.publicUrl }).eq('id', office.id));
      toast('تم تحديث الشعار'); reload();
    } catch (e) { toast('تعذر رفع الشعار: ' + e.message, 'error'); } finally { setUploading(false); }
  };

  return (
    <div className="card-body">
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
        <div className="brand-mark" style={{ width: 72, height: 72, borderRadius: 16, background: 'var(--navy-900)' }}>
          {office.logo_url ? <img src={office.logo_url} alt="شعار المكتب" /> : <Building2 size={30} />}
        </div>
        {editable && (
          <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
            <Upload size={16} />{uploading ? 'جارٍ الرفع…' : 'رفع شعار المكتب'}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => uploadLogo(e.target.files[0])} />
          </label>
        )}
      </div>
      <FormShell submitText="حفظ إعدادات المكتب" onSubmit={async () => {
        if (!editable) throw new Error('ليست لديك صلاحية تعديل إعدادات المكتب');
        must(await supabase.from('offices').update(values).eq('id', office.id));
        toast('تم حفظ إعدادات المكتب'); reload();
      }}>
        <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <Field label="اسم المكتب" required><input value={values.name} onChange={set('name')} required /></Field>
            <Field label="رقم الهوية النقابية"><input value={values.bar_number} onChange={set('bar_number')} /></Field>
            <Field label="الهاتف"><input value={values.phone} onChange={set('phone')} dir="ltr" /></Field>
            <Field label="البريد الإلكتروني"><input value={values.email} onChange={set('email')} dir="ltr" type="email" /></Field>
            <Field label="المحافظة / المدينة"><input value={values.city} onChange={set('city')} /></Field>
            <Field label="العملة الافتراضية"><Select value={values.default_currency} onChange={set('default_currency')} options={opts(CURRENCIES)} /></Field>
            <Field label="العنوان" full><input value={values.address} onChange={set('address')} /></Field>
            <Field label="تذييل سند القبض" full hint="يظهر أسفل كل سند قبض مطبوع"><input value={values.receipt_footer} onChange={set('receipt_footer')} placeholder="مثال: هذا السند لا يعتبر نافذاً إلا بالختم" /></Field>
            <label className="check full"><input type="checkbox" checked={!!values.lawyers_see_all} onChange={set('lawyers_see_all')} />
              السماح للمحامين برؤية جميع قضايا المكتب (عند الإلغاء يرى كل محامٍ القضايا المسندة إليه فقط)</label>
          </div>
        </fieldset>
      </FormShell>
    </div>
  );
}

function MemberModal({ member, onClose, onSaved }) {
  const toast = useToast();
  const { values, set } = useForm({ full_name: member?.full_name || '', email: member?.email || '', phone: member?.phone || '', title: member?.title || '', role: member?.role || 'lawyer', password: '' });
  return (
    <Modal title={member ? `تعديل: ${member.full_name}` : 'إضافة عضو للفريق'} onClose={onClose}>
      <FormShell onCancel={onClose} submitText={member ? 'حفظ' : 'إنشاء الحساب'} onSubmit={async () => {
        if (member) {
          if (member.role !== 'owner') {
            await callFunction('manage-member', { action: 'update', user_id: member.user_id, role: values.role, full_name: values.full_name, phone: values.phone, title: values.title });
          }
          if (values.email.trim().toLowerCase() !== (member.email || '').toLowerCase()) {
            await callFunction('manage-member', { action: 'update_email', user_id: member.user_id, email: values.email });
          }
          toast('تم تحديث بيانات العضو');
        } else {
          if (values.password.length < 8) throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
          await callFunction('manage-member', { action: 'create', ...values });
          toast('تم إنشاء الحساب. أرسل البريد وكلمة المرور للعضو');
        }
        onSaved();
      }}>
        <div className="form-grid">
          <Field label="الاسم الكامل" required><input value={values.full_name} onChange={set('full_name')} required /></Field>
          <Field label="الدور" required hint={ROLE_HELP[values.role]}>
            {member?.role === 'owner' ? <input value={ROLES.owner} disabled /> : (
              <Select value={values.role} onChange={set('role')} options={['admin', 'lawyer', 'accountant', 'secretary'].map((r) => ({ value: r, label: ROLES[r] }))} />
            )}
          </Field>
          <Field label="البريد الإلكتروني (لتسجيل الدخول)" required hint={member ? 'عند تغييره يسجّل العضو دخوله بالبريد الجديد' : undefined}><input type="email" value={values.email} onChange={set('email')} required dir="ltr" /></Field>
          {!member && <Field label="كلمة مرور مؤقتة" required hint="8 أحرف على الأقل، يمكن للعضو تغييرها لاحقاً"><input value={values.password} onChange={set('password')} required dir="ltr" minLength={8} /></Field>}
          <Field label="الهاتف"><input value={values.phone} onChange={set('phone')} dir="ltr" /></Field>
          <Field label="المسمى الوظيفي"><input value={values.title} onChange={set('title')} placeholder="مثال: محامٍ متدرب" /></Field>
        </div>
      </FormShell>
    </Modal>
  );
}

function TeamTab() {
  const { members, can, user, reload } = useAuth();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const manage = can('manageOffice');
  return (
    <>
      {manage && <div className="toolbar"><button className="btn btn-primary btn-sm" onClick={() => setModal({ new: true })}><Plus size={15} />إضافة عضو</button>
        <span className="small muted">ينشئ المدير حسابات الفريق مباشرة ويعطيهم بيانات الدخول</span></div>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>العضو</th><th>الدور</th><th className="hide-sm">البريد</th><th className="hide-sm">منذ</th><th>الحالة</th>{manage && <th></th>}</tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id}>
                <td><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><div className="avatar sm">{initials(m.full_name)}</div><div><div className="t-main">{m.full_name}{m.user_id === user.id && ' (أنت)'}</div><div className="t-sub">{m.title || m.phone}</div></div></div></td>
                <td><Badge tone={m.role === 'owner' ? 'b-gold' : 'b-blue'} plain>{ROLES[m.role]}</Badge></td>
                <td className="hide-sm small num">{m.email}</td>
                <td className="hide-sm small">{date(m.created_at)}</td>
                <td>{m.active ? <Badge tone="b-green">فعّال</Badge> : <Badge tone="b-gray">موقوف</Badge>}</td>
                {manage && (
                  <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                    {m.role !== 'owner' && m.user_id !== user.id && (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => setModal({ edit: m })}>تعديل</button>
                        <button className="btn btn-ghost btn-sm btn-icon" title="إعادة تعيين كلمة المرور" aria-label="إعادة تعيين كلمة المرور" onClick={() => setModal({ reset: m })}><KeyRound size={14} /></button>
                        <button className="btn btn-ghost btn-sm btn-icon" title={m.active ? 'إيقاف الحساب' : 'تفعيل الحساب'} aria-label="تفعيل أو إيقاف" onClick={() => setModal({ toggle: m })}><Power size={14} /></button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-body small muted"><ShieldCheck size={14} /> الأدوار: {Object.entries(ROLE_HELP).map(([k, v]) => `${ROLES[k]}: ${v}`).join(' — ')}</div>
      {(modal?.new || modal?.edit) && <MemberModal member={modal.edit} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
      {modal?.reset && <ResetPassword member={modal.reset} onClose={() => setModal(null)} />}
      {modal?.toggle && (
        <Confirm title={modal.toggle.active ? 'إيقاف الحساب' : 'تفعيل الحساب'} danger={modal.toggle.active} confirmText={modal.toggle.active ? 'إيقاف' : 'تفعيل'}
          message={modal.toggle.active ? `لن يتمكن ${modal.toggle.full_name} من الدخول إلى النظام. تبقى بياناته وسجلاته محفوظة.` : `سيتمكن ${modal.toggle.full_name} من الدخول مجدداً.`}
          onClose={() => setModal(null)} onConfirm={async () => {
            await callFunction('manage-member', { action: 'set_active', user_id: modal.toggle.user_id, active: !modal.toggle.active });
            toast('تم التحديث'); reload();
          }} />
      )}
    </>
  );
}

function ResetPassword({ member, onClose }) {
  const toast = useToast();
  const [pw, setPw] = useState('');
  return (
    <Modal title={`كلمة مرور جديدة لـ ${member.full_name}`} onClose={onClose} size="sm">
      <FormShell onCancel={onClose} submitText="تعيين" onSubmit={async () => {
        if (pw.length < 8) throw new Error('8 أحرف على الأقل');
        await callFunction('manage-member', { action: 'reset_password', user_id: member.user_id, password: pw });
        toast('تم تعيين كلمة المرور الجديدة'); onClose();
      }}>
        <Field label="كلمة المرور الجديدة" required><input value={pw} onChange={(e) => setPw(e.target.value)} dir="ltr" minLength={8} required autoFocus /></Field>
      </FormShell>
    </Modal>
  );
}

function AccountTab() {
  const { member, user, reload } = useAuth();
  const toast = useToast();
  const { values, set } = useForm({ full_name: member.full_name || '', phone: member.phone || '', title: member.title || '' });
  const [pw, setPw] = useState({ a: '', b: '' });
  const [em, setEm] = useState({ email: '', password: '' });
  return (
    <div className="card-body">
      <PushCard />
      <div className="grid cols-2">
        <div>
          <h4 style={{ marginBottom: 12 }}>بياناتي</h4>
          <FormShell submitText="حفظ" onSubmit={async () => {
            must(await supabase.rpc('update_my_profile', { p_full_name: values.full_name, p_phone: values.phone, p_title: values.title }));
            toast('تم حفظ بياناتك'); reload();
          }}>
            <div className="stack" style={{ gap: 12 }}>
              <Field label="الاسم الكامل"><input value={values.full_name} onChange={set('full_name')} required /></Field>
              <Field label="الهاتف"><input value={values.phone} onChange={set('phone')} dir="ltr" /></Field>
              <Field label="المسمى الوظيفي"><input value={values.title} onChange={set('title')} /></Field>
              <Field label="البريد الإلكتروني"><input value={user.email} disabled dir="ltr" /></Field>
            </div>
          </FormShell>
        </div>
        <div>
          <h4 style={{ marginBottom: 12 }}>تغيير كلمة المرور</h4>
          <FormShell submitText="تغيير كلمة المرور" onSubmit={async () => {
            if (pw.a.length < 8) throw new Error('8 أحرف على الأقل');
            if (pw.a !== pw.b) throw new Error('كلمتا المرور غير متطابقتين');
            const { error } = await supabase.auth.updateUser({ password: pw.a });
            if (error) throw error;
            setPw({ a: '', b: '' }); toast('تم تغيير كلمة المرور');
          }}>
            <div className="stack" style={{ gap: 12 }}>
              <Field label="كلمة المرور الجديدة"><input type="password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} dir="ltr" autoComplete="new-password" /></Field>
              <Field label="تأكيد كلمة المرور"><input type="password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} dir="ltr" autoComplete="new-password" /></Field>
            </div>
          </FormShell>
          <h4 style={{ margin: '28px 0 12px' }}>تغيير البريد الإلكتروني</h4>
          <FormShell submitText="تغيير البريد" onSubmit={async () => {
            await callFunction('account', { action: 'change_email', new_email: em.email, password: em.password });
            setEm({ email: '', password: '' });
            await supabase.auth.refreshSession();
            toast('تم تغيير البريد. استخدم البريد الجديد عند تسجيل الدخول'); reload();
          }}>
            <div className="stack" style={{ gap: 12 }}>
              <Field label="البريد الجديد" required><input type="email" value={em.email} onChange={(e) => setEm({ ...em, email: e.target.value })} dir="ltr" required /></Field>
              <Field label="كلمة المرور الحالية (للتأكيد)" required><input type="password" value={em.password} onChange={(e) => setEm({ ...em, password: e.target.value })} dir="ltr" required autoComplete="current-password" /></Field>
            </div>
          </FormShell>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState('office');
  return (
    <>
      <PageHead title="الإعدادات" sub="بيانات المكتب، فريق العمل، وحسابك الشخصي" />
      <div className="card">
        <Tabs active={tab} onChange={setTab} tabs={[
          { key: 'office', label: 'بيانات المكتب', icon: Building2 }, { key: 'team', label: 'فريق العمل', icon: Users }, { key: 'account', label: 'حسابي', icon: UserCog },
        ]} />
        {tab === 'office' && <OfficeTab />}
        {tab === 'team' && <TeamTab />}
        {tab === 'account' && <AccountTab />}
      </div>
    </>
  );
}
