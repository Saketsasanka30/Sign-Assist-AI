import { useEffect, useRef, useState } from "react";

interface UseCountUpOptions {
  target: number;
  decimals: number;
  suffix: string;
  index: number;
}

export function useCountUp({ target, decimals, suffix, index }: UseCountUpOptions) {
  const [display, setDisplay] = useState<string>(() => `0${suffix}`);
  const ref = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      setDisplay(`${target.toFixed(decimals)}${suffix}`);
      return;
    }

    let rafId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const runAnimation = () => {
      if (startedRef.current) return;
      startedRef.current = true;

      const duration = 1500 + index * 80;
      const startDelay = 480 + index * 90;

      timeoutId = setTimeout(() => {
        const start = performance.now();

        const tick = (now: number) => {
          const elapsed = now - start;
          const progress = Math.min(1, elapsed / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = target * eased;
          setDisplay(`${current.toFixed(decimals)}${suffix}`);

          if (progress < 1) {
            rafId = requestAnimationFrame(tick);
          } else {
            setDisplay(`${target.toFixed(decimals)}${suffix}`);
          }
        };

        rafId = requestAnimationFrame(tick);
      }, startDelay);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          runAnimation();
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [target, decimals, suffix, index]);

  return { ref, display };
}
