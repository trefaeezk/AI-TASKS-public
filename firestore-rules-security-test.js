// اختبارات أمنية لقواعد Firestore المحسنة
// تشغيل الاختبار: npm test firestore-rules-security-test.js

const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

describe('Firestore Security Rules Tests', () => {
  let testEnv;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'test-project',
      firestore: {
        rules: require('fs').readFileSync('firestore.rules', 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  // اختبارات المستخدمين
  describe('Users Collection Security', () => {
    test('المستخدم يمكنه قراءة بياناته الشخصية', async () => {
      const alice = testEnv.authenticatedContext('alice', {
        isIndependent: true,
        accountType: 'individual'
      });
      
      await assertSucceeds(alice.firestore().doc('users/alice').get());
    });

    test('المستخدم لا يمكنه قراءة بيانات مستخدم آخر', async () => {
      const alice = testEnv.authenticatedContext('alice', {
        isIndependent: true
      });
      
      await assertFails(alice.firestore().doc('users/bob').get());
    });

    test('المستخدم لا يمكنه تعديل دوره بنفسه', async () => {
      const alice = testEnv.authenticatedContext('alice', {
        isIndependent: true
      });
      
      await assertFails(
        alice.firestore().doc('users/alice').update({
          isSystemOwner: true,
          role: 'isSystemOwner'
        })
      );
    });

    test('مالك النظام يمكنه قراءة جميع المستخدمين', async () => {
      const systemOwner = testEnv.authenticatedContext('owner', {
        isSystemOwner: true,
        role: 'isSystemOwner'
      });
      
      await assertSucceeds(systemOwner.firestore().doc('users/alice').get());
    });
  });

  // اختبارات المهام
  describe('Tasks Collection Security', () => {
    test('المستخدم يمكنه إنشاء مهمة شخصية', async () => {
      const alice = testEnv.authenticatedContext('alice', {
        isIndependent: true,
        accountType: 'individual'
      });
      
      await assertSucceeds(
        alice.firestore().doc('tasks/task1').set({
          title: 'مهمة شخصية',
          userId: 'alice',
          organizationId: null,
          createdBy: 'alice',
          createdAt: new Date()
        })
      );
    });

    test('المستخدم لا يمكنه إنشاء مهمة لمستخدم آخر', async () => {
      const alice = testEnv.authenticatedContext('alice', {
        isIndependent: true
      });
      
      await assertFails(
        alice.firestore().doc('tasks/task2').set({
          title: 'مهمة لبوب',
          userId: 'bob',
          organizationId: null,
          createdBy: 'alice'
        })
      );
    });

    test('عضو المؤسسة يمكنه قراءة مهام مؤسسته', async () => {
      const orgMember = testEnv.authenticatedContext('member', {
        isOrgEngineer: true,
        organizationId: 'org1'
      });
      
      // إنشاء مهمة مؤسسية أولاً
      const admin = testEnv.authenticatedContext('admin', {
        isSystemAdmin: true
      });
      
      await admin.firestore().doc('tasks/orgTask1').set({
        title: 'مهمة مؤسسية',
        organizationId: 'org1',
        createdBy: 'admin'
      });
      
      await assertSucceeds(orgMember.firestore().doc('tasks/orgTask1').get());
    });
  });

  // اختبارات المؤسسات
  describe('Organizations Collection Security', () => {
    test('مالك المؤسسة يمكنه تعديل مؤسسته', async () => {
      const orgOwner = testEnv.authenticatedContext('owner', {
        isOrgOwner: true,
        organizationId: 'org1'
      });
      
      await assertSucceeds(
        orgOwner.firestore().doc('organizations/org1').update({
          name: 'اسم جديد للمؤسسة'
        })
      );
    });

    test('المستخدم العادي لا يمكنه تعديل المؤسسة', async () => {
      const regularUser = testEnv.authenticatedContext('user', {
        isIndependent: true
      });
      
      await assertFails(
        regularUser.firestore().doc('organizations/org1').update({
          name: 'محاولة تعديل'
        })
      );
    });
  });

  // اختبارات الإشعارات
  describe('Notifications Collection Security', () => {
    test('المستخدم يمكنه قراءة إشعاراته فقط', async () => {
      const alice = testEnv.authenticatedContext('alice', {
        isIndependent: true
      });
      
      // إنشاء إشعار لأليس
      const admin = testEnv.authenticatedContext('admin', {
        isSystemAdmin: true
      });
      
      await admin.firestore().doc('notifications/notif1').set({
        userId: 'alice',
        message: 'إشعار لأليس',
        read: false
      });
      
      await assertSucceeds(alice.firestore().doc('notifications/notif1').get());
    });

    test('المستخدم لا يمكنه قراءة إشعارات الآخرين', async () => {
      const alice = testEnv.authenticatedContext('alice', {
        isIndependent: true
      });
      
      // إنشاء إشعار لبوب
      const admin = testEnv.authenticatedContext('admin', {
        isSystemAdmin: true
      });
      
      await admin.firestore().doc('notifications/notif2').set({
        userId: 'bob',
        message: 'إشعار لبوب',
        read: false
      });
      
      await assertFails(alice.firestore().doc('notifications/notif2').get());
    });
  });

  // اختبارات القاعدة العامة
  describe('General Rules Security', () => {
    test('المستخدم العادي لا يمكنه الوصول للمجموعات غير المحددة', async () => {
      const regularUser = testEnv.authenticatedContext('user', {
        isIndependent: true
      });
      
      await assertFails(
        regularUser.firestore().doc('sensitiveData/secret').get()
      );
    });

    test('مالك النظام يمكنه الوصول لجميع البيانات', async () => {
      const systemOwner = testEnv.authenticatedContext('owner', {
        isSystemOwner: true,
        role: 'isSystemOwner'
      });
      
      await assertSucceeds(
        systemOwner.firestore().doc('sensitiveData/secret').get()
      );
    });

    test('المستخدم غير المسجل لا يمكنه الوصول لأي بيانات', async () => {
      const unauthenticated = testEnv.unauthenticatedContext();
      
      await assertFails(
        unauthenticated.firestore().doc('users/alice').get()
      );
    });
  });

  // اختبارات الصلاحيات المخصصة
  describe('Custom Permissions Security', () => {
    test('المستخدم مع صلاحية مخصصة يمكنه الوصول', async () => {
      const userWithPermission = testEnv.authenticatedContext('user', {
        customPermissions: ['tasks:view', 'users:edit']
      });
      
      await assertSucceeds(
        userWithPermission.firestore().collection('tasks').get()
      );
    });

    test('المستخدم بدون صلاحية مخصصة لا يمكنه الوصول', async () => {
      const userWithoutPermission = testEnv.authenticatedContext('user', {
        customPermissions: []
      });
      
      await assertFails(
        userWithoutPermission.firestore().doc('system/settings').get()
      );
    });
  });
});

// تشغيل الاختبارات
// npm install --save-dev @firebase/rules-unit-testing
// npm test
