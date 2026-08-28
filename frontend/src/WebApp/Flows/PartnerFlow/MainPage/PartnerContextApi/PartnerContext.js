// PartnerContext.js
import React, { createContext, useState, useContext } from "react";

const PartnerContext = createContext();

export const PartnerProvider = ({ children }) => {
  const [selectedMenu, setSelectedMenu] = useState("your-job-posts");
  const [partnerInfo, setPartnerInfo] = useState(null); // ✅ add this

  return (
    <PartnerContext.Provider value={{ selectedMenu, setSelectedMenu, partnerInfo, setPartnerInfo }}>
      {children}
    </PartnerContext.Provider>
  );
};

export const usePartnerContext = () => useContext(PartnerContext);
