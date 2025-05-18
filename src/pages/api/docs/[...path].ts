import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';

// تهيئة Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: 'tasks-intelligence',
    });
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('API docs handler called:', req.url);

  // إضافة رأس CORS للسماح بالوصول من أي مصدر
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // التعامل مع طلبات OPTIONS
  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request received');
    return res.status(200).end();
  }

  // التحقق من طريقة الطلب
  if (req.method !== 'GET') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('GET request received for docs API');

  try {
    // التحقق من المصادقة
    const authHeader = req.headers.authorization;
    let decodedToken: any = null;

    // في بيئة التطوير، السماح بالوصول بدون مصادقة للاختبار
    if (process.env.NODE_ENV === 'development' && authHeader === 'Bearer test-token') {
      console.log('Development mode: Using test token');
      // إنشاء رمز مصادقة وهمي للاختبار
      decodedToken = {
        uid: 'test-user',
        email: 'test@example.com',
        owner: true,
        admin: true
      };
    } else {
      // التحقق من وجود رمز المصادقة
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = authHeader.split('Bearer ')[1];

      try {
        console.log('Verifying token:', token.substring(0, 10) + '...');
        decodedToken = await getAuth().verifyIdToken(token);
        console.log('Token verified successfully, user claims:', decodedToken);
      } catch (error) {
        console.error('Error verifying token:', error);
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    // الحصول على مسار الملف
    const { path: filePath } = req.query;

    if (!filePath || !Array.isArray(filePath)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    // بناء المسار الكامل للملف
    const fullPath = path.join(process.cwd(), 'docs', ...filePath);

    // التحقق من وجود الملف
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // التحقق من الصلاحيات
    const isOwner = decodedToken.owner === true;

    // التحقق من الصلاحيات حسب المسار
    if (filePath[0] === 'debug' && !isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // قراءة محتوى الملف
    const fileContent = fs.readFileSync(fullPath, 'utf8');

    // تحديد نوع المحتوى
    const contentType = fullPath.endsWith('.md')
      ? 'text/markdown'
      : fullPath.endsWith('.json')
        ? 'application/json'
        : 'text/plain';

    // إضافة رؤوس التخزين المؤقت
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400'); // تخزين مؤقت لمدة ساعة، مع السماح باستخدام النسخة القديمة لمدة يوم
    res.setHeader('ETag', `"${Buffer.from(fileContent).toString('base64').substring(0, 27)}"`); // إضافة ETag للتحقق من التغييرات

    // إرسال المحتوى
    res.setHeader('Content-Type', contentType);
    res.status(200).send(fileContent);
  } catch (error: any) {
    console.error('Error serving documentation file:', error);

    // تحسين رسائل الخطأ
    let statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error.code === 'ENOENT') {
      statusCode = 404;
      errorMessage = 'File not found';
    } else if (error.message.includes('token')) {
      statusCode = 401;
      errorMessage = 'Authentication error';
    } else if (error.message.includes('permission') || error.message.includes('access')) {
      statusCode = 403;
      errorMessage = 'Access denied';
    }

    res.status(statusCode).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
