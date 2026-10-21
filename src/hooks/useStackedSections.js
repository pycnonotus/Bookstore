import { useLayoutEffect } from 'react';

export default function useStackedSections(stackRef, sectionKey) {
  useLayoutEffect(() => {
    const stack = stackRef.current;
    if (!stack) return;

    const sections = [...stack.querySelectorAll(':scope > .topic-section')];
    const header = document.querySelector('.site-header');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let focusedTarget = null;

    function updateDepth() {
      frame = 0;
      const keyboardFocus = stack.querySelector(':focus-visible');
      const enabled = !reducedMotion.matches && !keyboardFocus && sections.length > 1;
      const distance = Math.min(window.innerHeight * 0.55, 360);
      const nextTops = sections.map(section => section.getBoundingClientRect().top);

      sections.forEach((section, index) => {
        const progress = enabled && index < sections.length - 1
          ? Math.max(0, Math.min(1, (window.innerHeight - 24 - nextTops[index + 1]) / distance))
          : 0;
        section.style.setProperty('--stack-progress', progress.toFixed(4));
      });

      if (keyboardFocus && focusedTarget?.isConnected) {
        focusedTarget.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      }
      focusedTarget = null;
    }

    function scheduleDepth() {
      if (!frame) frame = window.requestAnimationFrame(updateDepth);
    }

    function measure() {
      const gap = window.innerWidth < 640 ? 16 : 24;
      const headerHeight = header?.offsetHeight ?? 0;
      const heights = sections.map(section => section.offsetHeight);
      sections.forEach((section, index) => {
        // Tall shelves must scroll through every row before they stick.
        const top = Math.min(headerHeight + gap, window.innerHeight - heights[index] - gap);
        section.style.setProperty('--stack-top', `${top}px`);
      });
      scheduleDepth();
    }

    function revealFocus(event) {
      focusedTarget = event.target;
      scheduleDepth();
    }

    const resizeObserver = new ResizeObserver(measure);
    sections.forEach(section => resizeObserver.observe(section));
    resizeObserver.observe(stack);
    if (header) resizeObserver.observe(header);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', scheduleDepth, { passive: true });
    reducedMotion.addEventListener('change', measure);
    stack.addEventListener('focusin', revealFocus);
    stack.addEventListener('focusout', scheduleDepth);
    measure();

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', scheduleDepth);
      reducedMotion.removeEventListener('change', measure);
      stack.removeEventListener('focusin', revealFocus);
      stack.removeEventListener('focusout', scheduleDepth);
    };
  }, [stackRef, sectionKey]);
}
