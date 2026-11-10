import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Briefcase, CalendarDays, ListChecks, Wallet, FileSignature, BarChart3,
  Bell, Settings, LogOut, Search, Menu, Moon, Sun, Scale, History, FolderOpen,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { ROLES } from '../lib/labels';
import { initials } from '../lib/format';
import { useDebounced } from './ui';

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || ''; } catch { return ''; }
  });
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
  }, [theme]);
  const isDark = theme ? theme === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return [isDark, () => setTheme(isDark ? 'light' : 'dark')];
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(0);
  const dq = useDebounced(q.trim(), 250);
  const nav = useNavigate();
  const box = useRef();

  useEffect(() => {
    if (dq.length < 2) { setRes([]); return; }
    supabase.rpc('global_search', { q: dq }).then(({ data }) => { setRes(data || []); setHl(0); });
  }, [dq]);
  useEffect(() => {
    const h = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const href = (r) => (r.kind === 'client' ? `/clients/${r.id}` : r.kind === 'case' ? `/cases/${r.id}` : '/tasks');
  const icons = { client: Users, case: Briefcase, task: ListChecks };
  const go = (r) => { nav(href(r)); setOpen(false); setQ(''); };

  return (
    <div className="search-box" ref={box}>
      <Search size={18} className="icon" />
      <input
        placeholder="ابحث عن موكل، قضية، رقم دعوى، خصم…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHl((h) => Math.min(h + 1, res.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHl((h) => Math.max(h - 1, 0)); }
          if (e.key === 'Enter' && res[hl]) go(res[hl]);
        }}
        aria-label="بحث شامل"
      />
      {open && dq.length >= 2 && (
        <div className="search-results">
          {res.length === 0 && <div className="small muted" style={{ padding: 14 }}>لا توجد نتائج مطابقة</div>}
          {res.map((r, i) => {
            const I = icons[r.kind];
            return (
              <a key={r.kind + r.id} href={`#${href(r)}`} className={i === hl ? 'hl' : ''} onClick={(e) => { e.preventDefault(); go(r); }}>
                <I size={16} color="var(--accent)" />
                <div style={{ minWidth: 0 }}>
                  <div>{r.title}</div>
                  {r.subtitle && <small>{r.subtitle}</small>}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { member, office, can, signOut, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [isDark, toggleTheme] = useTheme();
  const loc = useLocation();

  useEffect(() => setOpen(false), [loc.pathname]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false);
      if (alive) setUnread(count || 0);
    };
    supabase.rpc('refresh_my_notifications').then(load, load);
    const t = setInterval(load, 60000);
    const ch = supabase.channel('notif-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    window.addEventListener('notifications:changed', load);
    return () => { alive = false; clearInterval(t); supabase.removeChannel(ch); window.removeEventListener('notifications:changed', load); };
  }, [user.id]);

  const nav = [
    { section: 'الرئيسية' },
    { to: '/', icon: LayoutDashboard, label: 'لوحة التحكم', end: true },
    { to: '/calendar', icon: CalendarDays, label: 'الجلسات والتقويم' },
    { to: '/tasks', icon: ListChecks, label: 'المهام والمواعيد' },
    { section: 'العمل القانوني' },
    { to: '/clients', icon: Users, label: 'الموكلون' },
    { to: '/cases', icon: Briefcase, label: 'القضايا' },
    { to: '/poa', icon: FileSignature, label: 'الوكالات' },
    { to: '/documents', icon: FolderOpen, label: 'المستندات' },
    ...(can('viewFinance') ? [{ section: 'المالية' }, { to: '/finance', icon: Wallet, label: 'الحسابات' }] : []),
    ...(can('viewReports') ? [{ to: '/reports', icon: BarChart3, label: 'التقارير' }] : []),
    { section: 'المكتب' },
    { to: '/notifications', icon: Bell, label: 'التنبيهات', count: unread },
    ...(can('viewActivity') ? [{ to: '/activity', icon: History, label: 'سجل النشاط' }] : []),
    { to: '/settings', icon: Settings, label: 'الإعدادات' },
  ];

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">{office?.logo_url ? <img src={office.logo_url} alt="" /> : <Scale size={22} />}</div>
          <div style={{ minWidth: 0 }}>
            <div className="brand-name">ميزان</div>
            <div className="brand-sub" title={office?.name}>{office?.name}</div>
          </div>
        </div>
        <nav className="nav">
          {nav.map((n, i) =>
            n.section ? <div key={i} className="nav-section">{n.section}</div> : (
              <NavLink key={n.to} to={n.to} end={n.end}>
                <n.icon size={19} />{n.label}{n.count > 0 && <span className="count">{n.count}</span>}
              </NavLink>
            ),
          )}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="avatar">{initials(member?.full_name)}</div>
            <div className="meta">
              <b>{member?.full_name}</b>
              <span>{ROLES[member?.role]}</span>
            </div>
            <button className="icon-btn" style={{ color: '#8d9ab3' }} onClick={signOut} title="تسجيل الخروج" aria-label="تسجيل الخروج"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar no-print">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="القائمة"><Menu size={22} /></button>
          <GlobalSearch />
          <div className="topbar-actions">
            <button className="icon-btn" onClick={toggleTheme} title="تبديل المظهر" aria-label="تبديل المظهر">{isDark ? <Sun size={19} /> : <Moon size={19} />}</button>
            <NavLink to="/notifications" className="icon-btn" title="التنبيهات" aria-label="التنبيهات">
              <Bell size={19} />{unread > 0 && <span className="dot">{unread > 99 ? '99+' : unread}</span>}
            </NavLink>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHead({ title, sub, crumbs, children }) {
  return (
    <div className="page-head">
      <div>
        {crumbs && (
          <div className="crumbs">
            {crumbs.map((c, i) => (
              <span key={i}>{c.to ? <a href={`#${c.to}`}>{c.label}</a> : c.label}{i < crumbs.length - 1 && ' / '}</span>
            ))}
          </div>
        )}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}
