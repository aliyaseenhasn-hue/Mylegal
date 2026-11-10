import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, Plus, Search, Trash2, ExternalLink, FileText, FileImage, File } from 'lucide-react';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { date, fileSize } from '../lib/format';
import { DOC_TYPES, label, opts } from '../lib/labels';
import { PageHead } from '../components/Layout';
import { useAsync, Async, Empty, Confirm, useToast, Select, useDebounced, safeLike, Pager } from '../components/ui';
import { DocumentForm, openDocument, deleteDocument } from '../components/forms';

const iconFor = (mime = '') => (mime.startsWith('image/') ? FileImage : mime.includes('pdf') || mime.includes('word') ? FileText : File);

function DocRow({ d, onDelete, showCase }) {
  const toast = useToast();
  const { can, user } = useAuth();
  const I = iconFor(d.mime_type || '');
  return (
    <div className="list-item">
      <I size={22} color="var(--accent)" />
      <div className="grow">
        <div className="title">{d.title}</div>
        <div className="small muted">
          {label(DOC_TYPES, d.doc_type)} · {fileSize(d.size_bytes)} · {date(d.created_at)}
          {showCase && d.cases && <> · <Link className="link" to={`/cases/${d.case_id}`}>{d.cases.title}</Link></>}
          {showCase && !d.case_id && d.clients && <> · <Link className="link" to={`/clients/${d.client_id}`}>{d.clients.name}</Link></>}
        </div>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={() => openDocument(d).catch((e) => toast(e.message, 'error'))}><ExternalLink size={14} />فتح</button>
      {(can('deleteCore') || d.created_by === user.id) && <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onDelete(d)} aria-label="حذف"><Trash2 size={14} /></button>}
    </div>
  );
}

export function DocumentList({ caseId, clientId }) {
  const { can } = useAuth();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const state = useAsync(async () => {
    let q = supabase.from('documents').select('*').order('created_at', { ascending: false });
    q = caseId ? q.eq('case_id', caseId) : q.eq('client_id', clientId);
    return must(await q);
  }, [caseId, clientId]);
  return (
    <>
      {can('editCore') && <div className="toolbar"><button className="btn btn-ghost btn-sm" onClick={() => setModal('new')}><Plus size={15} />رفع مستند</button></div>}
      <Async state={state} empty={<Empty icon={FolderOpen} title="لا توجد مستندات" text="ارفع العرائض والعقود والأحكام لتكون في متناول الفريق" />}>
        {(docs) => docs.map((d) => <DocRow key={d.id} d={d} onDelete={(x) => setModal({ del: x })} />)}
      </Async>
      {modal === 'new' && <DocumentForm caseId={caseId} clientId={caseId ? undefined : clientId} onClose={() => setModal(null)} onSaved={() => { setModal(null); state.reload(); }} />}
      {modal?.del && <Confirm title="حذف المستند" message={`سيتم حذف "${modal.del.title}" نهائياً.`} onClose={() => setModal(null)}
        onConfirm={async () => { await deleteDocument(modal.del); toast('تم حذف المستند'); state.reload(); }} />}
    </>
  );
}

const PAGE = 30;
export function DocumentsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState(null);
  const dq = useDebounced(q.trim());
  const state = useAsync(async () => {
    let query = supabase.from('documents').select('*, cases(title), clients(name)', { count: 'exact' }).order('created_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (type) query = query.eq('doc_type', type);
    if (dq) { const s = safeLike(dq); query = query.or(`title.ilike.%${s}%,file_name.ilike.%${s}%`); }
    return must(await query);
  }, [dq, type, page]);
  return (
    <>
      <PageHead title="أرشيف المستندات" sub="كل مستندات المكتب محفوظة بأمان ولا تُفتح إلا لأعضاء المكتب">
        {can('editCore') && <button className="btn btn-primary" onClick={() => setModal('new')}><Plus size={18} />رفع مستند</button>}
      </PageHead>
      <div className="card">
        <div className="toolbar">
          <div className="search-box"><Search size={17} className="icon" /><input placeholder="بحث في المستندات" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
          <Select value={type} onChange={(v) => { setType(v); setPage(0); }} options={opts(DOC_TYPES)} placeholder="كل الأنواع" aria-label="النوع" />
        </div>
        <Async state={state} empty={<Empty icon={FolderOpen} title="لا توجد مستندات" />}>
          {({ data, count }) => (
            <>
              {data.map((d) => <DocRow key={d.id} d={d} showCase onDelete={(x) => setModal({ del: x })} />)}
              <Pager page={page} pageSize={PAGE} total={count} onPage={setPage} />
            </>
          )}
        </Async>
      </div>
      {modal === 'new' && <DocumentForm onClose={() => setModal(null)} onSaved={() => { setModal(null); state.reload(); }} />}
      {modal?.del && <Confirm title="حذف المستند" message={`سيتم حذف "${modal.del.title}" نهائياً.`} onClose={() => setModal(null)}
        onConfirm={async () => { await deleteDocument(modal.del); toast('تم حذف المستند'); state.reload(); }} />}
    </>
  );
}
