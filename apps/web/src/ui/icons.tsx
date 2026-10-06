/** Small line icons for the round buttons and the top bar (drawn inline so they're crisp at any size). */
const P = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Icon = {
  swords: () => (
    <svg viewBox="0 0 24 24" {...P}>
      <path d="M4 4l10 10M4 4h4M4 4v4M14 14l3 3M15.5 18.5l3-3M20 20l-2-2" />
      <path d="M20 4L10 14M20 4h-4M20 4v4M10 14l-3 3M5.5 15.5l3 3M4 20l2-2" />
    </svg>
  ),
  troops: () => (
    <svg viewBox="0 0 24 24" {...P}>
      <circle cx="8" cy="7" r="3" />
      <circle cx="16" cy="7" r="3" />
      <path d="M3 20c0-4 2-7 5-7s5 3 5 7M11 20c0-4 2-7 5-7s5 3 5 7" />
    </svg>
  ),
  spend: () => (
    <svg viewBox="0 0 24 24" {...P}>
      <ellipse cx="12" cy="7" rx="7" ry="3" />
      <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
    </svg>
  ),
  culture: () => (
    <svg viewBox="0 0 24 24" {...P}>
      <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z" />
    </svg>
  ),
  retreat: () => (
    <svg viewBox="0 0 24 24" {...P}>
      <path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-2" />
    </svg>
  ),
  gear: () => (
    <svg viewBox="0 0 24 24" {...P}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </svg>
  ),
  people: () => (
    <svg viewBox="0 0 24 24" {...P}>
      <path d="M5 4h14v7c0 5-7 9-7 9s-7-4-7-9z" />
      <path d="M12 4v16" />
    </svg>
  ),
  map: () => (
    <svg viewBox="0 0 24 24" {...P}>
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  ),
  pause: () => (
    <svg viewBox="0 0 24 24" {...P}>
      <path d="M9 5v14M15 5v14" />
    </svg>
  ),
  play: () => (
    <svg viewBox="0 0 24 24" {...P}>
      <path d="M7 4.5l12 7.5-12 7.5z" />
    </svg>
  ),
  scroll: () => (
    <svg viewBox="0 0 24 24" {...P}>
      <path d="M6 4h11a2 2 0 012 2v12a2 2 0 01-2 2H8a2 2 0 01-2-2z" />
      <path d="M9 9h7M9 13h7M9 17h4" />
    </svg>
  ),
};
