# 🔧 التثبيت المفصل

دليل التثبيت الكامل على جميع الأنظمة.

## المتطلبات

- **Python**: 3.8 أو أحدث
- **pip**: مدير الحزم (يأتي مع Python)
- **Git**: للاستنساخ
- **قاعدة البيانات**: SQLite (افتراضي) أو PostgreSQL

---

## التثبيت على Linux/Mac

### 1. تثبيت Python والمتطلبات الأساسية

```bash
# على Ubuntu/Debian
sudo apt-get update
sudo apt-get install python3 python3-pip python3-venv git

# على macOS (باستخدام Homebrew)
brew install python git
```

### 2. استنساخ المستودع

```bash
git clone https://github.com/aliyaseenhasn-hue/Mylegal.git
cd Mylegal
```

### 3. إنشاء بيئة افتراضية

```bash
python3 -m venv venv
source venv/bin/activate
```

### 4. تثبيت المتطلبات

```bash
pip install -r requirements.txt
```

### 5. الهجرات

```bash
python manage.py migrate
```

### 6. إنشاء مستخدم إداري (اختياري)

```bash
python manage.py createsuperuser
```

### 7. تشغيل السيرفر

```bash
python manage.py runserver
```

---

## التثبيت على Windows

### 1. تثبيت Python

- نزّل من: https://www.python.org/downloads/
- تأكد من تفعيل "Add Python to PATH" أثناء التثبيت

### 2. استنساخ المستودع

```bash
git clone https://github.com/aliyaseenhasn-hue/Mylegal.git
cd Mylegal
```

### 3. إنشاء بيئة افتراضية

```bash
python -m venv venv
venv\Scripts\activate
```

### 4. تثبيت المتطلبات

```bash
pip install -r requirements.txt
```

### 5. الهجرات

```bash
python manage.py migrate
```

### 6. تشغيل السيرفر

```bash
python manage.py runserver
```

---

## التثبيت مع Docker (اختياري)

```bash
# بناء الصورة
docker build -t mylegal .

# تشغيل الحاوية
docker run -p 8000:8000 mylegal
```

---

## إعدادات قاعدة البيانات

### SQLite (الافتراضي)
لا يتطلب أي تثبيت إضافي - يعمل مباشرة!

### PostgreSQL

```bash
# التثبيت
pip install psycopg2-binary

# تحديث settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'mylegal_db',
        'USER': 'postgres',
        'PASSWORD': 'your_password',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

---

## التحقق من التثبيت

```bash
# فحص البيئة
python manage.py check

# تشغيل الاختبارات
python manage.py test
```

---

## 🆘 حل المشاكل الشائعة

### خطأ: "Python not found"
- تأكد من تثبيت Python
- أضفه إلى PATH

### خطأ: "Module not found"
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### مشكلة مع البيئة الافتراضية
```bash
# حذف البيئة القديمة
rm -rf venv

# إنشاء بيئة جديدة
python -m venv venv
source venv/bin/activate
```

---

الخطوة التالية: [البدء السريع](./QUICKSTART.md)
