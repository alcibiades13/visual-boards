import { useLayoutEffect, useState, type RefObject } from 'react';

export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** Scroll position and height of a scroll container, for virtualization. */
export function useScrollViewport(ref: RefObject<HTMLElement | null>): { top: number; height: number } {
  const [viewport, setViewport] = useState({ top: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setViewport({ top: el.scrollTop, height: el.clientHeight }));
    };
    setViewport({ top: el.scrollTop, height: el.clientHeight });
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [ref]);
  return viewport;
}
