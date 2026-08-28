import { useEffect, useState } from "react";

const getIsMobile = (breakpoint) => {
  if (typeof window === "undefined") return false;
  return window.innerWidth < breakpoint;
};

const useIsMobileChart = (breakpoint = 640) => {
  const [isMobile, setIsMobile] = useState(() => getIsMobile(breakpoint));

  useEffect(() => {
    const handleResize = () => setIsMobile(getIsMobile(breakpoint));

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);

  return isMobile;
};

export default useIsMobileChart;
