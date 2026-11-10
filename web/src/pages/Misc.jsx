import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, CalendarClock, AlertTriangle, ListChecks, FileSignature, History, Trash2 } from 'lucide-react';
import { supabase, must } from '../lib/supabase';
import { timeAgo, dateTime } from '../lib/format';
import { PageHead } from '../components/Layout';
import { useAsync, Async, Empty, Pager, Select, useToast } from '../components/ui';
import { ACT, ENT } from './Dashboard';

const KIND_ICON = { task_due: ListChecks, task_overdue: AlertTriangle, hearing_soon: CalendarClock, poa_expiring: FileSignature, general: Bell, fees_due: Bell };
const notifyChanged = () => window.dispatchEvent(new Event('notifications:changed'));

export function NotificationsPage() {
  const toast = useToast();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const state = useAsync(async () => {
    let q = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(200);
    if (onlyUnread) q = q.eq('is_read', false);
    return must(await q);
  }, [onlyUnread]);

  const markAll = async () => {
    must(await supabase.from('notifications').update({ is_read: true }).eq('is_read', false));
    toast('تم تعليم الكل كمقروء'); notifyChanged(); state.reload();
  };
  const read = async (n) => {
    if (!n.is_read) { await supabase.from('notifications').update({ is_read: true }).eq('id', n.id); notifyChanged(); }
  };
  const remove = async (n) => {
    must(await supabase.from('notifications').delete().eq('id', n.id)); notifyChanged(); state.reload();
  };

  return (
    <>
      <PageHead title="التنبيهات" sub="تذكير تلقائي يومي بالجلسات والمهام والوكالات">
        <label className="check"><input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} />غير المقروءة فقط</label>
        <button className="btn btn-ghost" onClick={markAll}><CheckCheck size={17} />تعليم الكل كمقروء</button>
      </PageHead>
      <div className="card">
        <Async state={state} empty={<Empty icon={Bell} title="لا توجد تنبيهات" text="ستظهر هنا تذكيرات الجلسات والمهام المستحقة" />}>
          {(rows) => rows.map((n) => {
            const I = KIND_ICON[n.kind] || Bell;
            const tone = n.kind === 'task_overdue' ? 'tone-red' : n.kind === 'hearing_soon' ? 'tone-gold' : n.kind === 'poa_expiring' ? 'tone-amber' : 'tone-navy';
            return (
              <div key={n.id} className="list-item" style={!n.is_read ? { background: 'var(--accent-soft)' } : undefined}>
                <div className={`stat ${tone}`} style={{ padding: 8, borderRadius: 10 }}><I size={18} /></div>
                <Link to={n.link || '/'} className="grow" onClick={() => read(n)}>
                  <div className="title" style={{ fontWeight: n.is_read ? 400 : 600 }}>{n.title}</div>
                  <div className="small muted">{n.body}</div>
                </Link>
                <span className="small muted" title={dateTime(n.created_at)}>{timeAgo(n.created_at)}</span>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => remove(n)} aria-label="حذف التنبيه"><Trash2 size={14} /></button>
              </div>
            );
          })}
        </Async>
      </div>
    </>
  );
}

const PAGE = 40;
export function ActivityPage() {
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(0);
  const state = useAsync(async () => {
    let q = supabase.from('activity_feed').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (entity) q = q.eq('entity', entity);
    return must(await q);
  }, [entity, page]);
  const link = (a) => (a.action === 'delete' ? null : a.entity === 'clients' ? `/clients/${a.entity_id}` : a.case_id ? `/cases/${a.case_id}` : null);
  return (
    <>
      <PageHead title="سجل النشاط" sub="كل عملية إضافة أو تعديل أو حذف تُسجَّل باسم منفذها ووقتها" />
      <div className="card">
        <div className="toolbar">
          <Select value={entity} onChange={(v) => { setEntity(v); setPage(0); }} placeholder="كل السجلات" aria-label="النوع"
            options={Object.entries({ clients: 'الموكلون', cases: 'القضايا', hearings: 'الجلسات', tasks: 'المهام', payments: 'سندات القبض', expenses: 'المصاريف', powers_of_attorney: 'الوكالات', documents: 'المستندات' }).map(([value, label]) => ({ value, label }))} />
        </div>
        <Async state={state} empty={<Empty icon={History} title="لا يوجد نشاط" />}>
          {({ data, count }) => (
            <>
              {data.map((a) => {
                const to = link(a);
                const body = (<><div className="small"><b>{a.actor_name || 'النظام'}</b> {ACT[a.action]} {ENT[a.entity]}</div><div className="small muted title">{a.label}</div></>);
                return (
                  <div key={a.id} className="list-item">
                    <div className="avatar sm">{(a.actor_name || '؟')[0]}</div>
                    {to ? <Link to={to} className="grow">{body}</Link> : <div className="grow">{body}</div>}
                    <span className="small muted">{dateTime(a.created_at)}</span>
                  </div>
                );
              })}
              <Pager page={page} pageSize={PAGE} total={count} onPage={setPage} />
            </>
          )}
        </Async>
      </div>
    </>
  );
}

export function NotFound() {
  return <Empty title="الصفحة غير موجودة" action={<Link className="btn btn-primary" to="/">العودة للرئيسية</Link>} />;
}
