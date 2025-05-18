import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { getAuth } from 'firebase-admin/auth';
import { initAdmin } from '@/lib/firebase-admin';

// تهيئة Firebase Admin
initAdmin();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // التحقق من طريقة الطلب
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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
    
    // التحقق من وجود الملف
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // التحقق من الصلاحيات
    const isOwner = decodedToken.owner === true;
    const isAdmin = decodedToken.admin === true;
    
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
    
    // إرسال المحتوى
    res.setHeader('Content-Type', contentType);
    res.status(200).send(fileContent);
  } catch (error) {
    console.error('Error serving documentation file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
