import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, must } from './supabase';

const AuthCtx = createContext(null);

const PERMS = {
  manageOffice: ['owner', 'admin'],
  editCore: ['owner', 'admin', 'lawyer', 'secretary'],
  deleteCore: ['owner', 'admin'],
  viewFinance: ['owner', 'admin', 'accountant', 'lawyer'],
  editFinance: ['owner', 'admin', 'accountant'],
  deleteFinance: ['owner', 'admin'],
  viewReports: ['owner', 'admin', 'accountant'],
  viewActivity: ['owner', 'admin'],
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [ctx, setCtx] = useState(null);
  const [members, setMembers] = useState([]);
  const [loadingCtx, setLoadingCtx] = useState(false);

  const loadContext = useCallback(async () => {
    setLoadingCtx(true);
    try {
      const data = must(await supabase.rpc('my_context'));
      setCtx(data || null);
      if (data) {
        const list = must(await supabase.from('office_members').select('*').order('full_name'));
        setMembers(list);
      }
    } catch (e) {
      console.error(e);
      setCtx(null);
    } finally {
      setLoadingCtx(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_OUT') { setCtx(null); setMembers([]); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadContext();
  }, [session?.user?.id, loadContext]);

  const role = ctx?.member?.role;
  const can = useCallback((perm) => !!role && (PERMS[perm] || []).includes(role), [role]);

  const value = {
    session,
    user: session?.user,
    member: ctx?.member,
    office: ctx?.office,
    role,
    members,
    activeMembers: members.filter((m) => m.active),
    lawyers: members.filter((m) => m.active && ['owner', 'admin', 'lawyer'].includes(m.role)),
    can,
    loading: session === undefined || (session && loadingCtx && !ctx),
    reload: loadContext,
    signOut: () => supabase.auth.signOut(),
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export function memberName(members, id) {
  return members.find((m) => m.user_id === id)?.full_name || '—';
}
