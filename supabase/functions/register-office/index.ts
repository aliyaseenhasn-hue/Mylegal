// تسجيل مكتب جديد: ينشئ حساب المالك (مؤكداً) ثم المكتب وعضوية المالك
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const recent = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const list = (recent.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  list.push(now);
  recent.set(ip, list);
  return list.length > 5;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) return json({ error: "محاولات كثيرة، حاول لاحقاً" }, 429);

  let body: Record<string, string>;
  try { body = await req.json(); } catch { return json({ error: "طلب غير صالح" }, 400); }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const fullName = String(body.full_name || "").trim();
  const officeName = String(body.office_name || "").trim();
  const phone = String(body.phone || "").trim() || null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "البريد الإلكتروني غير صالح" }, 400);
  if (password.length < 8) return json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, 400);
  if (fullName.length < 2 || fullName.length > 120) return json({ error: "الاسم غير صالح" }, 400);
  if (officeName.length < 2 || officeName.length > 200) return json({ error: "اسم المكتب غير صالح" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (createErr || !created.user) {
    const msg = /already|registered|exists/i.test(createErr?.message || "")
      ? "هذا البريد مسجّل مسبقاً، سجّل الدخول بدلاً من ذلك"
      : "تعذر إنشاء الحساب";
    return json({ error: msg }, 400);
  }

  const { error: officeErr } = await admin.rpc("create_office_with_owner", {
    p_user: created.user.id, p_office_name: officeName, p_full_name: fullName, p_email: email, p_phone: phone,
  });
  if (officeErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: "تعذر إنشاء المكتب" }, 500);
  }
  return json({ ok: true });
});
