import type { ButtonHTMLAttributes, ComponentProps } from 'react';
import { Link } from 'react-router-dom';

type ButtonVariant = 'primary' | 'secondary' | 'quiet';

function buttonClass(variant: ButtonVariant, className?: string) {
  const base = `ui-button ui-button--${variant}`;
  return className ? `${base} ${className}` : base;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({
  variant = 'secondary',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return <button {...props} type={type} className={buttonClass(variant, className)} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
};

export function ButtonLink({ variant = 'secondary', className, ...props }: ButtonLinkProps) {
  return <Link {...props} className={buttonClass(variant, className)} />;
}
