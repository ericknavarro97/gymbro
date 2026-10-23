/**
 * Button / ButtonLink / IconButton. All sizes meet the 44px touch target.
 * Server-safe (no hooks): usable from Server and Client Components.
 */
import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cx } from "./cx";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 font-semibold whitespace-nowrap " +
  "transition-[background-color,color,border-color,transform,box-shadow] duration-150 active:scale-[0.98] " +
  "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-fg shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_8px_24px_-12px_var(--gb-accent)] hover:bg-accent-strong",
  secondary: "bg-surface-2 text-fg hover:bg-raised border border-line",
  outline: "border-2 border-line-strong text-fg hover:border-fg bg-transparent",
  ghost: "text-fg hover:bg-surface-2 bg-transparent",
  danger: "bg-danger-soft text-danger hover:brightness-110 border border-danger/30",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3.5 text-sm rounded-md",
  md: "min-h-12 px-5 text-base rounded-lg",
  lg: "min-h-14 px-6 rounded-xl font-display text-[1.35rem] uppercase tracking-wide",
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}

/** Class string for button-looking elements (e.g. a custom <a>). */
export function buttonStyles({ variant = "primary", size = "md", block, className }: ButtonStyleOptions = {}) {
  return cx(base, variants[variant], sizes[size], block && "w-full", className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, Omit<ButtonStyleOptions, "className"> {
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean;
  /** Icon before the label. */
  icon?: ReactNode;
  /** Icon after the label. */
  iconRight?: ReactNode;
}

export function Button({
  variant,
  size,
  block,
  loading = false,
  icon,
  iconRight,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, block, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner className="size-5" /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
}

export interface ButtonLinkProps extends ComponentProps<typeof Link>, Omit<ButtonStyleOptions, "className"> {
  icon?: ReactNode;
  iconRight?: ReactNode;
}

/** next/link styled as a Button. */
export function ButtonLink({ variant, size, block, icon, iconRight, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonStyles({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required accessible name. */
  label: string;
  variant?: "ghost" | "secondary" | "primary";
  size?: "md" | "lg";
  children: ReactNode;
}

/** Square 44px (md) / 52px (lg) icon-only button. */
export function IconButton({
  label,
  variant = "ghost",
  size = "md",
  className,
  children,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-colors active:scale-95 disabled:opacity-40",
        size === "md" ? "size-11" : "size-13",
        variant === "ghost" && "text-fg hover:bg-surface-2",
        variant === "secondary" && "bg-surface-2 text-fg border border-line hover:bg-raised",
        variant === "primary" && "bg-accent text-accent-fg hover:bg-accent-strong",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
