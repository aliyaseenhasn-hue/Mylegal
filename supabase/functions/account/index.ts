// استعادة الحساب: رمز إعادة تعيين كلمة المرور عبر البريد، معرفة البريد من رقم الهاتف، تغيير البريد
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.16";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GMAIL_USER = Deno.env.get("GMAIL_USER");
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");
const APP_NAME = "ميزان — إدارة مكتب المحاماة";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const hits = new Map<string, number[]>();
function limited(key: string, max: number) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < 60 * 60 * 1000);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const hashCode = (userId: string, code: string) => sha256(`${userId}:${code}:${SERVICE_KEY}`);

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  const visible = name.length <= 2 ? name[0] : name.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(3, name.length - visible.length))}@${domain}`;
}

async function sendCode(to: string, name: string, code: string) {
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
  await transport.sendMail({
    from: `"${APP_NAME}" <${GMAIL_USER}>`,
    to,
    subject: `رمز استعادة كلمة المرور: ${code}`,
    text: `مرحباً ${name}\nرمز استعادة كلمة المرور هو: ${code}\nالرمز صالح لمدة 15 دقيقة. إذا لم تطلب ذلك فتجاهل هذه الرسالة.`,
    html: `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#f5f3ee;padding:32px">
      <div style="max-width:460px;margin:auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e2d8">
        <div style="background:#0f2240;color:#d4a64a;padding:18px 24px;font-size:22px;font-weight:bold">ميزان</div>
        <div style="padding:24px;color:#1a2233;line-height:1.8">
          <p>مرحباً ${name}،</p>
          <p>طلبت استعادة كلمة المرور لحسابك. استخدم الرمز التالي:</p>
          <div style="font-size:34px;letter-spacing:10px;font-weight:bold;text-align:center;background:#f6ecd6;color:#0f2240;border-radius:10px;padding:14px;margin:18px 0" dir="ltr">${code}</div>
          <p style="color:#4b5567;font-size:13px">الرمز صالح لمدة 15 دقيقة. إذا لم تطلب ذلك فتجاهل هذه الرسالة ولن يتغير شيء.</p>
        </div>
      </div></div>`,
  });
}

async function findMemberByEmail(email: string) {
  const { data } = await admin.from("office_members").select("user_id, full_name, email, active").ilike("email", email).limit(1).maybeSingle();
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  let body: Record<string, string>;
  try { body = await req.json(); } catch { return json({ error: "طلب غير صالح" }, 400); }
  const action = String(body.action || "");

  // ---------- طلب رمز الاستعادة ----------
  if (action === "request_reset") {
    if (limited(`req:${ip}`, 10)) return json({ error: "محاولات كثيرة، حاول بعد ساعة" }, 429);
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      return json({ error: "خدمة إرسال البريد غير مفعّلة بعد. اطلب من مدير المكتب تعيين كلمة مرور جديدة لك" }, 503);
    }
    const email = String(body.email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return json({ error: "البريد الإلكتروني غير صالح" }, 400);
    const member = await findMemberByEmail(email);
    // نرد دائماً بنفس الرسالة كي لا نكشف وجود الحساب
    if (member && member.active) {
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
      const { data: ok } = await admin.rpc("reset_code_create", { p_user: member.user_id, p_hash: await hashCode(member.user_id, code) });
      if (ok) {
        try { await sendCode(email, member.full_name, code); } catch (e) {
          console.error("mail error", e);
          return json({ error: "تعذر إرسال البريد حالياً، حاول لاحقاً" }, 502);
        }
      }
    }
    return json({ ok: true });
  }

  // ---------- تأكيد الرمز وتعيين كلمة المرور ----------
  if (action === "confirm_reset") {
    if (limited(`confirm:${ip}`, 20)) return json({ error: "محاولات كثيرة، حاول بعد ساعة" }, 429);
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").replace(/\D/g, "");
    const password = String(body.password || "");
    if (password.length < 8) return json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, 400);
    if (code.length !== 6) return json({ error: "الرمز يتكون من 6 أرقام" }, 400);
    const member = await findMemberByEmail(email);
    if (!member || !member.active) return json({ error: "الرمز غير صحيح أو منتهي الصلاحية" }, 400);
    const { data: status } = await admin.rpc("reset_code_verify", { p_user: member.user_id, p_hash: await hashCode(member.user_id, code) });
    if (status === "locked") return json({ error: "تجاوزت عدد المحاولات. اطلب رمزاً جديداً" }, 400);
    if (status !== "ok") return json({ error: "الرمز غير صحيح أو منتهي الصلاحية" }, 400);
    const { error } = await admin.auth.admin.updateUserById(member.user_id, { password });
    if (error) return json({ error: "تعذر تعيين كلمة المرور" }, 500);
    return json({ ok: true });
  }

  // ---------- معرفة البريد من رقم الهاتف ----------
  if (action === "find_email") {
    if (limited(`find:${ip}`, 8)) return json({ error: "محاولات كثيرة، حاول بعد ساعة" }, 429);
    const digits = String(body.phone || "").replace(/\D/g, "");
    if (digits.length < 9) return json({ error: "أدخل رقم الهاتف كاملاً" }, 400);
    const tail = digits.slice(-10);
    const { data } = await admin.from("office_members").select("email, phone, active").not("phone", "is", null).limit(5000);
    const emails = (data || [])
      .filter((m) => m.active && m.email && String(m.phone).replace(/\D/g, "").slice(-10) === tail)
      .map((m) => maskEmail(m.email))
      .slice(0, 3);
    return json({ ok: true, emails });
  }

  // ---------- تغيير بريد المستخدم الحالي ----------
  if (action === "change_email") {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth?.user) return json({ error: "يجب تسجيل الدخول" }, 401);
    if (limited(`chg:${auth.user.id}`, 5)) return json({ error: "محاولات كثيرة، حاول بعد ساعة" }, 429);
    const newEmail = String(body.new_email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(newEmail)) return json({ error: "البريد الإلكتروني غير صالح" }, 400);
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { error: pwErr } = await anon.auth.signInWithPassword({ email: auth.user.email!, password: String(body.password || "") });
    if (pwErr) return json({ error: "كلمة المرور الحالية غير صحيحة" }, 400);
    const { error } = await admin.auth.admin.updateUserById(auth.user.id, { email: newEmail, email_confirm: true });
    if (error) return json({ error: /already|registered|exists/i.test(error.message) ? "هذا البريد مستخدم في حساب آخر" : "تعذر تغيير البريد" }, 400);
    await admin.from("office_members").update({ email: newEmail }).eq("user_id", auth.user.id);
    return json({ ok: true });
  }

  return json({ error: "إجراء غير معروف" }, 400);
});
