import type { CSSProperties, ReactNode } from "react";

/** The one gilded frame every panel uses: navy, a thin double gold rule and small corner ornaments. */
export function Frame({ title, extra, className = "", style, children, role, label }: { title?: ReactNode; extra?: ReactNode; className?: string; style?: CSSProperties; children?: ReactNode; role?: string; label?: string }) {
  return (
    <div className={`frame ${className}`} style={style} role={role} aria-label={label}>
      {(["tl", "tr", "bl", "br"] as const).map((c) => (
        <span key={c} className={`corner ${c}`}>
          <i />
        </span>
      ))}
      {(title || extra) && (
        <div className="frame-title">
          <span>{title}</span>
          {extra}
        </div>
      )}
      {children}
    </div>
  );
}
