// استبدل USER_ID_HERE بمعرف المستخدم الذي كتبته في الترمنال
const userId = "USER_ID_HERE";

// استدعاء وظيفة Firebase Cloud Function
const data = {
  uid: userId,
  role: "engineer"
};

updateUserRoleHttp(data)
  .then(result => {
    console.log("تم تحديث دور المستخدم بنجاح:", result);
  })
  .catch(error => {
    console.error("حدث خطأ أثناء تحديث دور المستخدم:", error);
  });
