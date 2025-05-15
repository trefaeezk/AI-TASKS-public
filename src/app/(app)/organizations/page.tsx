'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Building, Plus, Clock, Check, X } from 'lucide-react';
import CreateOrganizationRequest from '@/components/organizations/CreateOrganizationRequest';
import { collection, query, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

interface OrganizationRequest {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  userId: string;
}

interface OrganizationInvitation {
  id: string;
  organizationId: string;
  organizationName: string;
  role: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: any;
  invitedBy: string;
}

export default function OrganizationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<OrganizationRequest[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [activeTab, setActiveTab] = useState('requests');

  // تحميل طلبات إنشاء المؤسسات
  useEffect(() => {
    if (!user) return;

    setLoading(true);

    // الاستماع لتغييرات طلبات إنشاء المؤسسات
    const requestsQuery = query(
      collection(db, 'organizationRequests'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc') // استخدام الفهرس المركب userId + createdAt لتحسين الأداء وترتيب الطلبات
    );

    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => {
        const requestsData: OrganizationRequest[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          requestsData.push({
            id: doc.id,
            name: data.name,
            description: data.description,
            status: data.status,
            createdAt: data.createdAt,
            userId: data.userId,
          });
        });

        setRequests(requestsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading organization requests:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ أثناء تحميل طلبات إنشاء المؤسسات',
          variant: 'destructive',
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, toast]);

  // تحميل دعوات الانضمام للمؤسسات
  useEffect(() => {
    if (!user) return;

    // الاستماع لتغييرات دعوات الانضمام للمؤسسات
    const invitationsQuery = query(
      collection(db, 'organizationInvitations'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc') // استخدام الفهرس المركب userId + createdAt لتحسين الأداء وترتيب الدعوات
    );

    const unsubscribe = onSnapshot(
      invitationsQuery,
      (snapshot) => {
        const invitationsData: OrganizationInvitation[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          invitationsData.push({
            id: doc.id,
            organizationId: data.organizationId,
            organizationName: data.organizationName,
            role: data.role,
            status: data.status,
            createdAt: data.createdAt,
            invitedBy: data.invitedBy,
          });
        });

        setInvitations(invitationsData);
      },
      (error) => {
        console.error('Error loading organization invitations:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ أثناء تحميل دعوات الانضمام للمؤسسات',
          variant: 'destructive',
        });
      }
    );

    return () => unsubscribe();
  }, [user, toast]);

  // عرض حالة الطلب
  const renderRequestStatus = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">قيد المراجعة</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-100 text-green-800">تمت الموافقة</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-100 text-red-800">تم الرفض</Badge>;
      default:
        return <Badge variant="outline">غير معروف</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">إدارة المؤسسات</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="requests">طلبات إنشاء المؤسسات</TabsTrigger>
          <TabsTrigger value="invitations">دعوات الانضمام للمؤسسات</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <CreateOrganizationRequest />

          <h2 className="text-xl font-semibold mt-6">طلباتي السابقة</h2>

          {requests.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                لم تقم بإرسال أي طلبات لإنشاء مؤسسات بعد.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {requests.map((request) => (
                <Card key={request.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{request.name}</CardTitle>
                      {renderRequestStatus(request.status)}
                    </div>
                    <CardDescription>
                      {request.createdAt && (
                        <span>
                          تم الإرسال منذ {formatDistanceToNow(request.createdAt.toDate(), { locale: ar, addSuffix: false })}
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {request.description || 'لا يوجد وصف'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <h2 className="text-xl font-semibold">دعوات الانضمام للمؤسسات</h2>

          {invitations.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                لم تتلق أي دعوات للانضمام إلى مؤسسات بعد.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {invitations.map((invitation) => (
                <Card key={invitation.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{invitation.organizationName}</CardTitle>
                      {invitation.status === 'pending' ? (
                        <Badge variant="outline" className="bg-blue-100 text-blue-800">دعوة جديدة</Badge>
                      ) : invitation.status === 'accepted' ? (
                        <Badge variant="outline" className="bg-green-100 text-green-800">تم القبول</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-100 text-red-800">تم الرفض</Badge>
                      )}
                    </div>
                    <CardDescription>
                      الدور: {invitation.role}
                      {invitation.createdAt && (
                        <span className="block">
                          تم الإرسال منذ {formatDistanceToNow(invitation.createdAt.toDate(), { locale: ar, addSuffix: false })}
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {invitation.status === 'pending' && (
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" className="flex items-center">
                          <X className="ml-1 h-4 w-4" />
                          رفض
                        </Button>
                        <Button size="sm" className="flex items-center">
                          <Check className="ml-1 h-4 w-4" />
                          قبول
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
