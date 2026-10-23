import { useState, useEffect, useRef } from "react";

/**
 * Hook to keep the GoogleLogin button responsive and perfectly aligned with form inputs.
 * Google Identity Services limits button width to between 200px and 400px.
 * On desktop: fills up to `maxWidth` (default 384px, matching max-w-md form inputs).
 * On mobile/tablet: dynamically scales to match the container width without overflowing.
 *
 * @param {number} maxWidth - Maximum width on desktop (default: 384).
 * @returns {{ containerRef: React.RefObject, buttonWidth: string }}
 */
export const useGoogleButtonWidth = (maxWidth = 384) => {
  const containerRef = useRef(null);

  const getCalculatedWidth = () => {
    if (typeof window !== "undefined") {
      if (containerRef.current && containerRef.current.clientWidth > 0) {
        return Math.min(maxWidth, Math.max(200, Math.floor(containerRef.current.clientWidth)));
      }
      const approx = window.innerWidth - 32;
      return Math.min(maxWidth, Math.max(200, Math.floor(approx)));
    }
    return maxWidth;
  };

  const [buttonWidth, setButtonWidth] = useState(getCalculatedWidth);

  useEffect(() => {
    const update = () => {
      if (containerRef.current && containerRef.current.clientWidth > 0) {
        const clamped = Math.min(maxWidth, Math.max(200, Math.floor(containerRef.current.clientWidth)));
        setButtonWidth((prev) => (prev !== clamped ? clamped : prev));
      } else if (typeof window !== "undefined") {
        const approx = window.innerWidth - 32;
        const clamped = Math.min(maxWidth, Math.max(200, Math.floor(approx)));
        setButtonWidth((prev) => (prev !== clamped ? clamped : prev));
      }
    };

    update();

    let ro;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      ro = new ResizeObserver(update);
      ro.observe(containerRef.current);
    }
    window.addEventListener("resize", update);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [maxWidth]);

  return { containerRef, buttonWidth: String(buttonWidth) };
};

export default useGoogleButtonWidth;
