// سكريبت لتحديث دور المستخدم باستخدام Firebase Admin SDK
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, getIdToken } = require('firebase/auth');
const axios = require('axios');

// تكوين Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBIJrQX5HBBnP7LKzgsUNdWCX7aqhVG3wA",
  authDomain: "tasks-intelligence.firebaseapp.com",
  projectId: "tasks-intelligence",
  storageBucket: "tasks-intelligence.appspot.com",
  messagingSenderId: "770714758504",
  appId: "1:770714758504:web:aea98ba39a726df1ba3add"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// بيانات المستخدم المسؤول (يجب أن يكون مسؤولاً)
const adminEmail = "YOUR_ADMIN_EMAIL";
const adminPassword = "YOUR_ADMIN_PASSWORD";

// بيانات المستخدم المراد تحديث دوره
const targetEmail = "trefaeez@gmail.com";
const newRole = "engineer";

async function updateUserRole() {
  try {
    // تسجيل الدخول كمسؤول
    console.log(`تسجيل الدخول كمسؤول: ${adminEmail}`);
    const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    const adminUser = userCredential.user;
    
    // الحصول على رمز المصادقة
    const idToken = await getIdToken(adminUser);
    
    // الحصول على معرف المستخدم المستهدف
    console.log(`البحث عن المستخدم: ${targetEmail}`);
    const listUsersResponse = await axios.post(
      'https://europe-west1-tasks-intelligence.cloudfunctions.net/listFirebaseUsers',
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        }
      }
    );
    
    const users = listUsersResponse.data.users;
    const targetUser = users.find(user => user.email === targetEmail);
    
    if (!targetUser) {
      throw new Error(`لم يتم العثور على المستخدم: ${targetEmail}`);
    }
    
    const targetUid = targetUser.uid;
    console.log(`تم العثور على المستخدم: ${targetEmail} (${targetUid})`);
    
    // تحديث دور المستخدم
    console.log(`تحديث دور المستخدم إلى: ${newRole}`);
    const updateRoleResponse = await axios.post(
      'https://europe-west1-tasks-intelligence.cloudfunctions.net/updateUserRoleHttp',
      {
        uid: targetUid,
        role: newRole
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        }
      }
    );
    
    console.log('تم تحديث دور المستخدم بنجاح!');
    console.log(updateRoleResponse.data);
    
  } catch (error) {
    console.error('حدث خطأ أثناء تحديث دور المستخدم:', error.message);
    if (error.response) {
      console.error('استجابة الخطأ:', error.response.data);
    }
  }
}

// تنفيذ الوظيفة
updateUserRole();
