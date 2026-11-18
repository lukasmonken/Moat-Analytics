import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export function Badge({ children }: { children: ReactNode }) {
  return <span className="ui-badge">{children}</span>;
}

type PanelProps = ComponentPropsWithoutRef<'section'>;

export function Panel({ className, ...props }: PanelProps) {
  const classes = className ? `ui-panel ${className}` : 'ui-panel';
  return <section {...props} className={classes} />;
}

type TableProps = ComponentPropsWithoutRef<'table'>;

export function Table({ className, ...props }: TableProps) {
  return <table {...props} className={className ? `ui-table ${className}` : 'ui-table'} />;
}
