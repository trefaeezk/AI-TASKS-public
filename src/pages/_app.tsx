import '../app/globals.css';
import type { AppProps } from 'next/app';
// Removed AuthProvider and Toaster as they are in RootLayout (app/layout.tsx)
// Removed useEffect for service worker registration as RootLayout unregisters them
// Removed Head from next/head as RootLayout handles head content for App Router

export default function App({ Component, pageProps }: AppProps) {
  // _app.tsx is primarily for the Pages Router.
  // If your app is mainly App Router, global styles and minimal setup are needed here.
  // Global providers and head management should be in app/layout.tsx.
  return <Component {...pageProps} />;
}
