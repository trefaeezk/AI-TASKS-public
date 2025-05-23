'use client';

/**
 * مربع حوار إنشاء هدف استراتيجي جديد
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { functions, db } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useAccountType } from '@/hooks/useAccountType';
import { Skeleton } from '@/components/ui/skeleton';

interface CreateObjectiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    priority: 'low' | 'medium' | 'high';
    ownerId: string;
    ownerName: string;
    departmentId?: string;
  }) => void;
  periodId: string;
}

interface Department {
  id: string;
  name: string;
}

interface OrgMember {
  uid: string;
  name: string;
  email: string;
  role: string;
}

export function CreateObjectiveDialog({ open, onOpenChange, onSubmit, periodId }: CreateObjectiveDialogProps) {
  const { user } = useAuth();
  const { organizationId } = useAccountType();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [ownerId, setOwnerId] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);

  // جلب الأقسام وأعضاء المؤسسة
  useEffect(() => {
    if (!open || !organizationId) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // جلب الأقسام
        const departmentsQuery = query(
          collection(db, 'departments'),
          where('organizationId', '==', organizationId)
        );

        const departmentsSnapshot = await getDocs(departmentsQuery);
        const departmentsList: Department[] = [];

        departmentsSnapshot.forEach(doc => {
          departmentsList.push({
            id: doc.id,
            name: doc.data().name,
          });
        });

        setDepartments(departmentsList);

        // جلب أعضاء المؤسسة
        const getOrganizationMembers = httpsCallable<
          { orgId: string },
          { members: OrgMember[] }
        >(functions, 'getOrganizationMembers');

        const result = await getOrganizationMembers({ orgId: organizationId });
        setMembers(result.data.members || []);

        // تعيين المستخدم الحالي كمالك افتراضي
        if (user && result.data.members) {
          const currentMember = result.data.members.find(m => m.uid === user.uid);
          if (currentMember) {
            setOwnerId(currentMember.uid);
          } else if (result.data.members.length > 0) {
            setOwnerId(result.data.members[0].uid);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, organizationId, user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title) {
      alert('يرجى إدخال عنوان الهدف');
      return;
    }

    if (!ownerId) {
      alert('يرجى اختيار مالك الهدف');
      return;
    }

    const ownerMember = members.find(m => m.uid === ownerId);
    if (!ownerMember) {
      alert('مالك الهدف غير صالح');
      return;
    }

    onSubmit({
      title,
      description: description || undefined,
      priority,
      ownerId,
      ownerName: ownerMember.name || ownerMember.email,
      departmentId: departmentId || undefined,
    });
  };

  const handleReset = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDepartmentId('');
    // لا نعيد تعيين المالك لأنه يتم تعيينه تلقائيًا
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) handleReset();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>إنشاء هدف استراتيجي جديد</DialogTitle>
          <DialogDescription>
            أدخل تفاصيل الهدف الاستراتيجي الجديد. يمكنك إضافة النتائج الرئيسية بعد إنشاء الهدف.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">عنوان الهدف</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="أدخل عنوان الهدف"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">وصف الهدف (اختياري)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="أدخل وصف الهدف"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">الأولوية</Label>
                <Select value={priority} onValueChange={(value: 'low' | 'medium' | 'high') => setPriority(value)}>
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="اختر الأولوية" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">منخفضة</SelectItem>
                    <SelectItem value="medium">متوسطة</SelectItem>
                    <SelectItem value="high">عالية</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">القسم (اختياري)</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger id="department">
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">المؤسسة (بدون قسم)</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="owner">مالك الهدف</Label>
              <Select value={ownerId} onValueChange={setOwnerId} required>
                <SelectTrigger id="owner">
                  <SelectValue placeholder="اختر مالك الهدف" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.uid} value={member.uid}>
                      {member.name || member.email} ({member.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button type="submit">
                إنشاء الهدف
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
