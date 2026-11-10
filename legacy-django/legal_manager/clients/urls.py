from django.urls import path
from . import views

urlpatterns = [
    # Dashboard
    path('', views.dashboard, name='dashboard'),

    # Clients
    path('clients/', views.client_list, name='client-list'),
    path('clients/new/', views.client_create, name='client-create'),
    path('clients/<int:pk>/', views.client_detail, name='client-detail'),
    path('clients/<int:pk>/edit/', views.client_update, name='client-update'),
    path('clients/<int:pk>/delete/', views.client_delete, name='client-delete'),

    # Cases
    path('cases/', views.case_list, name='case-list'),
    path('cases/new/', views.case_create, name='case-create'),
    path('cases/<int:pk>/', views.case_detail, name='case-detail'),
    path('cases/<int:pk>/edit/', views.case_update, name='case-update'),
    path('cases/<int:pk>/archive/', views.case_archive, name='case-archive'),

    # Tasks
    path('tasks/', views.task_list, name='task-list'),
    path('tasks/new/', views.task_create, name='task-create'),
    path('tasks/<int:pk>/edit/', views.task_update, name='task-update'),
    path('tasks/<int:pk>/complete/', views.task_complete, name='task-complete'),

    # Payments
    path('payments/new/', views.payment_create, name='payment-create'),
    path('payments/<int:pk>/delete/', views.payment_delete, name='payment-delete'),

    # Documents
    path('documents/new/', views.document_create, name='document-create'),
    path('documents/<int:pk>/delete/', views.document_delete, name='document-delete'),

    # Notifications
    path('notifications/', views.notifications_list, name='notifications'),
    path('notifications/<int:pk>/read/', views.mark_notification_read, name='notification-read'),
    path('notifications/count/', views.unread_count, name='notification-count'),

    # Reports
    path('reports/financial/', views.financial_report, name='financial-report'),
]
