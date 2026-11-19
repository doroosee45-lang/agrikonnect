import '@testing-library/jest-dom';

globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
  root = null;
  rootMargin = '';
  thresholds = [];
} as unknown as IntersectionObserver;
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as ResizeObserver;
// jsdom ne fournit pas matchMedia ; useReveal et les composants animés le
// consultent (prefers-reduced-motion). Réponse neutre : aucune préférence.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() { return false; },
    }) as unknown as MediaQueryList;
}
globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
  setTimeout(cb, 16) as unknown as number;
globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
