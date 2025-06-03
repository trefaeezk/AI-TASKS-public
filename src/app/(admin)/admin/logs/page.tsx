// src/app/(admin)/admin/logs/page.tsx
'use client';

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { fetchLogs, type LogEntry } from '@/actions/log';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Loader2, AlertTriangle, FileText, RefreshCw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area'; // Import ScrollArea
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const getLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    console.log("Fetching logs...");

    try {
      const result = await fetchLogs();
      if (result.error) {
        throw new Error(result.error);
      }
      setLogs(result.logs || []);
       console.log(`Successfully fetched ${result.logs?.length || 0} log entries.`);
    } catch (err: any) {
       console.error("Error fetching logs:", err);
      setError(err.message || 'حدث خطأ أثناء تحميل السجلات.');
      toast({
        title: 'فشل تحميل السجلات',
        description: err.message || 'حدث خطأ غير متوقع.',
        variant: 'destructive',
      });
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    getLogs();
  }, [getLogs]);

   const getLogLevelVariant = (level: LogEntry['level']): "default" | "secondary" | "destructive" | "outline" => {
    switch (level) {
      case 'info': return 'default';
      case 'warn': return 'secondary'; // Using secondary for warning, adjust if needed
      case 'error': return 'destructive';
      default: return 'outline';
    }
  };

  const getLogLevelClass = (level: LogEntry['level']): string => {
    switch (level) {
        case 'info': return 'text-blue-600 dark:text-blue-400';
        case 'warn': return 'text-amber-600 dark:text-amber-400';
        case 'error': return 'text-destructive';
        default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-primary flex items-center">
                <FileText className="ml-2 h-6 w-6"/> سجلات التطبيق
            </h1>
             <Button onClick={getLogs} disabled={loading} size="sm" variant="outline">
                 <RefreshCw className={cn("ml-2 h-4 w-4", loading && "animate-spin")} />
                 تحديث
             </Button>
        </div>

      <Card className="shadow-md border border-border">
        <CardHeader>
          <CardTitle>عرض السجلات</CardTitle>
          <CardDescription>
            عرض رسائل السجل والمعلومات والأخطاء الخاصة بالتطبيق.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="space-y-2">
                 <Skeleton className="h-10 w-full rounded-md bg-muted" />
                 <Skeleton className="h-10 w-full rounded-md bg-muted" />
                 <Skeleton className="h-10 w-full rounded-md bg-muted" />
                 <Skeleton className="h-10 w-full rounded-md bg-muted" />
             </div>
          ) : error ? (
             <div className="text-center text-destructive p-4 border border-destructive/30 bg-destructive/10 rounded-md">
                <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                <p className="font-semibold">خطأ في تحميل السجلات</p>
                <p className="text-sm mb-3">{error}</p>
                <Button onClick={getLogs} variant="destructive" size="sm">
                    <RefreshCw className="ml-1.5 h-4 w-4" />
                    إعادة المحاولة
                </Button>
             </div>
          ) : (
            <ScrollArea className="h-[60vh] border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
                  <TableRow>
                    <TableHead className="w-[150px]">الوقت</TableHead>
                    <TableHead className="w-[80px]">المستوى</TableHead>
                    <TableHead>الرسالة</TableHead>
                    <TableHead className="w-[200px]">البيانات الإضافية</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        لا توجد سجلات لعرضها.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                           {log.timestamp ? format(log.timestamp.toDate(), 'yyyy/MM/dd HH:mm:ss', { locale: ar }) : '-'}
                         </TableCell>
                        <TableCell>
                          <Badge variant={getLogLevelVariant(log.level)} className="text-xs capitalize">
                             {log.level}
                           </Badge>
                        </TableCell>
                        <TableCell className={cn("text-sm", getLogLevelClass(log.level))}>
                          {log.message}
                        </TableCell>
                         <TableCell className="text-xs text-muted-foreground">
                            {log.metadata && (
                                 <pre className="whitespace-pre-wrap break-all max-w-xs bg-muted/40 p-1 rounded-sm text-[10px] max-h-20 overflow-y-auto">
                                     {JSON.stringify(log.metadata, null, 2)}
                                 </pre>
                            )}
                         </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
