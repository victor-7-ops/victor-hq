'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Agent Identity has been merged into System Pulse (/security). Redirect. */
export default function IdentityRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/security');
  }, [router]);
  return null;
}
