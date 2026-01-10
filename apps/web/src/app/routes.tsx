import { createBrowserRouter, Outlet } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';

// Page imports - lazy loaded for code splitting
import { lazy, Suspense } from 'react';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const VmPage = lazy(() => import('./pages/VmPage'));
const NetworkPage = lazy(() => import('./pages/NetworkPage'));
const OllamaPage = lazy(() => import('./pages/OllamaPage'));
const DocsPage = lazy(() => import('./pages/DocsPage'));
const DownloadsPage = lazy(() => import('./pages/DownloadsPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// Loading fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-zinc-600 border-t-blue-500 rounded-full" />
    </div>
  );
}

// Wrap lazy components with Suspense
function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

// Root layout with AppShell
function RootLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

// Router configuration
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: (
          <SuspenseWrapper>
            <DashboardPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'services',
        element: (
          <SuspenseWrapper>
            <ServicesPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'vm',
        element: (
          <SuspenseWrapper>
            <VmPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'vm/:vmId',
        element: (
          <SuspenseWrapper>
            <VmPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'network',
        element: (
          <SuspenseWrapper>
            <NetworkPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'ollama',
        element: (
          <SuspenseWrapper>
            <OllamaPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'docs',
        element: (
          <SuspenseWrapper>
            <DocsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'docs/*',
        element: (
          <SuspenseWrapper>
            <DocsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'downloads',
        element: (
          <SuspenseWrapper>
            <DownloadsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'about',
        element: (
          <SuspenseWrapper>
            <AboutPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'settings',
        element: (
          <SuspenseWrapper>
            <SettingsPage />
          </SuspenseWrapper>
        ),
      },
    ],
  },
], {
  basename: '/qemuweb',
});
