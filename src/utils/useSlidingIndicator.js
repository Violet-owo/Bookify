import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Measures the active child of a container and returns the style for an
 * indicator that glides (and stretches) from one item to the next.
 *
 *   const { containerRef, indicatorStyle } = useSlidingIndicator(activeKey);
 *   <div ref={containerRef} className="has-indicator">
 *     <span className="slide-indicator" style={indicatorStyle} />
 *     <button data-active={...}>…</button>
 *   </div>
 */
export function useSlidingIndicator(activeKey, selector = '[data-active="true"]') {
  const containerRef = useRef(null);
  const [box, setBox] = useState(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const measure = () => {
      const active = container.querySelector(selector);
      if (!active) {
        setBox(null);
        return;
      }
      setBox({
        x: active.offsetLeft,
        y: active.offsetTop,
        w: active.offsetWidth,
        h: active.offsetHeight
      });
    };

    measure();
    // Enable the transition only after the first placement (no fly-in from 0,0)
    const raf = requestAnimationFrame(() => setReady(true));
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [activeKey, selector]);

  const indicatorStyle = box
    ? {
        width: `${box.w}px`,
        height: `${box.h}px`,
        transform: `translate(${box.x}px, ${box.y}px)`,
        opacity: 1,
        transition: ready ? undefined : 'none'
      }
    : { opacity: 0 };

  return { containerRef, indicatorStyle };
}
