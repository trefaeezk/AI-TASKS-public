
'use client';

import { useState, useEffect } from "react"

const MOBILE_BREAKPOINT = 768 // md breakpoint in Tailwind

/**
 * Hook للتحقق مما إذا كان الجهاز محمولاً
 * يستخدم نقطة فاصلة 768 بكسل (تتوافق مع md في Tailwind)
 * يتم تحسينه باستخدام throttling لتحسين الأداء
 */
export function useIsMobile() {
  // استخدام قيمة أولية تعتمد على حجم النافذة إذا كان متاحًا (SSR-safe)
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < MOBILE_BREAKPOINT
    }
    return false // القيمة الافتراضية للـ SSR
  })

  useEffect(() => {
    // تنفيذ throttling لتحسين الأداء
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const checkDevice = () => {
      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
          timeoutId = null
        }, 100) // تأخير 100 مللي ثانية
      }
    }

    // فحص أولي
    checkDevice()

    // إضافة مستمع لتغيير حجم النافذة
    window.addEventListener("resize", checkDevice)

    // تنظيف المستمع عند إلغاء تحميل المكون
    return () => {
      window.removeEventListener("resize", checkDevice)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, []) // مصفوفة تبعيات فارغة لضمان تنفيذ هذا مرة واحدة عند التحميل

  return isMobile
}
