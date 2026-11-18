import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { Panel } from './Surface';

interface PageHeaderProps {
  title: string;
  description: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="ui-page-header">
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description: string;
  children?: ReactNode;
}

export function EmptyState({ icon, title, description, children }: EmptyStateProps) {
  return (
    <Panel className="ui-empty">
      <span className="ui-icon-box ui-empty__icon">
        <Icon name={icon} size={24} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </Panel>
  );
}
