import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from './providers';
import { SettingsProvider } from './settings-provider';
import { Sidebar } from '@/components/Sidebar';
import { DynamicFavicon } from '@/components/DynamicFavicon';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { LiveStreamWidget } from '@/components/LiveStreamWidget';
import { HeaderBar } from '@/components/HeaderBar';
import { initializeScheduler } from '@/lib/jobs/scheduler';

// Start internal cron jobs (daily metrics aggregation)
initializeScheduler();

export const metadata: Metadata = {
  title: 'OpenClaw Dashboard',
  description: 'Local Agentic Development Dashboard',
  icons: {
    icon: [
      { url: '/ocd-logo-dark.png', media: '(prefers-color-scheme: dark)' },
      { url: '/ocd-logo-light.png', media: '(prefers-color-scheme: light)' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <SettingsProvider>
            <DynamicFavicon />
            <OnboardingWizard />
            <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
              {/* Full-width header */}
              <HeaderBar />

              {/* Body: sidebar + main + logs */}
              <div className="flex flex-1 overflow-hidden">
                <Sidebar />

                {/* Main content */}
                <main className="flex-1 flex flex-col overflow-hidden relative">
                  {/* Mobile spacer for fixed header */}
                  <div className="md:hidden" style={{ height: '48px', flexShrink: 0 }} />
                  <div className="flex-1 overflow-y-auto">
                    {children}
                  </div>
                </main>

                {/* Live logs panel — inline, shrinks main */}
                <LiveStreamWidget />
              </div>
            </div>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
