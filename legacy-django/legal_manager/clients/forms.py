from django import forms
from crispy_forms.helper import FormHelper
from crispy_forms.layout import Layout, Submit, Row, Column, Div, Field
from .models import Client, Case, Task, Payment, Document


class ClientForm(forms.ModelForm):
    class Meta:
        model = Client
        fields = ['name', 'national_id', 'phone', 'email', 'address', 'notes']
        widgets = {
            'name': forms.TextInput(attrs={'placeholder': 'الاسم الكامل للموكل'}),
            'national_id': forms.TextInput(attrs={'placeholder': 'رقم الهوية الوطنية'}),
            'phone': forms.TextInput(attrs={'placeholder': '05xxxxxxxx'}),
            'email': forms.EmailInput(attrs={'placeholder': 'example@email.com'}),
            'address': forms.Textarea(attrs={'rows': 3, 'placeholder': 'عنوان الموكل'}),
            'notes': forms.Textarea(attrs={'rows': 3, 'placeholder': 'ملاحظات إضافية'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.layout = Layout(
            Row(
                Column('name', css_class='col-md-6'),
                Column('national_id', css_class='col-md-6'),
            ),
            Row(
                Column('phone', css_class='col-md-6'),
                Column('email', css_class='col-md-6'),
            ),
            'address',
            'notes',
            Submit('submit', 'حفظ الموكل', css_class='btn btn-primary btn-lg w-100 mt-3')
        )


class CaseForm(forms.ModelForm):
    class Meta:
        model = Case
        fields = ['client', 'title', 'case_number', 'case_type', 'court', 'judge',
                  'opponent_name', 'status', 'description', 'total_fees',
                  'next_session', 'assigned_to']
        widgets = {
            'description': forms.Textarea(attrs={'rows': 4}),
            'next_session': forms.DateInput(attrs={'type': 'date'}),
            'total_fees': forms.NumberInput(attrs={'min': '0', 'step': '0.01'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.layout = Layout(
            Row(
                Column('client', css_class='col-md-6'),
                Column('assigned_to', css_class='col-md-6'),
            ),
            'title',
            Row(
                Column('case_number', css_class='col-md-4'),
                Column('case_type', css_class='col-md-4'),
                Column('status', css_class='col-md-4'),
            ),
            Row(
                Column('court', css_class='col-md-6'),
                Column('judge', css_class='col-md-6'),
            ),
            Row(
                Column('opponent_name', css_class='col-md-6'),
                Column('next_session', css_class='col-md-6'),
            ),
            'description',
            Row(
                Column('total_fees', css_class='col-md-6'),
            ),
            Submit('submit', 'حفظ القضية', css_class='btn btn-primary btn-lg w-100 mt-3')
        )


class TaskForm(forms.ModelForm):
    class Meta:
        model = Task
        fields = ['case', 'title', 'task_type', 'description', 'priority',
                  'status', 'due_date', 'due_time', 'assigned_to', 'reminder_days']
        widgets = {
            'description': forms.Textarea(attrs={'rows': 3}),
            'due_date': forms.DateInput(attrs={'type': 'date'}),
            'due_time': forms.TimeInput(attrs={'type': 'time'}),
            'reminder_days': forms.NumberInput(attrs={'min': '1', 'max': '30'}),
        }

    def __init__(self, *args, case=None, **kwargs):
        super().__init__(*args, **kwargs)
        if case:
            self.fields['case'].initial = case
            self.fields['case'].widget = forms.HiddenInput()
        self.helper = FormHelper()
        self.helper.layout = Layout(
            'case',
            'title',
            Row(
                Column('task_type', css_class='col-md-4'),
                Column('priority', css_class='col-md-4'),
                Column('status', css_class='col-md-4'),
            ),
            Row(
                Column('due_date', css_class='col-md-4'),
                Column('due_time', css_class='col-md-4'),
                Column('reminder_days', css_class='col-md-4'),
            ),
            'assigned_to',
            'description',
            Submit('submit', 'حفظ المهمة', css_class='btn btn-primary btn-lg w-100 mt-3')
        )


class PaymentForm(forms.ModelForm):
    class Meta:
        model = Payment
        fields = ['case', 'amount', 'payment_date', 'payment_method', 'receipt_number', 'notes']
        widgets = {
            'payment_date': forms.DateInput(attrs={'type': 'date'}),
            'amount': forms.NumberInput(attrs={'min': '0', 'step': '0.01'}),
            'notes': forms.Textarea(attrs={'rows': 3}),
        }

    def __init__(self, *args, case=None, **kwargs):
        super().__init__(*args, **kwargs)
        if case:
            self.fields['case'].initial = case
            self.fields['case'].widget = forms.HiddenInput()
        self.helper = FormHelper()
        self.helper.layout = Layout(
            'case',
            Row(
                Column('amount', css_class='col-md-6'),
                Column('payment_date', css_class='col-md-6'),
            ),
            Row(
                Column('payment_method', css_class='col-md-6'),
                Column('receipt_number', css_class='col-md-6'),
            ),
            'notes',
            Submit('submit', 'تسجيل الدفعة', css_class='btn btn-success btn-lg w-100 mt-3')
        )


class DocumentForm(forms.ModelForm):
    class Meta:
        model = Document
        fields = ['case', 'title', 'document_type', 'file', 'description']
        widgets = {
            'description': forms.Textarea(attrs={'rows': 3}),
        }

    def __init__(self, *args, case=None, **kwargs):
        super().__init__(*args, **kwargs)
        if case:
            self.fields['case'].initial = case
            self.fields['case'].widget = forms.HiddenInput()
        self.helper = FormHelper()
        self.helper.layout = Layout(
            'case',
            Row(
                Column('title', css_class='col-md-8'),
                Column('document_type', css_class='col-md-4'),
            ),
            'file',
            'description',
            Submit('submit', 'رفع المستند', css_class='btn btn-info btn-lg w-100 mt-3')
        )
