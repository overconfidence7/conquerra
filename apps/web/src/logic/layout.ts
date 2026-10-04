/**
 * Phone or desktop layout. Pure, so it's tested without a screen.
 *
 * A phone must get the phone layout even when the browser reports a wide page: Chrome's "Desktop site" setting
 * fakes a ~980px-wide page, and a phone held sideways is wider than our old 760px cut-off. So besides the page
 * width we look at the screen itself: a touch-first screen whose short side is phone-sized is a phone.
 */

export type LayoutChoice = "auto" | "phone" | "desktop";
export type Layout = "phone" | "desktop";

/** Everything the choice depends on, read from the browser (see `readScreenFacts` in the UI). */
export interface ScreenFacts {
  /** The page's width and height in CSS pixels (window.innerWidth / innerHeight). */
  innerWidth: number;
  innerHeight: number;
  /** The whole screen in CSS pixels (screen.width / height). */
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  /** Running as the installed app (display-mode: standalone). */
  standalone: boolean;
  /** The main pointer is a finger (pointer: coarse). */
  coarse: boolean;
  /** The browser says it's a phone or tablet (user agent). "Desktop site" hides this, so it's only a hint. */
  mobileAgent: boolean;
}

/** Pages this narrow always get the phone layout (any device). */
export const PHONE_MAX_WIDTH = 760;
/** A touch screen whose short side is this small or smaller is a phone (tablets start around 744). */
export const PHONE_MAX_SHORT_SIDE = 600;

export function chooseLayout(f: ScreenFacts, choice: LayoutChoice = "auto"): { layout: Layout; why: string } {
  if (choice === "phone") return { layout: "phone", why: "Settings: Layout is set to Phone" };
  if (choice === "desktop") return { layout: "desktop", why: "Settings: Layout is set to Desktop" };
  if (f.innerWidth > 0 && f.innerWidth <= PHONE_MAX_WIDTH) return { layout: "phone", why: `the page is ${f.innerWidth}px wide (phone up to ${PHONE_MAX_WIDTH})` };
  const touch = f.coarse || f.mobileAgent;
  const screenShort = Math.min(f.screenWidth, f.screenHeight);
  if (touch && screenShort > 0 && screenShort <= PHONE_MAX_SHORT_SIDE)
    return { layout: "phone", why: `a touch screen ${screenShort}px across (phone up to ${PHONE_MAX_SHORT_SIDE}), even though the page reports ${f.innerWidth}px` };
  // Some phones report screen size in device pixels: the page's own short side catches those (installed app, sideways).
  const pageShort = Math.min(f.innerWidth, f.innerHeight);
  if (touch && f.standalone && pageShort > 0 && pageShort <= PHONE_MAX_SHORT_SIDE)
    return { layout: "phone", why: `the installed app on a touch screen with a short side of ${pageShort}px` };
  return { layout: "desktop", why: touch ? `a touch screen ${screenShort}px across: tablet-sized, so desktop` : "a mouse and a wide window" };
}

/** Phones and tablets say so in their user agent (unless "Desktop site" is on). */
export const isMobileAgent = (ua: string) => /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini/i.test(ua);

/** "Much wider than the screen": the page is this many times the screen's width (Desktop site draws ~980px on ~400px). */
export const DESKTOP_SITE_RATIO = 1.5;

/**
 * Is Chrome's "Desktop site" setting on? A phone-sized touch screen drawing a page much wider than the screen
 * itself. Then the whole game is drawn for a wide page and shrunk to fit, so everything looks small: the game shows a
 * one-line tip on how to turn it off (it doesn't try to rescale itself). Returns how many times too wide, or 0.
 */
export function desktopSiteZoom(f: ScreenFacts): number {
  const touch = f.coarse || f.mobileAgent;
  const short = Math.min(f.screenWidth, f.screenHeight);
  if (!touch || short <= 0 || short > PHONE_MAX_SHORT_SIDE || f.innerWidth <= 0) return 0;
  // The screen's width along the page's width: its short side upright, its long side held sideways.
  const along = f.innerWidth > f.innerHeight ? Math.max(f.screenWidth, f.screenHeight) : short;
  const ratio = f.innerWidth / along;
  return ratio > DESKTOP_SITE_RATIO ? ratio : 0;
}
