import { describe, expect, it } from "vitest";
import { chooseLayout, isMobileAgent, type ScreenFacts } from "../src/logic/layout";

/** A Pixel-class Android phone (412 × 915 CSS px), upright, in a Chrome tab. */
const phone: ScreenFacts = { innerWidth: 412, innerHeight: 839, screenWidth: 412, screenHeight: 915, devicePixelRatio: 2.625, standalone: false, coarse: true, mobileAgent: true };
const laptop: ScreenFacts = { innerWidth: 1440, innerHeight: 821, screenWidth: 1440, screenHeight: 900, devicePixelRatio: 2, standalone: false, coarse: false, mobileAgent: false };
const pick = (f: Partial<ScreenFacts>, base = phone) => chooseLayout({ ...base, ...f }).layout;

describe("phone or desktop layout", () => {
  it("a phone gets the phone layout; a laptop gets the desktop one", () => {
    expect(pick({})).toBe("phone");
    expect(pick({}, laptop)).toBe("desktop");
  });
  it("a phone still gets the phone layout when Chrome's 'Desktop site' fakes a wide page and hides 'Mobile'", () => {
    expect(pick({ innerWidth: 980, innerHeight: 2000, mobileAgent: false })).toBe("phone");
  });
  it("a phone held sideways (wider than 760) keeps the phone layout", () => {
    expect(pick({ innerWidth: 915, innerHeight: 380, screenWidth: 915, screenHeight: 412 })).toBe("phone");
  });
  it("the installed app keeps the phone layout even if the phone reports its screen in device pixels", () => {
    expect(pick({ standalone: true, innerWidth: 915, innerHeight: 412, screenWidth: 2400, screenHeight: 1080 })).toBe("phone");
  });
  it("a narrow desktop window gets the phone layout; a tablet gets the desktop one", () => {
    expect(pick({ innerWidth: 700 }, laptop)).toBe("phone");
    expect(pick({ innerWidth: 1024, innerHeight: 768, screenWidth: 1024, screenHeight: 768 })).toBe("desktop");
    expect(pick({ innerWidth: 820, innerHeight: 1180, screenWidth: 820, screenHeight: 1180, standalone: true })).toBe("desktop");
  });
  it("a touch-screen laptop with a big screen stays on desktop", () => {
    expect(pick({ coarse: true }, laptop)).toBe("desktop");
  });
  it("Settings → Layout overrides the guess either way", () => {
    expect(chooseLayout(laptop, "phone").layout).toBe("phone");
    expect(chooseLayout(phone, "desktop").layout).toBe("desktop");
    expect(chooseLayout(phone, "auto").why).toMatch(/412px wide/);
  });
  it("recognises phone user agents", () => {
    expect(isMobileAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36")).toBe(true);
    expect(isMobileAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36")).toBe(false);
  });
});
