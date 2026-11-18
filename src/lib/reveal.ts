// Attribute helpers for the entrance animations defined in styles/global.css + Base.astro script.
interface Reveal {
  /** 'load' animates on page load, 'view' when scrolled into view (once). */
  on?: 'load' | 'view';
  x?: number;
  y?: number;
  opacity?: number;
  delay?: number;
  dur?: number;
  ease?: 'expo' | 'out';
  /** Like framer-motion's viewport margin: negative = wait until this many px inside the viewport. */
  margin?: number;
}

export function rv(o: Reveal, style = '') {
  const vars = [
    o.x ? `--from-x:${o.x}px` : '',
    o.y ? `--from-y:${o.y}px` : '',
    o.opacity !== undefined ? `--from-o:${o.opacity}` : '',
    o.delay ? `--delay:${o.delay}s` : '',
    o.dur ? `--dur:${o.dur}s` : '',
    o.ease === 'expo' ? '--ease:var(--ease-out-expo)' : '',
  ].filter(Boolean);
  return {
    'data-reveal': o.on ?? 'load',
    ...(o.margin ? { 'data-margin': String(o.margin) } : {}),
    style: [...vars, style].filter(Boolean).join(';'),
  };
}

/** Horizontal divider that draws in from the left. */
export const line = (style = '') => ({ 'data-reveal-line': 'load', style });
