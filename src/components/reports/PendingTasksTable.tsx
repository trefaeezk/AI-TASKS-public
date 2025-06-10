/**
 * مكون جدول المهام المعلقة للموافقة
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Clock, 
  AlertTriangle, 
  Building, 
  User, 
  Calendar,
  Search,
  Filter,
  ExternalLink
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { PendingTaskDetails } from '@/services/approvalReports';

interface PendingTasksTableProps {
  tasks: PendingTaskDetails[];
  loading: boolean;
  title?: string;
  onTaskClick?: (taskId: string) => void;
}

export function PendingTasksTable({ 
  tasks, 
  loading, 
  title = "المهام المعلقة للموافقة",
  onTaskClick 
}: PendingTasksTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [approvalLevelFilter, setApprovalLevelFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'waitingTime' | 'submittedAt' | 'priority'>('waitingTime');

  // تصفية وترتيب المهام
  const filteredAndSortedTasks = React.useMemo(() => {
    let filtered = tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           task.submittedByName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      const matchesApprovalLevel = approvalLevelFilter === 'all' || task.approvalLevel === approvalLevelFilter;
      
      return matchesSearch && matchesPriority && matchesApprovalLevel;
    });

    // ترتيب المهام
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'waitingTime':
          return b.waitingTime - a.waitingTime;
        case 'submittedAt':
          return b.submittedAt.getTime() - a.submittedAt.getTime();
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
                 (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [tasks, searchTerm, priorityFilter, approvalLevelFilter, sortBy]);

  // دالة لتحديد لون الأولوية
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  // دالة لتحديد لون وقت الانتظار
  const getWaitingTimeColor = (hours: number) => {
    if (hours > 72) return 'text-red-600'; // أكثر من 3 أيام
    if (hours > 24) return 'text-orange-600'; // أكثر من يوم
    return 'text-muted-foreground';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Clock className="ml-2 h-5 w-5 text-orange-500" />
            {title}
          </div>
          <Badge variant="outline">
            {filteredAndSortedTasks.length} من {tasks.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* أدوات التصفية والبحث */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="البحث في المهام أو أسماء المُرسلين..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </div>
          
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder="الأولوية" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الأولويات</SelectItem>
              <SelectItem value="high">عالية</SelectItem>
              <SelectItem value="medium">متوسطة</SelectItem>
              <SelectItem value="low">منخفضة</SelectItem>
            </SelectContent>
          </Select>

          <Select value={approvalLevelFilter} onValueChange={setApprovalLevelFilter}>
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder="مستوى الموافقة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المستويات</SelectItem>
              <SelectItem value="department">القسم</SelectItem>
              <SelectItem value="organization">المؤسسة</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder="ترتيب حسب" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="waitingTime">وقت الانتظار</SelectItem>
              <SelectItem value="submittedAt">تاريخ الإرسال</SelectItem>
              <SelectItem value="priority">الأولوية</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* الجدول */}
        {filteredAndSortedTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>لا توجد مهام معلقة للموافقة</p>
            {searchTerm && (
              <p className="text-sm mt-2">جرب تغيير معايير البحث</p>
            )}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المهمة</TableHead>
                  <TableHead>المُرسل</TableHead>
                  <TableHead>المستوى</TableHead>
                  <TableHead>الأولوية</TableHead>
                  <TableHead>وقت الانتظار</TableHead>
                  <TableHead>تاريخ الإرسال</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedTasks.map((task) => (
                  <TableRow key={task.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium truncate max-w-[200px]" title={task.title}>
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={task.description}>
                            {task.description}
                          </div>
                        )}
                        {task.dueDate && (
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3 ml-1" />
                            {format(task.dueDate, 'dd/MM/yyyy')}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center">
                        <User className="h-4 w-4 ml-2 text-muted-foreground" />
                        <span className="text-sm">{task.submittedByName}</span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center">
                        <Building className="h-4 w-4 ml-2 text-muted-foreground" />
                        <div className="space-y-1">
                          <Badge variant={task.approvalLevel === 'organization' ? 'default' : 'secondary'}>
                            {task.approvalLevel === 'organization' ? 'المؤسسة' : 'القسم'}
                          </Badge>
                          {task.departmentName && (
                            <div className="text-xs text-muted-foreground">
                              {task.departmentName}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={getPriorityColor(task.priority)}>
                        {task.priority === 'high' ? 'عالية' : 
                         task.priority === 'medium' ? 'متوسطة' : 'منخفضة'}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <div className={`text-sm font-medium ${getWaitingTimeColor(task.waitingTime)}`}>
                        {task.waitingTime < 24 
                          ? `${Math.round(task.waitingTime)} ساعة`
                          : `${Math.round(task.waitingTime / 24)} يوم`
                        }
                      </div>
                      {task.waitingTime > 72 && (
                        <div className="flex items-center text-xs text-red-600 mt-1">
                          <AlertTriangle className="h-3 w-3 ml-1" />
                          متأخرة
                        </div>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        {format(task.submittedAt, 'dd/MM/yyyy')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(task.submittedAt, { locale: ar, addSuffix: true })}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {onTaskClick && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onTaskClick(task.id)}
                          className="h-8 w-8 p-0"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
