import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Briefcase, Plus, Search, Pencil, Trash2, Gavel, ListChecks, Wallet, FolderOpen, History, Printer, CheckCircle2,
  Download, Receipt, CalendarPlus, Scale, User, BellRing,
} from 'lucide-react';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { money, date, time, today, exportCsv, timeAgo, relativeDay, reminderText } from '../lib/format';
import {
  CASE_STATUS, CASE_TYPES, COURT_LEVELS, CLIENT_CAPACITY, PRIORITY, FEE_TYPES, HEARING_STATUS, TASK_STATUS, TASK_TYPES,
  PAYMENT_METHODS, EXPENSE_CATEGORIES, label, opts,
} from '../lib/labels';
import { PageHead } from '../components/Layout';
import {
  useAsync, Async, Empty, Pager, StatusBadge, Badge, Confirm, Tabs, useDebounced, useToast, Progress, Select, safeLike,
} from '../components/ui';
import { CaseForm, HearingForm, TaskForm, PaymentForm, ExpenseForm } from '../components/forms';
import { DocumentList } from './Documents';
import { ACT, ENT } from './Dashboard';

const PAGE = 25;

export function CaseList() {
  const { can, lawyers, user, role } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('open');
  const [type, setType] = useState('');
  const [lawyer, setLawyer] = useState(role === 'lawyer' ? user.id : '');
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState(false);
  const dq = useDebounced(q.trim());

  const build = (query) => {
    if (status === 'open') query = query.in('status', ['preparing', 'active', 'suspended']);
    else if (status === 'done') query = query.in('status', ['won', 'lost', 'settled', 'closed', 'archived']);
    else if (status) query = query.eq('status', status);
    if (type) query = query.eq('case_type', type);
    if (lawyer) query = query.eq('assigned_to', lawyer);
    if (dq) {
      const s = safeLike(dq);
      query = query.or(`title.ilike.%${s}%,case_number.ilike.%${s}%,client_name.ilike.%${s}%,opponent_name.ilike.%${s}%,court.ilike.%${s}%`);
    }
    return query;
  };

  const state = useAsync(async () => must(await build(supabase.from('case_overview').select('*', { count: 'exact' }))
    .order('updated_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)), [dq, status, type, lawyer, page]);

  const doExport = async () => {
    const rows = must(await build(supabase.from('case_overview').select('*')).order('file_no'));
    exportCsv(`القضايا-${today()}.csv`, [
      { label: 'رقم الملف', value: (r) => r.file_no }, { label: 'الموضوع', value: (r) => r.title }, { label: 'الموكل', value: (r) => r.client_name },
      { label: 'رقم الدعوى', value: (r) => r.case_number }, { label: 'النوع', value: (r) => label(CASE_TYPES, r.case_type) },
      { label: 'المحكمة', value: (r) => r.court }, { label: 'الخصم', value: (r) => r.opponent_name }, { label: 'الحالة', value: (r) => label(CASE_STATUS, r.status) },
      { label: 'المحامي', value: (r) => r.assigned_name }, { label: 'الجلسة القادمة', value: (r) => r.next_hearing },
      ...(can('viewFinance') ? [{ label: 'الأتعاب', value: (r) => r.total_fees }, { label: 'المحصّل', value: (r) => r.paid_total }, { label: 'المتبقي', value: (r) => r.remaining_fees }, { label: 'العملة', value: (r) => r.currency }] : []),
    ], rows);
  };

  const filters = (
    <div className="toolbar">
      <div className="search-box">
        <Search size={17} className="icon" />
        <input placeholder="الموضوع، رقم الدعوى، الموكل، الخصم، المحكمة" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      </div>
      <Select value={status} onChange={(v) => { setStatus(v); setPage(0); }} options={[{ value: 'open', label: 'المنظورة' }, { value: 'done', label: 'المنتهية' }, ...opts(CASE_STATUS)]} placeholder="كل الحالات" aria-label="الحالة" />
      <Select value={type} onChange={(v) => { setType(v); setPage(0); }} options={opts(CASE_TYPES)} placeholder="كل الأنواع" aria-label="النوع" />
      <Select value={lawyer} onChange={(v) => { setLawyer(v); setPage(0); }} options={lawyers.map((m) => ({ value: m.user_id, label: m.full_name }))} placeholder="كل المحامين" aria-label="المحامي" />
    </div>
  );

  return (
    <>
      <PageHead title="القضايا" sub="ملفات الدعاوى ومتابعتها">
        <button className="btn btn-ghost" onClick={doExport}><Download size={17} />تصدير Excel</button>
        {can('editCore') && <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={18} />قضية جديدة</button>}
      </PageHead>
      <div className="card">
        {filters}
        <Async state={state} empty={<Empty icon={Briefcase} title="لا توجد قضايا مطابقة" action={can('editCore') && !dq && <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={17} />فتح ملف قضية</button>} />}>
          {({ data, count }) => (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>الملف</th><th>القضية</th><th className="hide-sm">المحكمة</th><th>الحالة</th><th className="hide-sm">الجلسة القادمة</th>
                      {can('viewFinance') && <th className="hide-sm">الأتعاب</th>}<th className="hide-sm">المحامي</th></tr>
                  </thead>
                  <tbody>
                    {data.map((c) => (
                      <tr key={c.id} className="clickable" onClick={() => nav(`/cases/${c.id}`)}>
                        <td className="muted">#{c.file_no}</td>
                        <td>
                          <div className="t-main">{c.title} {c.priority === 'urgent' && <Badge tone="b-red" plain>عاجلة</Badge>}</div>
                          <div className="t-sub">{c.client_name}{c.opponent_name ? ` ضد ${c.opponent_name}` : ''}</div>
                        </td>
                        <td className="hide-sm"><div>{c.court || '—'}</div><div className="t-sub">{c.case_number}</div></td>
                        <td><StatusBadge map={CASE_STATUS} value={c.status} />{c.overdue_tasks > 0 && <div className="t-sub" style={{ color: 'var(--danger)' }}>{c.overdue_tasks} مهام متأخرة</div>}</td>
                        <td className="hide-sm small">{c.next_hearing ? <><div>{date(c.next_hearing)}</div><div className="t-sub">{relativeDay(c.next_hearing)}</div></> : '—'}</td>
                        {can('viewFinance') && (
                          <td className="hide-sm" style={{ minWidth: 150 }}>
                            <div className="small">{money(c.paid_total, c.currency)} / {money(c.total_fees, c.currency)}</div>
                            <Progress value={c.paid_percent} green={c.paid_percent >= 100} />
                          </td>
                        )}
                        <td className="hide-sm small">{c.assigned_name || '—'}</td>
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
      {modal && <CaseForm onClose={() => setModal(false)} onSaved={(c) => nav(`/cases/${c.id}`)} />}
    </>
  );
}

export function CaseDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState('hearings');
  const [modal, setModal] = useState(null);

  const state = useAsync(async () => {
    const [c, hearings, tasks, payments, expenses, activity] = await Promise.all([
      supabase.from('case_overview').select('*').eq('id', id).single().then(must),
      supabase.from('hearings').select('*').eq('case_id', id).order('hearing_date', { ascending: false }).then(must),
      supabase.from('task_board').select('*').eq('case_id', id).order('status').order('due_date').then(must),
      can('viewFinance') ? supabase.from('payments').select('*').eq('case_id', id).order('payment_date', { ascending: false }).then(must) : [],
      can('viewFinance') ? supabase.from('expenses').select('*').eq('case_id', id).order('expense_date', { ascending: false }).then(must) : [],
      supabase.from('activity_feed').select('*').eq('case_id', id).order('created_at', { ascending: false }).limit(40).then(must),
    ]);
    return { c, hearings, tasks, payments, expenses, activity };
  }, [id]);

  const close = (reload) => () => { setModal(null); if (reload) state.reload(); };
  const t = today();

  return (
    <Async state={state}>
      {({ c, hearings, tasks, payments, expenses, activity }) => {
        const upcoming = hearings.filter((h) => h.status === 'scheduled').sort((a, b) => a.hearing_date.localeCompare(b.hearing_date));
        const openTasks = tasks.filter((k) => ['pending', 'in_progress'].includes(k.status));
        return (
          <>
            <PageHead
              title={c.title}
              crumbs={[{ label: 'القضايا', to: '/cases' }, { label: `ملف رقم ${c.file_no}` }]}
              sub={<><StatusBadge map={CASE_STATUS} value={c.status} /> <Badge tone={PRIORITY[c.priority]?.tone} plain>أولوية {PRIORITY[c.priority]?.label}</Badge> <span className="muted small">مفتوح منذ {date(c.opened_at)}</span></>}
            >
              {can('editCore') && <button className="btn btn-primary" onClick={() => setModal('hearing')}><CalendarPlus size={17} />جلسة</button>}
              <button className="btn btn-ghost" onClick={() => setModal('task')}><ListChecks size={16} />مهمة</button>
              {can('editFinance') && <button className="btn btn-ghost" onClick={() => setModal('payment')}><Receipt size={16} />سند قبض</button>}
              <button className="btn btn-ghost btn-icon" onClick={() => window.print()} title="طباعة ملخص القضية" aria-label="طباعة"><Printer size={16} /></button>
              {can('editCore') && <button className="btn btn-ghost" onClick={() => setModal('edit')}><Pencil size={16} />تعديل</button>}
              {can('deleteCore') && <button className="btn btn-soft-danger btn-icon" onClick={() => setModal('delete')} title="حذف" aria-label="حذف"><Trash2 size={16} /></button>}
            </PageHead>

            <div className="grid main-side">
              <div className="card" style={{ minWidth: 0 }}>
                <Tabs active={tab} onChange={setTab} tabs={[
                  { key: 'hearings', label: 'الجلسات', icon: Gavel, count: hearings.length },
                  { key: 'tasks', label: 'المهام', icon: ListChecks, count: openTasks.length },
                  ...(can('viewFinance') ? [{ key: 'finance', label: 'المالية', icon: Wallet }] : []),
                  { key: 'docs', label: 'المستندات', icon: FolderOpen },
                  { key: 'activity', label: 'السجل', icon: History },
                ]} />

                {tab === 'hearings' && (
                  hearings.length === 0 ? <Empty icon={Gavel} title="لم تُسجل أي جلسة بعد" action={can('editCore') && <button className="btn btn-primary btn-sm" onClick={() => setModal('hearing')}><Plus size={15} />إضافة أول جلسة</button>} /> : (
                    <div className="card-body">
                      <div className="timeline">
                        {hearings.map((h) => (
                          <div key={h.id} className={`tl-item ${h.status === 'done' ? 'done' : h.status === 'cancelled' ? 'cancel' : ''}`}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                              <b>{date(h.hearing_date, { withDay: true })}</b>
                              {h.hearing_time && <span className="muted small">{time(h.hearing_time)}</span>}
                              <StatusBadge map={HEARING_STATUS} value={h.status} />
                              {h.status === 'scheduled' && h.hearing_date < t && <Badge tone="b-red" plain>بحاجة لتحديث النتيجة</Badge>}
                              {can('editCore') && <button className="btn btn-ghost btn-sm" style={{ marginInlineStart: 'auto' }} onClick={() => setModal({ hearing: h })}>{h.status === 'scheduled' ? 'تسجيل النتيجة' : 'تعديل'}</button>}
                            </div>
                            <div className="small muted">{[h.court, h.room, h.purpose].filter(Boolean).join(' · ')}</div>
                            {h.result && <div style={{ marginTop: 6, background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 8, whiteSpace: 'pre-wrap' }}>{h.result}</div>}
                            {h.next_date && <div className="small" style={{ marginTop: 4 }}>الجلسة القادمة: <b>{date(h.next_date)}</b></div>}
                            {h.notes && <div className="small muted" style={{ marginTop: 4 }}>{h.notes}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}

                {tab === 'tasks' && <TaskTable tasks={tasks} onEdit={(k) => setModal({ task: k })} onChange={state.reload} hideCase />}

                {tab === 'finance' && (
                  <div className="card-body">
                    <div className="grid cols-3" style={{ marginBottom: 16 }}>
                      <div className="card stat"><div><div className="lbl">الأتعاب ({label(FEE_TYPES, c.fee_type)})</div><div className="val" style={{ fontSize: 20 }}>{money(c.total_fees, c.currency)}</div></div></div>
                      <div className="card stat"><div><div className="lbl">المحصّل</div><div className="val" style={{ fontSize: 20, color: 'var(--success)' }}>{money(c.paid_total, c.currency)}</div></div></div>
                      <div className="card stat"><div><div className="lbl">المتبقي</div><div className="val" style={{ fontSize: 20, color: 'var(--danger)' }}>{money(c.remaining_fees, c.currency)}</div></div></div>
                    </div>
                    <Progress value={c.paid_percent} green={c.paid_percent >= 100} />
                    <div className="small muted" style={{ margin: '6px 0 18px' }}>تم تحصيل {c.paid_percent}% من الأتعاب{c.billable_expenses > 0 && ` · مصاريف مستردة من الموكل: ${money(c.billable_expenses, c.currency)}`}</div>

                    <div className="card-head" style={{ padding: '10px 0' }}>
                      <h3><Receipt size={17} />سندات القبض</h3>
                      {can('editFinance') && <button className="btn btn-ghost btn-sm" onClick={() => setModal('payment')}><Plus size={15} />سند قبض</button>}
                    </div>
                    {payments.length === 0 ? <Empty title="لا توجد دفعات" /> : (
                      <div className="table-wrap"><table className="table">
                        <thead><tr><th>رقم السند</th><th>التاريخ</th><th>المبلغ</th><th className="hide-sm">الطريقة</th><th></th></tr></thead>
                        <tbody>{payments.map((p) => (
                          <tr key={p.id}>
                            <td>#{p.receipt_no}</td><td>{date(p.payment_date)}</td><td className="t-main" style={{ color: 'var(--success)' }}>{money(p.amount, p.currency)}</td>
                            <td className="hide-sm">{label(PAYMENT_METHODS, p.method)}</td>
                            <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                              <Link className="btn btn-ghost btn-sm btn-icon" to={`/receipt/${p.id}`} title="طباعة السند" aria-label="طباعة السند"><Printer size={14} /></Link>
                              {can('editFinance') && <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setModal({ payment: p })} aria-label="تعديل"><Pencil size={14} /></button>}
                              {can('deleteFinance') && <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setModal({ delPayment: p })} aria-label="حذف"><Trash2 size={14} /></button>}
                            </td>
                          </tr>
                        ))}</tbody>
                      </table></div>
                    )}

                    <div className="card-head" style={{ padding: '18px 0 10px' }}>
                      <h3><Wallet size={17} />المصاريف</h3>
                      {can('editFinance') && <button className="btn btn-ghost btn-sm" onClick={() => setModal('expense')}><Plus size={15} />مصروف</button>}
                    </div>
                    {expenses.length === 0 ? <Empty title="لا توجد مصاريف" /> : (
                      <div className="table-wrap"><table className="table">
                        <thead><tr><th>التاريخ</th><th>البند</th><th>المبلغ</th><th className="hide-sm">يُسترد</th><th></th></tr></thead>
                        <tbody>{expenses.map((e) => (
                          <tr key={e.id}>
                            <td>{date(e.expense_date)}</td><td><div>{label(EXPENSE_CATEGORIES, e.category)}</div><div className="t-sub">{e.description}</div></td>
                            <td className="t-main">{money(e.amount, e.currency)}</td><td className="hide-sm">{e.billable ? 'نعم' : 'لا'}</td>
                            <td style={{ textAlign: 'left' }}>{can('editFinance') && <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setModal({ expense: e })} aria-label="تعديل"><Pencil size={14} /></button>}</td>
                          </tr>
                        ))}</tbody>
                      </table></div>
                    )}
                  </div>
                )}

                {tab === 'docs' && <DocumentList caseId={c.id} />}

                {tab === 'activity' && (activity.length === 0 ? <Empty icon={History} title="لا يوجد نشاط" /> : activity.map((a) => (
                  <div key={a.id} className="list-item">
                    <div className="avatar sm">{(a.actor_name || '؟')[0]}</div>
                    <div className="grow"><div className="small"><b>{a.actor_name || 'النظام'}</b> {ACT[a.action]} {ENT[a.entity]}</div><div className="small muted title">{a.label}</div></div>
                    <span className="small muted">{timeAgo(a.created_at)}</span>
                  </div>
                )))}
              </div>

              <div className="stack">
                <div className="card">
                  <div className="card-head"><h3><Scale size={18} />بيانات الدعوى</h3></div>
                  <div className="card-body">
                    <dl className="kv">
                      <dt>الموكل</dt><dd><Link className="link" to={`/clients/${c.client_id}`}>{c.client_name}</Link>{c.client_capacity && <span className="muted small"> ({label(CLIENT_CAPACITY, c.client_capacity)})</span>}</dd>
                      <dt>الخصم</dt><dd>{c.opponent_name || '—'}{c.opponent_lawyer && <div className="small muted">وكيله: {c.opponent_lawyer}</div>}</dd>
                      <dt>نوع الدعوى</dt><dd>{label(CASE_TYPES, c.case_type)}</dd>
                      <dt>رقم الدعوى</dt><dd>{c.case_number || '—'}{c.case_year ? ` / ${c.case_year}` : ''}</dd>
                      <dt>المحكمة</dt><dd>{c.court || '—'}{c.court_level && <div className="small muted">{label(COURT_LEVELS, c.court_level)}</div>}</dd>
                      {c.judge && <><dt>القاضي</dt><dd>{c.judge}</dd></>}
                      <dt>المحامي</dt><dd><User size={13} /> {c.assigned_name || 'غير مسند'}</dd>
                      {c.closed_at && <><dt>تاريخ الإغلاق</dt><dd>{date(c.closed_at)}</dd></>}
                    </dl>
                    {c.description && <><div className="divider" /><div className="small" style={{ whiteSpace: 'pre-wrap' }}>{c.description}</div></>}
                    {can('editCore') && (
                      <>
                        <div className="divider" />
                        <div className="field">
                          <label>تغيير حالة القضية</label>
                          <Select value={c.status} options={opts(CASE_STATUS)} onChange={async (v) => {
                            must(await supabase.from('cases').update({ status: v }).eq('id', c.id));
                            toast('تم تحديث حالة القضية'); state.reload();
                          }} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="card">
                  <div className="card-head"><h3><Gavel size={18} />الجلسة القادمة</h3></div>
                  <div className="card-body">
                    {upcoming.length ? (
                      <>
                        <div style={{ fontSize: 18, fontWeight: 600 }}>{date(upcoming[0].hearing_date, { withDay: true })}</div>
                        <div className="muted">{relativeDay(upcoming[0].hearing_date)}{upcoming[0].hearing_time && ` · ${time(upcoming[0].hearing_time)}`}</div>
                        {upcoming[0].purpose && <div className="small" style={{ marginTop: 6 }}>{upcoming[0].purpose}</div>}
                      </>
                    ) : <div className="muted">لا توجد جلسة مجدولة</div>}
                  </div>
                </div>
              </div>
            </div>

            {modal === 'edit' && <CaseForm kase={c} onClose={close()} onSaved={close(true)} />}
            {modal === 'hearing' && <HearingForm caseId={c.id} defaultCourt={c.court} onClose={close()} onSaved={close(true)} />}
            {modal?.hearing && <HearingForm hearing={modal.hearing} caseId={c.id} onClose={close()} onSaved={close(true)} />}
            {modal === 'task' && <TaskForm caseId={c.id} onClose={close()} onSaved={close(true)} />}
            {modal?.task && <TaskForm task={modal.task} caseId={c.id} onClose={close()} onSaved={close(true)} />}
            {modal === 'payment' && <PaymentForm caseId={c.id} currency={c.currency} onClose={close()} onSaved={(p) => { close(true)(); nav(`/receipt/${p.id}`); }} />}
            {modal?.payment && <PaymentForm payment={modal.payment} caseId={c.id} onClose={close()} onSaved={close(true)} />}
            {modal === 'expense' && <ExpenseForm caseId={c.id} currency={c.currency} onClose={close()} onSaved={close(true)} />}
            {modal?.expense && <ExpenseForm expense={modal.expense} caseId={c.id} onClose={close()} onSaved={close(true)} />}
            {modal?.delPayment && (
              <Confirm title="حذف سند القبض" message={`سيتم حذف السند رقم ${modal.delPayment.receipt_no} بمبلغ ${money(modal.delPayment.amount, modal.delPayment.currency)}. هل أنت متأكد؟`}
                onClose={close()} onConfirm={async () => { must(await supabase.from('payments').delete().eq('id', modal.delPayment.id)); toast('تم حذف السند'); state.reload(); }} />
            )}
            {modal === 'delete' && (
              <Confirm title="حذف القضية" confirmText="حذف نهائي"
                message={payments.length || expenses.length ? 'لا يمكن حذف قضية عليها حركات مالية. غيّر حالتها إلى "مؤرشفة" بدلاً من ذلك.' : 'سيتم حذف القضية وجلساتها ومهامها ومستنداتها نهائياً. لا يمكن التراجع.'}
                onClose={close()} onConfirm={async () => {
                  if (payments.length || expenses.length) throw new Error('لا يمكن حذف قضية عليها حركات مالية');
                  must(await supabase.from('cases').delete().eq('id', c.id)); toast('تم حذف القضية'); nav('/cases');
                }} />
            )}
          </>
        );
      }}
    </Async>
  );
}

export function TaskTable({ tasks, onEdit, onChange, hideCase }) {
  const toast = useToast();
  const t = today();
  if (!tasks.length) return <Empty icon={ListChecks} title="لا توجد مهام" />;
  const toggle = async (k) => {
    const done = k.status === 'completed';
    must(await supabase.from('tasks').update({ status: done ? 'pending' : 'completed' }).eq('id', k.id));
    toast(done ? 'أُعيدت المهمة' : 'أُنجزت المهمة');
    onChange?.();
  };
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th style={{ width: 40 }}></th><th>المهمة</th>{!hideCase && <th className="hide-sm">القضية</th>}<th>الاستحقاق</th><th className="hide-sm">الأولوية</th><th className="hide-sm">المسؤول</th><th></th></tr></thead>
        <tbody>
          {tasks.map((k) => {
            const done = k.status === 'completed';
            const late = !done && k.status !== 'cancelled' && k.due_date < t;
            return (
              <tr key={k.id} style={done || k.status === 'cancelled' ? { opacity: .6 } : undefined}>
                <td><button className="btn btn-ghost btn-sm btn-icon" onClick={() => toggle(k)} title={done ? 'إعادة فتح' : 'إنجاز'} aria-label={done ? 'إعادة فتح' : 'إنجاز'}>
                  <CheckCircle2 size={16} color={done ? 'var(--success)' : undefined} /></button></td>
                <td>
                  <div className="t-main" style={done ? { textDecoration: 'line-through' } : undefined}>{k.title}</div>
                  <div className="t-sub">{label(TASK_TYPES, k.task_type)}{k.status === 'in_progress' && ' · قيد التنفيذ'}</div>
                </td>
                {!hideCase && <td className="hide-sm small">{k.case_id ? <Link className="link" to={`/cases/${k.case_id}`}>{k.case_title}</Link> : <span className="muted">عامة</span>}</td>}
                <td className="small">
                  <div style={late ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>{date(k.due_date)}{k.due_time && ` ${time(k.due_time)}`}</div>
                  {!done && <div className="t-sub">{late ? `متأخرة ${relativeDay(k.due_date).replace('قبل ', '')}` : relativeDay(k.due_date)}</div>}
                  {!done && k.remind_at && (
                    <div className={`task-remind ${k.reminded_at ? 'sent' : ''}`} title={k.reminded_at ? 'أُرسل التذكير' : 'موعد التذكير'}>
                      <BellRing size={12} />{k.reminded_at ? 'ذُكّرت ' : ''}{reminderText(k.remind_at)}
                    </div>
                  )}
                </td>
                <td className="hide-sm"><StatusBadge map={PRIORITY} value={k.priority} /></td>
                <td className="hide-sm small">{k.assigned_name || '—'}</td>
                <td style={{ textAlign: 'left' }}><button className="btn btn-ghost btn-sm btn-icon" onClick={() => onEdit(k)} aria-label="تعديل"><Pencil size={14} /></button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export { TASK_STATUS };
