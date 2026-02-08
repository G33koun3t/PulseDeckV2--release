import React, { createContext, useContext, useState } from 'react';

const LicenseContext = createContext({ isFreeMode: false });

export function LicenseProvider({ children, initialFreeMode = false }) {
  const [isFreeMode] = useState(initialFreeMode);
  return (
    <LicenseContext.Provider value={{ isFreeMode }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  return useContext(LicenseContext);
}
