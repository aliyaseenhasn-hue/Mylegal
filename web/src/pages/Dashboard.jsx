import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Briefcase, CalendarDays, AlertTriangle, Wallet, FileSignature, Plus, CalendarClock, ListChecks, TrendingUp, Gavel, CheckCircle2,
} from 'lucide-react';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { money, date, time, today, addDays, relativeDay, MONTHS, timeAgo } from '../lib/format';
import { PRIORITY } from '../lib/labels';
import { useAsync, Async, Stat, Empty, Badge, useToast } from '../components/ui';
import { ClientForm, CaseForm, HearingForm, TaskForm, PaymentForm } from '../components/forms';
import { useNavigate } from 'react-router-dom';
import PushCard from '../components/PushCard';

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en', { hour: 'numeric', hour12: false, timeZone: 'Asia/Baghdad' }).format(new Date()));
  return h < 12 ? 'صباح الخير' : 'مساء الخير';
}

export function FinanceChart({ months }) {
  if (!months?.length) return null;
  const max = Math.max(1, ...months.map((m) => Math.max(Number(m.collected), Number(m.spent))));
  const W = 640, H = 200, pad = 28, bw = (W - pad) / months.length;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H + 24}`} preserveAspectRatio="none" role="img" aria-label="التحصيل والمصاريف الشهرية">
      {[0, 0.5, 1].map((g) => <line key={g} className="grid-line" x1={0} x2={W} y1={H - g * (H - 10)} y2={H - g * (H - 10)} />)}
      {months.map((m, i) => {
        const x = W - pad - (i + 1) * bw + bw * 0.18;
        const hc = (Number(m.collected) / max) * (H - 10);
        const hs = (Number(m.spent) / max) * (H - 10);
        const d = new Date(m.month + 'T00:00:00');
        return (
          <g key={m.month}>
            <rect className="bar" x={x} y={H - hc} width={bw * 0.32} height={hc} rx={3}><title>{`تحصيل: ${money(m.collected)}`}</title></rect>
            <rect className="bar2" x={x + bw * 0.34} y={H - hs} width={bw * 0.32} height={hs} rx={3}><title>{`مصاريف: ${money(m.spent)}`}</title></rect>
            <text x={x + bw * 0.33} y={H + 17} textAnchor="middle">{MONTHS[d.getMonth()].split(' ')[0]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Dashboard() {
  const { member, can } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const t = today();

  const state = useAsync(async () => {
    const [summary, hearings, tasks, cases, activity, months] = await Promise.all([
      supabase.rpc('dashboard_summary').then(must),
      supabase.from('hearing_agenda').select('*').eq('status', 'scheduled').gte('hearing_date', t).lte('hearing_date', addDays(t, 14))
        .order('hearing_date').order('hearing_time', { nullsFirst: false }).limit(12).then(must),
      supabase.from('task_board').select('*').in('status', ['pending', 'in_progress']).lte('due_date', addDays(t, 7))
        .order('due_date').limit(12).then(must),
      supabase.from('case_overview').select('id,title,file_no,client_name,status,next_hearing,remaining_fees,currency,paid_percent')
        .in('status', ['preparing', 'active', 'suspended']).order('updated_at', { ascending: false }).limit(6).then(must),
      can('viewActivity') ? supabase.from('activity_feed').select('*').order('created_at', { ascending: false }).limit(8).then(must) : [],
      can('viewFinance') ? supabase.rpc('monthly_finance', { p_months: 6, p_currency: 'IQD' }).then(must) : [],
    ]);
    return { summary, hearings, tasks, cases, activity, months };
  }, []);

  const completeTask = async (task) => {
    must(await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id));
    toast('أُنجزت المهمة');
    state.reload();
  };

  const close = (reload) => () => { setModal(null); if (reload) state.reload(); };

  return (
    <div className="stack">
      <div className="hero">
        <div>
          <h2>{greeting()}، {member?.full_name?.split(' ')[0]}</h2>
          <p>{date(t, { withDay: true })} — إليك ملخص عمل المكتب</p>
        </div>
        <div className="actions">
          {can('editCore') && <button className="btn btn-gold" onClick={() => setModal('case')}><Plus size={18} />قضية جديدة</button>}
          {can('editCore') && <button className="btn btn-ghost" onClick={() => setModal('client')}><Users size={17} />موكل</button>}
          {can('editCore') && <button className="btn btn-ghost" onClick={() => setModal('hearing')}><CalendarDays size={17} />جلسة</button>}
          <button className="btn btn-ghost" onClick={() => setModal('task')}><ListChecks size={17} />مهمة</button>
          {can('editFinance') && <button className="btn btn-ghost" onClick={() => setModal('payment')}><Wallet size={17} />سند قبض</button>}
        </div>
      </div>

      <PushCard compact />

      <Async state={state}>
        {({ summary: s, hearings, tasks, cases, activity, months }) => {
          const iqd = s.finance?.find((f) => f.currency === 'IQD') || {};
          const usd = s.finance?.find((f) => f.currency === 'USD');
          return (
            <>
              <div className="grid cols-4">
                <Stat icon={Briefcase} label="القضايا المنظورة" value={s.active_cases} sub={`${s.closed_cases} منتهية — ${s.won_cases} كسب`} to="/cases" />
                <Stat icon={CalendarClock} tone="tone-gold" label="جلسات اليوم" value={s.hearings_today} sub={`${s.hearings_week} خلال 7 أيام`} to="/calendar" />
                <Stat icon={AlertTriangle} tone={s.overdue_tasks ? 'tone-red' : 'tone-green'} label="مهام متأخرة" value={s.overdue_tasks} sub={`${s.open_tasks} مهمة مفتوحة — ${s.my_open_tasks} لك`} to="/tasks" />
                {can('viewFinance') ? (
                  <Stat icon={Wallet} tone="tone-green" label="المحصّل هذا الشهر" value={money(iqd.month_paid)} sub={`متبقٍ على الموكلين ${money(iqd.remaining)}`} to="/finance" />
                ) : (
                  <Stat icon={Users} tone="tone-green" label="الموكلون" value={s.clients} to="/clients" />
                )}
              </div>

              {s.poa_expiring > 0 && (
                <Link to="/poa" className="card" style={{ padding: '12px 18px', display: 'flex', gap: 10, alignItems: 'center', background: 'var(--warning-soft)', borderColor: 'transparent' }}>
                  <FileSignature size={19} color="var(--warning)" />
                  <span><b>{s.poa_expiring}</b> وكالة تنتهي خلال 30 يوماً — راجعها لتجديدها قبل انتهائها.</span>
                </Link>
              )}

              <div className="grid main-side">
                <div className="card">
                  <div className="card-head">
                    <h3><Gavel size={18} />الجلسات القادمة</h3>
                    <Link to="/calendar" className="link small">التقويم الكامل</Link>
                  </div>
                  <div className="card-body flush">
                    {hearings.length === 0 ? <Empty icon={CalendarDays} title="لا توجد جلسات خلال أسبوعين" /> : hearings.map((h) => {
                      const d = new Date(h.hearing_date + 'T00:00:00');
                      return (
                        <Link key={h.id} to={`/cases/${h.case_id}`} className="list-item">
                          <div className={`date-pill ${h.hearing_date === t ? 'today' : ''}`}><b>{d.getDate()}</b><small>{MONTHS[d.getMonth()].split(' ').pop()}</small></div>
                          <div className="grow">
                            <div className="title">{h.case_title}</div>
                            <div className="small muted">{h.client_name} · {h.court || 'المحكمة غير محددة'}{h.purpose ? ` · ${h.purpose}` : ''}</div>
                          </div>
                          <div style={{ textAlign: 'left' }}>
                            <Badge tone={h.hearing_date === t ? 'b-red' : 'b-gold'} plain>{relativeDay(h.hearing_date)}</Badge>
                            {h.hearing_time && <div className="small muted">{time(h.hearing_time)}</div>}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="card">
                  <div className="card-head">
                    <h3><ListChecks size={18} />مهام هذا الأسبوع</h3>
                    <Link to="/tasks" className="link small">كل المهام</Link>
                  </div>
                  <div className="card-body flush">
                    {tasks.length === 0 ? <Empty icon={CheckCircle2} title="لا توجد مهام مستحقة" text="أحسنت! كل شيء منجز" /> : tasks.map((k) => {
                      const late = k.due_date < t;
                      return (
                        <div key={k.id} className="list-item">
                          <button className="btn btn-ghost btn-sm btn-icon" title="إنجاز" aria-label="إنجاز المهمة" onClick={() => completeTask(k)}><CheckCircle2 size={16} /></button>
                          <div className="grow">
                            <div className="title">{k.title}</div>
                            <div className="small muted">{k.case_title || 'مهمة عامة'}{k.assigned_name ? ` · ${k.assigned_name}` : ''}</div>
                          </div>
                          <div style={{ textAlign: 'left' }}>
                            <Badge tone={late ? 'b-red' : PRIORITY[k.priority]?.tone} plain>{late ? 'متأخرة' : relativeDay(k.due_date)}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid main-side">
                {can('viewFinance') ? (
                  <div className="card">
                    <div className="card-head">
                      <h3><TrendingUp size={18} />الحركة المالية — آخر 6 أشهر (د.ع)</h3>
                      <div className="legend"><span><i style={{ background: 'var(--gold-500)' }} />التحصيل</span><span><i style={{ background: 'var(--navy-700)', opacity: .55 }} />المصاريف</span></div>
                    </div>
                    <div className="card-body">
                      <FinanceChart months={months} />
                      <div className="grid cols-3" style={{ marginTop: 14, gap: 10 }}>
                        <div><div className="small muted">إجمالي الأتعاب</div><b>{money(iqd.fees)}</b></div>
                        <div><div className="small muted">المحصّل</div><b style={{ color: 'var(--success)' }}>{money(iqd.paid)}</b></div>
                        <div><div className="small muted">المتبقي</div><b style={{ color: 'var(--danger)' }}>{money(iqd.remaining)}</b></div>
                      </div>
                      {usd && <div className="small muted" style={{ marginTop: 10 }}>بالدولار: أتعاب {money(usd.fees, 'USD')} · محصّل {money(usd.paid, 'USD')} · متبقٍ {money(usd.remaining, 'USD')}</div>}
                    </div>
                  </div>
                ) : (
                  <div className="card">
                    <div className="card-head"><h3><Briefcase size={18} />آخر القضايا</h3></div>
                    <div className="card-body flush">
                      {cases.length === 0 ? <Empty title="لا توجد قضايا منظورة" /> : cases.map((c) => (
                        <Link key={c.id} to={`/cases/${c.id}`} className="list-item">
                          <div className="grow"><div className="title">{c.title}</div><div className="small muted">#{c.file_no} · {c.client_name}</div></div>
                          <div className="small muted">{c.next_hearing ? `الجلسة: ${date(c.next_hearing)}` : ''}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                <div className="card">
                  <div className="card-head">
                    <h3><Briefcase size={18} />{can('viewActivity') ? 'آخر النشاطات' : 'القضايا النشطة'}</h3>
                    {can('viewActivity') && <Link to="/activity" className="link small">السجل</Link>}
                  </div>
                  <div className="card-body flush">
                    {can('viewActivity') ? (activity.length === 0 ? <Empty title="لا يوجد نشاط بعد" text="ابدأ بإضافة موكل أو قضية" /> : activity.map((a) => (
                      <div key={a.id} className="list-item">
                        <div className="avatar sm">{(a.actor_name || '؟')[0]}</div>
                        <div className="grow">
                          <div className="small"><b>{a.actor_name || 'النظام'}</b> {ACT[a.action]} {ENT[a.entity]}</div>
                          <div className="small muted title">{a.label}</div>
                        </div>
                        <span className="small muted">{timeAgo(a.created_at)}</span>
                      </div>
                    ))) : cases.map((c) => (
                      <Link key={c.id} to={`/cases/${c.id}`} className="list-item">
                        <div className="grow"><div className="title">{c.title}</div><div className="small muted">#{c.file_no} · {c.client_name}</div></div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </>
          );
        }}
      </Async>

      {modal === 'client' && <ClientForm onClose={close()} onSaved={(c) => { setModal(null); nav(`/clients/${c.id}`); }} />}
      {modal === 'case' && <CaseForm onClose={close()} onSaved={(c) => { setModal(null); nav(`/cases/${c.id}`); }} />}
      {modal === 'hearing' && <HearingForm onClose={close()} onSaved={close(true)} />}
      {modal === 'task' && <TaskForm onClose={close()} onSaved={close(true)} />}
      {modal === 'payment' && <PaymentForm onClose={close()} onSaved={close(true)} />}
    </div>
  );
}

export const ACT = { insert: 'أضاف', update: 'عدّل', delete: 'حذف' };
export const ENT = {
  clients: 'موكلاً', cases: 'قضية', hearings: 'جلسة', tasks: 'مهمة', payments: 'سند قبض', expenses: 'مصروفاً',
  powers_of_attorney: 'وكالة', documents: 'مستنداً',
};
