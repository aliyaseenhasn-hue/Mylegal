import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Download, TrendingUp, Users, Briefcase, Printer } from 'lucide-react';
import { supabase, must } from '../lib/supabase';
import { money, today, exportCsv, number } from '../lib/format';
import { CASE_STATUS, CASE_TYPES, CURRENCIES, ROLES, label, opts } from '../lib/labels';
import { PageHead } from '../components/Layout';
import { useAsync, Async, Empty, Tabs, Select, Progress } from '../components/ui';
import { FinanceChart } from './Dashboard';

export default function ReportsPage() {
  const [tab, setTab] = useState('receivables');
  const [currency, setCurrency] = useState('IQD');
  const [from, setFrom] = useState(today().slice(0, 4) + '-01-01');
  const [to, setTo] = useState(today());

  const state = useAsync(async () => {
    if (tab === 'receivables') {
      return must(await supabase.from('case_overview').select('id,file_no,title,client_name,client_id,status,total_fees,paid_total,remaining_fees,paid_percent,assigned_name,currency')
        .eq('currency', currency).gt('remaining_fees', 0).order('remaining_fees', { ascending: false }).limit(500));
    }
    if (tab === 'lawyers') return must(await supabase.rpc('lawyer_performance', { p_from: from || null, p_to: to || null }));
    if (tab === 'monthly') return must(await supabase.rpc('monthly_finance', { p_months: 12, p_currency: currency }));
    const cases = must(await supabase.from('cases').select('status, case_type, opened_at').gte('opened_at', from).lte('opened_at', to));
    const byType = {}; const byStatus = {};
    for (const c of cases) { byType[c.case_type] = (byType[c.case_type] || 0) + 1; byStatus[c.status] = (byStatus[c.status] || 0) + 1; }
    return { total: cases.length, byType, byStatus };
  }, [tab, currency, from, to]);

  const exportReport = () => {
    const d = state.data;
    if (!d) return;
    if (tab === 'receivables') exportCsv(`الذمم-${currency}-${today()}.csv`, [
      { label: 'الملف', value: (r) => r.file_no }, { label: 'القضية', value: (r) => r.title }, { label: 'الموكل', value: (r) => r.client_name },
      { label: 'الأتعاب', value: (r) => r.total_fees }, { label: 'المحصّل', value: (r) => r.paid_total }, { label: 'المتبقي', value: (r) => r.remaining_fees }, { label: 'المحامي', value: (r) => r.assigned_name },
    ], d);
    if (tab === 'lawyers') exportCsv(`أداء-المحامين-${today()}.csv`, [
      { label: 'المحامي', value: (r) => r.full_name }, { label: 'القضايا', value: (r) => r.cases_total }, { label: 'النشطة', value: (r) => r.cases_active },
      { label: 'كسب', value: (r) => r.cases_won }, { label: 'خسارة', value: (r) => r.cases_lost }, { label: 'جلسات منعقدة', value: (r) => r.hearings_done },
      { label: 'مهام منجزة', value: (r) => r.tasks_done }, { label: 'مهام متأخرة', value: (r) => r.tasks_overdue }, { label: 'تحصيل د.ع', value: (r) => r.collected_iqd }, { label: 'تحصيل $', value: (r) => r.collected_usd },
    ], d);
    if (tab === 'monthly') exportCsv(`الحركة-الشهرية-${currency}.csv`, [
      { label: 'الشهر', value: (r) => r.month.slice(0, 7) }, { label: 'التحصيل', value: (r) => r.collected }, { label: 'المصاريف', value: (r) => r.spent }, { label: 'الصافي', value: (r) => r.collected - r.spent },
    ], d);
  };

  const needsCurrency = tab === 'receivables' || tab === 'monthly';
  const needsRange = tab === 'lawyers' || tab === 'cases';

  return (
    <>
      <PageHead title="التقارير" sub="مؤشرات أداء المكتب المالية والقانونية">
        <button className="btn btn-ghost btn-icon" onClick={() => window.print()} title="طباعة" aria-label="طباعة"><Printer size={16} /></button>
        {tab !== 'cases' && <button className="btn btn-ghost" onClick={exportReport}><Download size={17} />تصدير Excel</button>}
      </PageHead>
      <div className="card">
        <Tabs active={tab} onChange={setTab} tabs={[
          { key: 'receivables', label: 'الأتعاب المتبقية', icon: TrendingUp }, { key: 'monthly', label: 'الحركة الشهرية', icon: BarChart3 },
          { key: 'lawyers', label: 'أداء المحامين', icon: Users }, { key: 'cases', label: 'إحصاء القضايا', icon: Briefcase },
        ]} />
        <div className="toolbar no-print">
          {needsCurrency && <Select value={currency} onChange={setCurrency} options={opts(CURRENCIES)} aria-label="العملة" />}
          {needsRange && <><label className="small muted">من</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><label className="small muted">إلى</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></>}
        </div>
        <Async state={state}>
          {(d) => {
            if (tab === 'receivables') {
              if (!d.length) return <Empty title="لا توجد أتعاب متبقية" text="جميع الأتعاب محصّلة بالكامل" />;
              const total = d.reduce((a, r) => a + Number(r.remaining_fees), 0);
              return (
                <div className="table-wrap"><table className="table">
                  <thead><tr><th>الملف</th><th>القضية / الموكل</th><th>الحالة</th><th>الأتعاب</th><th>المحصّل</th><th>المتبقي</th><th className="hide-sm">المحامي</th></tr></thead>
                  <tbody>{d.map((r) => (
                    <tr key={r.id}>
                      <td className="muted">#{r.file_no}</td>
                      <td><Link className="t-main link" to={`/cases/${r.id}`}>{r.title}</Link><div className="t-sub">{r.client_name}</div><Progress value={r.paid_percent} /></td>
                      <td>{label(CASE_STATUS, r.status)}</td>
                      <td data-label="الأتعاب">{money(r.total_fees, currency)}</td><td data-label="المحصّل" style={{ color: 'var(--success)' }}>{money(r.paid_total, currency)}</td>
                      <td data-label="المتبقي" style={{ color: 'var(--danger)', fontWeight: 600 }}>{money(r.remaining_fees, currency)}</td>
                      <td className="hide-sm small">{r.assigned_name || '—'}</td>
                    </tr>
                  ))}</tbody>
                  <tfoot><tr><td colSpan={5}>إجمالي الأتعاب المتبقية على الموكلين ({d.length} قضية)</td><td>{money(total, currency)}</td><td className="hide-sm"></td></tr></tfoot>
                </table></div>
              );
            }
            if (tab === 'monthly') {
              const tc = d.reduce((a, r) => a + Number(r.collected), 0); const ts = d.reduce((a, r) => a + Number(r.spent), 0);
              return (
                <div className="card-body">
                  <FinanceChart months={d} />
                  <div className="table-wrap" style={{ marginTop: 16 }}><table className="table">
                    <thead><tr><th>الشهر</th><th>التحصيل</th><th>المصاريف</th><th>الصافي</th></tr></thead>
                    <tbody>{[...d].reverse().map((r) => (
                      <tr key={r.month}><td><span className="t-main">{r.month.slice(0, 7)}</span></td><td data-label="التحصيل" style={{ color: 'var(--success)' }}>{money(r.collected, currency)}</td><td data-label="المصاريف">{money(r.spent, currency)}</td><td data-label="الصافي" className="t-main">{money(r.collected - r.spent, currency)}</td></tr>
                    ))}</tbody>
                    <tfoot><tr><td>آخر 12 شهراً</td><td data-label="التحصيل">{money(tc, currency)}</td><td data-label="المصاريف">{money(ts, currency)}</td><td data-label="الصافي">{money(tc - ts, currency)}</td></tr></tfoot>
                  </table></div>
                </div>
              );
            }
            if (tab === 'lawyers') {
              if (!d.length) return <Empty title="لا يوجد محامون في المكتب" />;
              return (
                <div className="table-wrap"><table className="table">
                  <thead><tr><th>المحامي</th><th>القضايا</th><th>النشطة</th><th>كسب / خسارة</th><th>نسبة الكسب</th><th>جلسات منعقدة</th><th>مهام منجزة / متأخرة</th><th>التحصيل</th></tr></thead>
                  <tbody>{d.map((r) => {
                    const decided = Number(r.cases_won) + Number(r.cases_lost);
                    const rate = decided ? Math.round((r.cases_won / decided) * 100) : null;
                    return (
                      <tr key={r.user_id} className="lawyer-row">
                        <td><div className="t-main">{r.full_name}</div><div className="t-sub">{ROLES[r.role]}</div></td>
                        <td data-label="القضايا">{r.cases_total}</td>
                        <td data-label="النشطة">{r.cases_active}</td>
                        <td data-label="كسب / خسارة">{r.cases_won} / {r.cases_lost}</td>
                        <td data-label="نسبة الكسب">{rate === null ? '—' : <><b>{rate}%</b><Progress value={rate} green /></>}</td>
                        <td data-label="جلسات منعقدة">{r.hearings_done}</td>
                        <td data-label="مهام منجزة / متأخرة">{r.tasks_done} / <span style={{ color: r.tasks_overdue ? 'var(--danger)' : undefined }}>{r.tasks_overdue}</span></td>
                        <td data-label="التحصيل">{money(r.collected_iqd)}{Number(r.collected_usd) > 0 && <> + {money(r.collected_usd, 'USD')}</>}</td>
                      </tr>
                    );
                  })}</tbody>
                </table></div>
              );
            }
            const max = Math.max(1, ...Object.values(d.byType));
            return (
              <div className="card-body">
                <div className="muted" style={{ marginBottom: 14 }}>القضايا المفتوحة في الفترة: <b style={{ color: 'var(--text)' }}>{number(d.total)}</b></div>
                {d.total === 0 ? <Empty title="لا توجد قضايا في هذه الفترة" /> : (
                  <div className="grid cols-2">
                    <div>
                      <h4 style={{ marginBottom: 12 }}>حسب نوع الدعوى</h4>
                      {Object.entries(d.byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                        <div key={k} style={{ marginBottom: 10 }}><div className="small" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{label(CASE_TYPES, k)}</span><b>{v}</b></div><Progress value={(v / max) * 100} /></div>
                      ))}
                    </div>
                    <div>
                      <h4 style={{ marginBottom: 12 }}>حسب الحالة</h4>
                      {Object.entries(d.byStatus).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                        <div key={k} style={{ marginBottom: 10 }}><div className="small" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{label(CASE_STATUS, k)}</span><b>{v}</b></div><Progress value={(v / d.total) * 100} green={k === 'won'} /></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          }}
        </Async>
      </div>
    </>
  );
}
