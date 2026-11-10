from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from django.db.models import Q, Sum
from django.http import JsonResponse
from .models import Client, Case, Task, Payment, Document, Notification
from .forms import ClientForm, CaseForm, TaskForm, PaymentForm, DocumentForm
import json


def generate_notifications(user):
    """Generate notifications for upcoming and overdue tasks"""
    today = timezone.now().date()
    # Clear old unread notifications older than 30 days
    Notification.objects.filter(user=user, created_at__lt=timezone.now() - timezone.timedelta(days=30)).delete()

    tasks = Task.objects.filter(
        status__in=['pending', 'in_progress'],
        assigned_to=user
    )

    for task in tasks:
        days_left = (task.due_date - today).days

        if days_left < 0:
            notif_type = 'task_overdue'
            title = f'مهمة متأخرة: {task.title}'
            msg = f'المهمة "{task.title}" للقضية "{task.case.title}" متأخرة بـ {abs(days_left)} يوم'
        elif days_left <= task.reminder_days:
            notif_type = 'task_due'
            title = f'تذكير: {task.title}'
            msg = f'المهمة "{task.title}" للقضية "{task.case.title}" تستحق خلال {days_left} يوم'
        else:
            continue

        # Only create if notification doesn't already exist for today
        if not Notification.objects.filter(
            user=user, task=task,
            created_at__date=today
        ).exists():
            Notification.objects.create(
                user=user, task=task,
                notification_type=notif_type,
                title=title, message=msg
            )


@login_required
def dashboard(request):
    generate_notifications(request.user)
    today = timezone.now().date()

    stats = {
        'total_clients': Client.objects.count(),
        'active_cases': Case.objects.filter(status='active').count(),
        'pending_tasks': Task.objects.filter(status__in=['pending', 'in_progress']).count(),
        'overdue_tasks': Task.objects.filter(
            status__in=['pending', 'in_progress'], due_date__lt=today
        ).count(),
    }

    financial = Case.objects.aggregate(
        total_fees=Sum('total_fees')
    )
    total_paid = sum(p['total'] for p in Payment.objects.values('case').annotate(
        total=Sum('amount')
    ))
    stats['total_fees'] = financial['total_fees'] or 0
    stats['total_paid'] = total_paid
    stats['total_remaining'] = stats['total_fees'] - total_paid

    upcoming_tasks = Task.objects.filter(
        status__in=['pending', 'in_progress'],
        due_date__gte=today,
        due_date__lte=today + timezone.timedelta(days=7)
    ).select_related('case', 'case__client').order_by('due_date')[:10]

    overdue_tasks = Task.objects.filter(
        status__in=['pending', 'in_progress'],
        due_date__lt=today
    ).select_related('case', 'case__client').order_by('due_date')[:10]

    recent_cases = Case.objects.select_related('client').order_by('-created_at')[:5]
    notifications = Notification.objects.filter(
        user=request.user, is_read=False
    ).order_by('-created_at')[:10]

    context = {
        'stats': stats,
        'upcoming_tasks': upcoming_tasks,
        'overdue_tasks': overdue_tasks,
        'recent_cases': recent_cases,
        'notifications': notifications,
        'today': today,
    }
    return render(request, 'clients/dashboard.html', context)


# ── Clients ──────────────────────────────────────────────────────────────────

@login_required
def client_list(request):
    q = request.GET.get('q', '')
    clients = Client.objects.prefetch_related('cases')
    if q:
        clients = clients.filter(
            Q(name__icontains=q) | Q(phone__icontains=q) | Q(national_id__icontains=q)
        )
    return render(request, 'clients/client_list.html', {'clients': clients, 'q': q})


@login_required
def client_detail(request, pk):
    client = get_object_or_404(Client, pk=pk)
    cases = client.cases.prefetch_related('tasks', 'payments').all()
    return render(request, 'clients/client_detail.html', {'client': client, 'cases': cases})


@login_required
def client_create(request):
    form = ClientForm(request.POST or None)
    if form.is_valid():
        client = form.save(commit=False)
        client.created_by = request.user
        client.save()
        messages.success(request, f'تم إضافة الموكل "{client.name}" بنجاح')
        return redirect('client-detail', pk=client.pk)
    return render(request, 'clients/client_form.html', {'form': form, 'title': 'إضافة موكل جديد'})


@login_required
def client_update(request, pk):
    client = get_object_or_404(Client, pk=pk)
    form = ClientForm(request.POST or None, instance=client)
    if form.is_valid():
        form.save()
        messages.success(request, 'تم تحديث بيانات الموكل بنجاح')
        return redirect('client-detail', pk=client.pk)
    return render(request, 'clients/client_form.html', {'form': form, 'title': f'تعديل: {client.name}'})


@login_required
def client_delete(request, pk):
    client = get_object_or_404(Client, pk=pk)
    if request.method == 'POST':
        name = client.name
        client.delete()
        messages.success(request, f'تم حذف الموكل "{name}"')
        return redirect('client-list')
    return render(request, 'clients/confirm_delete.html', {'object': client, 'type': 'الموكل'})


# ── Cases ────────────────────────────────────────────────────────────────────

@login_required
def case_list(request):
    q = request.GET.get('q', '')
    status = request.GET.get('status', '')
    cases = Case.objects.select_related('client').prefetch_related('payments', 'tasks')
    if q:
        cases = cases.filter(
            Q(title__icontains=q) | Q(case_number__icontains=q) |
            Q(client__name__icontains=q)
        )
    if status:
        cases = cases.filter(status=status)
    return render(request, 'clients/case_list.html', {
        'cases': cases, 'q': q, 'status': status,
        'status_choices': Case.STATUS_CHOICES
    })


@login_required
def case_detail(request, pk):
    case = get_object_or_404(Case, pk=pk)
    tasks = case.tasks.all().order_by('due_date')
    payments = case.payments.all()
    documents = case.documents.all()
    task_form = TaskForm(case=case)
    payment_form = PaymentForm(case=case)
    document_form = DocumentForm(case=case)
    context = {
        'case': case, 'tasks': tasks, 'payments': payments,
        'documents': documents, 'task_form': task_form,
        'payment_form': payment_form, 'document_form': document_form,
        'today': timezone.now().date(),
    }
    return render(request, 'clients/case_detail.html', context)


@login_required
def case_create(request):
    form = CaseForm(request.POST or None)
    if form.is_valid():
        case = form.save()
        messages.success(request, f'تم إنشاء القضية "{case.title}" بنجاح')
        return redirect('case-detail', pk=case.pk)
    return render(request, 'clients/case_form.html', {'form': form, 'title': 'إنشاء قضية جديدة'})


@login_required
def case_update(request, pk):
    case = get_object_or_404(Case, pk=pk)
    form = CaseForm(request.POST or None, instance=case)
    if form.is_valid():
        form.save()
        messages.success(request, 'تم تحديث بيانات القضية بنجاح')
        return redirect('case-detail', pk=case.pk)
    return render(request, 'clients/case_form.html', {'form': form, 'title': f'تعديل: {case.title}'})


@login_required
def case_archive(request, pk):
    case = get_object_or_404(Case, pk=pk)
    case.status = 'archived'
    case.save()
    messages.success(request, f'تم أرشفة القضية "{case.title}"')
    return redirect('case-detail', pk=case.pk)


# ── Tasks ────────────────────────────────────────────────────────────────────

@login_required
def task_list(request):
    today = timezone.now().date()
    status = request.GET.get('status', '')
    priority = request.GET.get('priority', '')
    tasks = Task.objects.select_related('case', 'case__client', 'assigned_to').all()
    if status:
        tasks = tasks.filter(status=status)
    if priority:
        tasks = tasks.filter(priority=priority)
    overdue = tasks.filter(status__in=['pending', 'in_progress'], due_date__lt=today)
    upcoming = tasks.filter(status__in=['pending', 'in_progress'], due_date__gte=today)
    completed = tasks.filter(status='completed')
    return render(request, 'clients/task_list.html', {
        'overdue': overdue, 'upcoming': upcoming, 'completed': completed,
        'status': status, 'priority': priority,
        'status_choices': Task.STATUS_CHOICES,
        'priority_choices': Task.PRIORITY_CHOICES,
        'today': today,
    })


@login_required
def task_create(request):
    case_id = request.GET.get('case')
    case = get_object_or_404(Case, pk=case_id) if case_id else None
    form = TaskForm(request.POST or None, case=case)
    if form.is_valid():
        task = form.save()
        messages.success(request, f'تم إضافة المهمة "{task.title}" بنجاح')
        return redirect('case-detail', pk=task.case.pk)
    return render(request, 'clients/task_form.html', {'form': form, 'title': 'إضافة مهمة جديدة'})


@login_required
def task_update(request, pk):
    task = get_object_or_404(Task, pk=pk)
    form = TaskForm(request.POST or None, instance=task)
    if form.is_valid():
        form.save()
        messages.success(request, 'تم تحديث المهمة بنجاح')
        return redirect('case-detail', pk=task.case.pk)
    return render(request, 'clients/task_form.html', {'form': form, 'title': f'تعديل: {task.title}'})


@login_required
def task_complete(request, pk):
    task = get_object_or_404(Task, pk=pk)
    task.mark_complete()
    messages.success(request, f'تم إكمال المهمة "{task.title}"')
    return redirect(request.META.get('HTTP_REFERER', 'task-list'))


# ── Payments ─────────────────────────────────────────────────────────────────

@login_required
def payment_create(request):
    case_id = request.GET.get('case')
    case = get_object_or_404(Case, pk=case_id) if case_id else None
    form = PaymentForm(request.POST or None, case=case)
    if form.is_valid():
        payment = form.save(commit=False)
        payment.created_by = request.user
        payment.save()
        messages.success(request, f'تم تسجيل دفعة بمبلغ {payment.amount} ريال')
        return redirect('case-detail', pk=payment.case.pk)
    return render(request, 'clients/payment_form.html', {'form': form, 'title': 'تسجيل دفعة'})


@login_required
def payment_delete(request, pk):
    payment = get_object_or_404(Payment, pk=pk)
    case_pk = payment.case.pk
    if request.method == 'POST':
        payment.delete()
        messages.success(request, 'تم حذف الدفعة')
        return redirect('case-detail', pk=case_pk)
    return render(request, 'clients/confirm_delete.html', {'object': payment, 'type': 'الدفعة'})


# ── Documents ─────────────────────────────────────────────────────────────────

@login_required
def document_create(request):
    case_id = request.GET.get('case')
    case = get_object_or_404(Case, pk=case_id) if case_id else None
    form = DocumentForm(request.POST or None, request.FILES or None, case=case)
    if form.is_valid():
        doc = form.save(commit=False)
        doc.uploaded_by = request.user
        doc.save()
        messages.success(request, f'تم رفع المستند "{doc.title}" بنجاح')
        return redirect('case-detail', pk=doc.case.pk)
    return render(request, 'clients/document_form.html', {'form': form, 'title': 'رفع مستند'})


@login_required
def document_delete(request, pk):
    document = get_object_or_404(Document, pk=pk)
    case_pk = document.case.pk
    if request.method == 'POST':
        document.file.delete()
        document.delete()
        messages.success(request, 'تم حذف المستند')
        return redirect('case-detail', pk=case_pk)
    return render(request, 'clients/confirm_delete.html', {'object': document, 'type': 'المستند'})


# ── Notifications ─────────────────────────────────────────────────────────────

@login_required
def notifications_list(request):
    generate_notifications(request.user)
    notifications = Notification.objects.filter(user=request.user).order_by('-created_at')
    notifications.filter(is_read=False).update(is_read=True)
    return render(request, 'clients/notifications.html', {'notifications': notifications})


@login_required
def mark_notification_read(request, pk):
    notif = get_object_or_404(Notification, pk=pk, user=request.user)
    notif.is_read = True
    notif.save()
    return JsonResponse({'status': 'ok'})


@login_required
def unread_count(request):
    count = Notification.objects.filter(user=request.user, is_read=False).count()
    return JsonResponse({'count': count})


# ── Reports ───────────────────────────────────────────────────────────────────

@login_required
def financial_report(request):
    cases = Case.objects.select_related('client').prefetch_related('payments').all()
    total_fees = cases.aggregate(t=Sum('total_fees'))['t'] or 0
    total_paid = Payment.objects.aggregate(t=Sum('amount'))['t'] or 0
    total_remaining = total_fees - total_paid

    cases_data = []
    for case in cases:
        cases_data.append({
            'case': case,
            'paid': case.paid_fees,
            'remaining': case.remaining_fees,
            'percentage': case.payment_percentage,
        })

    context = {
        'cases_data': cases_data,
        'total_fees': total_fees,
        'total_paid': total_paid,
        'total_remaining': total_remaining,
    }
    return render(request, 'clients/financial_report.html', context)
