'use client';

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Target, Plus, Edit, Trash2, ChevronDown, Calendar, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { db } from '@/config/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, query, where, getDocs, orderBy, Timestamp, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import Link from 'next/link';

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

export default function OkrPage() {
  const { user, userClaims } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);


  // بيانات الهدف الجديد
  const [newObjective, setNewObjective] = useState({
    title: '',
    description: '',
    departmentId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(new Date().setMonth(new Date().getMonth() + 3)), 'yyyy-MM-dd'),
  });

  const organizationId = userClaims?.organizationId;
  const isOwner = userClaims?.owner === true;
  const isAdmin = userClaims?.admin === true;
  const isEngineer = userClaims?.engineer === true;
  const isSupervisor = userClaims?.supervisor === true;
  const canManageOkrs = isOwner || isAdmin || isEngineer || isSupervisor;

  // تحميل الأهداف والأقسام
  useEffect(() => {
    if (!user || !organizationId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // جلب الأقسام
        const departmentsQuery = query(
          collection(db, 'departments'),
          where('organizationId', '==', organizationId)
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

        // جلب الأهداف
        const objectivesQuery = query(
          collection(db, 'objectives'),
          where('organizationId', '==', organizationId),
          orderBy('createdAt', 'desc')
        );

        const objectivesSnapshot = await getDocs(objectivesQuery);
        const objectivesList: Objective[] = [];

        objectivesSnapshot.forEach((doc) => {
          const data = doc.data();

          const keyResults: KeyResult[] = data.keyResults || [];

          // حساب التقدم الإجمالي للهدف
          const totalProgress = keyResults.length > 0
            ? keyResults.reduce((sum, kr) => sum + kr.progress, 0) / keyResults.length
            : 0;

          objectivesList.push({
            id: doc.id,
            title: data.title,
            description: data.description,
            departmentId: data.departmentId,
            startDate: data.startDate.toDate(),
            endDate: data.endDate.toDate(),
            progress: totalProgress,
            status: data.status || 'pending',
            keyResults: keyResults.map((kr: any) => ({
              ...kr,
              dueDate: kr.dueDate ? kr.dueDate.toDate() : undefined,
            })),
          });
        });

        setObjectives(objectivesList);
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
  }, [user, organizationId, toast]);

  // إنشاء هدف جديد
  const handleCreateObjective = async () => {
    if (!user || !organizationId) return;

    if (!newObjective.title) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال عنوان الهدف',
        variant: 'destructive',
      });
      return;
    }

    try {
      const objectiveData = {
        title: newObjective.title,
        description: newObjective.description,
        departmentId: newObjective.departmentId || null,
        organizationId,
        startDate: Timestamp.fromDate(new Date(newObjective.startDate)),
        endDate: Timestamp.fromDate(new Date(newObjective.endDate)),
        status: 'pending',
        keyResults: [],
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'objectives'), objectiveData);

      toast({
        title: 'تم إنشاء الهدف',
        description: 'تم إنشاء الهدف بنجاح',
      });

      // إعادة تعيين النموذج
      setNewObjective({
        title: '',
        description: '',
        departmentId: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(new Date().setMonth(new Date().getMonth() + 3)), 'yyyy-MM-dd'),
      });

      setIsCreateDialogOpen(false);

      // إضافة الهدف الجديد إلى القائمة
      const newObjectiveItem: Objective = {
        id: docRef.id,
        title: newObjective.title,
        description: newObjective.description,
        departmentId: newObjective.departmentId || undefined,
        startDate: new Date(newObjective.startDate),
        endDate: new Date(newObjective.endDate),
        progress: 0,
        status: 'pending',
        keyResults: [],
      };

      setObjectives([newObjectiveItem, ...objectives]);
    } catch (error) {
      console.error('Error creating objective:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إنشاء الهدف',
        variant: 'destructive',
      });
    }
  };

  // حذف هدف
  const handleDeleteObjective = async (objectiveId: string) => {
    if (!user || !organizationId) return;

    if (!confirm('هل أنت متأكد من حذف هذا الهدف؟')) return;

    try {
      await deleteDoc(doc(db, 'objectives', objectiveId));

      toast({
        title: 'تم حذف الهدف',
        description: 'تم حذف الهدف بنجاح',
      });

      // إزالة الهدف من القائمة
      setObjectives(objectives.filter(obj => obj.id !== objectiveId));
    } catch (error) {
      console.error('Error deleting objective:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء حذف الهدف',
        variant: 'destructive',
      });
    }
  };

  // تحديث تقدم النتيجة الرئيسية
  const handleUpdateKeyResultProgress = async (objectiveId: string, keyResultId: string, newProgress: number) => {
    if (!user || !organizationId) return;

    try {
      // تحديث الهدف محليًا أولاً
      const updatedObjectives = objectives.map(obj => {
        if (obj.id === objectiveId) {
          const updatedKeyResults = obj.keyResults.map(kr => {
            if (kr.id === keyResultId) {
              // تحديد حالة النتيجة الرئيسية بناءً على التقدم
              const keyResultStatus: 'pending' | 'in-progress' | 'completed' =
                newProgress >= 100 ? 'completed' : newProgress > 0 ? 'in-progress' : 'pending';

              return {
                ...kr,
                progress: newProgress,
                status: keyResultStatus
              };
            }
            return kr;
          });

          // حساب التقدم الإجمالي للهدف
          const totalProgress = updatedKeyResults.length > 0
            ? updatedKeyResults.reduce((sum, kr) => sum + kr.progress, 0) / updatedKeyResults.length
            : 0;

          // تحديد حالة الهدف بناءً على التقدم
          const objectiveStatus: 'pending' | 'in-progress' | 'completed' =
            totalProgress >= 100 ? 'completed' : totalProgress > 0 ? 'in-progress' : 'pending';

          return {
            ...obj,
            keyResults: updatedKeyResults,
            progress: totalProgress,
            status: objectiveStatus
          };
        }
        return obj;
      });

      setObjectives(updatedObjectives);

      // تحديث الهدف في قاعدة البيانات
      const objectiveRef = doc(db, 'objectives', objectiveId);
      const objective = updatedObjectives.find(obj => obj.id === objectiveId);

      if (objective) {
        await updateDoc(objectiveRef, {
          keyResults: objective.keyResults.map(kr => ({
            ...kr,
            dueDate: kr.dueDate ? Timestamp.fromDate(kr.dueDate) : null,
          })),
          progress: objective.progress,
          status: objective.status,
          updatedAt: serverTimestamp(),
        });
      }

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

  // تصفية الأهداف حسب التبويب النشط
  const filteredObjectives = objectives.filter(objective => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return objective.status === 'pending';
    if (activeTab === 'in-progress') return objective.status === 'in-progress';
    if (activeTab === 'completed') return objective.status === 'completed';
    if (activeTab.startsWith('dept-')) {
      const deptId = activeTab.replace('dept-', '');
      return objective.departmentId === deptId;
    }
    return true;
  });

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
        <Skeleton className="h-12 w-full mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <Target className="ml-2 h-6 w-6" />
          الأهداف والنتائج الرئيسية (OKRs)
        </h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/org/okr/reports">
              <BarChart3 className="ml-2 h-4 w-4" />
              التقارير
            </Link>
          </Button>
          {canManageOkrs && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center">
                  <Plus className="ml-2 h-4 w-4" />
                  إنشاء هدف جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>إنشاء هدف جديد</DialogTitle>
                  <DialogDescription>
                    أدخل تفاصيل الهدف الجديد. يمكنك إضافة النتائج الرئيسية بعد إنشاء الهدف.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">عنوان الهدف</Label>
                    <Input
                      id="title"
                      value={newObjective.title}
                      onChange={(e) => setNewObjective({ ...newObjective, title: e.target.value })}
                      placeholder="أدخل عنوان الهدف"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">وصف الهدف (اختياري)</Label>
                    <Textarea
                      id="description"
                      value={newObjective.description}
                      onChange={(e) => setNewObjective({ ...newObjective, description: e.target.value })}
                      placeholder="أدخل وصف الهدف"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">القسم (اختياري)</Label>
                    <Select
                      value={newObjective.departmentId}
                      onValueChange={(value) => setNewObjective({ ...newObjective, departmentId: value })}
                    >
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">تاريخ البدء</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={newObjective.startDate}
                        onChange={(e) => setNewObjective({ ...newObjective, startDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">تاريخ الانتهاء</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={newObjective.endDate}
                        onChange={(e) => setNewObjective({ ...newObjective, endDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button type="button" onClick={handleCreateObjective}>
                    إنشاء الهدف
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="mb-4">
          <TabsTrigger value="all">الكل</TabsTrigger>
          <TabsTrigger value="in-progress">قيد التنفيذ</TabsTrigger>
          <TabsTrigger value="pending">قيد الانتظار</TabsTrigger>
          <TabsTrigger value="completed">مكتملة</TabsTrigger>
          {departments.length > 0 && departments.map((dept) => (
            <TabsTrigger key={dept.id} value={`dept-${dept.id}`}>{dept.name}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab}>
          {filteredObjectives.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">لا توجد أهداف {activeTab !== 'all' ? 'في هذه الفئة' : ''}</p>
                {canManageOkrs && (
                  <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="mt-4"
                  >
                    <Plus className="ml-2 h-4 w-4" />
                    إنشاء هدف جديد
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {filteredObjectives.map((objective) => (
                <Collapsible key={objective.id} className="border rounded-lg">
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50">
                    <div className="flex items-center">
                      <Target className="ml-2 h-5 w-5 text-primary" />
                      <div>
                        <h3 className="text-lg font-medium">{objective.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {getDepartmentName(objective.departmentId)} |
                          {format(objective.startDate, ' d MMM yyyy', { locale: ar })} -
                          {format(objective.endDate, ' d MMM yyyy', { locale: ar })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getStatusColor(objective.status)}>
                        {getStatusText(objective.status)}
                      </Badge>
                      <div className="flex items-center gap-2 ml-4">
                        <span className="text-sm font-medium">{Math.round(objective.progress)}%</span>
                        <Progress value={objective.progress} className="w-24" />
                      </div>
                      <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform ui-expanded:rotate-180" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 pt-0 border-t">
                      {objective.description && (
                        <div className="mb-4">
                          <p className="text-sm text-muted-foreground">{objective.description}</p>
                        </div>
                      )}

                      <h4 className="text-base font-medium mb-2">النتائج الرئيسية:</h4>

                      {objective.keyResults.length === 0 ? (
                        <p className="text-sm text-muted-foreground mb-4">لا توجد نتائج رئيسية بعد.</p>
                      ) : (
                        <div className="space-y-3 mb-4">
                          {objective.keyResults.map((keyResult) => (
                            <div key={keyResult.id} className="border rounded p-3">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-medium">{keyResult.title}</h5>
                                <Badge variant="outline" className={getStatusColor(keyResult.status)}>
                                  {getStatusText(keyResult.status)}
                                </Badge>
                              </div>
                              {keyResult.description && (
                                <p className="text-sm text-muted-foreground mb-2">{keyResult.description}</p>
                              )}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">التقدم: {keyResult.progress}%</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({keyResult.current} / {keyResult.target} {keyResult.unit})
                                  </span>
                                </div>
                                {keyResult.dueDate && (
                                  <div className="flex items-center text-xs text-muted-foreground">
                                    <Calendar className="ml-1 h-3 w-3" />
                                    {format(keyResult.dueDate, 'd MMM yyyy', { locale: ar })}
                                  </div>
                                )}
                              </div>
                              <Progress value={keyResult.progress} className="h-2" />

                              {canManageOkrs && (
                                <div className="flex justify-end mt-2">
                                  <Select
                                    value={keyResult.progress.toString()}
                                    onValueChange={(value) => handleUpdateKeyResultProgress(objective.id, keyResult.id, parseInt(value))}
                                  >
                                    <SelectTrigger className="w-[120px] h-8 text-xs">
                                      <SelectValue placeholder="تحديث التقدم" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="0">0%</SelectItem>
                                      <SelectItem value="10">10%</SelectItem>
                                      <SelectItem value="20">20%</SelectItem>
                                      <SelectItem value="30">30%</SelectItem>
                                      <SelectItem value="40">40%</SelectItem>
                                      <SelectItem value="50">50%</SelectItem>
                                      <SelectItem value="60">60%</SelectItem>
                                      <SelectItem value="70">70%</SelectItem>
                                      <SelectItem value="80">80%</SelectItem>
                                      <SelectItem value="90">90%</SelectItem>
                                      <SelectItem value="100">100%</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {canManageOkrs && (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/org/okr/objective/${objective.id}`}>
                              <Edit className="ml-2 h-4 w-4" />
                              تعديل
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteObjective(objective.id)}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
