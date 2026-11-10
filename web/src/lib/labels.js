// قوائم الاختيارات والمسميات العربية (متوافقة مع قيود قاعدة البيانات)

export const ROLES = {
  owner: 'مالك المكتب',
  admin: 'مدير',
  lawyer: 'محامٍ',
  accountant: 'محاسب',
  secretary: 'سكرتير',
};

export const CASE_STATUS = {
  preparing: { label: 'قيد التحضير', tone: 'b-blue' },
  active: { label: 'منظورة', tone: 'b-green' },
  suspended: { label: 'موقوفة', tone: 'b-amber' },
  won: { label: 'كسب', tone: 'b-gold' },
  lost: { label: 'خسارة', tone: 'b-red' },
  settled: { label: 'صلح', tone: 'b-blue' },
  closed: { label: 'مغلقة', tone: 'b-gray' },
  archived: { label: 'مؤرشفة', tone: 'b-gray' },
};
export const OPEN_CASE_STATUSES = ['preparing', 'active', 'suspended'];

export const CASE_TYPES = {
  civil: 'مدني',
  criminal: 'جزائي',
  misdemeanor: 'جنح',
  personal_status: 'أحوال شخصية',
  commercial: 'تجاري',
  labor: 'عمل',
  administrative: 'إداري',
  real_estate: 'عقاري',
  execution: 'تنفيذ',
  other: 'أخرى',
};

export const COURT_LEVELS = {
  first_instance: 'محكمة البداءة',
  personal_status: 'محكمة الأحوال الشخصية',
  misdemeanor: 'محكمة الجنح',
  felony: 'محكمة الجنايات',
  investigation: 'محكمة التحقيق',
  labor: 'محكمة العمل',
  administrative: 'محكمة القضاء الإداري',
  appeal: 'محكمة الاستئناف',
  cassation: 'محكمة التمييز',
  execution: 'مديرية التنفيذ',
  other: 'أخرى',
};

export const CLIENT_CAPACITY = {
  plaintiff: 'مدعي',
  defendant: 'مدعى عليه',
  complainant: 'مشتكي',
  accused: 'متهم',
  appellant: 'مستأنِف / مميِّز',
  respondent: 'مستأنَف عليه',
  other: 'أخرى',
};

export const PRIORITY = {
  low: { label: 'منخفضة', tone: 'b-gray' },
  normal: { label: 'عادية', tone: 'b-blue' },
  medium: { label: 'متوسطة', tone: 'b-blue' },
  high: { label: 'عالية', tone: 'b-amber' },
  urgent: { label: 'عاجلة', tone: 'b-red' },
};
export const CASE_PRIORITY = ['low', 'normal', 'high', 'urgent'];
export const TASK_PRIORITY = ['low', 'medium', 'high', 'urgent'];

export const FEE_TYPES = {
  fixed: 'مبلغ مقطوع',
  installments: 'أقساط',
  percentage: 'نسبة من المحكوم به',
  pro_bono: 'مجاني / تطوعي',
};

export const HEARING_STATUS = {
  scheduled: { label: 'مجدولة', tone: 'b-blue' },
  done: { label: 'منعقدة', tone: 'b-green' },
  postponed: { label: 'مؤجلة', tone: 'b-amber' },
  cancelled: { label: 'ملغاة', tone: 'b-gray' },
};

export const TASK_STATUS = {
  pending: { label: 'بانتظار التنفيذ', tone: 'b-gray' },
  in_progress: { label: 'قيد التنفيذ', tone: 'b-blue' },
  completed: { label: 'مكتملة', tone: 'b-green' },
  cancelled: { label: 'ملغاة', tone: 'b-gray' },
};

export const TASK_TYPES = {
  document: 'إعداد / تقديم مستند',
  deadline: 'موعد قانوني',
  appeal: 'مدة طعن',
  meeting: 'اجتماع / موعد',
  call: 'اتصال',
  follow_up: 'متابعة دائرة',
  payment: 'تحصيل أتعاب',
  other: 'أخرى',
};

export const PAYMENT_METHODS = {
  cash: 'نقداً',
  bank_transfer: 'تحويل مصرفي',
  zaincash: 'زين كاش',
  qi_card: 'كي كارد',
  check: 'صك',
  other: 'أخرى',
};

export const EXPENSE_CATEGORIES = {
  court_fees: 'رسوم قضائية',
  stamps: 'طوابع',
  notification: 'تبليغات',
  expert: 'أجور خبير',
  translation: 'ترجمة',
  transport: 'نقل وتنقل',
  office: 'نثرية مكتب',
  salary: 'رواتب',
  rent: 'إيجار',
  other: 'أخرى',
};

export const POA_TYPES = {
  judicial: 'وكالة قضائية',
  general: 'وكالة عامة',
  special: 'وكالة خاصة',
  other: 'أخرى',
};

export const DOC_TYPES = {
  petition: 'عريضة / لائحة',
  contract: 'عقد',
  power_of_attorney: 'وكالة',
  court_order: 'قرار محكمة',
  judgment: 'حكم',
  evidence: 'مستند إثبات',
  memo: 'مذكرة',
  correspondence: 'مراسلة',
  id_document: 'مستمسك شخصي',
  other: 'أخرى',
};

export const CURRENCIES = { IQD: 'دينار عراقي', USD: 'دولار أمريكي' };

export const opts = (obj) => Object.entries(obj).map(([value, v]) => ({ value, label: typeof v === 'string' ? v : v.label }));
export const label = (obj, key) => {
  const v = obj?.[key];
  return v ? (typeof v === 'string' ? v : v.label) : '—';
};
