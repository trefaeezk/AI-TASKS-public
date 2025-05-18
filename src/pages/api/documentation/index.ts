import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('API documentation handler called');

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

  console.log('GET request received for documentation API');

  try {
    // قائمة الوثائق المتاحة
    const documents = [
      {
        id: 'debug-overview',
        title: 'نظرة عامة على صفحة التشخيص',
        description: 'شرح عام لصفحة التشخيص وكيفية استخدامها',
        category: 'debug',
        path: 'debug/README.md',
        requiredPermission: 'owner',
      },
      {
        id: 'debug-access-control',
        title: 'إدارة الصلاحيات لصفحة التشخيص',
        description: 'شرح نظام الصلاحيات للوصول إلى صفحة التشخيص',
        category: 'debug',
        path: 'debug/access-control.md',
        requiredPermission: 'owner',
      },
      {
        id: 'debug-email-system',
        title: 'نظام البريد الإلكتروني في صفحة التشخيص',
        description: 'شرح نظام البريد الإلكتروني المستخدم في صفحة التشخيص',
        category: 'debug',
        path: 'debug/email-system.md',
        requiredPermission: 'owner',
      },
      {
        id: 'general-overview',
        title: 'نظرة عامة على النظام',
        description: 'شرح عام لنظام إدارة المهام',
        category: 'general',
        path: 'README.md',
        requiredPermission: 'user',
      },
      {
        id: 'user-guide',
        title: 'دليل المستخدم',
        description: 'دليل استخدام النظام للمستخدمين',
        category: 'general',
        path: 'user.md',
        requiredPermission: 'user',
      },
      {
        id: 'organizations-guide',
        title: 'دليل المؤسسات',
        description: 'شرح نظام المؤسسات في النظام',
        category: 'general',
        path: 'ORGANIZATIONS.md',
        requiredPermission: 'user',
      },
      {
        id: 'roles-permissions',
        title: 'الأدوار والصلاحيات',
        description: 'شرح نظام الأدوار والصلاحيات في النظام',
        category: 'general',
        path: 'ROLES_PERMISSIONS.md',
        requiredPermission: 'user',
      },
      {
        id: 'performance-guide',
        title: 'دليل الأداء',
        description: 'شرح نظام الأداء في النظام',
        category: 'performance',
        path: 'PERFORMANCE.md',
        requiredPermission: 'user',
      },
      {
        id: 'developer-guide',
        title: 'دليل المطور',
        description: 'دليل المطور للنظام',
        category: 'development',
        path: 'DEVELOPER_GUIDE.md',
        requiredPermission: 'user',
      },
    ];

    // تحميل محتوى الوثيقة الافتراضية
    let initialDocContent = '';
    let initialDocId = 'general-overview';

    try {
      const docPath = path.join(process.cwd(), 'docs', 'README.md');
      if (fs.existsSync(docPath)) {
        initialDocContent = fs.readFileSync(docPath, 'utf8');
      }
    } catch (error) {
      console.error('Error loading initial document:', error);
    }

    // إضافة رؤوس التخزين المؤقت
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400'); // تخزين مؤقت لمدة ساعة، مع السماح باستخدام النسخة القديمة لمدة يوم

    // إضافة ETag للتحقق من التغييرات
    const etag = `"${Buffer.from(JSON.stringify(documents)).toString('base64').substring(0, 27)}"`;
    res.setHeader('ETag', etag);

    // إرسال البيانات
    res.status(200).json({
      documents,
      initialDocContent,
      initialDocId,
    });
  } catch (error: any) {
    console.error('Error in documentation API:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
