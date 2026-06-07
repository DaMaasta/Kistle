import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

interface HeaderState {
  title: string;
  onBack?: () => void;
}

interface HeaderContextType {
  headerState: HeaderState | null;
  setHeader: (state: HeaderState) => void;
  clearHeader: () => void;
}

const HeaderContext = createContext<HeaderContextType>({
  headerState: null,
  setHeader: () => {},
  clearHeader: () => {},
});

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [headerState, setHeaderState] = useState<HeaderState | null>(null);

  const setHeader = useCallback((state: HeaderState) => {
    setHeaderState(state);
  }, []);

  const clearHeader = useCallback(() => {
    setHeaderState(null);
  }, []);

  return (
    <HeaderContext.Provider value={{ headerState, setHeader, clearHeader }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  return useContext(HeaderContext);
}
