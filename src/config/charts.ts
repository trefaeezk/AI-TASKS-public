/**
 * إعدادات الرسوم البيانية المشتركة
 */

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  RadialLinearScale,
} from 'chart.js';

// تسجيل جميع مكونات Chart.js المطلوبة
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  RadialLinearScale
);

// الألوان المستخدمة في التطبيق
export const chartColors = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  secondary: '#6b7280',
  light: '#f3f4f6',
  dark: '#1f2937'
};

// إعدادات افتراضية للرسوم البيانية
export const defaultChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        font: {
          family: 'system-ui, -apple-system, sans-serif',
          size: 12,
        },
        padding: 15,
        usePointStyle: true,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: '#374151',
      borderWidth: 1,
      cornerRadius: 8,
      displayColors: true,
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        font: {
          size: 11,
        },
      },
    },
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(0, 0, 0, 0.1)',
      },
      ticks: {
        font: {
          size: 11,
        },
      },
    },
  },
};

// إعدادات خاصة للرسوم البيانية الدائرية
export const pieChartOptions = {
  ...defaultChartOptions,
  plugins: {
    ...defaultChartOptions.plugins,
    legend: {
      ...defaultChartOptions.plugins.legend,
      position: 'right' as const,
    },
  },
  scales: undefined, // الرسوم الدائرية لا تحتاج محاور
};

// إعدادات خاصة للرسوم البيانية الرادار
export const radarChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        font: {
          family: 'system-ui, -apple-system, sans-serif',
          size: 12,
        },
      },
    },
  },
  scales: {
    r: {
      beginAtZero: true,
      max: 100,
      grid: {
        color: 'rgba(0, 0, 0, 0.1)',
      },
      pointLabels: {
        font: {
          size: 11,
        },
      },
      ticks: {
        display: false,
      },
    },
  },
};

// دالة لإنشاء مجموعة ألوان متدرجة
export function generateColorPalette(count: number): string[] {
  const colors = [
    chartColors.success,
    chartColors.primary,
    chartColors.warning,
    chartColors.danger,
    chartColors.info,
    chartColors.secondary,
  ];
  
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(colors[i % colors.length]);
  }
  
  return result;
}

// دالة لإنشاء ألوان شفافة
export function generateTransparentColors(colors: string[], opacity: number = 0.2): string[] {
  return colors.map(color => {
    // تحويل hex إلى rgba
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  });
}

// إعدادات التصدير
export const exportOptions = {
  pdf: {
    format: 'a4' as const,
    orientation: 'portrait' as const,
    unit: 'mm' as const,
  },
  image: {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
  },
};

// دالة للتحقق من دعم الرسوم البيانية
export function checkChartSupport(): boolean {
  try {
    // التحقق من وجود Canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    return !!ctx;
  } catch (error) {
    console.warn('الرسوم البيانية غير مدعومة في هذا المتصفح:', error);
    return false;
  }
}

// تصدير جميع الإعدادات
export default {
  colors: chartColors,
  defaultOptions: defaultChartOptions,
  pieOptions: pieChartOptions,
  radarOptions: radarChartOptions,
  generateColorPalette,
  generateTransparentColors,
  exportOptions,
  checkChartSupport,
};
