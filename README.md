# Seal X2 — Science Learning Portal

واجهة عربية RTL متجاوبة لمنصة علوم، مبنية بـ HTML/CSS/JavaScript وSupabase.

## الوظائف الحالية
- تسجيل حسابات بالبريد الإلكتروني وكلمة المرور عبر Supabase Auth.
- ملفات طلاب تلقائية بصلاحية student افتراضياً.
- مساحة مدرس لإضافة الامتحانات والأسئلة والإعلانات وروابط المصادر.
- امتحانات اختيار من متعدد وتصحيح محفوظ من خلال Postgres RPC على الخادم.
- سجل محاولات الطالب ونتائجه.
- سياسات Row Level Security لحماية البيانات وصلاحيات النشر.

## قاعدة البيانات
تم تطبيق مخطط قاعدة البيانات على مشروع Supabase مستقل باسم Seal X2:
- profiles, subjects, exams, exam_questions
- exam_attempts, announcements, resources

المشروع يستخدم مفتاح Supabase publishable داخل الواجهة فقط. لا تضع Service Role Key في ملفات الموقع أبداً.

## النشر
1. افتح إعدادات المستودع: Settings → Pages.
2. اختر **Deploy from a branch** ثم الفرع main والمجلد / (root)، واحفظ.
3. بعد اكتمال النشر سيكون الموقع على:
   https://mahmoudabdelfattah049-dotcom.github.io/Seal-X2/

## تفعيل حساب المدرس
كل حساب جديد يبدأ بصلاحية student. بعد إنشاء حساب المدرس وتأكيد ملكيته، يمكن للمسؤول من SQL Editor تعديل role للحساب المحدد إلى teacher:
```sql
update public.profiles
set role = 'teacher'
where id = 'AUTH_USER_UUID';
```
لا تنفذ هذا إلا بعد التأكد من UUID الصحيح لحساب المدرس.

## حدود النسخة الأولى
هذه نسخة أولية قابلة للتجربة وليست نظاماً مدرسياً معتمداً بعد. مدة الامتحان حالياً إرشادية وليست مؤقتاً يفرضه الخادم. رفع الملفات، تقارير تفصيلية، إدارة قوائم الطلاب، وسجل تدقيق إداري مراحل لاحقة.
