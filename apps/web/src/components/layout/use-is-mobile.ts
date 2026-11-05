import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 767px)';

function subscribe(listener: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches);
}
