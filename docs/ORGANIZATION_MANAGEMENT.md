# 🏢 دليل إدارة المؤسسات

## 📋 جدول المحتويات
- [نظرة عامة](#نظرة-عامة)
- [إنشاء المؤسسات](#إنشاء-المؤسسات)
- [إدارة الأعضاء](#إدارة-الأعضاء)
- [الأقسام والهيكل التنظيمي](#الأقسام-والهيكل-التنظيمي)
- [الصلاحيات والأدوار](#الصلاحيات-والأدوار)
- [أمثلة عملية](#أمثلة-عملية)

---

## 🔍 نظرة عامة

نظام إدارة المؤسسات يوفر هيكل تنظيمي مرن يدعم:
- **المؤسسات متعددة المستويات**
- **الأقسام والفرق**
- **إدارة الأعضاء والأدوار**
- **التحكم في الصلاحيات**
- **التقارير والإحصائيات**

---

## 🏗️ إنشاء المؤسسات

### 📝 بيانات المؤسسة الأساسية
```typescript
interface Organization {
  id: string;                    // معرف فريد
  name: string;                  // اسم المؤسسة
  description?: string;          // وصف المؤسسة
  logo?: string;                 // شعار المؤسسة
  website?: string;              // موقع الويب
  phone?: string;                // رقم الهاتف
  email?: string;                // البريد الإلكتروني
  address?: {                    // العنوان
    street: string;
    city: string;
    country: string;
    postalCode?: string;
  };
  
  // إدارة المؤسسة
  ownerId: string;               // مالك المؤسسة
  adminIds: string[];            // قائمة الأدمن
  
  // الإعدادات
  settings: {
    allowPublicJoin: boolean;    // السماح بالانضمام العام
    requireApproval: boolean;    // يتطلب موافقة للانضمام
    maxMembers?: number;         // الحد الأقصى للأعضاء
  };
  
  // الإحصائيات
  stats: {
    memberCount: number;         // عدد الأعضاء
    departmentCount: number;     // عدد الأقسام
    taskCount: number;           // عدد المهام
    activeMembers: number;       // الأعضاء النشطين
  };
  
  // التواريخ
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}
```

### 🚀 إنشاء مؤسسة جديدة
```typescript
// مثال: إنشاء مؤسسة
const organizationData = {
  name: "شركة التقنية المتقدمة",
  description: "شركة متخصصة في تطوير البرمجيات",
  website: "https://techcompany.com",
  email: "info@techcompany.com",
  phone: "+966501234567",
  address: {
    street: "شارع الملك فهد",
    city: "الرياض",
    country: "السعودية",
    postalCode: "12345"
  },
  settings: {
    allowPublicJoin: false,
    requireApproval: true,
    maxMembers: 100
  }
};

// إنشاء المؤسسة
const orgId = await createOrganization(organizationData, creatorUserId);
```

---

## 👥 إدارة الأعضاء

### 📊 هيكل عضو المؤسسة
```typescript
interface OrganizationMember {
  userId: string;                // معرف المستخدم
  organizationId: string;        // معرف المؤسسة
  role: OrganizationRole;        // الدور في المؤسسة
  departmentId?: string;         // القسم (اختياري)
  position?: string;             // المنصب
  
  // الصلاحيات المخصصة
  customPermissions?: PermissionKey[];
  
  // معلومات الانضمام
  joinedAt: Timestamp;           // تاريخ الانضمام
  invitedBy?: string;            // من دعاه
  approvedBy?: string;           // من وافق عليه
  
  // الحالة
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  
  // الإحصائيات
  stats: {
    tasksCompleted: number;      // المهام المكتملة
    tasksAssigned: number;       // المهام المعينة
    lastActivity: Timestamp;     // آخر نشاط
  };
  
  updatedAt: Timestamp;
}
```

### 🔄 عمليات إدارة الأعضاء

#### 1. **دعوة عضو جديد**
```typescript
async function inviteMember(
  organizationId: string,
  email: string,
  role: OrganizationRole,
  departmentId?: string
) {
  // إنشاء دعوة
  const invitation = {
    organizationId,
    email,
    role,
    departmentId,
    invitedBy: currentUserId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 أيام
    status: 'pending'
  };
  
  // حفظ الدعوة
  await db.collection('invitations').add(invitation);
  
  // إرسال بريد إلكتروني
  await sendInvitationEmail(email, invitation);
}
```

#### 2. **قبول الدعوة**
```typescript
async function acceptInvitation(invitationId: string, userId: string) {
  const invitation = await getInvitation(invitationId);
  
  if (invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
    throw new Error('الدعوة منتهية الصلاحية أو مستخدمة');
  }
  
  // إضافة العضو للمؤسسة
  await addMemberToOrganization(
    invitation.organizationId,
    userId,
    invitation.role,
    invitation.departmentId
  );
  
  // تحديث حالة الدعوة
  await updateInvitation(invitationId, { status: 'accepted' });
}
```

#### 3. **تحديث دور العضو**
```typescript
async function updateMemberRole(
  organizationId: string,
  userId: string,
  newRole: OrganizationRole
) {
  // التحقق من الصلاحيات
  await ensurePermission(currentUserId, 'users:edit');
  
  // تحديث الدور في قاعدة البيانات
  await db.collection('organizations')
    .doc(organizationId)
    .collection('members')
    .doc(userId)
    .update({
      role: newRole,
      updatedAt: new Date()
    });
  
  // تحديث Firebase Auth Claims
  await updateUserClaims(userId, { role: newRole });
}
```

---

## 🏬 الأقسام والهيكل التنظيمي

### 📋 هيكل القسم
```typescript
interface Department {
  id: string;                    // معرف القسم
  organizationId: string;        // معرف المؤسسة
  name: string;                  // اسم القسم
  description?: string;          // وصف القسم
  
  // الهيكل التنظيمي
  parentDepartmentId?: string;   // القسم الأب (للأقسام الفرعية)
  headId?: string;               // رئيس القسم
  
  // الإعدادات
  settings: {
    allowSubDepartments: boolean; // السماح بالأقسام الفرعية
    maxMembers?: number;          // الحد الأقصى للأعضاء
  };
  
  // الإحصائيات
  stats: {
    memberCount: number;          // عدد الأعضاء
    subDepartmentCount: number;   // عدد الأقسام الفرعية
    taskCount: number;            // عدد المهام
  };
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}
```

### 🌳 إنشاء هيكل تنظيمي
```typescript
// مثال: إنشاء هيكل تنظيمي لشركة تقنية
const organizationStructure = {
  "الإدارة العامة": {
    head: "ceo_user_id",
    subDepartments: {
      "إدارة التطوير": {
        head: "dev_manager_id",
        subDepartments: {
          "فريق Frontend": { head: "frontend_lead_id" },
          "فريق Backend": { head: "backend_lead_id" },
          "فريق Mobile": { head: "mobile_lead_id" }
        }
      },
      "إدارة التسويق": {
        head: "marketing_manager_id",
        subDepartments: {
          "التسويق الرقمي": { head: "digital_marketing_lead_id" },
          "العلاقات العامة": { head: "pr_lead_id" }
        }
      },
      "الموارد البشرية": {
        head: "hr_manager_id"
      }
    }
  }
};

// إنشاء الأقسام
async function createOrganizationStructure(
  organizationId: string,
  structure: any,
  parentId?: string
) {
  for (const [deptName, deptData] of Object.entries(structure)) {
    const department = await createDepartment({
      organizationId,
      name: deptName,
      parentDepartmentId: parentId,
      headId: deptData.head
    });
    
    if (deptData.subDepartments) {
      await createOrganizationStructure(
        organizationId,
        deptData.subDepartments,
        department.id
      );
    }
  }
}
```

---

## 🔐 الصلاحيات والأدوار

### 👑 أدوار المؤسسة
```typescript
type OrganizationRole = 
  | 'org_owner'  // مالك المؤسسة
  | 'org_admin'          // أدمن المؤسسة
  | 'org_supervisor'     // مشرف
  | 'org_engineer'       // مهندس
  | 'org_technician'     // فني
  | 'org_assistant';     // مساعد فني
```

### 🎯 مصفوفة الصلاحيات
| العملية | org_admin | org_supervisor | org_engineer | org_technician | org_assistant |
|---------|-----------|----------------|--------------|----------------|---------------|
| إدارة الأعضاء | ✅ | ❌ | ❌ | ❌ | ❌ |
| إنشاء الأقسام | ✅ | ❌ | ❌ | ❌ | ❌ |
| إدارة المهام | ✅ | ✅ | ✅ | ✅ | ❌ |
| عرض التقارير | ✅ | ✅ | ✅ | ❌ | ❌ |
| إنشاء التقارير | ✅ | ✅ | ❌ | ❌ | ❌ |
| الموافقة على المهام | ✅ | ✅ | ❌ | ❌ | ❌ |

### 🔄 تفويض الصلاحيات
```typescript
// تفويض صلاحيات مخصصة لعضو
async function delegatePermissions(
  organizationId: string,
  userId: string,
  permissions: PermissionKey[],
  expiresAt?: Date
) {
  const delegation = {
    organizationId,
    userId,
    permissions,
    delegatedBy: currentUserId,
    delegatedAt: new Date(),
    expiresAt: expiresAt || null,
    status: 'active'
  };
  
  await db.collection('permission_delegations').add(delegation);
  
  // تحديث صلاحيات المستخدم
  await updateUserPermissions(userId, permissions);
}
```

---

## 💡 أمثلة عملية

### 🏢 سيناريو: شركة تطوير البرمجيات

#### 1. **إنشاء المؤسسة**
```typescript
const techCompany = await createOrganization({
  name: "شركة التقنية المبتكرة",
  description: "شركة متخصصة في تطوير تطبيقات الويب والموبايل",
  settings: {
    allowPublicJoin: false,
    requireApproval: true,
    maxMembers: 50
  }
}, ownerId);
```

#### 2. **إنشاء الأقسام**
```typescript
// قسم التطوير
const devDept = await createDepartment({
  organizationId: techCompany.id,
  name: "قسم التطوير",
  description: "مسؤول عن تطوير المنتجات التقنية"
});

// فرق فرعية
const frontendTeam = await createDepartment({
  organizationId: techCompany.id,
  name: "فريق Frontend",
  parentDepartmentId: devDept.id
});

const backendTeam = await createDepartment({
  organizationId: techCompany.id,
  name: "فريق Backend",
  parentDepartmentId: devDept.id
});
```

#### 3. **إضافة الأعضاء**
```typescript
// إضافة مدير التطوير
await addMember(techCompany.id, {
  userId: "dev_manager_id",
  role: "org_supervisor",
  departmentId: devDept.id,
  position: "مدير التطوير"
});

// إضافة مطورين
await addMember(techCompany.id, {
  userId: "frontend_dev_id",
  role: "org_engineer",
  departmentId: frontendTeam.id,
  position: "مطور Frontend"
});

await addMember(techCompany.id, {
  userId: "backend_dev_id",
  role: "org_engineer",
  departmentId: backendTeam.id,
  position: "مطور Backend"
});
```

### 📊 تقارير المؤسسة
```typescript
// تقرير شامل عن المؤسسة
async function generateOrganizationReport(organizationId: string) {
  const org = await getOrganization(organizationId);
  const members = await getOrganizationMembers(organizationId);
  const departments = await getOrganizationDepartments(organizationId);
  
  return {
    organization: {
      name: org.name,
      memberCount: members.length,
      departmentCount: departments.length,
      createdAt: org.createdAt
    },
    
    membersByRole: members.reduce((acc, member) => {
      acc[member.role] = (acc[member.role] || 0) + 1;
      return acc;
    }, {}),
    
    membersByDepartment: members.reduce((acc, member) => {
      const deptName = departments.find(d => d.id === member.departmentId)?.name || 'غير محدد';
      acc[deptName] = (acc[deptName] || 0) + 1;
      return acc;
    }, {}),
    
    activeMembers: members.filter(m => m.status === 'active').length,
    pendingInvitations: await getPendingInvitations(organizationId)
  };
}
```

### 🔄 سير العمل النموذجي
```typescript
// سير عمل إنشاء مشروع جديد
async function createProjectWorkflow(organizationId: string, projectData: any) {
  // 1. إنشاء المشروع
  const project = await createProject(projectData);
  
  // 2. إنشاء فريق المشروع
  const projectTeam = await createDepartment({
    organizationId,
    name: `فريق ${project.name}`,
    description: `فريق مخصص لمشروع ${project.name}`
  });
  
  // 3. تعيين قائد الفريق
  await assignTeamLead(projectTeam.id, projectData.teamLeadId);
  
  // 4. إضافة أعضاء الفريق
  for (const memberId of projectData.teamMembers) {
    await addMemberToDepartment(projectTeam.id, memberId);
  }
  
  // 5. إنشاء المهام الأولية
  await createInitialTasks(project.id, projectTeam.id);
  
  return {
    project,
    team: projectTeam,
    message: "تم إنشاء المشروع والفريق بنجاح"
  };
}
```

---

## 🔍 نصائح وأفضل الممارسات

### ✅ أفضل الممارسات

1. **تنظيم الهيكل**
   - ابدأ بهيكل بسيط وطوره تدريجياً
   - استخدم أسماء واضحة للأقسام
   - حدد مسؤوليات كل قسم بوضوح

2. **إدارة الأعضاء**
   - راجع الأدوار والصلاحيات دورياً
   - استخدم فترات تجريبية للأعضاء الجدد
   - وثق التغييرات في الأدوار

3. **الأمان**
   - طبق مبدأ الحد الأدنى من الصلاحيات
   - راجع الصلاحيات المفوضة بانتظام
   - استخدم المراجعة المزدوجة للعمليات الحساسة

### ⚠️ تجنب هذه الأخطاء

1. **الهيكل المعقد**: تجنب إنشاء هيكل معقد من البداية
2. **الصلاحيات المفرطة**: لا تعطي صلاحيات أكثر من اللازم
3. **عدم المراجعة**: تجاهل مراجعة الأعضاء والأدوار دورياً

---

*آخر تحديث: ديسمبر 2024*
