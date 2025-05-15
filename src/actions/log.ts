'use server';

import { getFirebaseDb } from '@/config/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore, Query, CollectionReference } from 'firebase-admin/firestore';

export interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: Timestamp;
  metadata?: Record<string, any>;
}

const MAX_LOGS_TO_FETCH = 100;

export async function fetchLogs(): Promise<{ logs?: LogEntry[]; error?: string }> {
  let db: Firestore;
  try {
    console.log("[fetchLogs Action - Admin SDK] Attempting to get Firestore instance...");
    db = await getFirebaseDb(); // Await the async function
    console.log("[fetchLogs Action - Admin SDK] Firestore instance obtained. Fetching logs...");

    const logsColRef: CollectionReference = db.collection('logs');
    const q: Query = logsColRef.orderBy('timestamp', 'desc').limit(MAX_LOGS_TO_FETCH);

    const querySnapshot = await q.get();

    const logs = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        level: data.level || 'info',
        message: data.message || 'رسالة سجل غير متوفرة',
        timestamp: data.timestamp instanceof Timestamp ? data.timestamp : Timestamp.now(),
        metadata: data.metadata || undefined,
      } as LogEntry;
    });
    console.log(`[fetchLogs Action - Admin SDK] Successfully fetched ${logs.length} log entries.`);
    return { logs };

  } catch (error: any) {
    console.error('[fetchLogs Action - Admin SDK] Error fetching logs from Firestore:', error);
    const errorMessage = `فشل في جلب السجلات باستخدام Admin SDK: ${error.message || 'سبب غير معروف'}. تحقق من تكوين الخادم وسجلاته وصلاحيات حساب الخدمة.`;
    return { error: errorMessage };
  }
}

export async function addLogEntry(level: LogEntry['level'], message: string, metadata?: Record<string, any>): Promise<{ success?: boolean; error?: string }> {
    let db: Firestore;
    try {
        console.log(`[addLogEntry Action - Admin SDK] Attempting to add log [${level}]: ${message}`);
        db = await getFirebaseDb(); // Await the async function
        const logsColRef = db.collection('logs');

        const logData = {
            level,
            message,
            timestamp: Timestamp.now(),
            metadata: metadata || null,
        };

        await logsColRef.add(logData);

        console.log(`Log entry added: [${level}] ${message}`);
        return { success: true };
    } catch (error: any) {
        console.error('[addLogEntry Action - Admin SDK] Error adding log entry:', error);
        const errorMessage = `فشل في إضافة سجل باستخدام Admin SDK: ${error.message || 'سبب غير معروف'}. تحقق من سجلات الخادم.`;
        return { error: errorMessage };
    }
}