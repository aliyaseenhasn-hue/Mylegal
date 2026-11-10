import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Plus, Receipt, Wallet, Printer, Download, Pencil, Search, ArrowRight, Send } from 'lucide-react';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { money, date, dateTime, today, exportCsv, amountInWords } from '../lib/format';
import { PAYMENT_METHODS, EXPENSE_CATEGORIES, CURRENCIES, label, opts } from '../lib/labels';
import { PageHead } from '../components/Layout';
import { useAsync, Async, Empty, Tabs, Select, Stat, Pager, useDebounced, safeLike } from '../components/ui';
import { PaymentForm, ExpenseForm } from '../components/forms';

const PAGE = 30;
const monthStart = () => today().slice(0, 8) + '01';

export default function FinancePage() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState('payments');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [currency, setCurrency] = useState('IQD');
  const [extra, setExtra] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState(null);
  const dq = useDebounced(q.trim());

  const state = useAsync(async () => {
    const isPay = tab === 'payments';
    const view = isPay ? 'payment_register' : 'expense_register';
    const dcol = isPay ? 'payment_date' : 'expense_date';
    const base = (sel, opt) => {
      let x = supabase.from(view).select(sel, opt).eq('currency', currency);
      if (from) x = x.gte(dcol, from);
      if (to) x = x.lte(dcol, to);
      if (extra) x = isPay ? x.eq('method', extra) : x.eq('category', extra);
      if (dq) { const s = safeLike(dq); x = x.or(`case_title.ilike.%${s}%,client_name.ilike.%${s}%,notes.ilike.%${s}%`.replace('notes', isPay ? 'notes' : 'description')); }
      return x;
    };
    const [list, all] = await Promise.all([
      base('*', { count: 'exact' }).order(dcol, { ascending: false }).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1).then(must),
      base('amount').then(must),
    ]);
    const [p, e] = await Promise.all([
      (() => { let x = supabase.from('payments').select('amount').eq('currency', currency); if (from) x = x.gte('payment_date', from); if (to) x = x.lte('payment_date', to); return x.then(must); })(),
      (() => { let x = supabase.from('expenses').select('amount').eq('currency', currency); if (from) x = x.gte('expense_date', from); if (to) x = x.lte('expense_date', to); return x.then(must); })(),
    ]);
    const sum = (arr) => arr.reduce((a, r) => a + Number(r.amount), 0);
    return { ...list, filteredTotal: sum(all), collected: sum(p), spent: sum(e) };
  }, [tab, from, to, currency, extra, dq, page]);

  const doExport = async () => {
    const isPay = tab === 'payments';
    let x = supabase.from(isPay ? 'payment_register' : 'expense_register').select('*').eq('currency', currency);
    const dcol = isPay ? 'payment_date' : 'expense_date';
    if (from) x = x.gte(dcol, from);
    if (to) x = x.lte(dcol, to);
    const rows = must(await x.order(dcol));
    exportCsv(`${isPay ? 'سندات-القبض' : 'المصاريف'}-${from}-${to}.csv`, isPay ? [
      { label: 'رقم السند', value: (r) => r.receipt_no }, { label: 'التاريخ', value: (r) => r.payment_date }, { label: 'الموكل', value: (r) => r.client_name },
      { label: 'القضية', value: (r) => r.case_title }, { label: 'المبلغ', value: (r) => r.amount }, { label: 'العملة', value: (r) => r.currency },
      { label: 'الطريقة', value: (r) => label(PAYMENT_METHODS, r.method) }, { label: 'ملاحظات', value: (r) => r.notes },
    ] : [
      { label: 'التاريخ', value: (r) => r.expense_date }, { label: 'البند', value: (r) => label(EXPENSE_CATEGORIES, r.category) },
      { label: 'القضية', value: (r) => r.case_title || 'مصاريف المكتب' }, { label: 'المبلغ', value: (r) => r.amount }, { label: 'العملة', value: (r) => r.currency },
      { label: 'يُسترد من الموكل', value: (r) => (r.billable ? 'نعم' : 'لا') }, { label: 'الوصف', value: (r) => r.description },
    ], rows);
  };

  const reset = (fn) => (v) => { fn(v); setPage(0); };

  return (
    <>
      <PageHead title="الحسابات" sub="سندات القبض ومصاريف القضايا والمكتب">
        <button className="btn btn-ghost" onClick={doExport}><Download size={17} />تصدير Excel</button>
        {can('editFinance') && <button className="btn btn-ghost" onClick={() => setModal('expense')}><Wallet size={17} />مصروف</button>}
        {can('editFinance') && <button className="btn btn-primary" onClick={() => setModal('payment')}><Plus size={18} />سند قبض</button>}
      </PageHead>

      <Async state={state}>
        {(d) => (
          <div className="grid cols-3" style={{ marginBottom: 18 }}>
            <Stat icon={Receipt} tone="tone-green" label="المقبوضات في الفترة" value={money(d.collected, currency)} />
            <Stat icon={Wallet} tone="tone-red" label="المصاريف في الفترة" value={money(d.spent, currency)} />
            <Stat icon={Wallet} tone="tone-gold" label="الصافي" value={money(d.collected - d.spent, currency)} />
          </div>
        )}
      </Async>

      <div className="card">
        <Tabs active={tab} onChange={(k) => { setTab(k); setExtra(''); setPage(0); }} tabs={[{ key: 'payments', label: 'سندات القبض', icon: Receipt }, { key: 'expenses', label: 'المصاريف', icon: Wallet }]} />
        <div className="toolbar">
          <div className="search-box"><Search size={17} className="icon" /><input placeholder="بحث بالموكل أو القضية" value={q} onChange={(e) => reset(setQ)(e.target.value)} /></div>
          <label className="small muted">من</label><input type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
          <label className="small muted">إلى</label><input type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} />
          <Select value={currency} onChange={reset(setCurrency)} options={opts(CURRENCIES)} aria-label="العملة" />
          <Select value={extra} onChange={reset(setExtra)} options={opts(tab === 'payments' ? PAYMENT_METHODS : EXPENSE_CATEGORIES)} placeholder={tab === 'payments' ? 'كل الطرق' : 'كل البنود'} aria-label="تصفية" />
        </div>
        <Async state={state} empty={<Empty icon={tab === 'payments' ? Receipt : Wallet} title="لا توجد حركات في هذه الفترة" />}>
          {({ data, count, filteredTotal }) => (
            <>
              <div className="table-wrap">
                {tab === 'payments' ? (
                  <table className="table">
                    <thead><tr><th>السند</th><th>التاريخ</th><th>الموكل / القضية</th><th>المبلغ</th><th className="hide-sm">الطريقة</th><th className="hide-sm">بواسطة</th><th></th></tr></thead>
                    <tbody>{data.map((p) => (
                      <tr key={p.id}>
                        <td>#{p.receipt_no}</td><td className="small">{date(p.payment_date)}</td>
                        <td><div className="t-main">{p.client_name}</div><Link className="t-sub link" to={`/cases/${p.case_id}`}>#{p.file_no} {p.case_title}</Link></td>
                        <td className="t-main" style={{ color: 'var(--success)' }}>{money(p.amount, p.currency)}</td>
                        <td className="hide-sm small">{label(PAYMENT_METHODS, p.method)}</td>
                        <td className="hide-sm small muted">{p.created_by_name}</td>
                        <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                          <Link className="btn btn-ghost btn-sm btn-icon" to={`/receipt/${p.id}`} aria-label="طباعة"><Printer size={14} /></Link>
                          {can('editFinance') && <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setModal({ payment: p })} aria-label="تعديل"><Pencil size={14} /></button>}
                        </td>
                      </tr>
                    ))}</tbody>
                    <tfoot><tr><td colSpan={3}>إجمالي النتائج</td><td>{money(filteredTotal, currency)}</td><td colSpan={3} className="hide-sm"></td></tr></tfoot>
                  </table>
                ) : (
                  <table className="table">
                    <thead><tr><th>التاريخ</th><th>البند</th><th>القضية</th><th>المبلغ</th><th className="hide-sm">يُسترد</th><th></th></tr></thead>
                    <tbody>{data.map((e) => (
                      <tr key={e.id}>
                        <td className="small">{date(e.expense_date)}</td>
                        <td><div className="t-main">{label(EXPENSE_CATEGORIES, e.category)}</div><div className="t-sub">{e.description}</div></td>
                        <td className="small">{e.case_id ? <Link className="link" to={`/cases/${e.case_id}`}>{e.case_title}</Link> : <span className="muted">مصاريف المكتب</span>}</td>
                        <td className="t-main">{money(e.amount, e.currency)}</td>
                        <td className="hide-sm small">{e.case_id ? (e.billable ? 'نعم' : 'لا') : '—'}</td>
                        <td style={{ textAlign: 'left' }}>{can('editFinance') && <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setModal({ expense: e })} aria-label="تعديل"><Pencil size={14} /></button>}</td>
                      </tr>
                    ))}</tbody>
                    <tfoot><tr><td colSpan={3}>إجمالي النتائج</td><td>{money(filteredTotal, currency)}</td><td colSpan={2} className="hide-sm"></td></tr></tfoot>
                  </table>
                )}
              </div>
              <Pager page={page} pageSize={PAGE} total={count} onPage={setPage} />
            </>
          )}
        </Async>
      </div>

      {modal === 'payment' && <PaymentForm currency={currency} onClose={() => setModal(null)} onSaved={(p) => nav(`/receipt/${p.id}`)} />}
      {modal?.payment && <PaymentForm payment={modal.payment} caseId={modal.payment.case_id} onClose={() => setModal(null)} onSaved={() => { setModal(null); state.reload(); }} />}
      {modal === 'expense' && <ExpenseForm currency={currency} onClose={() => setModal(null)} onSaved={() => { setModal(null); state.reload(); }} />}
      {modal?.expense && <ExpenseForm expense={modal.expense} onClose={() => setModal(null)} onSaved={() => { setModal(null); state.reload(); }} />}
    </>
  );
}

const LOGO = (
  <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#0f2240" /><path d="M32 12v40M20 52h24M14 22h36M14 22l-6 14a7 7 0 0 0 12 0zM50 22l-6 14a7 7 0 0 0 12 0z" stroke="#d4a64a" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export function ReceiptPage() {
  const { id } = useParams();
  const { office } = useAuth();
  const nav = useNavigate();
  const state = useAsync(async () => {
    const p = must(await supabase.from('payment_register').select('*').eq('id', id).single());
    const [kase, client, all] = await Promise.all([
      supabase.from('cases').select('case_number, case_year, court, total_fees, fee_type, currency').eq('id', p.case_id).single().then(must),
      supabase.from('clients').select('phone').eq('id', p.client_id).single().then(must),
      supabase.from('payments').select('id, amount, currency, payment_date, receipt_no').eq('case_id', p.case_id).then(must),
    ]);
    // المدفوع حتى هذا السند (بنفس العملة) لحساب الرصيد بعد الدفعة
    const order = (x) => `${x.payment_date}-${String(x.receipt_no).padStart(9, '0')}`;
    const paidUntil = all.filter((x) => x.currency === p.currency && order(x) <= order(p)).reduce((a, x) => a + Number(x.amount), 0);
    return { p, kase, client, paidUntil };
  }, [id]);

  return (
    <Async state={state}>
      {({ p, kase, client, paidUntil }) => {
        const sameCurrency = kase.currency === p.currency;
        const fees = Number(kase.total_fees || 0);
        const remaining = Math.max(0, fees - paidUntil);
        const showBalance = sameCurrency && fees > 0 && kase.fee_type !== 'pro_bono';
        const no = String(p.receipt_no).padStart(4, '0');
        const purpose = p.notes || `أتعاب المحاماة`;
        const share = () => {
          const lines = [
            `*${office?.name}*`, `سند قبض رقم ${no} — ${date(p.payment_date)}`, '',
            `استلمنا من: ${p.payer_name || p.client_name}`, `المبلغ: ${money(p.amount, p.currency)}`,
            `فقط ${amountInWords(p.amount, p.currency)} لا غير`, `عن: ${purpose} — ${p.case_title}`,
            ...(showBalance ? ['', `إجمالي الأتعاب: ${money(fees, p.currency)}`, `المدفوع حتى الآن: ${money(paidUntil, p.currency)}`, `المتبقي: ${money(remaining, p.currency)}`] : []),
            '', 'شكراً لثقتكم.',
          ];
          const phone = (client.phone || '').replace(/\D/g, '').replace(/^0/, '964');
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
        };
        return (
          <>
            <div className="page-head no-print">
              <button className="btn btn-ghost" onClick={() => nav(-1)}><ArrowRight size={16} />رجوع</button>
              <div className="actions">
                <Link className="btn btn-ghost" to={`/cases/${p.case_id}`}>فتح القضية</Link>
                {client.phone && <button className="btn btn-ghost" onClick={share}><Send size={16} />إرسال للموكل</button>}
                <button className="btn btn-primary" onClick={() => window.print()}><Printer size={17} />طباعة</button>
              </div>
            </div>

            <article className="rc">
              <header className="rc-head">
                <div className="rc-office">
                  <div className="rc-logo">{office?.logo_url ? <img src={office.logo_url} alt="" /> : LOGO}</div>
                  <div>
                    <h2>{office?.name}</h2>
                    <div className="rc-meta">
                      {[office?.address, office?.city].filter(Boolean).join('، ')}
                      {office?.phone && <> · <span className="num">{office.phone}</span></>}
                    </div>
                    {office?.bar_number && <div className="rc-meta">رقم الهوية النقابية: <span className="num">{office.bar_number}</span></div>}
                  </div>
                </div>
                <div className="rc-badge">
                  <div className="rc-badge-title">سند قبض</div>
                  <div className="rc-badge-row"><span>رقم</span><b className="num">{no}</b></div>
                  <div className="rc-badge-row"><span>التاريخ</span><b>{date(p.payment_date)}</b></div>
                </div>
              </header>

              <section className="rc-amount">
                <div className="rc-amount-label">المبلغ المستلم</div>
                <div className="rc-amount-value num">{money(p.amount, p.currency)}</div>
                <div className="rc-amount-words">فقط {amountInWords(p.amount, p.currency)} لا غير</div>
              </section>

              <dl className="rc-fields">
                <div><dt>استلمنا من السيد/ة</dt><dd>{p.payer_name || p.client_name}{p.payer_name && p.payer_name !== p.client_name && <small> (عن الموكل {p.client_name})</small>}</dd></div>
                <div><dt>وذلك عن</dt><dd>{purpose}</dd></div>
                <div><dt>الدعوى</dt><dd>{p.case_title}<small> — ملف رقم {p.file_no}</small></dd></div>
                {(kase.case_number || kase.court) && (
                  <div><dt>رقم الدعوى / المحكمة</dt><dd>{[kase.case_number && `${kase.case_number}${kase.case_year ? `/${kase.case_year}` : ''}`, kase.court].filter(Boolean).join(' — ')}</dd></div>
                )}
                <div><dt>طريقة الدفع</dt><dd>{label(PAYMENT_METHODS, p.method)}{p.reference && <small> — رقم المرجع <span className="num">{p.reference}</span></small>}</dd></div>
              </dl>

              {showBalance && (
                <section className="rc-balance">
                  <div><span>إجمالي الأتعاب</span><b className="num">{money(fees, p.currency)}</b></div>
                  <div><span>المدفوع حتى الآن</span><b className="num">{money(paidUntil, p.currency)}</b></div>
                  <div className={remaining > 0 ? 'due' : 'paid'}><span>المتبقي</span><b className="num">{remaining > 0 ? money(remaining, p.currency) : 'مسدّد بالكامل'}</b></div>
                </section>
              )}

              <section className="rc-sign">
                <div><div className="rc-line" /><b>توقيع المستلم</b><small>{p.created_by_name}</small></div>
                <div><div className="rc-line" /><b>توقيع الدافع</b><small>{p.payer_name || p.client_name}</small></div>
                <div className="rc-stamp">الختم</div>
              </section>

              <footer className="rc-foot">
                {office?.receipt_footer && <div>{office.receipt_footer}</div>}
                <div className="rc-foot-meta">صدر عن نظام ميزان لإدارة مكاتب المحاماة · {dateTime(p.created_at)}</div>
              </footer>
            </article>
          </>
        );
      }}
    </Async>
  );
}
