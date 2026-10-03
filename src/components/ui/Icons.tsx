import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

const base = (p: P) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  width: 18,
  height: 18,
  "aria-hidden": true,
  ...p,
});

export const IconCheck = (p: P) => (
  <svg {...base(p)}><path d="m5 12.5 4.2 4.2L19 7" /></svg>
);
export const IconAlert = (p: P) => (
  <svg {...base(p)}><path d="M12 4.4 21 19.6H3Z" /><path d="M12 10v4M12 16.9v.1" /></svg>
);
export const IconMinus = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M8.4 12h7.2" /></svg>
);
export const IconExpert = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5.5 20c.6-3.4 3.2-5.2 6.5-5.2s5.9 1.8 6.5 5.2" />
  </svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="6.6" /><path d="m16 16 4.4 4.4" /></svg>
);
export const IconArrow = (p: P) => (
  <svg {...base(p)}><path d="M14.5 6 8.5 12l6 6" /></svg>
);
export const IconBook = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.5 4.6h9a2.6 2.6 0 0 1 2.6 2.6v12H7.1a2.6 2.6 0 0 1-2.6-2.6Z" />
    <path d="M19.5 4.6v14.6" />
  </svg>
);
export const IconClock = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.3V12l3 1.8" /></svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}><path d="m6.5 6.5 11 11M17.5 6.5l-11 11" /></svg>
);
export const IconInfo = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 7.9v.1" /></svg>
);
export const IconPlug = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 3.5v5M15 3.5v5" />
    <path d="M6.5 8.5h11v3a5.5 5.5 0 0 1-11 0Z" />
    <path d="M12 17v3.5" />
  </svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.8 6.8h14.4M9.5 6.8V4.9h5v1.9" />
    <path d="M6.6 6.8 7.5 20h9l.9-13.2" />
  </svg>
);
