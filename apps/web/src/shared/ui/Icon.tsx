import type { ReactElement } from 'react';

const icons = {
  overview: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
    </>
  ),
  screener: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
      <path d="M8 4v4m8 2v4m-6 2v4" />
    </>
  ),
  company: (
    <>
      <path d="M4 21V8l8-5 8 5v13H4Z" />
      <path d="M9 21v-4h6v4M8 11h.01M12 11h.01M16 11h.01M8 14h.01M12 14h.01M16 14h.01" />
    </>
  ),
  valuation: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8m-8 5h.01m4 0h.01m4 0h.01m-8 4h.01m4 0h.01m4 0h.01" />
    </>
  ),
  portfolio: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m-13 6h18m-9-1v3" />
    </>
  ),
  backtest: (
    <>
      <path d="M3 7v5h5m-5 0a9 9 0 1 1 2.5 6.2M12 8v4l3 2" />
    </>
  ),
  methodology: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3Z" />
      <path d="M8 8h8m-8 4h5" />
    </>
  ),
  'arrow-right': <path d="M4.5 12h14m-5-5 5 5-5 5" />,
  'arrow-up-right': <path d="M6 18 18 6m-8 0h8v8" />,
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.2" />
      <path d="m15.4 15.4 4.1 4.1" />
    </>
  ),
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2m-17.1 7.1 1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M20.5 15a8.7 8.7 0 0 1-11.4-11 8.7 8.7 0 1 0 11.4 11Z" />,
  database: (
    <>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.5" />
      <path d="M4.5 5.5v12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-12m-15 6c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5" />
    </>
  ),
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof icons;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {icons[name]}
    </svg>
  );
}
