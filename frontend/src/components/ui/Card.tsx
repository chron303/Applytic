import type { ReactNode, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  shadow?: boolean;
  className?: string;
}

const padMap: Record<string, string> = {
  none: "0",
  sm:   "1rem",
  md:   "1.5rem",
  lg:   "2rem",
};

export function Card({
  children,
  padding = "md",
  shadow = false,
  className = "",
  style,
  ...rest
}: CardProps) {
  return (
    <div
      className={`card ${className}`}
      style={{
        "--card-pad": padMap[padding],
        boxShadow: shadow ? "var(--shadow-md)" : "var(--shadow-xs)",
        ...style,
      } as React.CSSProperties}
      {...rest}
    >
      {children}

      <style>{`
        .card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--card-pad);
          width: 100%;
          transition: box-shadow var(--transition-base);
        }
      `}</style>
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, icon, action }: CardHeaderProps) {
  return (
    <div className="card-header">
      <div className="card-header-left">
        {icon && <span className="card-header-icon">{icon}</span>}
        <div>
          <h3 className="card-header-title">{title}</h3>
          {subtitle && <p className="card-header-subtitle">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="card-header-action">{action}</div>}

      <style>{`
        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.25rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--color-border);
        }
        .card-header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .card-header-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: var(--color-info-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          color: var(--color-text);
          flex-shrink: 0;
        }
        .card-header-title {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--color-text);
          margin: 0;
        }
        .card-header-subtitle {
          font-size: 0.8125rem;
          color: var(--color-text-muted);
          margin: 0.125rem 0 0;
        }
        .card-header-action {
          flex-shrink: 0;
        }
        @media (max-width: 640px) {
          .card-header {
            flex-direction: column;
            gap: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}
