// لوحة المشرف العام للمنصة: كل المكاتب والحسابات، إيقاف/تفعيل، إعادة تعيين كلمة المرور، تغيير البريد
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth?.user) return json({ error: "يجب تسجيل الدخول" }, 401);
  const { data: isAdmin } = await admin.rpc("is_platform_admin", { p_user: auth.user.id });
  if (!isAdmin) return json({ error: "هذه الصفحة للمشرف العام فقط" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "طلب غير صالح" }, 400); }
  const action = String(body.action || "");
  const userId = String(body.user_id || "");
  const self = userId === auth.user.id;

  if (action === "overview") {
    const { data, error } = await admin.rpc("platform_overview");
    return error ? json({ error: "تعذر تحميل البيانات" }, 500) : json(data);
  }

  if (action === "set_office_active") {
    const officeId = String(body.office_id || "");
    const { data: mine } = await admin.from("office_members").select("office_id").eq("user_id", auth.user.id).maybeSingle();
    if (mine?.office_id === officeId && !body.active) return json({ error: "لا يمكنك إيقاف مكتبك أنت" }, 400);
    const { error } = await admin.from("offices").update({ active: Boolean(body.active) }).eq("id", officeId);
    return error ? json({ error: "تعذر التحديث" }, 500) : json({ ok: true });
  }

  if (action === "set_user_active") {
    if (self) return json({ error: "لا يمكنك إيقاف حسابك" }, 400);
    const active = Boolean(body.active);
    // الحارس في قاعدة البيانات يتجاوز service_role، لذا يُسمح هنا بإيقاف المالك أيضاً
    const { error } = await admin.from("office_members").update({ active }).eq("user_id", userId);
    if (error) return json({ error: "تعذر التحديث" }, 500);
    await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
    return json({ ok: true });
  }

  if (action === "reset_password") {
    const password = String(body.password || "");
    if (password.length < 8) return json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, 400);
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    return error ? json({ error: "تعذر تعيين كلمة المرور" }, 500) : json({ ok: true });
  }

  if (action === "update_email") {
    const email = String(body.email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return json({ error: "البريد الإلكتروني غير صالح" }, 400);
    const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
    if (error) return json({ error: /already|registered|exists/i.test(error.message) ? "هذا البريد مستخدم في حساب آخر" : "تعذر تغيير البريد" }, 400);
    await admin.from("office_members").update({ email }).eq("user_id", userId);
    return json({ ok: true });
  }

  return json({ error: "إجراء غير معروف" }, 400);
});
