import { creditsInUse, needsCredit } from "@conquerra/sound";
import { Frame } from "./Frame";

const LICENSE: Record<string, string> = { "CC0-1.0": "CC0", PD: "public domain", "CC-BY-3.0": "CC BY 3.0", "CC-BY-4.0": "CC BY 4.0" };

/**
 * Settings → Credits (session 24): the sound packs the game's sounds come from, author, title and license. All CC0
 * today, so none is owed credit, but every pack is listed anyway (it's polite, and it's how a sound gets traced).
 * Loaded the first time it's opened.
 */
export default function SoundCredits({ onClose }: { onClose(): void }) {
  const credits = creditsInUse();
  return (
    <Frame className="popover credits" title="Credits" extra={<button className="link" onClick={onClose}>Back</button>}>
      <p className="small muted">Sound and music from these free packs.{credits.some((c) => needsCredit(c.license)) ? "" : " All of them are public domain (CC0)."}</p>
      <ul className="credit-list">
        {credits.map((c) => (
          <li key={c.id}>
            <span>{c.title}</span> <span className="muted">by {c.author} · {LICENSE[c.license] ?? c.license}</span>
          </li>
        ))}
      </ul>
    </Frame>
  );
}
