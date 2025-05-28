import type { Metadata } from 'next';
import { Cairo } from 'next/font/google'; // Changed font to Cairo for Arabic support
import { Toaster } from '@/components/ui/toaster'; // Import Toaster
import { AuthProvider } from '@/context/AuthContext'; // Import AuthProvider

import { NotificationSettingsProvider } from '@/components/notifications/NotificationSettingsProvider'; // Import NotificationSettingsProvider
import { LanguageProvider } from '@/context/LanguageContext'; // Import LanguageProvider
import { ThemeProvider } from '@/context/ThemeContext'; // Import ThemeProvider
// AuthProvider will be moved to the (app) group layout
import './globals.css';
import React from 'react';

const cairo = Cairo({
  subsets: ['arabic', 'latin'], // Include Arabic and Latin subsets
  variable: '--font-cairo',
});

// export const metadata: Metadata = { // Metadata cannot be used in a client component
//   title: 'ذكاء المهام | إدارة المهام بالذكاء الاصطناعي', // Updated title
//   description: 'تطبيق ويب لإدارة المهام الشخصية بذكاء مع اقتراحات وأولويات مدعومة بالذكاء الاصطناعي.', // Updated description
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
          {/* Metadata moved to head for client component */}
          <title>إدارة المهام | تنظيم وإدارة المهام بكفاءة</title>
          <meta name="description" content="تطبيق ويب لإدارة المهام بكفاءة عالية مع ميزات متقدمة للتنظيم والمتابعة." />
          {/* Ensure viewport meta tag is present and correct */}
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" />
          <meta name="theme-color" content="#ffffff" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          {/* Add other head elements like favicon links here if needed */}
       </head>
      <body className={`${cairo.variable} font-sans antialiased bg-background text-foreground overflow-x-hidden`}>
         {/* Wrap children with providers */}
         <ThemeProvider>
           <LanguageProvider>
             <AuthProvider>
                <NotificationSettingsProvider>
                   {children}
                </NotificationSettingsProvider>
                <Toaster /> {/* Add Toaster component here */}
             </AuthProvider>
           </LanguageProvider>
         </ThemeProvider>
      </body>
    </html>
  );
}
