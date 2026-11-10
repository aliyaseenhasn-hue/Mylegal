import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { X, CheckCircle2, AlertCircle, Inbox, ChevronRight, ChevronLeft } from 'lucide-react';

/* ---------------- إشعارات منبثقة ---------------- */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, type = 'success') => {
    const id = Math.random();
    setItems((x) => [...x, { id, msg, type }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), type === 'error' ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------------- تحميل البيانات ---------------- */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(fn)
      .then((data) => !cancelled && alive.current && setState({ data, error: null, loading: false }))
      .catch((error) => !cancelled && alive.current && setState({ data: null, error, loading: false }));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

/* ---------------- نافذة ---------------- */
export function Modal({ title, onClose, children, size = '' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق"><X size={20} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({ title = 'تأكيد', message, confirmText = 'تأكيد', danger = true, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <p style={{ marginTop: 0 }}>{message}</p>
      {err && <div className="form-error">{err}</div>}
      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        <button
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          disabled={busy}
          onClick={async () => {
            setBusy(true); setErr('');
            try { await onConfirm(); onClose(); } catch (e) { setErr(e.message); setBusy(false); }
          }}
        >{busy ? 'جارٍ التنفيذ…' : confirmText}</button>
      </div>
    </Modal>
  );
}

/* ---------------- حقول النماذج ---------------- */
export function Field({ label, required, hint, full, children }) {
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      {label && <label>{label}{required && <span className="req"> *</span>}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Select({ value, onChange, options, placeholder, ...rest }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/** نموذج عام: يدير الحالة والإرسال والأخطاء */
export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const set = (k) => (v) => setValues((s) => ({ ...s, [k]: v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }));
  return { values, setValues, set };
}

export function FormShell({ onSubmit, onCancel, submitText = 'حفظ', children }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setErr('');
        try { await onSubmit(); } catch (ex) { setErr(ex.message || 'حدث خطأ'); } finally { setBusy(false); }
      }}
    >
      {children}
      {err && <div className="form-error" style={{ marginTop: 14 }}>{err}</div>}
      <div className="form-actions">
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>إلغاء</button>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'جارٍ الحفظ…' : submitText}</button>
      </div>
    </form>
  );
}

/* ---------------- عناصر عرض ---------------- */
export function Badge({ tone = 'b-gray', children, plain }) {
  return <span className={`badge ${tone} ${plain ? 'plain' : ''}`}>{children}</span>;
}
export function StatusBadge({ map, value }) {
  const v = map[value];
  if (!v) return null;
  return <Badge tone={v.tone}>{v.label}</Badge>;
}

export function Empty({ icon: Icon = Inbox, title = 'لا توجد بيانات', text, action }) {
  return (
    <div className="empty">
      <Icon size={42} strokeWidth={1.4} />
      <b>{title}</b>
      {text && <div className="small">{text}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function Loader({ label }) {
  return <div className="loader"><div className="spinner" />{label && <div className="small" style={{ marginTop: 10 }}>{label}</div>}</div>;
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="empty">
      <AlertCircle size={40} strokeWidth={1.4} color="var(--danger)" />
      <b>تعذر تحميل البيانات</b>
      <div className="small">{error?.message}</div>
      {onRetry && <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={onRetry}>إعادة المحاولة</button>}
    </div>
  );
}

export function Async({ state, children, empty }) {
  if (state.loading && !state.data) return <Loader />;
  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;
  if (empty && (!state.data || (Array.isArray(state.data) && state.data.length === 0) || (state.data.data && state.data.data.length === 0))) return empty;
  return children(state.data);
}

export function Stat({ icon: Icon, label, value, sub, tone = 'tone-navy', to }) {
  const inner = (
    <div className="card stat">
      <div className={`ico ${tone}`}><Icon size={22} /></div>
      <div style={{ minWidth: 0 }}>
        <div className="lbl">{label}</div>
        <div className="val">{value}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
    </div>
  );
  return to ? <a href={`#${to}`}>{inner}</a> : inner;
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={active === t.key} className={active === t.key ? 'active' : ''} onClick={() => onChange(t.key)}>
          {t.icon && <t.icon size={16} />}{t.label}{t.count !== undefined && <span className="n">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return total ? <div className="pager"><span>{total} سجل</span></div> : null;
  return (
    <div className="pager">
      <span>عرض {page * pageSize + 1}–{Math.min(total, (page + 1) * pageSize)} من {total}</span>
      <div className="actions">
        <button className="btn btn-ghost btn-sm btn-icon" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="السابق"><ChevronRight size={16} /></button>
        <span>{page + 1} / {pages}</span>
        <button className="btn btn-ghost btn-sm btn-icon" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label="التالي"><ChevronLeft size={16} /></button>
      </div>
    </div>
  );
}

export function Progress({ value, green }) {
  return <div className={`progress ${green ? 'green' : ''}`}><span style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }} /></div>;
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** تنظيف القيم الفارغة قبل الإرسال لقاعدة البيانات */
export function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = v === '' ? null : v;
  return out;
}

/** إزالة الرموز التي تكسر فلاتر PostgREST */
export function safeLike(s) {
  return String(s).replace(/[,()%*\\:"']/g, ' ').trim();
}
