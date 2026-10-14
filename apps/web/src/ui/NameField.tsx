import { useEffect, useState } from "react";
import { refreshMe, setMyName } from "../host/onlineActions";
import { useGame } from "../store";

/**
 * "Your name" (session 27): the name the table screen and the players panel show for you online. It starts as your
 * email's first part; a change here is used at the next table you sit at (a game under way keeps the name it started
 * with).
 */
export function NameField() {
  const me = useGame((s) => s.me);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => void (me ?? refreshMe()), [me]);
  if (!me) return null;
  const save = async () => {
    try {
      await setMyName(draft);
      setProblem(null);
      setEditing(false);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="online-name">
      <span className="field-name">Your name</span>
      {editing ? (
        <>
          <input className="name-input" value={draft} maxLength={24} aria-label="Your name" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void save()} />
          <button onClick={() => void save()}>Save</button>
          <button className="link small" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <span>{me.name}</span>
          <button
            className="link small"
            onClick={() => {
              setDraft(me.name);
              setEditing(true);
            }}
          >
            Change
          </button>
        </>
      )}
      {problem && <span className="warn small block">{problem}</span>}
      <span className="muted small block">What the other players see. A game under way keeps the name it started with.</span>
    </div>
  );
}
