'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useParams, useRouter } from 'next/navigation';
import {
  Target, Plus, Edit, Trash2, ArrowLeft, Calendar,
  CheckCircle2, Circle, ChevronDown, Link as LinkIcon,
  Save, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { db } from '@/config/firebase';
import {
  collection, doc, getDoc, updateDoc,
  query, where, getDocs, Timestamp, serverTimestamp
} from 'firebase/firestore';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';

// تعريف أنواع البيانات
interface KeyResult {
  id: string;
  title: string;
  description?: string;
  progress: number;
  target: number;
  current: number;
  unit: string;
  dueDate?: Date;
  status: 'pending' | 'in-progress' | 'completed';
  tasks: string[]; // معرفات المهام المرتبطة
}

interface Objective {
  id: string;
  title: string;
  description?: string;
  departmentId?: string;
  startDate: Date;
  endDate: Date;
  progress: number;
  status: 'pending' | 'in-progress' | 'completed';
  keyResults: KeyResult[];
}

interface Department {
  id: string;
  name: string;
}

interface Task {
  id: string;
  description: string;
  status: 'pending' | 'completed' | 'hold';
  dueDate?: Date;
}

export default function ObjectiveDetailPage() {
  const { user, userClaims } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const objectiveId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [objective, setObjective] = useState<Objective | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddKeyResultDialogOpen, setIsAddKeyResultDialogOpen] = useState(false);
  const [isEditKeyResultDialogOpen, setIsEditKeyResultDialogOpen] = useState(false);
  const [isLinkTasksDialogOpen, setIsLinkTasksDialogOpen] = useState(false);
  const [selectedKeyResult, setSelectedKeyResult] = useState<KeyResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // بيانات الهدف للتعديل
  const [editObjective, setEditObjective] = useState({
    title: '',
    description: '',
    departmentId: '',
    startDate: '',
    endDate: '',
  });

  // بيانات النتيجة الرئيسية الجديدة
  const [newKeyResult, setNewKeyResult] = useState({
    title: '',
    description: '',
    target: 100,
    current: 0,
    unit: 'نسبة مئوية',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const organizationId = userClaims?.organizationId;
  const isOwner = userClaims?.owner === true;
  const isAdmin = userClaims?.admin === true;
  const isEngineer = userClaims?.engineer === true;
  const isSupervisor = userClaims?.supervisor === true;
  const canManageOkrs = isOwner || isAdmin || isEngineer || isSupervisor;

  // تحميل بيانات الهدف والأقسام والمهام
  useEffect(() => {
    if (!user || !organizationId || !objectiveId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // جلب بيانات الهدف
        const objectiveDoc = await getDoc(doc(db, 'objectives', objectiveId));

        if (!objectiveDoc.exists()) {
          toast({
            title: 'خطأ',
            description: 'الهدف غير موجود',
            variant: 'destructive',
          });
          router.push('/org/okr');
          return;
        }

        const objectiveData = objectiveDoc.data();

        // التحقق من أن الهدف ينتمي للمؤسسة الحالية
        if (objectiveData.organizationId !== organizationId) {
          toast({
            title: 'خطأ',
            description: 'ليس لديك صلاحية الوصول إلى هذا الهدف',
            variant: 'destructive',
          });
          router.push('/org/okr');
          return;
        }

        const keyResults: KeyResult[] = objectiveData.keyResults || [];

        // حساب التقدم الإجمالي للهدف
        const totalProgress = keyResults.length > 0
          ? keyResults.reduce((sum, kr) => sum + kr.progress, 0) / keyResults.length
          : 0;

        const objectiveWithData: Objective = {
          id: objectiveDoc.id,
          title: objectiveData.title,
          description: objectiveData.description,
          departmentId: objectiveData.departmentId,
          startDate: objectiveData.startDate.toDate(),
          endDate: objectiveData.endDate.toDate(),
          progress: totalProgress,
          status: objectiveData.status || 'pending',
          keyResults: keyResults.map((kr: any) => ({
            ...kr,
            dueDate: kr.dueDate ? kr.dueDate.toDate() : undefined,
          })),
        };

        setObjective(objectiveWithData);

        // تعيين بيانات التعديل
        setEditObjective({
          title: objectiveData.title,
          description: objectiveData.description || '',
          departmentId: objectiveData.departmentId || '',
          startDate: format(objectiveData.startDate.toDate(), 'yyyy-MM-dd'),
          endDate: format(objectiveData.endDate.toDate(), 'yyyy-MM-dd'),
        });

        // جلب الأقسام من المسار الموحد
        const departmentsQuery = query(
          collection(db, 'organizations', organizationId, 'departments')
        );

        const departmentsSnapshot = await getDocs(departmentsQuery);
        const departmentsList: Department[] = [];

        departmentsSnapshot.forEach((doc) => {
          departmentsList.push({
            id: doc.id,
            name: doc.data().name || 'قسم بدون اسم',
          });
        });

        setDepartments(departmentsList);

        // جلب المهام
        const tasksQuery = query(
          collection(db, 'tasks'),
          where('organizationId', '==', organizationId),
          where('status', '!=', 'completed')
        );

        const tasksSnapshot = await getDocs(tasksQuery);
        const tasksList: Task[] = [];

        tasksSnapshot.forEach((doc) => {
          const data = doc.data();
          tasksList.push({
            id: doc.id,
            description: data.description,
            status: data.status,
            dueDate: data.dueDate ? data.dueDate.toDate() : undefined,
          });
        });

        setTasks(tasksList);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ أثناء تحميل البيانات',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, organizationId, objectiveId, router, toast]);

  // تحديث الهدف
  const handleUpdateObjective = async () => {
    if (!user || !organizationId || !objective) return;

    if (!editObjective.title) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال عنوان الهدف',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const objectiveRef = doc(db, 'objectives', objective.id);

      await updateDoc(objectiveRef, {
        title: editObjective.title,
        description: editObjective.description || null,
        departmentId: editObjective.departmentId || null,
        startDate: Timestamp.fromDate(new Date(editObjective.startDate)),
        endDate: Timestamp.fromDate(new Date(editObjective.endDate)),
        updatedAt: serverTimestamp(),
      });

      // تحديث الهدف محليًا
      setObjective({
        ...objective,
        title: editObjective.title,
        description: editObjective.description,
        departmentId: editObjective.departmentId,
        startDate: new Date(editObjective.startDate),
        endDate: new Date(editObjective.endDate),
      });

      toast({
        title: 'تم تحديث الهدف',
        description: 'تم تحديث الهدف بنجاح',
      });

      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating objective:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تحديث الهدف',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // إضافة نتيجة رئيسية جديدة
  const handleAddKeyResult = async () => {
    if (!user || !organizationId || !objective) return;

    if (!newKeyResult.title) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال عنوان النتيجة الرئيسية',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const objectiveRef = doc(db, 'objectives', objective.id);

      // إنشاء النتيجة الرئيسية الجديدة
      const newKeyResultData: KeyResult = {
        id: uuidv4(),
        title: newKeyResult.title,
        description: newKeyResult.description,
        target: newKeyResult.target,
        current: newKeyResult.current,
        unit: newKeyResult.unit,
        progress: (newKeyResult.current / newKeyResult.target) * 100,
        status: 'pending',
        dueDate: new Date(newKeyResult.dueDate),
        tasks: [],
      };

      // تحديث الهدف بإضافة النتيجة الرئيسية الجديدة
      const updatedKeyResults = [...objective.keyResults, newKeyResultData];

      // حساب التقدم الإجمالي للهدف
      const totalProgress = updatedKeyResults.length > 0
        ? updatedKeyResults.reduce((sum, kr) => sum + kr.progress, 0) / updatedKeyResults.length
        : 0;

      // تحديد حالة الهدف بناءً على التقدم
      const objectiveStatus: 'pending' | 'in-progress' | 'completed' =
        totalProgress >= 100 ? 'completed' : totalProgress > 0 ? 'in-progress' : 'pending';

      await updateDoc(objectiveRef, {
        keyResults: updatedKeyResults.map(kr => ({
          ...kr,
          dueDate: kr.dueDate ? Timestamp.fromDate(kr.dueDate) : null,
        })),
        progress: totalProgress,
        status: objectiveStatus,
        updatedAt: serverTimestamp(),
      });

      // تحديث الهدف محليًا
      setObjective({
        ...objective,
        keyResults: updatedKeyResults,
        progress: totalProgress,
        status: totalProgress >= 100 ? 'completed' : totalProgress > 0 ? 'in-progress' : 'pending',
      });

      toast({
        title: 'تم إضافة النتيجة الرئيسية',
        description: 'تم إضافة النتيجة الرئيسية بنجاح',
      });

      // إعادة تعيين النموذج
      setNewKeyResult({
        title: '',
        description: '',
        target: 100,
        current: 0,
        unit: 'نسبة مئوية',
        dueDate: format(new Date(), 'yyyy-MM-dd'),
      });

      setIsAddKeyResultDialogOpen(false);
    } catch (error) {
      console.error('Error adding key result:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إضافة النتيجة الرئيسية',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // تحديث النتيجة الرئيسية
  const handleUpdateKeyResult = async () => {
    if (!user || !organizationId || !objective || !selectedKeyResult) return;

    if (!selectedKeyResult.title) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال عنوان النتيجة الرئيسية',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const objectiveRef = doc(db, 'objectives', objective.id);

      // تحديث النتيجة الرئيسية
      const updatedKeyResults = objective.keyResults.map(kr => {
        if (kr.id === selectedKeyResult.id) {
          // تحديد حالة النتيجة الرئيسية بناءً على التقدم
          const keyResultProgress = (selectedKeyResult.current / selectedKeyResult.target) * 100;
          const keyResultStatus: 'pending' | 'in-progress' | 'completed' =
            keyResultProgress >= 100 ? 'completed' : keyResultProgress > 0 ? 'in-progress' : 'pending';

          return {
            ...selectedKeyResult,
            progress: keyResultProgress,
            status: keyResultStatus,
          };
        }
        return kr;
      });

      // حساب التقدم الإجمالي للهدف
      const totalProgress = updatedKeyResults.length > 0
        ? updatedKeyResults.reduce((sum, kr) => sum + kr.progress, 0) / updatedKeyResults.length
        : 0;

      await updateDoc(objectiveRef, {
        keyResults: updatedKeyResults.map(kr => ({
          ...kr,
          dueDate: kr.dueDate ? Timestamp.fromDate(kr.dueDate) : null,
        })),
        progress: totalProgress,
        status: totalProgress >= 100 ? 'completed' : totalProgress > 0 ? 'in-progress' : 'pending',
        updatedAt: serverTimestamp(),
      });

      // تحديث الهدف محليًا
      setObjective({
        ...objective,
        keyResults: updatedKeyResults,
        progress: totalProgress,
        status: totalProgress >= 100 ? 'completed' : totalProgress > 0 ? 'in-progress' : 'pending',
      });

      toast({
        title: 'تم تحديث النتيجة الرئيسية',
        description: 'تم تحديث النتيجة الرئيسية بنجاح',
      });

      setIsEditKeyResultDialogOpen(false);
    } catch (error) {
      console.error('Error updating key result:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تحديث النتيجة الرئيسية',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // حذف النتيجة الرئيسية
  const handleDeleteKeyResult = async (keyResultId: string) => {
    if (!user || !organizationId || !objective) return;

    if (!confirm('هل أنت متأكد من حذف هذه النتيجة الرئيسية؟')) return;

    try {
      const objectiveRef = doc(db, 'objectives', objective.id);

      // حذف النتيجة الرئيسية
      const updatedKeyResults = objective.keyResults.filter(kr => kr.id !== keyResultId);

      // حساب التقدم الإجمالي للهدف
      const totalProgress = updatedKeyResults.length > 0
        ? updatedKeyResults.reduce((sum, kr) => sum + kr.progress, 0) / updatedKeyResults.length
        : 0;

      await updateDoc(objectiveRef, {
        keyResults: updatedKeyResults.map(kr => ({
          ...kr,
          dueDate: kr.dueDate ? Timestamp.fromDate(kr.dueDate) : null,
        })),
        progress: totalProgress,
        status: totalProgress >= 100 ? 'completed' : totalProgress > 0 ? 'in-progress' : 'pending',
        updatedAt: serverTimestamp(),
      });

      // تحديث الهدف محليًا
      setObjective({
        ...objective,
        keyResults: updatedKeyResults,
        progress: totalProgress,
        status: totalProgress >= 100 ? 'completed' : totalProgress > 0 ? 'in-progress' : 'pending',
      });

      toast({
        title: 'تم حذف النتيجة الرئيسية',
        description: 'تم حذف النتيجة الرئيسية بنجاح',
      });
    } catch (error) {
      console.error('Error deleting key result:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء حذف النتيجة الرئيسية',
        variant: 'destructive',
      });
    }
  };

  // ربط المهام بالنتيجة الرئيسية
  const handleLinkTasks = async (keyResultId: string, taskIds: string[]) => {
    if (!user || !organizationId || !objective) return;

    setIsSaving(true);

    try {
      const objectiveRef = doc(db, 'objectives', objective.id);

      // تحديث النتيجة الرئيسية بإضافة المهام المرتبطة
      const updatedKeyResults = objective.keyResults.map(kr => {
        if (kr.id === keyResultId) {
          return {
            ...kr,
            tasks: taskIds,
          };
        }
        return kr;
      });

      await updateDoc(objectiveRef, {
        keyResults: updatedKeyResults.map(kr => ({
          ...kr,
          dueDate: kr.dueDate ? Timestamp.fromDate(kr.dueDate) : null,
        })),
        updatedAt: serverTimestamp(),
      });

      // تحديث الهدف محليًا
      setObjective({
        ...objective,
        keyResults: updatedKeyResults,
      });

      // تحديث المهام لتشير إلى النتيجة الرئيسية
      for (const taskId of taskIds) {
        const taskRef = doc(db, 'tasks', taskId);
        await updateDoc(taskRef, {
          objectiveId: objective.id,
          keyResultId: keyResultId,
          updatedAt: serverTimestamp(),
        });
      }

      toast({
        title: 'تم ربط المهام',
        description: 'تم ربط المهام بالنتيجة الرئيسية بنجاح',
      });

      setIsLinkTasksDialogOpen(false);
    } catch (error) {
      console.error('Error linking tasks:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء ربط المهام',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // تحديث تقدم النتيجة الرئيسية
  const handleUpdateKeyResultProgress = async (keyResultId: string, newCurrent: number) => {
    if (!user || !organizationId || !objective) return;

    try {
      const objectiveRef = doc(db, 'objectives', objective.id);

      // تحديث النتيجة الرئيسية
      const updatedKeyResults = objective.keyResults.map(kr => {
        if (kr.id === keyResultId) {
          const newProgress = (newCurrent / kr.target) * 100;
          const newStatus: 'pending' | 'in-progress' | 'completed' =
            newProgress >= 100 ? 'completed' : newProgress > 0 ? 'in-progress' : 'pending';

          return {
            ...kr,
            current: newCurrent,
            progress: newProgress,
            status: newStatus,
          };
        }
        return kr;
      });

      // حساب التقدم الإجمالي للهدف
      const totalProgress = updatedKeyResults.length > 0
        ? updatedKeyResults.reduce((sum, kr) => sum + kr.progress, 0) / updatedKeyResults.length
        : 0;

      await updateDoc(objectiveRef, {
        keyResults: updatedKeyResults.map(kr => ({
          ...kr,
          dueDate: kr.dueDate ? Timestamp.fromDate(kr.dueDate) : null,
        })),
        progress: totalProgress,
        status: totalProgress >= 100 ? 'completed' : totalProgress > 0 ? 'in-progress' : 'pending',
        updatedAt: serverTimestamp(),
      });

      // تحديد حالة الهدف بناءً على التقدم
      const objectiveStatus: 'pending' | 'in-progress' | 'completed' =
        totalProgress >= 100 ? 'completed' : totalProgress > 0 ? 'in-progress' : 'pending';

      // تحديث الهدف محليًا
      setObjective({
        ...objective,
        keyResults: updatedKeyResults,
        progress: totalProgress,
        status: objectiveStatus,
      });

      toast({
        title: 'تم تحديث التقدم',
        description: 'تم تحديث تقدم النتيجة الرئيسية بنجاح',
      });
    } catch (error) {
      console.error('Error updating key result progress:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تحديث التقدم',
        variant: 'destructive',
      });
    }
  };

  // الحصول على اسم القسم
  const getDepartmentName = (departmentId?: string) => {
    if (!departmentId) return 'المؤسسة';
    const department = departments.find(dept => dept.id === departmentId);
    return department ? department.name : 'قسم غير معروف';
  };

  // الحصول على لون حالة الهدف
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // الحصول على نص حالة الهدف
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'قيد الانتظار';
      case 'in-progress': return 'قيد التنفيذ';
      case 'completed': return 'مكتمل';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-40 w-full mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!objective) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-40">
          <p className="text-muted-foreground">الهدف غير موجود أو ليس لديك صلاحية الوصول إليه.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* رأس الصفحة */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center">
            <Target className="ml-2 h-6 w-6 text-primary" />
            {objective.title}
          </h1>
          <p className="text-muted-foreground mt-1">
            {getDepartmentName(objective.departmentId)} |
            {format(objective.startDate, ' d MMM yyyy', { locale: ar })} -
            {format(objective.endDate, ' d MMM yyyy', { locale: ar })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/org/okr">
              <ArrowLeft className="ml-2 h-4 w-4" />
              العودة إلى الأهداف
            </Link>
          </Button>
          {canManageOkrs && (
            <Button onClick={() => setIsEditDialogOpen(true)}>
              <Edit className="ml-2 h-4 w-4" />
              تعديل الهدف
            </Button>
          )}
        </div>
      </div>

      {/* معلومات الهدف */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle>تفاصيل الهدف</CardTitle>
            <Badge variant="outline" className={getStatusColor(objective.status)}>
              {getStatusText(objective.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {objective.description && (
            <p className="mb-4 text-muted-foreground">{objective.description}</p>
          )}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">التقدم الإجمالي: {Math.round(objective.progress)}%</span>
            <Progress value={objective.progress} className="w-full" />
          </div>
        </CardContent>
      </Card>

      {/* النتائج الرئيسية */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">النتائج الرئيسية</h2>
          {canManageOkrs && (
            <Button onClick={() => setIsAddKeyResultDialogOpen(true)}>
              <Plus className="ml-2 h-4 w-4" />
              إضافة نتيجة رئيسية
            </Button>
          )}
        </div>

        {objective.keyResults.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">لا توجد نتائج رئيسية بعد.</p>
              {canManageOkrs && (
                <Button
                  onClick={() => setIsAddKeyResultDialogOpen(true)}
                  className="mt-4"
                >
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة نتيجة رئيسية
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {objective.keyResults.map((keyResult) => (
              <Collapsible key={keyResult.id} className="border rounded-lg">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50">
                  <div className="flex items-center">
                    <div>
                      <h3 className="text-lg font-medium">{keyResult.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {keyResult.current} / {keyResult.target} {keyResult.unit}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getStatusColor(keyResult.status)}>
                      {getStatusText(keyResult.status)}
                    </Badge>
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-sm font-medium">{Math.round(keyResult.progress)}%</span>
                      <Progress value={keyResult.progress} className="w-24" />
                    </div>
                    <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform ui-expanded:rotate-180" />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-4 pt-0 border-t">
                    {keyResult.description && (
                      <div className="mb-4">
                        <p className="text-sm text-muted-foreground">{keyResult.description}</p>
                      </div>
                    )}

                    {keyResult.dueDate && (
                      <div className="flex items-center text-xs text-muted-foreground mb-4">
                        <Calendar className="ml-1 h-3 w-3" />
                        تاريخ الاستحقاق: {format(keyResult.dueDate, 'd MMM yyyy', { locale: ar })}
                      </div>
                    )}

                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2">تحديث التقدم:</h4>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={keyResult.current}
                          onChange={(e) => {
                            const newValue = parseInt(e.target.value);
                            if (!isNaN(newValue) && newValue >= 0) {
                              handleUpdateKeyResultProgress(keyResult.id, newValue);
                            }
                          }}
                          className="w-24"
                          min={0}
                          max={keyResult.target}
                        />
                        <span>من {keyResult.target} {keyResult.unit}</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2">المهام المرتبطة:</h4>
                      {keyResult.tasks && keyResult.tasks.length > 0 ? (
                        <ul className="space-y-1">
                          {keyResult.tasks.map((taskId) => {
                            const task = tasks.find(t => t.id === taskId);
                            return task ? (
                              <li key={taskId} className="text-sm flex items-center">
                                {task.status === 'completed' ? (
                                  <CheckCircle2 className="ml-2 h-4 w-4 text-green-500" />
                                ) : (
                                  <Circle className="ml-2 h-4 w-4 text-muted-foreground" />
                                )}
                                {task.description}
                              </li>
                            ) : null;
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">لا توجد مهام مرتبطة بعد.</p>
                      )}
                    </div>

                    {canManageOkrs && (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedKeyResult(keyResult);
                            setIsLinkTasksDialogOpen(true);
                          }}
                        >
                          <LinkIcon className="ml-2 h-4 w-4" />
                          ربط المهام
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedKeyResult(keyResult);
                            setIsEditKeyResultDialogOpen(true);
                          }}
                        >
                          <Edit className="ml-2 h-4 w-4" />
                          تعديل
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteKeyResult(keyResult.id)}
                        >
                          <Trash2 className="ml-2 h-4 w-4" />
                          حذف
                        </Button>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </div>

      {/* حوار تعديل الهدف */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>تعديل الهدف</DialogTitle>
            <DialogDescription>
              قم بتعديل تفاصيل الهدف أدناه.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">عنوان الهدف</Label>
              <Input
                id="title"
                value={editObjective.title}
                onChange={(e) => setEditObjective({ ...editObjective, title: e.target.value })}
                placeholder="أدخل عنوان الهدف"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">وصف الهدف (اختياري)</Label>
              <Textarea
                id="description"
                value={editObjective.description}
                onChange={(e) => setEditObjective({ ...editObjective, description: e.target.value })}
                placeholder="أدخل وصف الهدف"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">القسم (اختياري)</Label>
              <Select
                value={editObjective.departmentId}
                onValueChange={(value) => setEditObjective({ ...editObjective, departmentId: value })}
              >
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">تاريخ البدء</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={editObjective.startDate}
                  onChange={(e) => setEditObjective({ ...editObjective, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">تاريخ الانتهاء</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={editObjective.endDate}
                  onChange={(e) => setEditObjective({ ...editObjective, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={handleUpdateObjective}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="ml-2 h-4 w-4" />}
              حفظ التغييرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار إضافة نتيجة رئيسية */}
      <Dialog open={isAddKeyResultDialogOpen} onOpenChange={setIsAddKeyResultDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>إضافة نتيجة رئيسية</DialogTitle>
            <DialogDescription>
              أدخل تفاصيل النتيجة الرئيسية الجديدة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="kr-title">عنوان النتيجة الرئيسية</Label>
              <Input
                id="kr-title"
                value={newKeyResult.title}
                onChange={(e) => setNewKeyResult({ ...newKeyResult, title: e.target.value })}
                placeholder="أدخل عنوان النتيجة الرئيسية"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kr-description">وصف النتيجة الرئيسية (اختياري)</Label>
              <Textarea
                id="kr-description"
                value={newKeyResult.description}
                onChange={(e) => setNewKeyResult({ ...newKeyResult, description: e.target.value })}
                placeholder="أدخل وصف النتيجة الرئيسية"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kr-target">القيمة المستهدفة</Label>
                <Input
                  id="kr-target"
                  type="number"
                  value={newKeyResult.target}
                  onChange={(e) => setNewKeyResult({ ...newKeyResult, target: parseInt(e.target.value) || 0 })}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kr-unit">وحدة القياس</Label>
                <Input
                  id="kr-unit"
                  value={newKeyResult.unit}
                  onChange={(e) => setNewKeyResult({ ...newKeyResult, unit: e.target.value })}
                  placeholder="مثال: نسبة مئوية، عدد، ..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kr-dueDate">تاريخ الاستحقاق</Label>
              <Input
                id="kr-dueDate"
                type="date"
                value={newKeyResult.dueDate}
                onChange={(e) => setNewKeyResult({ ...newKeyResult, dueDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAddKeyResultDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={handleAddKeyResult}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Plus className="ml-2 h-4 w-4" />}
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار تعديل النتيجة الرئيسية */}
      <Dialog open={isEditKeyResultDialogOpen} onOpenChange={setIsEditKeyResultDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>تعديل النتيجة الرئيسية</DialogTitle>
            <DialogDescription>
              قم بتعديل تفاصيل النتيجة الرئيسية أدناه.
            </DialogDescription>
          </DialogHeader>
          {selectedKeyResult && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-kr-title">عنوان النتيجة الرئيسية</Label>
                <Input
                  id="edit-kr-title"
                  value={selectedKeyResult.title}
                  onChange={(e) => setSelectedKeyResult({ ...selectedKeyResult, title: e.target.value })}
                  placeholder="أدخل عنوان النتيجة الرئيسية"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-kr-description">وصف النتيجة الرئيسية (اختياري)</Label>
                <Textarea
                  id="edit-kr-description"
                  value={selectedKeyResult.description || ''}
                  onChange={(e) => setSelectedKeyResult({ ...selectedKeyResult, description: e.target.value })}
                  placeholder="أدخل وصف النتيجة الرئيسية"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-kr-target">القيمة المستهدفة</Label>
                  <Input
                    id="edit-kr-target"
                    type="number"
                    value={selectedKeyResult.target}
                    onChange={(e) => setSelectedKeyResult({ ...selectedKeyResult, target: parseInt(e.target.value) || 0 })}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-kr-current">القيمة الحالية</Label>
                  <Input
                    id="edit-kr-current"
                    type="number"
                    value={selectedKeyResult.current}
                    onChange={(e) => setSelectedKeyResult({ ...selectedKeyResult, current: parseInt(e.target.value) || 0 })}
                    min={0}
                    max={selectedKeyResult.target}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-kr-unit">وحدة القياس</Label>
                <Input
                  id="edit-kr-unit"
                  value={selectedKeyResult.unit}
                  onChange={(e) => setSelectedKeyResult({ ...selectedKeyResult, unit: e.target.value })}
                  placeholder="مثال: نسبة مئوية، عدد، ..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-kr-dueDate">تاريخ الاستحقاق</Label>
                <Input
                  id="edit-kr-dueDate"
                  type="date"
                  value={selectedKeyResult.dueDate ? format(selectedKeyResult.dueDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) => setSelectedKeyResult({
                    ...selectedKeyResult,
                    dueDate: e.target.value ? new Date(e.target.value) : undefined
                  })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsEditKeyResultDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={handleUpdateKeyResult}
              disabled={isSaving || !selectedKeyResult}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="ml-2 h-4 w-4" />}
              حفظ التغييرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار ربط المهام */}
      <Dialog open={isLinkTasksDialogOpen} onOpenChange={setIsLinkTasksDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>ربط المهام بالنتيجة الرئيسية</DialogTitle>
            <DialogDescription>
              اختر المهام التي تريد ربطها بالنتيجة الرئيسية.
            </DialogDescription>
          </DialogHeader>
          {selectedKeyResult && (
            <div className="space-y-4 py-4">
              <div className="mb-4">
                <h3 className="text-base font-medium mb-2">النتيجة الرئيسية:</h3>
                <p>{selectedKeyResult.title}</p>
              </div>

              <div className="mb-4">
                <h3 className="text-base font-medium mb-2">المهام المتاحة:</h3>
                {tasks.length === 0 ? (
                  <p className="text-muted-foreground">لا توجد مهام متاحة.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
                    {tasks.map((task) => (
                      <div key={task.id} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`task-${task.id}`}
                          checked={selectedKeyResult.tasks.includes(task.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedKeyResult({
                                ...selectedKeyResult,
                                tasks: [...selectedKeyResult.tasks, task.id],
                              });
                            } else {
                              setSelectedKeyResult({
                                ...selectedKeyResult,
                                tasks: selectedKeyResult.tasks.filter(id => id !== task.id),
                              });
                            }
                          }}
                          className="ml-2"
                        />
                        <label htmlFor={`task-${task.id}`} className="text-sm">
                          {task.description}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsLinkTasksDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={() => selectedKeyResult && handleLinkTasks(selectedKeyResult.id, selectedKeyResult.tasks)}
              disabled={isSaving || !selectedKeyResult}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <LinkIcon className="ml-2 h-4 w-4" />}
              ربط المهام
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}