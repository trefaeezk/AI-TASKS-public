/**
 * صفحة طلبات الموافقة الخاصة بالمستخدم
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  MessageSquare,
  Search,
  Filter,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';
import { Task } from '@/types/task';

export default function MyRequestsPage() {
  const { user } = useAuth();
  
  const [requests, setRequests] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // جلب جميع طلبات المستخدم
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'tasks'),
      where('submittedBy', '==', user.uid),
      where('requiresApproval', '==', true),
      orderBy('submittedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      
      setRequests(tasks);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching user requests:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // فلترة الطلبات
  const filteredRequests = requests.filter(request => {
    const matchesSearch = request.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'pending' && request.status === 'pending-approval') ||
      (statusFilter === 'approved' && request.approved === true) ||
      (statusFilter === 'rejected' && request.approved === false);
    const matchesPriority = priorityFilter === 'all' || request.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusInfo = (request: Task) => {
    // أولاً: التحقق من وجود قرار موافقة
    if (request.approved === true) {
      return {
        icon: <CheckCircle className="h-4 w-4 text-white" />,
        text: 'تمت الموافقة',
        color: 'bg-green-600 text-white border border-green-600'
      };
    } else if (request.approved === false) {
      return {
        icon: <XCircle className="h-4 w-4 text-white" />,
        text: 'تم الرفض',
        color: 'bg-red-600 text-white border border-red-600'
      };
    } else if (request.status === 'pending-approval') {
      // لم يتم اتخاذ قرار بعد
      return {
        icon: <Clock className="h-4 w-4 text-white" />,
        text: 'في انتظار الموافقة',
        color: 'bg-orange-600 text-white border border-orange-600'
      };
    } else {
      // حالة افتراضية
      return {
        icon: <Clock className="h-4 w-4 text-white" />,
        text: 'في انتظار الموافقة',
        color: 'bg-orange-600 text-white border border-orange-600'
      };
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return 'عالية';
      case 'medium': return 'متوسطة';
      case 'low': return 'منخفضة';
      default: return priority;
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending-approval').length;
  const approvedCount = requests.filter(r => r.approved === true).length;
  const rejectedCount = requests.filter(r => r.approved === false).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Clock className="h-8 w-8 animate-spin mr-2" />
        <span>جاري تحميل طلباتك...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">طلباتي</h1>
          <p className="text-muted-foreground">متابعة حالة طلبات الموافقة الخاصة بك</p>
        </div>
        <Badge variant="outline" className="text-lg px-3 py-1">
          {requests.length} طلب
        </Badge>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center p-4">
            <Clock className="h-8 w-8 text-orange-600 mr-3" />
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">في انتظار الموافقة</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-4">
            <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="text-2xl font-bold">{approvedCount}</p>
              <p className="text-sm text-muted-foreground">تمت الموافقة</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-4">
            <XCircle className="h-8 w-8 text-red-600 mr-3" />
            <div>
              <p className="text-2xl font-bold">{rejectedCount}</p>
              <p className="text-sm text-muted-foreground">تم الرفض</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* فلاتر البحث */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="البحث في الطلبات..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="pending">في انتظار الموافقة</SelectItem>
                <SelectItem value="approved">تمت الموافقة</SelectItem>
                <SelectItem value="rejected">تم الرفض</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="الأولوية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأولويات</SelectItem>
                <SelectItem value="high">عالية</SelectItem>
                <SelectItem value="medium">متوسطة</SelectItem>
                <SelectItem value="low">منخفضة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* قائمة الطلبات */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">لا توجد طلبات</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                  ? 'لا توجد طلبات تطابق معايير البحث'
                  : 'لم تقم بإرسال أي طلبات موافقة بعد'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((request) => {
            const statusInfo = getStatusInfo(request);
            
            const getBorderClass = (request: Task) => {
              if (request.status === 'pending-approval') {
                return 'border-r-orange-500';
              } else if (request.approved === true) {
                return 'border-r-green-500';
              } else if (request.approved === false) {
                return 'border-r-red-500';
              } else {
                return 'border-r-gray-300';
              }
            };

            return (
              <Card key={request.id} className={`border-r-4 ${getBorderClass(request)}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <CardTitle className="text-lg">{request.description}</CardTitle>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>أُرسل في: {format(request.submittedAt?.toDate() || new Date(), 'PPP', { locale: ar })}</span>
                        </div>
                        {request.approvedAt && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>تم الرد في: {format(request.approvedAt.toDate(), 'PPP', { locale: ar })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant={getPriorityColor(request.priority || 'medium')}>
                        {getPriorityText(request.priority || 'medium')}
                      </Badge>
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.icon}
                        <span>{statusInfo.text}</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {request.details && (
                    <div>
                      <p className="text-sm font-medium mb-1">التفاصيل:</p>
                      <p className="text-sm text-muted-foreground">{request.details}</p>
                    </div>
                  )}

                  {request.notes && (
                    <div>
                      <p className="text-sm font-medium mb-1">ملاحظاتك:</p>
                      <p className="text-sm text-muted-foreground">{request.notes}</p>
                    </div>
                  )}

                  {request.rejectionReason && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-red-800 mb-1">سبب الرفض:</p>
                          <p className="text-sm text-red-700">{request.rejectionReason}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {request.approvedByName && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>تم الرد بواسطة: {request.approvedByName}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
