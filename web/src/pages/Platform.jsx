import { useState } from 'react';
import { ShieldCheck, Building2, Users, Briefcase, FolderOpen, Search, KeyRound, Power, Mail, RefreshCw } from 'lucide-react';
import { callFunction } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ROLES } from '../lib/labels';
import { date, dateTime, number } from '../lib/format';
import { PageHead } from '../components/Layout';
import { useAsync, Async, Stat, Tabs, Badge, Empty, Modal, Field, FormShell, Confirm, useToast } from '../components/ui';

function UserModal({ user, kind, onClose, onDone }) {
  const toast = useToast();
  const [value, setValue] = useState(kind === 'email' ? user.email || '' : '');
  return (
    <Modal title={kind === 'email' ? `تغيير بريد ${user.full_name}` : `كلمة مرور جديدة لـ ${user.full_name}`} onClose={onClose} size="sm">
      <FormShell onCancel={onClose} submitText="حفظ" onSubmit={async () => {
        if (kind === 'email') await callFunction('platform-admin', { action: 'update_email', user_id: user.user_id, email: value });
        else {
          if (value.length < 8) throw new Error('8 أحرف على الأقل');
          await callFunction('platform-admin', { action: 'reset_password', user_id: user.user_id, password: value });
        }
        toast(kind === 'email' ? 'تم تغيير البريد' : 'تم تعيين كلمة المرور الجديدة');
        onDone();
      }}>
        <Field label={kind === 'email' ? 'البريد الجديد' : 'كلمة المرور الجديدة'} required hint={kind === 'email' ? undefined : 'أبلغ صاحب الحساب بها، ويمكنه تغييرها من صفحة "حسابي"'}>
          <input type={kind === 'email' ? 'email' : 'text'} value={value} onChange={(e) => setValue(e.target.value)} dir="ltr" required autoFocus minLength={kind === 'email' ? undefined : 8} />
        </Field>
      </FormShell>
    </Modal>
  );
}

export default function PlatformPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('offices');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const state = useAsync(() => callFunction('platform-admin', { action: 'overview' }), []);
  const done = () => { setModal(null); state.reload(); };
  const match = (...fields) => !q.trim() || fields.some((f) => String(f || '').toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <PageHead title="لوحة المشرف العام" sub="كل المكاتب والحسابات المسجلة في المنصة — هذه الصفحة تظهر لك وحدك">
        <button className="btn btn-ghost" onClick={state.reload}><RefreshCw size={16} />تحديث</button>
      </PageHead>
      <Async state={state}>
        {(d) => (
          <>
            <div className="grid cols-4" style={{ marginBottom: 18 }}>
              <Stat icon={Building2} label="المكاتب" value={number(d.totals.offices)} />
              <Stat icon={Users} tone="tone-gold" label="المستخدمون" value={number(d.totals.users)} />
              <Stat icon={Briefcase} tone="tone-green" label="القضايا" value={number(d.totals.cases)} sub={`${number(d.totals.clients)} موكل`} />
              <Stat icon={FolderOpen} tone="tone-amber" label="المستندات" value={number(d.totals.documents)} />
            </div>
            <div className="card">
              <Tabs active={tab} onChange={setTab} tabs={[
                { key: 'offices', label: 'المكاتب', icon: Building2, count: d.offices.length },
                { key: 'users', label: 'الحسابات', icon: Users, count: d.users.length },
              ]} />
              <div className="toolbar">
                <div className="search-box"><Search size={17} className="icon" /><input placeholder="بحث بالاسم أو البريد" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              </div>
              {tab === 'offices' && (d.offices.length === 0 ? <Empty title="لا توجد مكاتب" /> : (
                <div className="table-wrap"><table className="table">
                  <thead><tr><th>المكتب</th><th>المالك</th><th className="hide-sm">الأعضاء</th><th className="hide-sm">الموكلون / القضايا</th><th className="hide-sm">آخر نشاط</th><th>الحالة</th><th></th></tr></thead>
                  <tbody>{d.offices.filter((o) => match(o.name, o.owner_name, o.owner_email, o.phone)).map((o) => (
                    <tr key={o.id}>
                      <td><div className="t-main">{o.name}</div><div className="t-sub">{o.city} · سُجّل {date(o.created_at)}</div></td>
                      <td><div>{o.owner_name}</div><div className="t-sub num">{o.owner_email}</div></td>
                      <td className="hide-sm">{o.members}</td>
                      <td className="hide-sm">{o.clients} / {o.cases}</td>
                      <td className="hide-sm small">{o.last_activity ? dateTime(o.last_activity) : '—'}</td>
                      <td>{o.active ? <Badge tone="b-green">فعّال</Badge> : <Badge tone="b-red">موقوف</Badge>}</td>
                      <td style={{ textAlign: 'left' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setModal({ office: o })}><Power size={14} />{o.active ? 'إيقاف' : 'تفعيل'}</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table></div>
              ))}
              {tab === 'users' && (
                <div className="table-wrap"><table className="table">
                  <thead><tr><th>الاسم</th><th>البريد</th><th className="hide-sm">المكتب / الدور</th><th className="hide-sm">آخر دخول</th><th>الحالة</th><th></th></tr></thead>
                  <tbody>{d.users.filter((u) => match(u.full_name, u.email, u.office_name)).map((u) => (
                    <tr key={u.user_id}>
                      <td><div className="t-main">{u.full_name}{u.is_platform_admin && <> <Badge tone="b-gold" plain><ShieldCheck size={11} /> مشرف عام</Badge></>}</div></td>
                      <td className="small num">{u.email}</td>
                      <td className="hide-sm"><div>{u.office_name}</div><div className="t-sub">{ROLES[u.role]}</div></td>
                      <td className="hide-sm small">{u.last_sign_in_at ? dateTime(u.last_sign_in_at) : 'لم يدخل بعد'}</td>
                      <td>{u.active ? <Badge tone="b-green">فعّال</Badge> : <Badge tone="b-red">موقوف</Badge>}</td>
                      <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                        <button className="btn btn-ghost btn-sm btn-icon" title="تغيير البريد" aria-label="تغيير البريد" onClick={() => setModal({ user: u, kind: 'email' })}><Mail size={14} /></button>
                        <button className="btn btn-ghost btn-sm btn-icon" title="كلمة مرور جديدة" aria-label="كلمة مرور جديدة" onClick={() => setModal({ user: u, kind: 'password' })}><KeyRound size={14} /></button>
                        {u.user_id !== me.id && <button className="btn btn-ghost btn-sm btn-icon" title={u.active ? 'إيقاف' : 'تفعيل'} aria-label="إيقاف أو تفعيل" onClick={() => setModal({ toggleUser: u })}><Power size={14} /></button>}
                      </td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
            </div>
          </>
        )}
      </Async>
      {modal?.user && <UserModal user={modal.user} kind={modal.kind} onClose={() => setModal(null)} onDone={done} />}
      {modal?.office && (
        <Confirm title={modal.office.active ? 'إيقاف المكتب' : 'تفعيل المكتب'} danger={modal.office.active} confirmText={modal.office.active ? 'إيقاف' : 'تفعيل'}
          message={modal.office.active ? `لن يتمكن أي عضو في "${modal.office.name}" من الدخول. البيانات تبقى محفوظة ويمكن إعادة التفعيل في أي وقت.` : `سيعود أعضاء "${modal.office.name}" للدخول بشكل طبيعي.`}
          onClose={() => setModal(null)} onConfirm={async () => {
            await callFunction('platform-admin', { action: 'set_office_active', office_id: modal.office.id, active: !modal.office.active });
            toast('تم التحديث'); state.reload();
          }} />
      )}
      {modal?.toggleUser && (
        <Confirm title={modal.toggleUser.active ? 'إيقاف الحساب' : 'تفعيل الحساب'} danger={modal.toggleUser.active} confirmText={modal.toggleUser.active ? 'إيقاف' : 'تفعيل'}
          message={modal.toggleUser.active ? `لن يتمكن ${modal.toggleUser.full_name} من الدخول.` : `سيتمكن ${modal.toggleUser.full_name} من الدخول مجدداً.`}
          onClose={() => setModal(null)} onConfirm={async () => {
            await callFunction('platform-admin', { action: 'set_user_active', user_id: modal.toggleUser.user_id, active: !modal.toggleUser.active });
            toast('تم التحديث'); state.reload();
          }} />
      )}
    </>
  );
}
