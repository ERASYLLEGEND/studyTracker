import './globals.css';
import type { Metadata, Viewport } from 'next';
import ServiceWorkerRegister from './components/ServiceWorkerRegister';
import FirebaseInit from './components/FirebaseInit';

// PWA Metadata
export const metadata: Metadata = {
  title: 'StudyTracker - Умный трекер учебы',
  description: 'Персональный трекер учебы, задач, привычек и Pomodoro',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'StudyTracker',
  },
};

// Viewport и theme-color для PWA
export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <head>
        {/* Дополнительные meta-теги для PWA совместимости */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="application-name" content="StudyTracker" />
      </head>
      <body className="antialiased min-h-screen bg-slate-900 text-slate-100 pb-20 md:pb-0">
        {/* Регистрация Service Worker (клиентский компонент) */}
        <ServiceWorkerRegister />
        {/* Инициализация Firebase Messaging */}
        <FirebaseInit />
        {children}
      </body>
    </html>
  );
}
