import { useState } from 'react';
import { Plus, ListChecks } from 'lucide-react';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { today, addDays } from '../lib/format';
import { TASK_TYPES, TASK_PRIORITY, PRIORITY, opts } from '../lib/labels';
import { PageHead } from '../components/Layout';
import { useAsync, Async, Empty, Tabs, Select } from '../components/ui';
import { TaskForm } from '../components/forms';
import { TaskTable } from './Cases';

export default function TasksPage() {
  const { activeMembers, user } = useAuth();
  const t = today();
  const [tab, setTab] = useState('open');
  const [who, setWho] = useState(user.id);
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('');
  const [modal, setModal] = useState(null);

  const state = useAsync(async () => {
    let q = supabase.from('task_board').select('*');
    if (who) q = q.eq('assigned_to', who);
    if (type) q = q.eq('task_type', type);
    if (priority) q = q.eq('priority', priority);
    const open = ['pending', 'in_progress'];
    if (tab === 'open') q = q.in('status', open).order('due_date').order('priority', { ascending: false });
    else if (tab === 'overdue') q = q.in('status', open).lt('due_date', t).order('due_date');
    else if (tab === 'week') q = q.in('status', open).gte('due_date', t).lte('due_date', addDays(t, 7)).order('due_date');
    else q = q.eq('status', 'completed').order('completed_at', { ascending: false }).limit(100);
    return must(await q);
  }, [tab, who, type, priority]);

  return (
    <>
      <PageHead title="المهام والمواعيد" sub="متابعة أعمال الفريق ومواعيد الطعن والمراجعات">
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={18} />مهمة جديدة</button>
      </PageHead>
      <div className="card">
        <Tabs active={tab} onChange={setTab} tabs={[
          { key: 'open', label: 'المفتوحة' }, { key: 'overdue', label: 'المتأخرة' }, { key: 'week', label: 'هذا الأسبوع' }, { key: 'done', label: 'المنجزة' },
        ]} />
        <div className="toolbar">
          <Select value={who} onChange={setWho} options={activeMembers.map((m) => ({ value: m.user_id, label: m.user_id === user.id ? 'مهامي' : m.full_name }))} placeholder="كل الفريق" aria-label="المسؤول" />
          <Select value={type} onChange={setType} options={opts(TASK_TYPES)} placeholder="كل الأنواع" aria-label="النوع" />
          <Select value={priority} onChange={setPriority} options={TASK_PRIORITY.map((k) => ({ value: k, label: PRIORITY[k].label }))} placeholder="كل الأولويات" aria-label="الأولوية" />
        </div>
        <Async state={state} empty={<Empty icon={ListChecks} title={tab === 'overdue' ? 'لا توجد مهام متأخرة' : 'لا توجد مهام'} />}>
          {(tasks) => <TaskTable tasks={tasks} onEdit={(k) => setModal({ task: k })} onChange={state.reload} />}
        </Async>
      </div>
      {modal && <TaskForm task={modal.task} caseId={modal.task?.case_id || undefined} onClose={() => setModal(null)} onSaved={() => { setModal(null); state.reload(); }} />}
    </>
  );
}
