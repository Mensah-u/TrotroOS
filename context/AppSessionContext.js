import { createContext, useContext } from 'react';

export const AppSessionContext = createContext(null);

export function useAppSession() {
  const ctx = useContext(AppSessionContext);
  if (!ctx) {
    throw new Error('useAppSession must be used within AppSessionProvider');
  }
  return ctx;
}
