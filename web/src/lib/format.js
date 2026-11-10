const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export function money(amount, currency = 'IQD') {
  const n = Number(amount || 0);
  if (currency === 'USD') return `$${nf.format(n)}`;
  return `${nf.format(Math.round(n))} د.ع`;
}

export function number(n) {
  return nf.format(Number(n || 0));
}

/** تاريخ اليوم بتوقيت بغداد بصيغة YYYY-MM-DD */
export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baghdad' }).format(new Date());
}

export function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export { MONTHS, DAYS };

export function date(iso, { withDay = false } = {}) {
  if (!iso) return '—';
  const d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00' : iso);
  if (isNaN(d)) return '—';
  const s = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return withDay ? `${DAYS[d.getDay()]}، ${s}` : s;
}

export function shortDate(iso) {
  if (!iso) return '—';
  const d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00' : iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function dateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const t = d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Baghdad' });
  return `${date(iso)} — ${t}`;
}

export function time(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'م' : 'ص';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function daysBetween(fromIso, toIso) {
  const a = new Date(fromIso + 'T00:00:00');
  const b = new Date(toIso + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

export function relativeDay(iso) {
  if (!iso) return '';
  const diff = daysBetween(today(), iso.slice(0, 10));
  if (diff === 0) return 'اليوم';
  if (diff === 1) return 'غداً';
  if (diff === -1) return 'أمس';
  if (diff > 1 && diff <= 10) return `بعد ${diff} أيام`;
  if (diff > 10) return `بعد ${diff} يوماً`;
  if (diff < -1 && diff >= -10) return `قبل ${-diff} أيام`;
  return `قبل ${-diff} يوماً`;
}

export function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'الآن';
  if (s < 3600) return `قبل ${Math.floor(s / 60)} د`;
  if (s < 86400) return `قبل ${Math.floor(s / 3600)} س`;
  if (s < 86400 * 7) return `قبل ${Math.floor(s / 86400)} يوم`;
  return date(iso);
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
}

export function fileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/** تحويل رقم إلى كلمات عربية (للإيصالات) */
export function amountInWords(n, currency = 'IQD') {
  n = Math.floor(Number(n || 0));
  if (n === 0) return 'صفر';
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  const below1000 = (x) => {
    const parts = [];
    const h = Math.floor(x / 100), r = x % 100;
    if (h) parts.push(hundreds[h]);
    if (r) {
      if (r < 20) parts.push(ones[r]);
      else {
        const o = r % 10, t = Math.floor(r / 10);
        parts.push(o ? `${ones[o]} و${tens[t]}` : tens[t]);
      }
    }
    return parts.join(' و');
  };
  const scales = [
    [1e9, ['مليار', 'ملياران', 'مليارات']],
    [1e6, ['مليون', 'مليونان', 'ملايين']],
    [1e3, ['ألف', 'ألفان', 'آلاف']],
  ];
  const parts = [];
  for (const [v, [one, two, many]] of scales) {
    const q = Math.floor(n / v);
    if (q) {
      if (q === 1) parts.push(one);
      else if (q === 2) parts.push(two);
      else if (q <= 10) parts.push(`${below1000(q)} ${many}`);
      else parts.push(`${below1000(q)} ${one}`);
      n %= v;
    }
  }
  if (n) parts.push(below1000(n));
  return parts.join(' و') + (currency === 'USD' ? ' دولار أمريكي' : ' دينار عراقي');
}

/** تصدير CSV متوافق مع Excel (UTF-8 BOM) */
export function exportCsv(filename, columns, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.label)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => esc(c.value(r))).join(','));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
