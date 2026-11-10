from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.urls import reverse


class Client(models.Model):
    """موكل"""
    name = models.CharField(max_length=200, verbose_name='اسم الموكل')
    national_id = models.CharField(max_length=20, blank=True, verbose_name='رقم الهوية')
    phone = models.CharField(max_length=20, verbose_name='رقم الهاتف')
    email = models.EmailField(blank=True, verbose_name='البريد الإلكتروني')
    address = models.TextField(blank=True, verbose_name='العنوان')
    notes = models.TextField(blank=True, verbose_name='ملاحظات')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإضافة')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='clients', verbose_name='أضيف بواسطة')

    class Meta:
        verbose_name = 'موكل'
        verbose_name_plural = 'الموكلون'
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('client-detail', kwargs={'pk': self.pk})

    @property
    def total_paid(self):
        return sum(p.amount for p in self.cases.prefetch_related('payments').all()
                   for p in p.payments.all())

    @property
    def active_cases_count(self):
        return self.cases.filter(status='active').count()


class Case(models.Model):
    """قضية / ملف"""
    STATUS_CHOICES = [
        ('active', 'نشطة'),
        ('suspended', 'موقوفة'),
        ('closed', 'مغلقة'),
        ('archived', 'مؤرشفة'),
        ('won', 'مكسوبة'),
        ('lost', 'مخسورة'),
    ]

    CASE_TYPE_CHOICES = [
        ('civil', 'مدني'),
        ('criminal', 'جنائي'),
        ('commercial', 'تجاري'),
        ('family', 'أسرة'),
        ('labor', 'عمالي'),
        ('administrative', 'إداري'),
        ('real_estate', 'عقاري'),
        ('other', 'أخرى'),
    ]

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='cases',
                                verbose_name='الموكل')
    title = models.CharField(max_length=300, verbose_name='عنوان القضية')
    case_number = models.CharField(max_length=100, blank=True, verbose_name='رقم القضية')
    case_type = models.CharField(max_length=20, choices=CASE_TYPE_CHOICES, default='civil',
                                  verbose_name='نوع القضية')
    court = models.CharField(max_length=200, blank=True, verbose_name='المحكمة')
    judge = models.CharField(max_length=200, blank=True, verbose_name='اسم القاضي')
    opponent_name = models.CharField(max_length=200, blank=True, verbose_name='اسم الخصم')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active',
                               verbose_name='الحالة')
    description = models.TextField(blank=True, verbose_name='تفاصيل القضية')
    total_fees = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                      verbose_name='إجمالي الأتعاب')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الفتح')
    next_session = models.DateField(null=True, blank=True, verbose_name='الجلسة القادمة')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='assigned_cases', verbose_name='محامي المعالجة')

    class Meta:
        verbose_name = 'قضية'
        verbose_name_plural = 'القضايا'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.client.name}"

    def get_absolute_url(self):
        return reverse('case-detail', kwargs={'pk': self.pk})

    @property
    def paid_fees(self):
        return sum(p.amount for p in self.payments.all())

    @property
    def remaining_fees(self):
        return self.total_fees - self.paid_fees

    @property
    def payment_percentage(self):
        if self.total_fees == 0:
            return 0
        return int((self.paid_fees / self.total_fees) * 100)

    @property
    def overdue_tasks_count(self):
        return self.tasks.filter(
            status__in=['pending', 'in_progress'],
            due_date__lt=timezone.now().date()
        ).count()


class Task(models.Model):
    """مهمة"""
    PRIORITY_CHOICES = [
        ('low', 'منخفضة'),
        ('medium', 'متوسطة'),
        ('high', 'عالية'),
        ('urgent', 'عاجلة'),
    ]

    STATUS_CHOICES = [
        ('pending', 'معلقة'),
        ('in_progress', 'قيد التنفيذ'),
        ('completed', 'مكتملة'),
        ('cancelled', 'ملغاة'),
    ]

    TASK_TYPE_CHOICES = [
        ('session', 'جلسة محكمة'),
        ('document', 'تقديم مستند'),
        ('deadline', 'موعد نهائي'),
        ('meeting', 'اجتماع'),
        ('follow_up', 'متابعة'),
        ('payment', 'تحصيل دفعة'),
        ('other', 'أخرى'),
    ]

    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name='tasks',
                              verbose_name='القضية')
    title = models.CharField(max_length=300, verbose_name='عنوان المهمة')
    task_type = models.CharField(max_length=20, choices=TASK_TYPE_CHOICES, default='other',
                                  verbose_name='نوع المهمة')
    description = models.TextField(blank=True, verbose_name='تفاصيل المهمة')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium',
                                 verbose_name='الأولوية')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending',
                               verbose_name='الحالة')
    due_date = models.DateField(verbose_name='تاريخ الاستحقاق')
    due_time = models.TimeField(null=True, blank=True, verbose_name='وقت الاستحقاق')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='tasks', verbose_name='مسند إلى')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='تاريخ الإكمال')
    reminder_days = models.IntegerField(default=3,
                                         verbose_name='التذكير قبل (أيام)')

    class Meta:
        verbose_name = 'مهمة'
        verbose_name_plural = 'المهام'
        ordering = ['due_date', '-priority']

    def __str__(self):
        return f"{self.title} - {self.case.title}"

    def get_absolute_url(self):
        return reverse('task-detail', kwargs={'pk': self.pk})

    @property
    def is_overdue(self):
        if self.status in ['completed', 'cancelled']:
            return False
        return self.due_date < timezone.now().date()

    @property
    def days_remaining(self):
        delta = self.due_date - timezone.now().date()
        return delta.days

    @property
    def needs_reminder(self):
        if self.status in ['completed', 'cancelled']:
            return False
        return self.days_remaining <= self.reminder_days

    def mark_complete(self):
        self.status = 'completed'
        self.completed_at = timezone.now()
        self.save()


class Payment(models.Model):
    """دفعة مالية"""
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'نقدي'),
        ('bank_transfer', 'تحويل بنكي'),
        ('check', 'شيك'),
        ('other', 'أخرى'),
    ]

    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name='payments',
                              verbose_name='القضية')
    amount = models.DecimalField(max_digits=12, decimal_places=2, verbose_name='المبلغ')
    payment_date = models.DateField(default=timezone.now, verbose_name='تاريخ الدفع')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES,
                                       default='cash', verbose_name='طريقة الدفع')
    receipt_number = models.CharField(max_length=50, blank=True, verbose_name='رقم الإيصال')
    notes = models.TextField(blank=True, verbose_name='ملاحظات')
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                    verbose_name='أضيف بواسطة')

    class Meta:
        verbose_name = 'دفعة مالية'
        verbose_name_plural = 'الدفعات المالية'
        ordering = ['-payment_date']

    def __str__(self):
        return f"{self.amount} ريال - {self.case.title}"


class Document(models.Model):
    """مستند / ملف"""
    DOCUMENT_TYPE_CHOICES = [
        ('contract', 'عقد'),
        ('court_order', 'أمر محكمة'),
        ('petition', 'لائحة / عريضة'),
        ('evidence', 'مستند إثبات'),
        ('correspondence', 'مراسلة'),
        ('power_of_attorney', 'توكيل'),
        ('judgment', 'حكم'),
        ('other', 'أخرى'),
    ]

    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name='documents',
                              verbose_name='القضية')
    title = models.CharField(max_length=300, verbose_name='عنوان المستند')
    document_type = models.CharField(max_length=30, choices=DOCUMENT_TYPE_CHOICES,
                                      default='other', verbose_name='نوع المستند')
    file = models.FileField(upload_to='documents/%Y/%m/', verbose_name='الملف')
    description = models.TextField(blank=True, verbose_name='وصف')
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الرفع')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     verbose_name='رُفع بواسطة')

    class Meta:
        verbose_name = 'مستند'
        verbose_name_plural = 'المستندات'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.title} - {self.case.title}"

    @property
    def file_extension(self):
        import os
        _, ext = os.path.splitext(self.file.name)
        return ext.lower()


class Notification(models.Model):
    """تنبيه"""
    TYPE_CHOICES = [
        ('task_due', 'مهمة مستحقة'),
        ('task_overdue', 'مهمة متأخرة'),
        ('payment_due', 'دفعة مستحقة'),
        ('session', 'جلسة قادمة'),
        ('general', 'عام'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications',
                              verbose_name='المستخدم')
    task = models.ForeignKey(Task, on_delete=models.CASCADE, null=True, blank=True,
                              related_name='notifications', verbose_name='المهمة')
    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='general',
                                          verbose_name='نوع التنبيه')
    title = models.CharField(max_length=300, verbose_name='عنوان التنبيه')
    message = models.TextField(verbose_name='نص التنبيه')
    is_read = models.BooleanField(default=False, verbose_name='مقروء')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')

    class Meta:
        verbose_name = 'تنبيه'
        verbose_name_plural = 'التنبيهات'
        ordering = ['-created_at']

    def __str__(self):
        return self.title
