import { useEffect, useState } from "react";
import "./online.css";
import { pushOff, pushOn, pushState, setTurnEmail, type PushState } from "../host/onlineActions";
import { refreshMe } from "../host/onlineActions";
import { useGame } from "../store";

/**
 * "Your turn" (session 29), in Settings online: a push to this device when a planning window opens and your page isn't
 * open (the installed app on Android, Chrome on a computer), and an email in long games (1 h turns and up).
 */
export const ALERTS_TEXT = {
  push: "Tell me when it's my turn",
  pushHelp: "A notification on this device when a new turn opens and the game isn't open here.",
  install: "To get a notification when it's your turn, install the game first. In Chrome, open the menu and tap Install Conquerra. On an iPhone, tap Share, then Add to Home Screen.",
  blocked: "Notifications are blocked for this site. You can allow them in the browser's site settings, then try again.",
  email: "Email me when it's my turn in a long game",
  emailHelp: (to: string) => `For games with turns of an hour or more, to ${to}. For now it reaches only the addresses Nate has set up for the game's email.`,
} as const;

export function TurnAlerts() {
  const me = useGame((s) => s.me);
  const [push, setPush] = useState<PushState>("checking");
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => void (me ?? refreshMe()), [me]);
  useEffect(() => {
    void pushState().then(setPush);
  }, []);
  if (!me) return null;
  const togglePush = async (on: boolean) => {
    setProblem(null);
    try {
      setPush(on ? await pushOn(me.push ?? "") : await pushOff());
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="turn-alerts">
      {push === "unsupported" ? (
        <p className="muted small">{ALERTS_TEXT.install}</p>
      ) : (
        <label className="check small turn-alert">
          <input type="checkbox" checked={push === "on"} disabled={push === "checking" || push === "blocked" || !me.push} onChange={(e) => void togglePush(e.target.checked)} />
          <span>
            {ALERTS_TEXT.push}
            <span className="muted small block">{push === "blocked" ? ALERTS_TEXT.blocked : ALERTS_TEXT.pushHelp}</span>
          </span>
        </label>
      )}
      <label className="check small turn-alert">
        <input type="checkbox" checked={!!me.turnEmail} onChange={(e) => void setTurnEmail(e.target.checked).catch((x: unknown) => setProblem(x instanceof Error ? x.message : String(x)))} />
        <span>
          {ALERTS_TEXT.email}
          {me.email && <span className="muted small block">{ALERTS_TEXT.emailHelp(me.email)}</span>}
        </span>
      </label>
      {problem && <p className="warn small">{problem}</p>}
    </div>
  );
}
