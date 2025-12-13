import { ReactNode, createContext, useContext } from 'react';

type PreAuthOnboardingControls = {
  restart: () => void;
};

const PreAuthOnboardingContext = createContext<PreAuthOnboardingControls | null>(
  null
);

export const PreAuthOnboardingProvider = ({
  children,
  restart,
}: {
  children: ReactNode;
  restart: () => void;
}) => (
  <PreAuthOnboardingContext.Provider value={{ restart }}>
    {children}
  </PreAuthOnboardingContext.Provider>
);

export const usePreAuthOnboardingControls = () => {
  const ctx = useContext(PreAuthOnboardingContext);
  if (!ctx) return null;
  return ctx;
};
