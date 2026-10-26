import type { ReportReason } from "./protocol";

/**
 * Session 34, abuse limits: every line a player reads about reporting, blocking and the caps (the voice guide applies:
 * plain, short, no sarcasm in a refusal). Shared by the room, the Worker and the page.
 */
export const SAFETY_TEXT = {
  // Report a line.
  report: "Report",
  reportTitle: "Report this line",
  reportWhy: "Why?",
  reasons: { abuse: "Abuse", spam: "Spam", cheating: "Cheating", other: "Other" } satisfies Record<ReportReason, string>,
  reportWords: "Anything Nate should know (optional)",
  send: "Send report",
  cancel: "Cancel",
  reported: "Reported. Nate reads these.",
  reportedAlready: "You've reported that line already.",
  reportsToday: "You've sent three reports today, the most a day. You can send more tomorrow.",
  pickReason: "Pick a reason first.",
  notALine: "That line isn't in one of your chats.",
  ownLine: "That's your own line.",
  peopleOnly: "Only people's lines can be reported, and only people can be blocked.",
  // Block a person.
  block: "Block",
  blockAsk: (name: string) => `Block ${name}? Their messages won't reach you, here or in any game. Their deals still will. They aren't told.`,
  blocked: (name: string) => `Blocked. ${name}'s messages won't reach you. Unblock in Settings.`,
  blockYourself: "That's you.",
  // Settings: Blocked players.
  blockedTitle: "Blocked players",
  noneBlocked: "No one. Block someone from their chat line or the Houses panel.",
  unblock: "Unblock",
  // The caps.
  tablesToday: "You've made 20 tables today, the most a day. You can make more tomorrow.",
  tooFast: "That's a lot at once. Wait a moment, then try again.",
  joinsTooFast: "That's a lot of links at once. Wait a minute, then try again.",
} as const;

/** Session 34: the caps, in one place (the room's and the Worker's). */
export const SAFETY_LIMITS = {
  /** Reports a person may send in 24 hours. */
  reportsPerDay: 3,
  /** A report's own words, at most. */
  reportWords: 120,
  /** Tables a person may make in 24 hours. */
  tablesPerDay: 20,
  /** Messages a page may send the room in a window (the chat's own one-every-2-s limit sits inside it). */
  messagesPerWindow: 30,
  windowMs: 10_000,
  /** Joins by invite code from one address in a minute. */
  joinsPerMinute: 10,
} as const;
