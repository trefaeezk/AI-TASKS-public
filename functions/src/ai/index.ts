/**
 * وظائف Firebase للذكاء الاصطناعي
 *
 * هذا الملف يصدر جميع وظائف الذكاء الاصطناعي المتاحة في التطبيق
 */

import * as functions from 'firebase-functions';

// تصدير وظائف الذكاء الاصطناعي
export * from './tasks/suggest-milestones';
export * from './tasks/suggest-milestone-weights';
export * from './tasks/suggest-milestone-due-dates';
export * from './tasks/suggest-smart-due-date';
export * from './planning/generate-daily-plan';
export * from './planning/generate-weekly-report';
export * from './planning/generate-smart-suggestions';
export * from './meetings/generate-daily-meeting-agenda';

// تصدير الأنواع المشتركة
export * from './types';

// تصدير الوظائف المساعدة
export * from './utils';
export * from './config';
