import { useEffect, useState } from 'react';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import {
  CASE_TYPES, COURT_LEVELS, CLIENT_CAPACITY, CASE_STATUS, PRIORITY, CASE_PRIORITY, TASK_PRIORITY, FEE_TYPES,
  HEARING_STATUS, TASK_STATUS, TASK_TYPES, PAYMENT_METHODS, EXPENSE_CATEGORIES, POA_TYPES, DOC_TYPES, CURRENCIES, opts,
} from '../lib/labels';
import { today } from '../lib/format';
import { Modal, Field, Select, FormShell, useForm, clean, useToast } from './ui';

const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj?.[k] ?? '']));

async function save(table, id, values) {
  const row = clean(values);
  if (id) return must(await supabase.from(table).update(row).eq('id', id).select().single());
  return must(await supabase.from(table).insert(row).select().single());
}

/* ---------- اختيار موكل / قضية ---------- */
function useOptions(table, columns, orderBy) {
  const [list, setList] = useState([]);
  useEffect(() => {
    supabase.from(table).select(columns).order(orderBy).limit(1000).then(({ data }) => setList(data || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);
  return list;
}

function CasePicker({ value, onChange, required }) {
  const cases = useOptions('case_overview', 'id, title, file_no, client_name, currency', 'title');
  return (
    <Select value={value} onChange={onChange} required={required} placeholder="— اختر القضية —"
      options={cases.map((c) => ({ value: c.id, label: `${c.file_no ? `#${c.file_no} ` : ''}${c.title} — ${c.client_name}` }))} />
  );
}
function ClientPicker({ value, onChange, required }) {
  const clients = useOptions('clients', 'id, name', 'name');
  return <Select value={value} onChange={onChange} required={required} placeholder="— اختر الموكل —" options={clients.map((c) => ({ value: c.id, label: c.name }))} />;
}
function MemberPicker({ value, onChange, lawyersOnly, placeholder = '— غير محدد —' }) {
  const { activeMembers, lawyers } = useAuth();
  const list = lawyersOnly ? lawyers : activeMembers;
  return <Select value={value} onChange={onChange} placeholder={placeholder} options={list.map((m) => ({ value: m.user_id, label: m.full_name }))} />;
}

/* ---------- الموكل ---------- */
export function ClientForm({ client, onClose, onSaved }) {
  const toast = useToast();
  const { values, set } = useForm({
    kind: 'individual', ...pick(client, ['name', 'national_id', 'phone', 'phone2', 'email', 'address', 'occupation', 'referred_by', 'notes']),
    ...(client?.kind ? { kind: client.kind } : {}),
  });
  return (
    <Modal title={client ? 'تعديل بيانات الموكل' : 'إضافة موكل جديد'} onClose={onClose}>
      <FormShell onCancel={onClose} onSubmit={async () => {
        const saved = await save('clients', client?.id, values);
        toast(client ? 'تم تحديث بيانات الموكل' : 'تمت إضافة الموكل');
        onSaved?.(saved);
      }}>
        <div className="form-grid">
          <Field label="نوع الموكل">
            <Select value={values.kind} onChange={set('kind')} options={[{ value: 'individual', label: 'شخص طبيعي' }, { value: 'company', label: 'شركة / جهة' }]} />
          </Field>
          <Field label={values.kind === 'company' ? 'اسم الجهة' : 'الاسم الكامل'} required>
            <input value={values.name} onChange={set('name')} required minLength={2} placeholder={values.kind === 'company' ? 'شركة …' : 'الاسم الرباعي واللقب'} />
          </Field>
          <Field label="رقم الهاتف" required>
            <input value={values.phone} onChange={set('phone')} required dir="ltr" placeholder="07xx xxx xxxx" inputMode="tel" />
          </Field>
          <Field label="هاتف بديل">
            <input value={values.phone2} onChange={set('phone2')} dir="ltr" inputMode="tel" />
          </Field>
          <Field label={values.kind === 'company' ? 'رقم التسجيل' : 'رقم البطاقة الوطنية'}>
            <input value={values.national_id} onChange={set('national_id')} dir="ltr" />
          </Field>
          <Field label="البريد الإلكتروني">
            <input type="email" value={values.email} onChange={set('email')} dir="ltr" />
          </Field>
          <Field label="المهنة / النشاط">
            <input value={values.occupation} onChange={set('occupation')} />
          </Field>
          <Field label="جهة التعريف (من أرسله)">
            <input value={values.referred_by} onChange={set('referred_by')} />
          </Field>
          <Field label="العنوان" full>
            <input value={values.address} onChange={set('address')} placeholder="المحافظة، القضاء، المحلة…" />
          </Field>
          <Field label="ملاحظات" full>
            <textarea value={values.notes} onChange={set('notes')} />
          </Field>
        </div>
      </FormShell>
    </Modal>
  );
}

/* ---------- القضية ---------- */
export function CaseForm({ kase, clientId, onClose, onSaved }) {
  const toast = useToast();
  const { office, user, role } = useAuth();
  const { values, set } = useForm({
    client_id: clientId || '', case_type: 'civil', status: 'active', priority: 'normal', fee_type: 'fixed',
    currency: office?.default_currency || 'IQD', total_fees: 0, opened_at: today(),
    assigned_to: role === 'lawyer' ? user.id : '',
    ...Object.fromEntries(Object.entries(pick(kase, ['client_id', 'title', 'case_number', 'case_year', 'case_type', 'court', 'court_level', 'judge',
      'client_capacity', 'opponent_name', 'opponent_lawyer', 'status', 'priority', 'description', 'fee_type', 'total_fees', 'currency', 'opened_at', 'assigned_to'])).filter(([, v]) => kase && v !== '')),
  });
  return (
    <Modal title={kase ? 'تعديل القضية' : 'فتح ملف قضية جديد'} onClose={onClose} size="lg">
      <FormShell onCancel={onClose} onSubmit={async () => {
        const saved = await save('cases', kase?.id, { ...values, total_fees: Number(values.total_fees || 0), case_year: values.case_year || null });
        toast(kase ? 'تم تحديث القضية' : `تم فتح ملف القضية رقم ${saved.file_no}`);
        onSaved?.(saved);
      }}>
        <div className="form-grid cols-3">
          <Field label="الموكل" required>
            <ClientPicker value={values.client_id} onChange={set('client_id')} required />
          </Field>
          <Field label="صفة الموكل">
            <Select value={values.client_capacity} onChange={set('client_capacity')} options={opts(CLIENT_CAPACITY)} placeholder="—" />
          </Field>
          <Field label="المحامي المسؤول">
            <MemberPicker value={values.assigned_to} onChange={set('assigned_to')} lawyersOnly />
          </Field>
          <Field label="موضوع الدعوى" required full>
            <input value={values.title} onChange={set('title')} required minLength={2} placeholder="مثال: دعوى مطالبة بدين / تفريق للضرر…" />
          </Field>
          <Field label="نوع الدعوى">
            <Select value={values.case_type} onChange={set('case_type')} options={opts(CASE_TYPES)} />
          </Field>
          <Field label="رقم الدعوى">
            <input value={values.case_number} onChange={set('case_number')} placeholder="مثال: 1234/ب/2026" />
          </Field>
          <Field label="السنة">
            <input type="number" value={values.case_year} onChange={set('case_year')} min={1990} max={2100} placeholder="2026" />
          </Field>
          <Field label="درجة المحكمة">
            <Select value={values.court_level} onChange={set('court_level')} options={opts(COURT_LEVELS)} placeholder="—" />
          </Field>
          <Field label="المحكمة">
            <input value={values.court} onChange={set('court')} placeholder="مثال: محكمة بداءة الكرخ" />
          </Field>
          <Field label="القاضي">
            <input value={values.judge} onChange={set('judge')} />
          </Field>
          <Field label="الخصم">
            <input value={values.opponent_name} onChange={set('opponent_name')} />
          </Field>
          <Field label="وكيل الخصم">
            <input value={values.opponent_lawyer} onChange={set('opponent_lawyer')} />
          </Field>
          <Field label="تاريخ فتح الملف">
            <input type="date" value={values.opened_at} onChange={set('opened_at')} />
          </Field>
          <Field label="الحالة">
            <Select value={values.status} onChange={set('status')} options={opts(CASE_STATUS)} />
          </Field>
          <Field label="الأولوية">
            <Select value={values.priority} onChange={set('priority')} options={CASE_PRIORITY.map((k) => ({ value: k, label: PRIORITY[k].label }))} />
          </Field>
          <Field label="طريقة الأتعاب">
            <Select value={values.fee_type} onChange={set('fee_type')} options={opts(FEE_TYPES)} />
          </Field>
          <Field label="إجمالي الأتعاب المتفق عليها">
            <input type="number" min={0} step="any" value={values.total_fees} onChange={set('total_fees')} dir="ltr" />
          </Field>
          <Field label="العملة">
            <Select value={values.currency} onChange={set('currency')} options={opts(CURRENCIES)} />
          </Field>
          <Field label="تفاصيل ووقائع الدعوى" full>
            <textarea value={values.description} onChange={set('description')} rows={4} />
          </Field>
        </div>
      </FormShell>
    </Modal>
  );
}

/* ---------- الجلسة ---------- */
export function HearingForm({ hearing, caseId, defaultCourt, onClose, onSaved }) {
  const toast = useToast();
  const { values, set } = useForm({
    case_id: caseId || '', hearing_date: today(), status: 'scheduled', court: defaultCourt || '',
    ...(hearing ? Object.fromEntries(Object.entries(pick(hearing, ['case_id', 'hearing_date', 'hearing_time', 'court', 'room', 'purpose', 'status', 'result', 'next_date', 'notes'])).filter(([, v]) => v !== '')) : {}),
  });
  const closing = ['done', 'postponed'].includes(values.status);
  return (
    <Modal title={hearing ? 'تحديث الجلسة' : 'إضافة جلسة'} onClose={onClose}>
      <FormShell onCancel={onClose} onSubmit={async () => {
        const saved = await save('hearings', hearing?.id, { ...values, hearing_time: values.hearing_time || null });
        toast(values.next_date && closing ? 'تم الحفظ وجدولة الجلسة القادمة تلقائياً' : 'تم حفظ الجلسة');
        onSaved?.(saved);
      }}>
        <div className="form-grid">
          {!caseId && (
            <Field label="القضية" required full><CasePicker value={values.case_id} onChange={set('case_id')} required /></Field>
          )}
          <Field label="تاريخ الجلسة" required><input type="date" value={values.hearing_date} onChange={set('hearing_date')} required /></Field>
          <Field label="الوقت"><input type="time" value={values.hearing_time} onChange={set('hearing_time')} /></Field>
          <Field label="المحكمة"><input value={values.court} onChange={set('court')} /></Field>
          <Field label="القاعة / الهيئة"><input value={values.room} onChange={set('room')} /></Field>
          <Field label="الغرض من الجلسة" full><input value={values.purpose} onChange={set('purpose')} placeholder="مرافعة، تبادل لوائح، استماع شهود، نطق بالحكم…" /></Field>
          <Field label="حالة الجلسة"><Select value={values.status} onChange={set('status')} options={opts(HEARING_STATUS)} /></Field>
          {closing && (
            <Field label="موعد الجلسة القادمة" hint="ستُضاف الجلسة القادمة للتقويم تلقائياً">
              <input type="date" value={values.next_date} onChange={set('next_date')} min={values.hearing_date} />
            </Field>
          )}
          {closing && (
            <Field label="ما جرى في الجلسة / القرار" full><textarea value={values.result} onChange={set('result')} placeholder="مثال: قررت المحكمة تأجيل الدعوى لتبليغ المدعى عليه…" /></Field>
          )}
          <Field label="ملاحظات" full><textarea value={values.notes} onChange={set('notes')} rows={2} /></Field>
        </div>
      </FormShell>
    </Modal>
  );
}

/* ---------- المهمة ---------- */
export function TaskForm({ task, caseId, onClose, onSaved }) {
  const toast = useToast();
  const { user } = useAuth();
  const { values, set } = useForm({
    case_id: caseId || '', task_type: 'other', priority: 'medium', status: 'pending', due_date: today(), reminder_days: 2, assigned_to: user.id,
    ...(task ? Object.fromEntries(Object.entries(pick(task, ['case_id', 'title', 'description', 'task_type', 'priority', 'status', 'due_date', 'due_time', 'reminder_days', 'assigned_to'])).filter(([, v]) => v !== '')) : {}),
  });
  return (
    <Modal title={task ? 'تعديل المهمة' : 'إضافة مهمة'} onClose={onClose}>
      <FormShell onCancel={onClose} onSubmit={async () => {
        const saved = await save('tasks', task?.id, { ...values, reminder_days: Number(values.reminder_days || 0), due_time: values.due_time || null });
        toast('تم حفظ المهمة');
        onSaved?.(saved);
      }}>
        <div className="form-grid">
          <Field label="عنوان المهمة" required full><input value={values.title} onChange={set('title')} required minLength={2} /></Field>
          {!caseId && <Field label="القضية المرتبطة" full hint="اتركه فارغاً لمهمة عامة للمكتب"><CasePicker value={values.case_id} onChange={set('case_id')} /></Field>}
          <Field label="نوع المهمة"><Select value={values.task_type} onChange={set('task_type')} options={opts(TASK_TYPES)} /></Field>
          <Field label="الأولوية"><Select value={values.priority} onChange={set('priority')} options={TASK_PRIORITY.map((k) => ({ value: k, label: PRIORITY[k].label }))} /></Field>
          <Field label="تاريخ الاستحقاق" required><input type="date" value={values.due_date} onChange={set('due_date')} required /></Field>
          <Field label="الوقت"><input type="time" value={values.due_time} onChange={set('due_time')} /></Field>
          <Field label="مسندة إلى"><MemberPicker value={values.assigned_to} onChange={set('assigned_to')} /></Field>
          <Field label="التذكير قبل (أيام)"><input type="number" min={0} max={60} value={values.reminder_days} onChange={set('reminder_days')} /></Field>
          {task && <Field label="الحالة"><Select value={values.status} onChange={set('status')} options={opts(TASK_STATUS)} /></Field>}
          <Field label="التفاصيل" full><textarea value={values.description} onChange={set('description')} rows={3} /></Field>
        </div>
      </FormShell>
    </Modal>
  );
}

/* ---------- سند القبض ---------- */
export function PaymentForm({ payment, caseId, currency, onClose, onSaved }) {
  const toast = useToast();
  const { values, set } = useForm({
    case_id: caseId || '', payment_date: today(), method: 'cash', currency: currency || 'IQD',
    ...(payment ? Object.fromEntries(Object.entries(pick(payment, ['case_id', 'amount', 'currency', 'payment_date', 'method', 'payer_name', 'reference', 'notes'])).filter(([, v]) => v !== '')) : {}),
  });
  return (
    <Modal title={payment ? `تعديل سند القبض #${payment.receipt_no}` : 'سند قبض جديد'} onClose={onClose}>
      <FormShell onCancel={onClose} submitText={payment ? 'حفظ' : 'تسجيل الدفعة'} onSubmit={async () => {
        const saved = await save('payments', payment?.id, { ...values, amount: Number(values.amount) });
        toast(payment ? 'تم تعديل السند' : `تم تسجيل سند القبض رقم ${saved.receipt_no}`);
        onSaved?.(saved);
      }}>
        <div className="form-grid">
          {!caseId && <Field label="القضية" required full><CasePicker value={values.case_id} onChange={set('case_id')} required /></Field>}
          <Field label="المبلغ" required><input type="number" min={0.01} step="any" value={values.amount} onChange={set('amount')} required dir="ltr" autoFocus /></Field>
          <Field label="العملة"><Select value={values.currency} onChange={set('currency')} options={opts(CURRENCIES)} /></Field>
          <Field label="تاريخ القبض" required><input type="date" value={values.payment_date} onChange={set('payment_date')} required /></Field>
          <Field label="طريقة الدفع"><Select value={values.method} onChange={set('method')} options={opts(PAYMENT_METHODS)} /></Field>
          <Field label="اسم الدافع" hint="إن كان غير الموكل"><input value={values.payer_name} onChange={set('payer_name')} /></Field>
          <Field label="رقم المرجع / الحوالة"><input value={values.reference} onChange={set('reference')} dir="ltr" /></Field>
          <Field label="ملاحظات" full><textarea value={values.notes} onChange={set('notes')} rows={2} placeholder="مثال: القسط الثاني من الأتعاب" /></Field>
        </div>
      </FormShell>
    </Modal>
  );
}

/* ---------- المصروف ---------- */
export function ExpenseForm({ expense, caseId, currency, onClose, onSaved }) {
  const toast = useToast();
  const { values, set } = useForm({
    case_id: caseId || '', category: 'court_fees', expense_date: today(), currency: currency || 'IQD', billable: true,
    ...(expense ? Object.fromEntries(Object.entries(pick(expense, ['case_id', 'category', 'amount', 'currency', 'expense_date', 'billable', 'description'])).filter(([, v]) => v !== '')) : {}),
  });
  return (
    <Modal title={expense ? 'تعديل المصروف' : 'تسجيل مصروف'} onClose={onClose}>
      <FormShell onCancel={onClose} onSubmit={async () => {
        const saved = await save('expenses', expense?.id, { ...values, amount: Number(values.amount) });
        toast('تم حفظ المصروف');
        onSaved?.(saved);
      }}>
        <div className="form-grid">
          {!caseId && <Field label="القضية" full hint="اتركه فارغاً لمصاريف المكتب العامة"><CasePicker value={values.case_id} onChange={set('case_id')} /></Field>}
          <Field label="البند"><Select value={values.category} onChange={set('category')} options={opts(EXPENSE_CATEGORIES)} /></Field>
          <Field label="المبلغ" required><input type="number" min={0.01} step="any" value={values.amount} onChange={set('amount')} required dir="ltr" /></Field>
          <Field label="العملة"><Select value={values.currency} onChange={set('currency')} options={opts(CURRENCIES)} /></Field>
          <Field label="التاريخ" required><input type="date" value={values.expense_date} onChange={set('expense_date')} required /></Field>
          <Field label="الوصف" full><input value={values.description} onChange={set('description')} /></Field>
          {(values.case_id || caseId) && (
            <label className="check full"><input type="checkbox" checked={!!values.billable} onChange={set('billable')} /> يُحمَّل على الموكل (يُسترد منه)</label>
          )}
        </div>
      </FormShell>
    </Modal>
  );
}

/* ---------- الوكالة ---------- */
export function PoaForm({ poa, clientId, onClose, onSaved }) {
  const toast = useToast();
  const { values, set } = useForm({
    client_id: clientId || '', poa_type: 'judicial', issue_date: today(),
    ...(poa ? Object.fromEntries(Object.entries(pick(poa, ['client_id', 'poa_number', 'poa_type', 'issuer', 'issue_date', 'expiry_date', 'notes'])).filter(([, v]) => v !== '')) : {}),
  });
  return (
    <Modal title={poa ? 'تعديل الوكالة' : 'تسجيل وكالة'} onClose={onClose}>
      <FormShell onCancel={onClose} onSubmit={async () => {
        const saved = await save('powers_of_attorney', poa?.id, values);
        toast('تم حفظ الوكالة');
        onSaved?.(saved);
      }}>
        <div className="form-grid">
          {!clientId && <Field label="الموكل" required full><ClientPicker value={values.client_id} onChange={set('client_id')} required /></Field>}
          <Field label="نوع الوكالة"><Select value={values.poa_type} onChange={set('poa_type')} options={opts(POA_TYPES)} /></Field>
          <Field label="رقم الوكالة"><input value={values.poa_number} onChange={set('poa_number')} /></Field>
          <Field label="جهة الإصدار" full><input value={values.issuer} onChange={set('issuer')} placeholder="مثال: الكاتب العدل في الكرادة" /></Field>
          <Field label="تاريخ الإصدار"><input type="date" value={values.issue_date} onChange={set('issue_date')} /></Field>
          <Field label="تاريخ الانتهاء" hint="سيصلك تنبيه قبل الانتهاء بـ 30 يوماً"><input type="date" value={values.expiry_date} onChange={set('expiry_date')} /></Field>
          <Field label="ملاحظات" full><textarea value={values.notes} onChange={set('notes')} rows={2} /></Field>
        </div>
      </FormShell>
    </Modal>
  );
}

/* ---------- رفع مستند ---------- */
export function DocumentForm({ caseId, clientId, onClose, onSaved }) {
  const toast = useToast();
  const { office } = useAuth();
  const [file, setFile] = useState(null);
  const { values, set } = useForm({ title: '', doc_type: 'other', description: '', case_id: caseId || '', client_id: clientId || '' });
  return (
    <Modal title="رفع مستند" onClose={onClose}>
      <FormShell onCancel={onClose} submitText="رفع" onSubmit={async () => {
        if (!file) throw new Error('اختر ملفاً للرفع');
        if (file.size > 25 * 1024 * 1024) throw new Error('الحد الأقصى لحجم الملف 25 ميغابايت');
        if (!values.case_id && !values.client_id) throw new Error('اختر القضية أو الموكل');
        const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin';
        const path = `${office.id}/${values.case_id || 'client-' + values.client_id}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from('documents').upload(path, file, { contentType: file.type || 'application/octet-stream' });
        if (up.error) throw new Error('تعذر رفع الملف: ' + up.error.message);
        try {
          const saved = await save('documents', null, {
            ...values, title: values.title || file.name.replace(/\.[^.]+$/, ''), storage_path: path,
            file_name: file.name, mime_type: file.type, size_bytes: file.size,
          });
          toast('تم رفع المستند');
          onSaved?.(saved);
        } catch (e) {
          await supabase.storage.from('documents').remove([path]);
          throw e;
        }
      }}>
        <div className="form-grid">
          {!caseId && !clientId && <Field label="القضية" full><CasePicker value={values.case_id} onChange={set('case_id')} required /></Field>}
          <Field label="الملف" required full hint="PDF، صور، Word… حتى 25 ميغابايت. الملفات محمية ولا يصل إليها إلا أعضاء المكتب">
            <input type="file" onChange={(e) => setFile(e.target.files[0])} required />
          </Field>
          <Field label="عنوان المستند"><input value={values.title} onChange={set('title')} placeholder="يُؤخذ من اسم الملف إن تُرك فارغاً" /></Field>
          <Field label="نوع المستند"><Select value={values.doc_type} onChange={set('doc_type')} options={opts(DOC_TYPES)} /></Field>
          <Field label="وصف" full><textarea value={values.description} onChange={set('description')} rows={2} /></Field>
        </div>
      </FormShell>
    </Modal>
  );
}

export async function openDocument(doc) {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 120, { download: false });
  if (error) throw new Error('تعذر فتح المستند');
  window.open(data.signedUrl, '_blank', 'noopener');
}

export async function deleteDocument(doc) {
  must(await supabase.from('documents').delete().eq('id', doc.id));
  await supabase.storage.from('documents').remove([doc.storage_path]);
}
