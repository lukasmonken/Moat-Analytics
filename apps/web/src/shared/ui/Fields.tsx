import type { ComponentPropsWithoutRef } from 'react';
import { Icon } from './Icon';

type InputProps = ComponentPropsWithoutRef<'input'> & {
  id: string;
  label: string;
};

export function Input({ id, label, type = 'text', className, ...props }: InputProps) {
  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      <div className="ui-field__control">
        {type === 'search' && <Icon className="ui-field__prefix" name="search" size={17} />}
        <input
          {...props}
          className={className ? `ui-input ${className}` : 'ui-input'}
          id={id}
          type={type}
        />
      </div>
    </div>
  );
}

type SelectProps = ComponentPropsWithoutRef<'select'> & {
  id: string;
  label: string;
};

export function Select({ id, label, className, ...props }: SelectProps) {
  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      <div className="ui-field__control">
        <select {...props} className={className ? `ui-select ${className}` : 'ui-select'} id={id} />
        <Icon className="ui-field__suffix" name="chevron-down" size={16} />
      </div>
    </div>
  );
}
