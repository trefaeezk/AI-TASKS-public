# Organization Components

مجموعة من المكونات المحسنة لإدارة أعضاء المؤسسة بطريقة منظمة ومرنة.

## المكونات

### 1. MemberCard
مكون لعرض بطاقة عضو واحد مع جميع المعلومات والإجراءات المطلوبة.

**الميزات:**
- عرض معلومات العضو (الاسم، البريد الإلكتروني، الدور، القسم)
- أيقونات ملونة للأدوار المختلفة
- عرض حالة النشاط وتاريخ الانضمام
- أزرار الإجراءات (تعديل، إزالة، حذف)
- تصميم متجاوب ومتحرك

### 2. MembersStats
مكون لعرض إحصائيات سريعة عن الأعضاء.

**الميزات:**
- إجمالي الأعضاء
- الأعضاء النشطين
- عدد الأفراد (بدون قسم)
- عدد الأعضاء في الأقسام
- تصميم بطاقات جذاب مع أيقونات

### 3. MembersFilters
مكون لشريط البحث والفلاتر المتقدمة.

**الميزات:**
- بحث نصي في الأسماء والبريد الإلكتروني
- فلتر حسب الدور (يظهر فقط الأدوار الموجودة في المؤسسة)
- فلتر حسب القسم (مع عدد الأعضاء في كل قسم)
- أيقونات ملونة للأدوار في القائمة المنسدلة
- عرض عدد الأعضاء لكل دور وقسم
- زر إعادة تعيين الفلاتر
- مؤشر النتائج المفلترة مع عرض الفلاتر النشطة

### 4. MembersList
مكون رئيسي لعرض قوائم الأعضاء بتبويبات مختلفة.

**الميزات:**
- تبويب "جميع الأعضاء"
- تبويب "الأدوار" (مجمعة حسب الدور)
- تبويب "الأفراد" (بدون قسم)
- تبويب "الأقسام" (مجمعة حسب القسم)
- عرض فارغ مناسب لكل تبويب
- تكامل مع المكونات الأخرى

## الاستخدام

```tsx
import { MembersStats, MembersFilters, MembersList } from '@/components/organization';

// في الصفحة الرئيسية
<MembersStats stats={membersStats} />

<MembersFilters
  searchTerm={searchTerm}
  selectedRole={selectedRole}
  selectedDepartment={selectedDepartment}
  departments={departments}
  isOwner={isOwner}
  filteredCount={filteredMembers.length}
  totalCount={membersStats.total}
  onSearchChange={setSearchTerm}
  onRoleChange={setSelectedRole}
  onDepartmentChange={setSelectedDepartment}
  onReset={resetFilters}
/>

<MembersList
  members={filteredMembers}
  departments={departments}
  activeTab={activeTab}
  isOwner={isOwner}
  isAdmin={isAdmin}
  stats={membersStats}
  onTabChange={setActiveTab}
  onEditMember={handleEditMember}
  onRemoveMember={handleRemoveMember}
  onDeleteMember={handleDeleteMember}
/>
```

## الفوائد

1. **فصل الاهتمامات**: كل مكون له مسؤولية واضحة ومحددة
2. **إعادة الاستخدام**: يمكن استخدام المكونات في صفحات أخرى
3. **سهولة الصيانة**: تحديث مكون واحد يؤثر على جميع الاستخدامات
4. **اختبار أسهل**: كل مكون يمكن اختباره بشكل منفصل
5. **تطوير أسرع**: فريق العمل يمكنه العمل على مكونات مختلفة بشكل متوازي

## التحسينات المستقبلية

- إضافة مكون للتصدير والاستيراد
- مكون لإدارة الأذونات المتقدمة
- مكون لعرض تاريخ النشاطات
- دعم التحميل التدريجي للقوائم الكبيرة
