import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Users, Plus, Search, Phone, Pencil, Trash2, Briefcase, FileSignature, FolderOpen, Download, Mail, MapPin, Archive } from 'lucide-react';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { money, date, exportCsv, today } from '../lib/format';
import { CASE_STATUS, CASE_TYPES, POA_TYPES, label } from '../lib/labels';
import { PageHead } from '../components/Layout';
import { useAsync, Async, Empty, Pager, StatusBadge, Badge, Confirm, Tabs, useDebounced, useToast, Progress, safeLike } from '../components/ui';
import { ClientForm, CaseForm, PoaForm, DocumentForm } from '../components/forms';
import { DocumentList } from './Documents';

const PAGE = 25;

export function ClientList() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [archived, setArchived] = useState(false);
  const [modal, setModal] = useState(false);
  const dq = useDebounced(q.trim());

  const state = useAsync(async () => {
    let query = supabase.from('client_overview').select('*', { count: 'exact' }).eq('archived', archived)
      .order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (dq) { const s = safeLike(dq); query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,national_id.ilike.%${s}%`); }
    return must(await query);
  }, [dq, page, archived]);

  const doExport = async () => {
    const rows = must(await supabase.from('client_overview').select('*').order('name'));
    exportCsv(`الموكلون-${today()}.csv`, [
      { label: 'الرقم', value: (r) => r.client_no }, { label: 'الاسم', value: (r) => r.name }, { label: 'الهاتف', value: (r) => r.phone },
      { label: 'البطاقة الوطنية', value: (r) => r.national_id }, { label: 'العنوان', value: (r) => r.address },
      { label: 'عدد القضايا', value: (r) => r.cases_count }, { label: 'القضايا النشطة', value: (r) => r.active_cases },
    ], rows);
  };

  return (
    <>
      <PageHead title="الموكلون" sub="سجل موكلي المكتب وملفاتهم">
        <button className="btn btn-ghost" onClick={doExport}><Download size={17} />تصدير Excel</button>
        {can('editCore') && <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={18} />موكل جديد</button>}
      </PageHead>
      <div className="card">
        <div className="toolbar">
          <div className="search-box">
            <Search size={17} className="icon" />
            <input placeholder="بحث بالاسم أو الهاتف أو رقم البطاقة" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          </div>
          <label className="check"><input type="checkbox" checked={archived} onChange={(e) => { setArchived(e.target.checked); setPage(0); }} />عرض المؤرشفين</label>
        </div>
        <Async state={state} empty={<Empty icon={Users} title={dq ? 'لا توجد نتائج' : 'لا يوجد موكلون بعد'} text={dq ? '' : 'أضف أول موكل للبدء'}
          action={!dq && can('editCore') && <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={17} />إضافة موكل</button>} />}>
          {({ data, count }) => (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>#</th><th>الموكل</th><th>الهاتف</th><th className="hide-sm">القضايا</th><th className="hide-sm">الأتعاب / المحصّل</th><th className="hide-sm">تاريخ الإضافة</th></tr></thead>
                  <tbody>
                    {data.map((c) => (
                      <tr key={c.id} className="clickable" onClick={() => nav(`/clients/${c.id}`)}>
                        <td className="muted">{c.client_no}</td>
                        <td><div className="t-main">{c.name}</div><div className="t-sub">{c.kind === 'company' ? 'شركة / جهة' : c.occupation || ''}</div></td>
                        <td><span className="num">{c.phone}</span></td>
                        <td className="hide-sm">{c.cases_count} {c.active_cases > 0 && <Badge tone="b-green" plain>{c.active_cases} نشطة</Badge>}</td>
                        <td className="hide-sm small">{money(c.total_fees)} / <span style={{ color: 'var(--success)' }}>{money(c.paid_total)}</span></td>
                        <td className="hide-sm muted small">{date(c.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={page} pageSize={PAGE} total={count} onPage={setPage} />
            </>
          )}
        </Async>
      </div>
      {modal && <ClientForm onClose={() => setModal(false)} onSaved={(c) => nav(`/clients/${c.id}`)} />}
    </>
  );
}

export function ClientDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState('cases');
  const [modal, setModal] = useState(null);

  const state = useAsync(async () => {
    const [client, cases, poas] = await Promise.all([
      supabase.from('client_overview').select('*').eq('id', id).single().then(must),
      supabase.from('case_overview').select('*').eq('client_id', id).order('created_at', { ascending: false }).then(must),
      supabase.from('powers_of_attorney').select('*').eq('client_id', id).order('expiry_date', { nullsFirst: false }).then(must),
    ]);
    return { client, cases, poas };
  }, [id]);

  const close = (reload) => () => { setModal(null); if (reload) state.reload(); };

  return (
    <Async state={state}>
      {({ client: c, cases, poas }) => (
        <>
          <PageHead title={c.name} crumbs={[{ label: 'الموكلون', to: '/clients' }, { label: `موكل رقم ${c.client_no}` }]}>
            {can('editCore') && <button className="btn btn-primary" onClick={() => setModal('case')}><Plus size={17} />قضية لهذا الموكل</button>}
            {can('editCore') && <button className="btn btn-ghost" onClick={() => setModal('edit')}><Pencil size={16} />تعديل</button>}
            {can('editCore') && (
              <button className="btn btn-ghost" onClick={async () => {
                must(await supabase.from('clients').update({ archived: !c.archived }).eq('id', c.id));
                toast(c.archived ? 'أُعيد الموكل للقائمة' : 'تمت أرشفة الموكل'); state.reload();
              }}><Archive size={16} />{c.archived ? 'إلغاء الأرشفة' : 'أرشفة'}</button>
            )}
            {can('deleteCore') && <button className="btn btn-soft-danger btn-icon" title="حذف" aria-label="حذف" onClick={() => setModal('delete')}><Trash2 size={16} /></button>}
          </PageHead>

          <div className="grid main-side">
            <div className="card">
              <Tabs active={tab} onChange={setTab} tabs={[
                { key: 'cases', label: 'القضايا', icon: Briefcase, count: cases.length },
                { key: 'poa', label: 'الوكالات', icon: FileSignature, count: poas.length },
                { key: 'docs', label: 'المستندات', icon: FolderOpen },
              ]} />
              {tab === 'cases' && (cases.length === 0 ? <Empty icon={Briefcase} title="لا توجد قضايا لهذا الموكل" /> : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>الملف</th><th>القضية</th><th>الحالة</th><th className="hide-sm">الأتعاب</th><th className="hide-sm">الجلسة القادمة</th></tr></thead>
                    <tbody>
                      {cases.map((k) => (
                        <tr key={k.id} className="clickable" onClick={() => nav(`/cases/${k.id}`)}>
                          <td className="muted">#{k.file_no}</td>
                          <td><div className="t-main">{k.title}</div><div className="t-sub">{label(CASE_TYPES, k.case_type)}{k.case_number ? ` · ${k.case_number}` : ''}</div></td>
                          <td><StatusBadge map={CASE_STATUS} value={k.status} /></td>
                          <td className="hide-sm" style={{ minWidth: 140 }}>
                            <div className="small">{money(k.paid_total, k.currency)} / {money(k.total_fees, k.currency)}</div>
                            <Progress value={k.paid_percent} green={k.paid_percent >= 100} />
                          </td>
                          <td className="hide-sm small">{k.next_hearing ? date(k.next_hearing) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {tab === 'poa' && (
                <>
                  {can('editCore') && <div className="toolbar"><button className="btn btn-ghost btn-sm" onClick={() => setModal('poa')}><Plus size={15} />تسجيل وكالة</button></div>}
                  {poas.length === 0 ? <Empty icon={FileSignature} title="لا توجد وكالات مسجلة" /> : poas.map((p) => <PoaRow key={p.id} p={p} onEdit={() => setModal({ poa: p })} />)}
                </>
              )}
              {tab === 'docs' && <DocumentList clientId={c.id} />}
            </div>

            <div className="stack">
              <div className="card">
                <div className="card-head"><h3><Users size={18} />بيانات الموكل</h3>{c.archived && <Badge tone="b-gray">مؤرشف</Badge>}</div>
                <div className="card-body">
                  <dl className="kv">
                    <dt>الهاتف</dt><dd><a href={`tel:${c.phone}`} className="num link"><Phone size={13} /> {c.phone}</a>{c.phone2 && <div className="num small">{c.phone2}</div>}</dd>
                    {c.national_id && <><dt>{c.kind === 'company' ? 'رقم التسجيل' : 'البطاقة الوطنية'}</dt><dd className="num">{c.national_id}</dd></>}
                    {c.email && <><dt>البريد</dt><dd><a className="link" href={`mailto:${c.email}`}><Mail size={13} /> {c.email}</a></dd></>}
                    {c.address && <><dt>العنوان</dt><dd><MapPin size={13} /> {c.address}</dd></>}
                    {c.occupation && <><dt>المهنة</dt><dd>{c.occupation}</dd></>}
                    {c.referred_by && <><dt>جهة التعريف</dt><dd>{c.referred_by}</dd></>}
                    <dt>تاريخ الإضافة</dt><dd>{date(c.created_at)}</dd>
                  </dl>
                  {c.notes && <><div className="divider" /><div className="small" style={{ whiteSpace: 'pre-wrap' }}>{c.notes}</div></>}
                  {c.phone && (
                    <a className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} target="_blank" rel="noreferrer"
                      href={`https://wa.me/${c.phone.replace(/\D/g, '').replace(/^0/, '964')}`}>مراسلة عبر واتساب</a>
                  )}
                </div>
              </div>
              {can('viewFinance') && (
                <div className="card">
                  <div className="card-head"><h3>الملخص المالي</h3></div>
                  <div className="card-body">
                    <dl className="kv">
                      <dt>إجمالي الأتعاب</dt><dd>{money(c.total_fees)}</dd>
                      <dt>المحصّل</dt><dd style={{ color: 'var(--success)' }}>{money(c.paid_total)}</dd>
                      <dt>المتبقي</dt><dd style={{ color: 'var(--danger)' }}>{money(Math.max(0, c.total_fees - c.paid_total))}</dd>
                    </dl>
                    {cases.some((k) => k.currency === 'USD') && <div className="small muted" style={{ marginTop: 8 }}>يشمل قضايا بالدولار؛ راجع كل قضية للتفاصيل.</div>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {modal === 'edit' && <ClientForm client={c} onClose={close()} onSaved={close(true)} />}
          {modal === 'case' && <CaseForm clientId={c.id} onClose={close()} onSaved={(k) => nav(`/cases/${k.id}`)} />}
          {modal === 'poa' && <PoaForm clientId={c.id} onClose={close()} onSaved={close(true)} />}
          {modal?.poa && <PoaForm poa={modal.poa} clientId={c.id} onClose={close()} onSaved={close(true)} />}
          {modal === 'doc' && <DocumentForm clientId={c.id} onClose={close()} onSaved={close(true)} />}
          {modal === 'delete' && (
            <Confirm title="حذف الموكل" confirmText="حذف نهائي"
              message={cases.length ? 'لا يمكن حذف موكل لديه قضايا. أرشِف الموكل بدلاً من ذلك.' : `سيتم حذف "${c.name}" ووكالاته ومستنداته نهائياً. هل أنت متأكد؟`}
              onClose={close()}
              onConfirm={async () => {
                if (cases.length) throw new Error('لا يمكن حذف موكل لديه قضايا');
                must(await supabase.from('clients').delete().eq('id', c.id));
                toast('تم حذف الموكل'); nav('/clients');
              }} />
          )}
        </>
      )}
    </Async>
  );
}

export function PoaRow({ p, onEdit, showClient }) {
  const t = today();
  const expired = p.expiry_date && p.expiry_date < t;
  const soon = p.expiry_date && !expired && p.expiry_date <= new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  return (
    <div className="list-item">
      <FileSignature size={20} color="var(--accent)" />
      <div className="grow">
        <div className="title">{label(POA_TYPES, p.poa_type)}{p.poa_number ? ` رقم ${p.poa_number}` : ''}{showClient && <> — <Link className="link" to={`/clients/${p.client_id}`}>{p.client_name}</Link></>}</div>
        <div className="small muted">{p.issuer || 'جهة الإصدار غير محددة'} · صدرت {date(p.issue_date)}</div>
      </div>
      <div style={{ textAlign: 'left' }}>
        {p.expiry_date ? <Badge tone={expired ? 'b-red' : soon ? 'b-amber' : 'b-green'}>{expired ? 'منتهية' : soon ? 'تنتهي قريباً' : 'سارية'}</Badge> : <Badge tone="b-blue">غير محددة المدة</Badge>}
        {p.expiry_date && <div className="small muted">حتى {date(p.expiry_date)}</div>}
      </div>
      {onEdit && <button className="btn btn-ghost btn-sm btn-icon" onClick={onEdit} aria-label="تعديل"><Pencil size={14} /></button>}
    </div>
  );
}
