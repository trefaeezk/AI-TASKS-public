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
  // إضافة رأس CORS للسماح بالوصول من أي مصدر
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // التعامل مع طلبات OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // التحقق من طريقة الطلب
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('API request received for docs:', req.url);
    // التحقق من المصادقة
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;

    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ error: 'Invalid token' });
    }

    // الحصول على مسار الملف
    const { path: filePath } = req.query;

    if (!filePath || !Array.isArray(filePath)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    // بناء المسار الكامل للملف
    const fullPath = path.join(process.cwd(), 'docs', ...filePath);

    console.log(`Requested file path: ${filePath.join('/')}`);
    console.log(`Full path: ${fullPath}`);

    // التحقق من وجود الملف
    if (!fs.existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`);
      return res.status(404).json({ error: 'File not found' });
    }

    console.log(`File exists: ${fullPath}`);

    // التحقق من الصلاحيات
    const isOwner = decodedToken.owner === true;
    const isAdmin = decodedToken.admin === true;

    // التحقق من الصلاحيات حسب المسار
    if (filePath[0] === 'debug' && !isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // قراءة محتوى الملف
    const fileContent = fs.readFileSync(fullPath, 'utf8');

    console.log(`File content length: ${fileContent.length}`);

    // تحديد نوع المحتوى
    const contentType = fullPath.endsWith('.md')
      ? 'text/markdown'
      : fullPath.endsWith('.json')
        ? 'application/json'
        : 'text/plain';

    console.log(`Content type: ${contentType}`);

    // إضافة رؤوس التخزين المؤقت
    res.setHeader('Cache-Control', 'public, max-age=3600'); // تخزين مؤقت لمدة ساعة

    // إرسال المحتوى
    res.setHeader('Content-Type', contentType);
    res.status(200).send(fileContent);

    console.log(`Response sent successfully for: ${filePath.join('/')}`);
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
