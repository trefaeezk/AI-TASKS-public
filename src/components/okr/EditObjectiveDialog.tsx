'use client';

/**
 * مربع حوار تعديل الهدف الاستراتيجي
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

interface EditObjectiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    priority: 'low' | 'medium' | 'high';
    status: 'active' | 'completed' | 'at_risk' | 'behind';
    ownerId: string;
    ownerName: string;
    departmentId?: string;
  }) => void;
  objective: {
    id: string;
    title: string;
    description?: string;
    priority: 'low' | 'medium' | 'high';
    status: 'active' | 'completed' | 'at_risk' | 'behind';
    ownerId: string;
    ownerName: string;
    departmentId?: string;
  };
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

export function EditObjectiveDialog({ open, onOpenChange, onSubmit, objective }: EditObjectiveDialogProps) {
  const { user } = useAuth();
  const { organizationId } = useAccountType();
  
  const [title, setTitle] = useState(objective.title);
  const [description, setDescription] = useState(objective.description || '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(objective.priority);
  const [status, setStatus] = useState<'active' | 'completed' | 'at_risk' | 'behind'>(objective.status);
  const [ownerId, setOwnerId] = useState(objective.ownerId);
  const [departmentId, setDepartmentId] = useState(objective.departmentId || '');
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  // تحديث الحالة عند تغيير الهدف
  useEffect(() => {
    setTitle(objective.title);
    setDescription(objective.description || '');
    setPriority(objective.priority);
    setStatus(objective.status);
    setOwnerId(objective.ownerId);
    setDepartmentId(objective.departmentId || '');
  }, [objective]);
  
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
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [open, organizationId]);
  
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
      status,
      ownerId,
      ownerName: ownerMember.name || ownerMember.email,
      departmentId: departmentId || undefined,
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>تعديل الهدف الاستراتيجي</DialogTitle>
          <DialogDescription>
            قم بتعديل تفاصيل الهدف الاستراتيجي.
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
                <Label htmlFor="status">الحالة</Label>
                <Select value={status} onValueChange={(value: 'active' | 'completed' | 'at_risk' | 'behind') => setStatus(value)}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="اختر الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="at_risk">في خطر</SelectItem>
                    <SelectItem value="behind">متأخر</SelectItem>
                    <SelectItem value="completed">مكتمل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
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
              
              <div className="space-y-2">
                <Label htmlFor="department">القسم (اختياري)</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger id="department">
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">المؤسسة (بدون قسم)</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button type="submit">
                حفظ التغييرات
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
