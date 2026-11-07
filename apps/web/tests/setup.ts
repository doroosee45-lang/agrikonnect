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
globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
  setTimeout(cb, 16) as unknown as number;
globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
