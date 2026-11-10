// إدارة فريق المكتب (للمالك والمدير فقط): إنشاء حساب، تعديل الدور، إيقاف/تفعيل، إعادة تعيين كلمة المرور
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ASSIGNABLE = ["admin", "lawyer", "accountant", "secretary"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !auth.user) return json({ error: "يجب تسجيل الدخول" }, 401);

  const { data: me } = await admin.from("office_members").select("office_id, role, active").eq("user_id", auth.user.id).maybeSingle();
  if (!me || !me.active || !["owner", "admin"].includes(me.role)) return json({ error: "ليست لديك صلاحية إدارة الفريق" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "طلب غير صالح" }, 400); }
  const action = String(body.action || "");

  if (action === "create") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const fullName = String(body.full_name || "").trim();
    const role = String(body.role || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "البريد الإلكتروني غير صالح" }, 400);
    if (password.length < 8) return json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, 400);
    if (fullName.length < 2) return json({ error: "الاسم مطلوب" }, 400);
    if (!ASSIGNABLE.includes(role)) return json({ error: "دور غير صالح" }, 400);
    if (role === "admin" && me.role !== "owner") return json({ error: "فقط مالك المكتب يمكنه إضافة مدير" }, 403);

    const { data: created, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: fullName },
    });
    if (error || !created.user) {
      return json({ error: /already|registered|exists/i.test(error?.message || "") ? "هذا البريد مسجّل مسبقاً في النظام" : "تعذر إنشاء الحساب" }, 400);
    }
    const { error: insErr } = await admin.from("office_members").insert({
      office_id: me.office_id, user_id: created.user.id, role, full_name: fullName, email,
      phone: String(body.phone || "") || null, title: String(body.title || "") || null,
    });
    if (insErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: "تعذر إضافة العضو" }, 500);
    }
    return json({ ok: true, user_id: created.user.id });
  }

  const userId = String(body.user_id || "");
  const { data: target } = await admin.from("office_members").select("user_id, role, office_id").eq("user_id", userId).maybeSingle();
  if (!target || target.office_id !== me.office_id) return json({ error: "العضو غير موجود" }, 404);
  if (target.role === "owner") return json({ error: "لا يمكن تعديل حساب مالك المكتب من هنا" }, 403);
  if (target.user_id === auth.user.id) return json({ error: "لا يمكنك تعديل صلاحياتك بنفسك" }, 403);
  if (target.role === "admin" && me.role !== "owner") return json({ error: "فقط مالك المكتب يمكنه تعديل حساب مدير" }, 403);

  if (action === "update") {
    const role = String(body.role || target.role);
    if (!ASSIGNABLE.includes(role)) return json({ error: "دور غير صالح" }, 400);
    if (role === "admin" && me.role !== "owner") return json({ error: "فقط مالك المكتب يمكنه تعيين مدير" }, 403);
    const patch: Record<string, unknown> = { role };
    if (body.full_name) patch.full_name = String(body.full_name).trim();
    if (body.phone !== undefined) patch.phone = String(body.phone || "") || null;
    if (body.title !== undefined) patch.title = String(body.title || "") || null;
    const { error } = await admin.from("office_members").update(patch).eq("user_id", userId);
    return error ? json({ error: "تعذر التحديث" }, 500) : json({ ok: true });
  }

  if (action === "set_active") {
    const active = Boolean(body.active);
    const { error } = await admin.from("office_members").update({ active }).eq("user_id", userId);
    if (error) return json({ error: "تعذر التحديث" }, 500);
    await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
    return json({ ok: true });
  }

  if (action === "update_email") {
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "البريد الإلكتروني غير صالح" }, 400);
    const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
    if (error) return json({ error: /already|registered|exists/i.test(error.message) ? "هذا البريد مستخدم في حساب آخر" : "تعذر تغيير البريد" }, 400);
    await admin.from("office_members").update({ email }).eq("user_id", userId);
    return json({ ok: true });
  }

  if (action === "reset_password") {
    const password = String(body.password || "");
    if (password.length < 8) return json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, 400);
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    return error ? json({ error: "تعذر تعيين كلمة المرور" }, 500) : json({ ok: true });
  }

  return json({ error: "إجراء غير معروف" }, 400);
});
