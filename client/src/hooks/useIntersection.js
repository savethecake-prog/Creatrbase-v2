import { useState, useEffect, useRef } from 'react';

/**
 * useIntersection
 * Custom hook that uses Intersection Observer to detect when an element
 * enters the viewport. Excellent for scroll-reveal animations.
 */
export function useIntersection(options = {}) {
  const [isIntersecting, setIntersecting] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      // Trigger once and disconnect if that's the desired behavior (once: true)
      if (entry.isIntersecting) {
        setIntersecting(true);
        if (options.once) {
          observer.unobserve(entry.target);
        }
      } else if (!options.once) {
        setIntersecting(false);
      }
    }, {
      threshold: options.threshold || 0.1,
      rootMargin: options.rootMargin || '0px',
      ...options
    });

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [options.once, options.threshold, options.rootMargin]);

  return [ref, isIntersecting];
}
