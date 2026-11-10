import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export const FUNCTIONS_URL = `${url}/functions/v1`;

/** يرمي خطأً مفهوماً بالعربية عند فشل استعلام Supabase */
export function must({ data, error, count }) {
  if (error) throw translateError(error);
  return count !== undefined && count !== null ? { data, count } : data;
}

export function translateError(error) {
  const msg = error?.message || String(error);
  const map = [
    [/banned/i, 'هذا الحساب موقوف. تواصل مع مدير المكتب'],
    [/Invalid login credentials/i, 'البريد الإلكتروني أو كلمة المرور غير صحيحة'],
    [/row-level security|permission denied|not allowed/i, 'ليست لديك صلاحية لتنفيذ هذا الإجراء'],
    [/violates foreign key constraint.*(cases_client_id|payments_case_id|expenses_case_id)/i, 'لا يمكن الحذف لوجود سجلات مرتبطة (قضايا أو دفعات). أرشِف السجل بدلاً من حذفه'],
    [/violates foreign key/i, 'لا يمكن الحذف لوجود سجلات مرتبطة به'],
    [/duplicate key/i, 'هذا السجل موجود مسبقاً'],
    [/Failed to fetch|NetworkError|network/i, 'تعذر الاتصال بالخادم. تحقق من الإنترنت'],
    [/JWT expired/i, 'انتهت الجلسة، يرجى تسجيل الدخول مجدداً'],
    [/Password should be at least/i, 'كلمة المرور قصيرة جداً (8 أحرف على الأقل)'],
    [/check constraint/i, 'بعض القيم المدخلة غير صالحة'],
  ];
  for (const [re, ar] of map) if (re.test(msg)) return new Error(ar);
  return new Error(msg);
}

/** استدعاء دالة طرفية */
export async function callFunction(name, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${session?.access_token || key}`,
    },
    body: JSON.stringify(body),
  });
  let json = {};
  try { json = await res.json(); } catch { /* ignore */ }
  if (!res.ok || json.error) throw translateError(new Error(json.error || `خطأ ${res.status}`));
  return json;
}
