import { useState } from 'react';
import { Plus, FileSignature } from 'lucide-react';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { today, addDays } from '../lib/format';
import { PageHead } from '../components/Layout';
import { useAsync, Async, Empty, Tabs } from '../components/ui';
import { PoaForm } from '../components/forms';
import { PoaRow } from './Clients';

export default function PoaPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState('expiring');
  const [modal, setModal] = useState(null);
  const t = today();
  const state = useAsync(async () => {
    let q = supabase.from('poa_register').select('*');
    if (tab === 'expiring') q = q.gte('expiry_date', t).lte('expiry_date', addDays(t, 30)).order('expiry_date');
    else if (tab === 'expired') q = q.lt('expiry_date', t).order('expiry_date', { ascending: false });
    else q = q.order('created_at', { ascending: false });
    return must(await q.limit(300));
  }, [tab]);
  return (
    <>
      <PageHead title="الوكالات" sub="سجل وكالات الموكلين ومتابعة تواريخ انتهائها">
        {can('editCore') && <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={18} />تسجيل وكالة</button>}
      </PageHead>
      <div className="card">
        <Tabs active={tab} onChange={setTab} tabs={[{ key: 'expiring', label: 'تنتهي خلال 30 يوماً' }, { key: 'expired', label: 'المنتهية' }, { key: 'all', label: 'الكل' }]} />
        <Async state={state} empty={<Empty icon={FileSignature} title={tab === 'expiring' ? 'لا توجد وكالات قاربت على الانتهاء' : 'لا توجد وكالات'} />}>
          {(rows) => rows.map((p) => <PoaRow key={p.id} p={p} showClient onEdit={can('editCore') ? () => setModal({ poa: p }) : undefined} />)}
        </Async>
      </div>
      {modal && <PoaForm poa={modal.poa} clientId={modal.poa?.client_id} onClose={() => setModal(null)} onSaved={() => { setModal(null); state.reload(); }} />}
    </>
  );
}
