'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingWizard } from '@/components/OnboardingWizard';

/**
 * The /setup route now renders the full 10-step OnboardingWizard.
 * Navigating here always opens the wizard regardless of onboarding state.
 */
export default function SetupPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true) }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background">
      <OnboardingWizard
        forceOpen
        onClose={() => router.push('/fleet')}
      />
    </div>
  );
}
