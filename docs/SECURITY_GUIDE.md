# 🔐 دليل الأمان والفحوصات

تعليمات شاملة لتحسين الأمان في مشروع Mylegal.

---

## 1️⃣ فحوصات الأمان الأساسية

### ✅ قائمة التحقق من الأمان

```bash
# الخطوة 1: فك ضغط الملف
unzip "legal manager django.zip"

# الخطوة 2: البحث عن مشاكل أمنية شائعة
grep -r "SECRET_KEY = " legal_manager/
grep -r "DEBUG = True" legal_manager/
grep -r "ALLOWED_HOSTS = " legal_manager/
grep -r "password" legal_manager/
grep -r "api_key" legal_manager/
```

---

## 2️⃣ مشاكل الأمان الشائعة وحلولها

### مشكلة 1: SECRET_KEY مكشوفة

**❌ الكود السيء:**
```python
# في settings.py
SECRET_KEY = 'django-insecure-your-secret-key-12345'
DEBUG = True
ALLOWED_HOSTS = ['*']
```

**✅ الحل الصحيح:**
```python
# في settings.py
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv('SECRET_KEY')
DEBUG = os.getenv('DEBUG', 'False') == 'True'
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost').split(',')

if not SECRET_KEY:
    raise ValueError("SECRET_KEY must be set in environment variables")
```

**ملف `.env`:**
```
SECRET_KEY=your-very-long-random-secret-key-here-change-me
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DATABASE_URL=postgresql://user:password@localhost:5432/mylegal_db
```

---

### مشكلة 2: SQL Injection

**❌ الكود السيء:**
```python
def search_clients(name):
    # خطير جداً!
    query = f"SELECT * FROM clients_client WHERE name = '{name}'"
    clients = Client.objects.raw(query)
    return clients
```

**✅ الحل الصحيح:**
```python
def search_clients(name):
    # آمن - استخدام ORM
    clients = Client.objects.filter(name__icontains=name)
    return clients

# أو إذا كان يجب استخدام raw queries:
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute("SELECT * FROM clients_client WHERE name = %s", [name])
    clients = cursor.fetchall()
```

---

### مشكلة 3: Cross-Site Scripting (XSS)

**❌ الكود السيء:**
```html
<!-- في template -->
<h1>{{ client.name }}</h1>
<p>{{ client.bio }}</p>
```

**✅ الحل الصحيح:**
```html
<!-- في template - Django يفعل هذا تلقائياً -->
<h1>{{ client.name }}</h1>
<p>{{ client.bio|escape }}</p>

<!-- أو استخدم |safe فقط للبيانات الموثوقة -->
<div>{{ trusted_html_content|safe }}</div>
```

---

### مشكلة 4: CSRF Attack

**❌ الكود السيء:**
```html
<form method="POST" action="/clients/create/">
    <input type="text" name="name">
    <button>إضافة</button>
</form>
```

**✅ الحل الصحيح:**
```html
<form method="POST" action="/clients/create/">
    {% csrf_token %}
    <input type="text" name="name">
    <button>إضافة</button>
</form>
```

**في Views:**
```python
from django.middleware.csrf import csrf_protect
from django.views.decorators.http import require_http_methods

@csrf_protect
@require_http_methods(["POST"])
def create_client(request):
    name = request.POST.get('name')
    # معالجة البيانات
    return redirect('client_list')
```

---

### مشكلة 5: Authentication & Authorization

**❌ الكود السيء:**
```python
def get_client_details(request, client_id):
    client = Client.objects.get(id=client_id)
    return render(request, 'client_detail.html', {'client': client})
```

**✅ الحل الصحيح:**
```python
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied

@login_required(login_url='login')
def get_client_details(request, client_id):
    client = Client.objects.get(id=client_id)
    
    # التحقق من الصلاحيات
    if client.created_by != request.user:
        raise PermissionDenied("ليس لديك الصلاحية لعرض هذا العميل")
    
    return render(request, 'client_detail.html', {'client': client})
```

---

### مشكلة 6: Password Security

**❌ الكود السيء:**
```python
def authenticate_user(username, password):
    user = User.objects.get(username=username)
    if user.password == password:  # خطر!
        return user
    return None
```

**✅ الحل الصحيح:**
```python
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import make_password, check_password

def authenticate_user(username, password):
    user = authenticate(username=username, password=password)
    return user

# أو للتخزين المباشر:
def create_user_with_password(username, password):
    hashed_password = make_password(password)
    user = User.objects.create(username=username, password=hashed_password)
    return user

def verify_password(stored_password, provided_password):
    return check_password(provided_password, stored_password)
```

---

## 3️⃣ إعدادات الأمان الموصى بها

### في `settings.py`:

```python
# ✅ الأمان
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_SECURITY_POLICY = {
    'default-src': ("'self'",),
    'script-src': ("'self'", "'unsafe-inline'"),
}

# ✅ Session Security
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_AGE = 3600  # ساعة واحدة

# ✅ Password Validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8}
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# ✅ Database Security
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST'),
        'PORT': os.getenv('DB_PORT', '5432'),
        'ATOMIC_REQUESTS': True,
    }
}

# ✅ Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'WARNING',
            'class': 'logging.FileHandler',
            'filename': 'logs/security.log',
        },
    },
    'loggers': {
        'django.security': {
            'handlers': ['file'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}
```

---

## 4️⃣ الاختبارات الأمنية

### اختبر SQL Injection:

```python
def test_sql_injection_protection():
    # محاولة حقن SQL
    malicious_input = "' OR '1'='1"
    clients = Client.objects.filter(name__icontains=malicious_input)
    # يجب أن تعود نتيجة آمنة بدون خطأ
    assert isinstance(clients, list)
```

### اختبر XSS Protection:

```python
def test_xss_protection():
    xss_payload = "<script>alert('XSS')</script>"
    client = Client.objects.create(name=xss_payload)
    # عند عرض الاسم في template، يجب أن يكون محمياً
    assert client.name == xss_payload
    # لكن عند العرض في HTML، Django سيفسره كـ نص عادي
```

### اختبر CSRF Protection:

```python
from django.test import TestCase
from django.test.client import Client as TestClient

def test_csrf_protection():
    client = TestClient(enforce_csrf_checks=True)
    response = client.post('/clients/create/', {'name': 'Test'})
    # يجب أن تحصل على 403 بدون CSRF token
    assert response.status_code == 403
```

---

## 5️⃣ أدوات الفحص الأمني

### تثبيت أدوات الفحص:

```bash
pip install bandit pylint safety flake8
```

### فحص الأكواد:

```bash
# Bandit - فحص مشاكل الأمان
bandit -r legal_manager/

# Pylint - فحص جودة الكود
pylint legal_manager/

# Safety - فحص المكتبات المعيبة
safety check

# Flake8 - فحص معايير PEP 8
flake8 legal_manager/
```

### مثال على تقرير Bandit:

```
>> Issue: [B602:shell_injection] Starting a process with a shell, possible
   injection detected, security issue.
   Severity: High   Confidence: High
   Location: ./legal_manager/clients/views.py:10
   10  os.system(user_input)  # ❌ خطر جداً
```

---

## 6️⃣ قائمة الفحص النهائية

قبل نشر التطبيق في الإنتاج:

- [ ] ✅ تم تعطيل DEBUG
- [ ] ✅ تم تعيين SECRET_KEY من متغيرات البيئة
- [ ] ✅ تم تعيين ALLOWED_HOSTS بشكل صحيح
- [ ] ✅ تم تفعيل HTTPS/SSL
- [ ] ✅ تم حماية جميع النماذج بـ CSRF tokens
- [ ] ✅ تم استخدام Django ORM فقط (لا raw queries)
- [ ] ✅ تم التحقق من صحة جميع المدخلات
- [ ] ✅ تم استخدام prepared statements
- [ ] ✅ تم تفعيل SQL escaping
- [ ] ✅ تم معالجة جميع الأخطاء
- [ ] ✅ تم تفعيل Logging
- [ ] ✅ تم وضع Database backups
- [ ] ✅ تم فحص المكتبات بـ safety
- [ ] ✅ تم تشغيل اختبارات الأمان
- [ ] ✅ تم مراجعة الأكواد من قبل فريق

---

## 📞 الموارد الإضافية

- [Django Security Documentation](https://docs.djangoproject.com/en/stable/topics/security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Bandit Documentation](https://bandit.readthedocs.io/)

---

**تاريخ التحديث:** 17 يوليو 2026
