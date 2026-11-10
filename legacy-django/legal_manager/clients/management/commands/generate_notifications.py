from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from clients.models import Task, Notification


class Command(BaseCommand):
    help = 'توليد التنبيهات للمهام المستحقة والمتأخرة'

    def handle(self, *args, **options):
        today = timezone.now().date()
        users = User.objects.all()
        count = 0

        for user in users:
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
                    msg = f'المهمة "{task.title}" تستحق خلال {days_left} أيام'
                else:
                    continue

                if not Notification.objects.filter(
                    user=user, task=task, created_at__date=today
                ).exists():
                    Notification.objects.create(
                        user=user, task=task,
                        notification_type=notif_type,
                        title=title, message=msg
                    )
                    count += 1

        self.stdout.write(self.style.SUCCESS(f'تم إنشاء {count} تنبيه جديد'))
