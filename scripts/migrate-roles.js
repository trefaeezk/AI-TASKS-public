/**
 * سكريبت لتحديث الأدوار القديمة إلى الأدوار الجديدة في قاعدة البيانات
 * Migration script to update old roles to new roles in database
 */

const admin = require('firebase-admin');

// تهيئة Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'tasks-intelligence'
  });
}

const db = admin.firestore();

// خريطة تحويل الأدوار من القديمة للجديدة
const ROLE_MIGRATION_MAP = {
  // الأدوار القديمة -> الأدوار الجديدة
  'system_owner': 'isSystemOwner',
  'system_admin': 'isSystemAdmin',
  'org_owner': 'isOrgOwner',
  'org_admin': 'isOrgAdmin',
  'org_supervisor': 'isOrgSupervisor',
  'org_engineer': 'isOrgEngineer',
  'org_technician': 'isOrgTechnician',
  'org_assistant': 'isOrgAssistant',
  'independent': 'isIndependent',
  
  // أدوار قديمة جداً
  'admin': 'isOrgAdmin',
  'owner': 'isOrgOwner',
  'user': 'isOrgAssistant',
  'manager': 'isOrgAdmin',
  'employee': 'isOrgAssistant',
  'guest': 'isOrgAssistant'
};

/**
 * تحديث مجموعة المستخدمين
 */
async function migrateUsersCollection() {
  console.log('🔄 بدء تحديث مجموعة المستخدمين...');
  
  const usersSnapshot = await db.collection('users').get();
  const batch = db.batch();
  let updateCount = 0;
  
  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    const oldRole = userData.role;
    
    if (oldRole && ROLE_MIGRATION_MAP[oldRole]) {
      const newRole = ROLE_MIGRATION_MAP[oldRole];
      
      console.log(`📝 تحديث المستخدم ${doc.id}: ${oldRole} -> ${newRole}`);
      
      batch.update(doc.ref, {
        role: newRole,
        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        oldRole: oldRole // احتفظ بالدور القديم للمرجع
      });
      
      updateCount++;
    }
  }
  
  if (updateCount > 0) {
    await batch.commit();
    console.log(`✅ تم تحديث ${updateCount} مستخدم في مجموعة users`);
  } else {
    console.log('ℹ️ لا توجد أدوار قديمة في مجموعة users');
  }
}

/**
 * تحديث مجموعة أعضاء المؤسسات
 */
async function migrateOrganizationMembers() {
  console.log('🔄 بدء تحديث أعضاء المؤسسات...');
  
  const orgsSnapshot = await db.collection('organizations').get();
  let totalUpdates = 0;
  
  for (const orgDoc of orgsSnapshot.docs) {
    const membersSnapshot = await orgDoc.ref.collection('members').get();
    const batch = db.batch();
    let orgUpdateCount = 0;
    
    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data();
      const oldRole = memberData.role;
      
      if (oldRole && ROLE_MIGRATION_MAP[oldRole]) {
        const newRole = ROLE_MIGRATION_MAP[oldRole];
        
        console.log(`📝 تحديث عضو ${memberDoc.id} في ${orgDoc.id}: ${oldRole} -> ${newRole}`);
        
        batch.update(memberDoc.ref, {
          role: newRole,
          migratedAt: admin.firestore.FieldValue.serverTimestamp(),
          oldRole: oldRole
        });
        
        orgUpdateCount++;
      }
    }
    
    if (orgUpdateCount > 0) {
      await batch.commit();
      totalUpdates += orgUpdateCount;
    }
  }
  
  if (totalUpdates > 0) {
    console.log(`✅ تم تحديث ${totalUpdates} عضو في المؤسسات`);
  } else {
    console.log('ℹ️ لا توجد أدوار قديمة في أعضاء المؤسسات');
  }
}

/**
 * تحديث مجموعة الأفراد
 */
async function migrateIndividuals() {
  console.log('🔄 بدء تحديث مجموعة الأفراد...');
  
  const individualsSnapshot = await db.collection('individuals').get();
  const batch = db.batch();
  let updateCount = 0;
  
  for (const doc of individualsSnapshot.docs) {
    const userData = doc.data();
    const oldRole = userData.role;
    
    if (oldRole && ROLE_MIGRATION_MAP[oldRole]) {
      const newRole = ROLE_MIGRATION_MAP[oldRole];
      
      console.log(`📝 تحديث فرد ${doc.id}: ${oldRole} -> ${newRole}`);
      
      batch.update(doc.ref, {
        role: newRole,
        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        oldRole: oldRole
      });
      
      updateCount++;
    }
  }
  
  if (updateCount > 0) {
    await batch.commit();
    console.log(`✅ تم تحديث ${updateCount} فرد في مجموعة individuals`);
  } else {
    console.log('ℹ️ لا توجد أدوار قديمة في مجموعة individuals');
  }
}

/**
 * تحديث Custom Claims للمستخدمين
 */
async function migrateUserClaims() {
  console.log('🔄 بدء تحديث Custom Claims...');
  
  const usersSnapshot = await db.collection('users').get();
  let updateCount = 0;
  
  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    const uid = userData.uid || doc.id;
    
    try {
      const userRecord = await admin.auth().getUser(uid);
      const currentClaims = userRecord.customClaims || {};
      const oldRole = currentClaims.role;
      
      if (oldRole && ROLE_MIGRATION_MAP[oldRole]) {
        const newRole = ROLE_MIGRATION_MAP[oldRole];
        
        console.log(`🔐 تحديث Claims للمستخدم ${uid}: ${oldRole} -> ${newRole}`);
        
        // تحديث الـ claims
        const newClaims = {
          ...currentClaims,
          role: newRole,
          migratedAt: new Date().toISOString(),
          oldRole: oldRole
        };
        
        await admin.auth().setCustomUserClaims(uid, newClaims);
        updateCount++;
      }
    } catch (error) {
      console.warn(`⚠️ خطأ في تحديث Claims للمستخدم ${uid}:`, error.message);
    }
  }
  
  if (updateCount > 0) {
    console.log(`✅ تم تحديث Claims لـ ${updateCount} مستخدم`);
  } else {
    console.log('ℹ️ لا توجد أدوار قديمة في Claims');
  }
}

/**
 * تشغيل جميع عمليات التحديث
 */
async function runMigration() {
  console.log('🚀 بدء عملية تحديث الأدوار الشاملة...');
  console.log('📋 خريطة التحويل:', ROLE_MIGRATION_MAP);
  
  try {
    await migrateUsersCollection();
    await migrateOrganizationMembers();
    await migrateIndividuals();
    await migrateUserClaims();
    
    console.log('🎉 تمت عملية التحديث بنجاح!');
    console.log('💡 نصيحة: قم بتحديث الصفحة أو إعادة تسجيل الدخول لرؤية التغييرات');
    
  } catch (error) {
    console.error('❌ خطأ في عملية التحديث:', error);
  }
}

// تشغيل السكريبت
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ فشل في تشغيل السكريبت:', error);
      process.exit(1);
    });
}

module.exports = {
  runMigration,
  ROLE_MIGRATION_MAP
};
