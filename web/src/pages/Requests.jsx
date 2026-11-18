import { useState } from 'react';
import { Inbox, MessageCircle, Phone, UserPlus, Check, RotateCcw, Archive } from 'lucide-react';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { dateTime, timeAgo } from '../lib/format';
import { PageHead } from '../components/Layout';
import { useAsync, Async, Empty, Tabs, Badge, useToast } from '../components/ui';
import { ClientForm } from '../components/forms';

/** حالات طلبات الاستشارة الواردة من موقع المكتب (القيم مخزنة بالعربية في قاعدة البيانات) */
export const REQUEST_STATUS = {
  'جديد': { label: 'جديد', tone: 'b-gold' },
  'تم التواصل': { label: 'تم التواصل', tone: 'b-blue' },
  'مغلق': { label: 'مغلق', tone: 'b-gray' },
};

/** يحوّل رقماً عراقياً محلياً (07…) إلى صيغة دولية لروابط واتساب */
function waNumber(phone = '') {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('964')) return d;
  if (d.startsWith('0')) return '964' + d.slice(1);
  return d;
}

export default function RequestsPage() {
  const toast = useToast();
  const { can } = useAuth();
  const [tab, setTab] = useState('جديد');
  const [convert, setConvert] = useState(null);

  const state = useAsync(async () => {
    let q = supabase.from('consultation_requests').select('*').order('created_at', { ascending: false }).limit(200);
    if (tab !== 'all') q = q.eq('status', tab);
    return must(await q);
  }, [tab]);

  const setStatus = async (r, status) => {
    must(await supabase.from('consultation_requests').update({ status }).eq('id', r.id));
    toast(status === 'مغلق' ? 'تم إغلاق الطلب' : status === 'جديد' ? 'أُعيد الطلب إلى الجديدة' : 'تم تعليم الطلب: تم التواصل');
    state.reload();
  };

  return (
    <>
      <PageHead title="طلبات الاستشارة" sub="الطلبات الواردة من نموذج موقع المكتب" />
      <div className="card">
        <Tabs active={tab} onChange={setTab} tabs={[
          { key: 'جديد', label: 'الجديدة' }, { key: 'تم التواصل', label: 'تم التواصل' }, { key: 'مغلق', label: 'المغلقة' }, { key: 'all', label: 'الكل' },
        ]} />
        <Async state={state} empty={<Empty icon={Inbox} title={tab === 'جديد' ? 'لا توجد طلبات جديدة' : 'لا توجد طلبات'} text="عندما يرسل أحد طلب استشارة من موقع المكتب، يظهر هنا ويصلك تنبيه." />}>
          {(rows) => rows.map((r) => (
            <div key={r.id} className="list-item" style={{ alignItems: 'flex-start', flexWrap: 'wrap', ...(r.status === 'جديد' ? { background: 'var(--accent-soft)' } : null) }}>
              <div className="grow" style={{ minWidth: 220 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b>{r.full_name}</b>
                  <Badge tone={REQUEST_STATUS[r.status]?.tone}>{r.status}</Badge>
                  <Badge tone="b-gray" plain>{r.case_type}</Badge>
                </div>
                <div className="small muted" style={{ marginTop: 2 }}>
                  <span dir="ltr">{r.phone}</span> · يفضّل: {r.preferred_contact} · <span title={dateTime(r.created_at)}>{timeAgo(r.created_at)}</span>
                </div>
                <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.message}</p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <a className="btn btn-ghost btn-sm" href={`https://wa.me/${waNumber(r.phone)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} />واتساب</a>
                <a className="btn btn-ghost btn-sm" href={`tel:${r.phone.replace(/\s/g, '')}`}><Phone size={15} />اتصال</a>
                {can('editCore') && <button className="btn btn-ghost btn-sm" onClick={() => setConvert(r)}><UserPlus size={15} />إضافة كموكل</button>}
                {r.status === 'جديد' && <button className="btn btn-primary btn-sm" onClick={() => setStatus(r, 'تم التواصل')}><Check size={15} />تم التواصل</button>}
                {r.status !== 'مغلق' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(r, 'مغلق')}><Archive size={15} />إغلاق</button>}
                {r.status !== 'جديد' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(r, 'جديد')}><RotateCcw size={15} />إعادة فتح</button>}
              </div>
            </div>
          ))}
        </Async>
      </div>
      {convert && (
        <ClientForm
          initial={{ name: convert.full_name, phone: convert.phone, notes: `طلب استشارة من الموقع (${convert.case_type}):\n${convert.message}` }}
          onClose={() => setConvert(null)}
          onSaved={async (client) => {
            const r = convert;
            setConvert(null);
            if (r.status === 'جديد') await supabase.from('consultation_requests').update({ status: 'تم التواصل' }).eq('id', r.id);
            state.reload();
            if (client?.id) window.location.hash = `#/clients/${client.id}`;
          }}
        />
      )}
    </>
  );
}
