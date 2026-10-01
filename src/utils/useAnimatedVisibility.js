import { useState, useEffect } from 'react';

/**
 * Custom hook to allow smooth enter AND exit animations for modals, drawers, and popovers.
 * When isOpen transitions to false, isExiting becomes true for the duration (ms),
 * allowing CSS exit animations (fade out, slide out, scale down) to complete before unmounting.
 */
export function useAnimatedVisibility(isOpen, durationMs = 280) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsExiting(false);
    } else if (shouldRender) {
      setIsExiting(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsExiting(false);
      }, durationMs);

      return () => clearTimeout(timer);
    }
  }, [isOpen, durationMs, shouldRender]);

  return { shouldRender, isExiting };
}
