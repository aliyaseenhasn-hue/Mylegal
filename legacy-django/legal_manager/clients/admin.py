from django.contrib import admin
from .models import Client, Case, Task, Payment, Document, Notification


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    fields = ['amount', 'payment_date', 'payment_method', 'receipt_number']


class TaskInline(admin.TabularInline):
    model = Task
    extra = 0
    fields = ['title', 'task_type', 'priority', 'status', 'due_date', 'assigned_to']


class DocumentInline(admin.TabularInline):
    model = Document
    extra = 0
    fields = ['title', 'document_type', 'file', 'uploaded_at']
    readonly_fields = ['uploaded_at']


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ['name', 'phone', 'email', 'active_cases_count', 'created_at']
    search_fields = ['name', 'phone', 'national_id', 'email']
    list_filter = ['created_at']
    readonly_fields = ['created_at']


@admin.register(Case)
class CaseAdmin(admin.ModelAdmin):
    list_display = ['title', 'client', 'case_number', 'case_type', 'status',
                    'total_fees', 'paid_fees', 'remaining_fees', 'next_session']
    list_filter = ['status', 'case_type', 'created_at']
    search_fields = ['title', 'case_number', 'client__name']
    readonly_fields = ['created_at']
    inlines = [TaskInline, PaymentInline, DocumentInline]

    def paid_fees(self, obj):
        return f"{obj.paid_fees:,.2f} ريال"
    paid_fees.short_description = 'المدفوع'

    def remaining_fees(self, obj):
        return f"{obj.remaining_fees:,.2f} ريال"
    remaining_fees.short_description = 'المتبقي'


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'case', 'task_type', 'priority', 'status',
                    'due_date', 'is_overdue', 'assigned_to']
    list_filter = ['status', 'priority', 'task_type', 'due_date']
    search_fields = ['title', 'case__title', 'case__client__name']
    readonly_fields = ['created_at', 'completed_at']

    def is_overdue(self, obj):
        return obj.is_overdue
    is_overdue.boolean = True
    is_overdue.short_description = 'متأخرة؟'


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['case', 'amount', 'payment_date', 'payment_method', 'receipt_number']
    list_filter = ['payment_method', 'payment_date']
    search_fields = ['case__title', 'case__client__name', 'receipt_number']


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['title', 'case', 'document_type', 'uploaded_at', 'uploaded_by']
    list_filter = ['document_type', 'uploaded_at']
    search_fields = ['title', 'case__title']


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'notification_type', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read', 'created_at']
