/**
 * سكربت لإنشاء مؤشرات Firestore المطلوبة
 * 
 * يستخدم هذا السكربت Firebase Admin SDK لإنشاء المؤشرات المطلوبة في Firestore
 * 
 * لتشغيل السكربت:
 * 1. تأكد من تثبيت حزمة firebase-admin
 * 2. قم بتشغيل السكربت باستخدام Node.js: node scripts/create-indexes.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// تهيئة Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * إنشاء مؤشر Firestore
 * @param {string} collectionId - معرف المجموعة
 * @param {Array<Object>} fields - حقول المؤشر
 * @returns {Promise<void>}
 */
async function createIndex(collectionId, fields) {
  try {
    // الحصول على مرجع للمشروع
    const projectId = admin.app().options.projectId;
    const firestore = admin.firestore();
    
    // إنشاء المؤشر باستخدام واجهة برمجة التطبيقات الإدارية
    const index = {
      collectionGroup: collectionId,
      queryScope: 'COLLECTION',
      fields: fields
    };
    
    console.log(`Creating index for collection ${collectionId} with fields:`, fields);
    
    // استخدام واجهة برمجة التطبيقات الإدارية لإنشاء المؤشر
    await firestore._firestoreClient.createIndex({
      parent: `projects/${projectId}/databases/(default)/collectionGroups/${collectionId}`,
      index: index
    });
    
    console.log(`Index created successfully for collection ${collectionId}`);
  } catch (error) {
    console.error(`Error creating index for collection ${collectionId}:`, error);
  }
}

/**
 * إنشاء جميع المؤشرات المطلوبة
 */
async function createAllIndexes() {
  try {
    // 1. مؤشر للإشعارات حسب userId و createdAt
    await createIndex('notifications', [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' }
    ]);
    
    // 2. مؤشر للإشعارات حسب organizationId و userId و createdAt
    await createIndex('notifications', [
      { fieldPath: 'organizationId', order: 'ASCENDING' },
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
      { fieldPath: '__name__', order: 'DESCENDING' }
    ]);
    
    // 3. مؤشر للمهام حسب departmentId و organizationId و dueDate
    await createIndex('tasks', [
      { fieldPath: 'departmentId', order: 'ASCENDING' },
      { fieldPath: 'organizationId', order: 'ASCENDING' },
      { fieldPath: 'dueDate', order: 'ASCENDING' },
      { fieldPath: '__name__', order: 'ASCENDING' }
    ]);
    
    // 4. مؤشر للمهام حسب userId و status
    await createIndex('tasks', [
      { fieldPath: 'userId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'dueDate', order: 'ASCENDING' }
    ]);
    
    // 5. مؤشر للمهام حسب organizationId و status
    await createIndex('tasks', [
      { fieldPath: 'organizationId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'dueDate', order: 'ASCENDING' }
    ]);
    
    // 6. مؤشر للمهام حسب departmentId و status
    await createIndex('tasks', [
      { fieldPath: 'departmentId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'dueDate', order: 'ASCENDING' }
    ]);
    
    console.log('All indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes:', error);
  } finally {
    // إغلاق الاتصال بـ Firebase
    admin.app().delete();
  }
}

// تشغيل الوظيفة الرئيسية
createAllIndexes();
