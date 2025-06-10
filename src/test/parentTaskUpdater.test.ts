// اختبار دوال تحديث المهام الرئيسية
import { calculateTaskStatusFromMilestones } from '@/services/parentTaskUpdater';
import { TaskStatus } from '@/types/task';

describe('calculateTaskStatusFromMilestones', () => {
  test('should return completed when all milestones are completed', () => {
    const milestones = [
      { id: '1', description: 'Milestone 1', completed: true, weight: 50 },
      { id: '2', description: 'Milestone 2', completed: true, weight: 50 }
    ];
    
    const result = calculateTaskStatusFromMilestones(milestones, 'hold');
    expect(result).toBe('completed');
  });

  test('should return in-progress when some milestones are completed and task is on hold', () => {
    const milestones = [
      { id: '1', description: 'Milestone 1', completed: true, weight: 50 },
      { id: '2', description: 'Milestone 2', completed: false, weight: 50 }
    ];
    
    const result = calculateTaskStatusFromMilestones(milestones, 'hold');
    expect(result).toBe('in-progress');
  });

  test('should maintain current status when no milestones are completed', () => {
    const milestones = [
      { id: '1', description: 'Milestone 1', completed: false, weight: 50 },
      { id: '2', description: 'Milestone 2', completed: false, weight: 50 }
    ];
    
    const result = calculateTaskStatusFromMilestones(milestones, 'hold');
    expect(result).toBe('hold');
  });

  test('should not change completed status', () => {
    const milestones = [
      { id: '1', description: 'Milestone 1', completed: false, weight: 50 },
      { id: '2', description: 'Milestone 2', completed: false, weight: 50 }
    ];
    
    const result = calculateTaskStatusFromMilestones(milestones, 'completed');
    expect(result).toBe('completed');
  });

  test('should not change cancelled status', () => {
    const milestones = [
      { id: '1', description: 'Milestone 1', completed: true, weight: 50 },
      { id: '2', description: 'Milestone 2', completed: true, weight: 50 }
    ];
    
    const result = calculateTaskStatusFromMilestones(milestones, 'cancelled');
    expect(result).toBe('cancelled');
  });

  test('should maintain in-progress status when some milestones are completed', () => {
    const milestones = [
      { id: '1', description: 'Milestone 1', completed: true, weight: 50 },
      { id: '2', description: 'Milestone 2', completed: false, weight: 50 }
    ];
    
    const result = calculateTaskStatusFromMilestones(milestones, 'in-progress');
    expect(result).toBe('in-progress');
  });

  test('should return current status when no milestones exist', () => {
    const milestones: any[] = [];
    
    const result = calculateTaskStatusFromMilestones(milestones, 'hold');
    expect(result).toBe('hold');
  });
});
