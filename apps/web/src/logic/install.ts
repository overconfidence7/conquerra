/**
 * Session 35, the installed app: the lobby's Install line. Chrome (on Android) offers an install prompt the page can
 * open (`beforeinstallprompt`); Safari on an iPhone has none, so the line says where Safari's own steps are. Nothing
 * shows once the game runs installed (`display-mode: standalone`), or once the line was dismissed on this device.
 */
export type InstallForm = "none" | "prompt" | "ios";

export const INSTALL_TEXT = {
  line: "Install Conquerra: it opens like an app.",
  install: "Install",
  ios: "In Safari, tap Share, then Add to Home Screen.",
  dismiss: "Not now",
} as const;

export const INSTALL_DISMISSED = "conquerra.installDismissed";

/** Which form the Install line takes. A desktop (no touch screen) never shows it: the lobby stays as it is there. */
export function installForm(o: { standalone: boolean; dismissed: boolean; prompt: boolean; ios: boolean; touch: boolean }): InstallForm {
  if (o.standalone || o.dismissed || !o.touch) return "none";
  if (o.prompt) return "prompt";
  return o.ios ? "ios" : "none";
}

/** An iPhone or iPad (an iPad says it's a Mac, but has a touch screen). */
export const isIos = (ua: string, touchPoints: number) => /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
