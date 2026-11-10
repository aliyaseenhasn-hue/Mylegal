// إرسال إشعارات الدفع (Web Push) لأجهزة المستخدم
// يُستدعى من قاعدة البيانات فور إنشاء تنبيه (بسرّ داخلي)، أو من المستخدم نفسه لإرسال إشعار تجريبي
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let config: Record<string, string> | null = null;
async function getConfig() {
  if (!config) {
    const { data } = await admin.rpc("push_config");
    config = data || {};
    webpush.setVapidDetails(config!.vapid_subject, config!.vapid_public, config!.vapid_private);
  }
  return config!;
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

async function sendAll(subs: Sub[], payload: Record<string, unknown>) {
  let sent = 0;
  const results = await Promise.allSettled(subs.map((s) =>
    webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
      TTL: 60 * 60 * 24, urgency: "high",
    })));
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      sent++;
      await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).eq("id", subs[i].id);
    } else {
      const code = (r.reason as { statusCode?: number })?.statusCode;
      console.error("push failed", code, String((r.reason as Error)?.message || r.reason).slice(0, 200));
      // الاشتراك منتهٍ أو أُلغي من الجهاز
      if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", subs[i].id);
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const cfg = await getConfig();
  if (!cfg.vapid_private) return json({ error: "الإشعارات غير مهيأة" }, 503);
  let body: Record<string, string> = {};
  try { body = await req.json(); } catch { /* empty */ }

  // ---------- من قاعدة البيانات: تنبيه جديد ----------
  if (req.headers.get("x-push-secret")) {
    if (req.headers.get("x-push-secret") !== cfg.trigger_secret) return json({ error: "forbidden" }, 403);
    const { data: job } = await admin.rpc("push_job", { p_notification: body.notification_id });
    if (!job?.notification || !job.subscriptions?.length) return json({ ok: true, sent: 0 });
    const n = job.notification;
    const sent = await sendAll(job.subscriptions, {
      title: n.title, body: n.body || "", url: `#${n.link || "/notifications"}`, tag: n.id, badge: job.unread,
    });
    await admin.from("notifications").update({ pushed_at: new Date().toISOString() }).eq("id", n.id);
    return json({ ok: true, sent });
  }

  // ---------- من المستخدم: إشعار تجريبي لأجهزته ----------
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth?.user) return json({ error: "يجب تسجيل الدخول" }, 401);
  if (body.action !== "test") return json({ error: "إجراء غير معروف" }, 400);
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", auth.user.id);
  if (!subs?.length) return json({ error: "لا يوجد جهاز مفعّل للإشعارات" }, 400);
  const sent = await sendAll(subs, {
    title: "ميزان — إشعار تجريبي ✅", body: "الإشعارات تعمل على هذا الجهاز. ستصلك تذكيرات الجلسات والمهام هنا.",
    url: "#/notifications", tag: "test",
  });
  return sent ? json({ ok: true, sent }) : json({ error: "تعذر الإرسال لهذا الجهاز. أعد تفعيل الإشعارات" }, 502);
});
