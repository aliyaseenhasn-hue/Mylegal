import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Plus, CalendarDays, List, Gavel, Printer } from 'lucide-react';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { date, time, today, MONTHS, DAYS, addDays, relativeDay } from '../lib/format';
import { HEARING_STATUS } from '../lib/labels';
import { PageHead } from '../components/Layout';
import { useAsync, Async, Empty, StatusBadge, Select, Badge } from '../components/ui';
import { HearingForm } from '../components/forms';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function CalendarPage() {
  const { can, lawyers, role, user } = useAuth();
  const t = today();
  const [view, setView] = useState(() => (window.innerWidth < 700 ? 'agenda' : 'month'));
  const [cursor, setCursor] = useState(() => { const d = new Date(t + 'T00:00:00'); d.setDate(1); return d; });
  const [lawyer, setLawyer] = useState(role === 'lawyer' ? user.id : '');
  const [modal, setModal] = useState(null);

  const range = useMemo(() => {
    if (view === 'agenda') return { from: t, to: addDays(t, 60) };
    const start = new Date(cursor); start.setDate(1 - start.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 41);
    return { from: iso(start), to: iso(end), start };
  }, [view, cursor, t]);

  const state = useAsync(async () => {
    let hq = supabase.from('hearing_agenda').select('*').gte('hearing_date', range.from).lte('hearing_date', range.to).order('hearing_date').order('hearing_time', { nullsFirst: false });
    let tq = supabase.from('task_board').select('*').gte('due_date', range.from).lte('due_date', range.to).neq('status', 'cancelled').order('due_date');
    if (lawyer) { hq = hq.eq('assigned_to', lawyer); tq = tq.eq('assigned_to', lawyer); }
    if (view === 'agenda') hq = hq.eq('status', 'scheduled');
    const [hearings, tasks] = await Promise.all([hq.then(must), view === 'month' ? tq.then(must) : []]);
    return { hearings, tasks };
  }, [range.from, range.to, lawyer, view]);

  const move = (n) => setCursor((c) => { const d = new Date(c); d.setMonth(d.getMonth() + n); return d; });

  return (
    <>
      <PageHead title="الجلسات والتقويم" sub="رول الجلسات ومواعيد المكتب">
        <div className="actions">
          <button className={`btn ${view === 'month' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('month')}><CalendarDays size={16} />شهري</button>
          <button className={`btn ${view === 'agenda' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('agenda')}><List size={16} />رول الجلسات</button>
        </div>
        {view === 'agenda' && <button className="btn btn-ghost btn-icon" onClick={() => window.print()} title="طباعة الرول" aria-label="طباعة"><Printer size={16} /></button>}
        {can('editCore') && <button className="btn btn-gold" onClick={() => setModal({ new: true })}><Plus size={18} />جلسة</button>}
      </PageHead>
      <div className="card">
        <div className="toolbar">
          {view === 'month' && (
            <>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => move(-1)} aria-label="الشهر السابق"><ChevronRight size={16} /></button>
              <b style={{ minWidth: 150, textAlign: 'center' }}>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</b>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => move(1)} aria-label="الشهر التالي"><ChevronLeft size={16} /></button>
              <button className="btn btn-ghost btn-sm" onClick={() => { const d = new Date(t + 'T00:00:00'); d.setDate(1); setCursor(d); }}>اليوم</button>
            </>
          )}
          {view === 'agenda' && <b>الجلسات المجدولة خلال 60 يوماً</b>}
          <div style={{ marginInlineStart: 'auto' }}>
            <Select value={lawyer} onChange={setLawyer} options={lawyers.map((m) => ({ value: m.user_id, label: m.full_name }))} placeholder="كل المحامين" aria-label="المحامي" />
          </div>
        </div>
        <Async state={state}>
          {({ hearings, tasks }) => view === 'month' ? (
            <div className="cal">
              {DAYS.map((d) => <div key={d} className="dow">{d}</div>)}
              {Array.from({ length: 42 }).map((_, i) => {
                const d = new Date(range.start); d.setDate(range.start.getDate() + i);
                const key = iso(d);
                const hs = hearings.filter((h) => h.hearing_date === key);
                const ts = tasks.filter((k) => k.due_date === key);
                return (
                  <div key={key} className={`day ${d.getMonth() !== cursor.getMonth() ? 'out' : ''} ${key === t ? 'today' : ''}`}
                    onClick={(e) => { if (e.target === e.currentTarget && can('editCore')) setModal({ new: true, date: key }); }}>
                    <div className="dnum">{d.getDate()}</div>
                    {hs.map((h) => (
                      <Link key={h.id} to={`/cases/${h.case_id}`} className={`ev ${h.status !== 'scheduled' ? 'done' : ''}`} title={`${h.case_title} — ${h.client_name}`}>
                        {h.hearing_time ? time(h.hearing_time) + ' ' : ''}{h.case_title}
                      </Link>
                    ))}
                    {ts.map((k) => (
                      <Link key={k.id} to={k.case_id ? `/cases/${k.case_id}` : '/tasks'} className={`ev task ${k.status === 'completed' ? 'done' : ''}`} title={k.title}>{k.title}</Link>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : hearings.length === 0 ? <Empty icon={Gavel} title="لا توجد جلسات مجدولة" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>التاريخ</th><th>القضية</th><th className="hide-sm">المحكمة</th><th className="hide-sm">الغرض</th><th className="hide-sm">المحامي</th><th>الحالة</th></tr></thead>
                <tbody>
                  {hearings.map((h, i) => (
                    <tr key={h.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {(i === 0 || hearings[i - 1].hearing_date !== h.hearing_date) ? <><b>{date(h.hearing_date, { withDay: true })}</b><div className="t-sub">{relativeDay(h.hearing_date)}</div></> : null}
                        {h.hearing_time && <div className="small">{time(h.hearing_time)}</div>}
                      </td>
                      <td><Link className="t-main link" to={`/cases/${h.case_id}`}>{h.case_title}</Link><div className="t-sub">#{h.file_no} · {h.client_name}{h.case_number ? ` · ${h.case_number}` : ''}</div></td>
                      <td className="hide-sm">{h.court || '—'}{h.room && <div className="t-sub">{h.room}</div>}</td>
                      <td className="hide-sm small">{h.purpose || '—'}</td>
                      <td className="hide-sm small">{h.assigned_name || '—'}</td>
                      <td>
                        {h.hearing_date === t ? <Badge tone="b-red">اليوم</Badge> : <StatusBadge map={HEARING_STATUS} value={h.status} />}
                        {can('editCore') && <button className="btn btn-ghost btn-sm no-print" style={{ marginInlineStart: 6 }} onClick={() => setModal({ hearing: h })}>النتيجة</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Async>
      </div>
      {modal?.new && <HearingForm hearing={modal.date ? { hearing_date: modal.date } : undefined} onClose={() => setModal(null)} onSaved={() => { setModal(null); state.reload(); }} />}
      {modal?.hearing && <HearingForm hearing={modal.hearing} caseId={modal.hearing.case_id} onClose={() => setModal(null)} onSaved={() => { setModal(null); state.reload(); }} />}
    </>
  );
}
