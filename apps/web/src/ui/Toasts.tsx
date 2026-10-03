import type { Toast } from "../replay/toasts";

export interface ShownToast extends Toast {
  id: number;
}

/** Short gilded pop-ups during and after the replay ("Gules captures Oakcrest"). */
export function Toasts({ toasts }: { toasts: readonly ShownToast[] }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`frame slim toast ${t.tone}`} style={t.house ? { borderLeftColor: t.house } : undefined}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
