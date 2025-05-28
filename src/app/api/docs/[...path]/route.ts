import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * API Route لتقديم ملفات التوثيق
 * يتعامل مع جميع الطلبات إلى /api/docs/[...path]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // بناء مسار الملف
    const filePath = path.join(process.cwd(), 'docs', ...params.path);
    
    // التحقق من وجود الملف
    if (!fs.existsSync(filePath)) {
      return new NextResponse('File not found', { 
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    // قراءة محتوى الملف
    const content = fs.readFileSync(filePath, 'utf8');
    
    // تحديد نوع المحتوى بناءً على امتداد الملف
    const extension = path.extname(filePath).toLowerCase();
    let contentType = 'text/plain';
    
    switch (extension) {
      case '.md':
        contentType = 'text/markdown';
        break;
      case '.json':
        contentType = 'application/json';
        break;
      case '.html':
        contentType = 'text/html';
        break;
      case '.txt':
        contentType = 'text/plain';
        break;
      default:
        contentType = 'text/plain';
    }

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // تخزين مؤقت لساعة واحدة
      },
    });

  } catch (error) {
    console.error('Error reading documentation file:', error);
    return new NextResponse('Internal Server Error', { 
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
}

/**
 * معالج OPTIONS للـ CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
