# 🤝 دليل المساهمة

شكراً لاهتمامك بالمساهمة في مشروع **Mylegal**! هذا الملف يحتوي على الإرشادات للمساهمة الفعّالة.

## 📋 قبل البدء

1. تأكد من قراءة [README.md](README.md)
2. تحقق من [Issues](https://github.com/aliyaseenhasn-hue/Mylegal/issues) الحالية حتى لا تكرر عملاً قائماً
3. اتبع معايير الكود الخاصة بنا

## 🔄 عملية المساهمة

### 1️⃣ اعمل على Fork للمستودع
```bash
git clone https://github.com/YOUR_USERNAME/Mylegal.git
cd Mylegal
git remote add upstream https://github.com/aliyaseenhasn-hue/Mylegal.git
```

### 2️⃣ أنشئ فرعاً جديداً
```bash
git checkout -b feature/your-feature-name
# أو للإصلاحات:
git checkout -b bugfix/bug-name
```

### 3️⃣ قم بالتعديلات
- اتبع معايير الكود الموجودة
- اكتب تعليقات واضحة وموجزة
- قم باختبار تغييراتك محلياً

### 4️⃣ الالتزام والدفع
```bash
git add .
git commit -m "📝 وصف واضح للتغييرات"
git push origin feature/your-feature-name
```

### 5️⃣ فتح Pull Request
- اذهب إلى GitHub وفتح PR من فرعك
- وصف التغييرات بوضوح
- أضف أي معلومات إضافية ذات صلة

---

## 📝 معايير الكود

### Python/Django
- اتبع [PEP 8](https://www.python.org/dev/peps/pep-0008/)
- استخدم أسماء متغيرات واضحة
- أضف docstrings للدوال والفئات
- اكتب tests للأكواد الجديدة

### الرسائل الملتزمة (Commit Messages)
استخدم الصيغة التالية:
```
[نوع]: وصف موجز

وصف تفصيلي (اختياري)

- النقطة الأولى
- النقطة الثانية
```

**أنواع الالتزام:**
- 🎨 `style`: تحسينات التنسيق والشكل
- 📝 `docs`: تحديثات التوثيق
- ✨ `feat`: ميزة جديدة
- 🐛 `fix`: إصلاح خطأ
- ♻️ `refactor`: إعادة تنظيم الكود
- ⚡ `perf`: تحسينات الأداء
- ✅ `test`: إضافة اختبارات

---

## 🧪 الاختبار

قبل إرسال PR، تأكد من:

```bash
# تشغيل الاختبارات
python manage.py test

# التحقق من معايير الكود
flake8 .

# التحقق من أمان الكود
python manage.py check --deploy
```

---

## 📚 التوثيق

إذا أضفت ميزة جديدة:
1. حدّث README.md إذا لزم الأمر
2. أضف docstrings للكود
3. أضف تعليقات توضيحية

---

## 🎯 أنواع المساهمات المرحب بها

- 🐛 إبلاغ عن الأخطاء
- ✨ اقتراح ميزات جديدة
- 📝 تحسين التوثيق
- 🧪 إضافة اختبارات
- ♻️ تحسين الكود الموجود
- 🌍 ترجمة المشروع

---

## 💬 أسئلة أو مساعدة؟

- استخدم [Discussions](https://github.com/aliyaseenhasn-hue/Mylegal/discussions)
- افتح [Issue](https://github.com/aliyaseenhasn-hue/Mylegal/issues)
- تواصل عبر البريد الإلكتروني

---

شكراً لمساهمتك! 🙏
