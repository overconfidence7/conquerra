import { describe, expect, it } from "vitest";
import { INSTALL_TEXT, installForm, isIos } from "../src/logic/install";
import { problems } from "../../../packages/content/test/voiceScan";

/** Session 35: the lobby's Install line (a button on Android, Safari's steps on an iPhone, nothing when installed). */
const phone = { standalone: false, dismissed: false, prompt: false, ios: false, touch: true };

describe("the Install line (session 35)", () => {
  it("its three states: Chrome's prompt on offer, an iPhone, nothing", () => {
    expect(installForm({ ...phone, prompt: true })).toBe("prompt");
    expect(installForm({ ...phone, ios: true })).toBe("ios");
    // An Android phone before Chrome offers the prompt (or a browser that never does): nothing to press, so nothing.
    expect(installForm(phone)).toBe("none");
  });

  it("never once the game runs installed, once dismissed on this device, or on a desktop", () => {
    for (const extra of [{ standalone: true }, { dismissed: true }, { touch: false }]) {
      expect(installForm({ ...phone, prompt: true, ...extra })).toBe("none");
      expect(installForm({ ...phone, ios: true, ...extra })).toBe("none");
    }
  });

  it("knows an iPhone and an iPad (which says it's a Mac but has a touch screen)", () => {
    expect(isIos("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15", 5)).toBe(true);
    expect(isIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", 5)).toBe(true);
    expect(isIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", 0)).toBe(false);
    expect(isIos("Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/141.0", 5)).toBe(false);
  });

  it("its words are in the voice: the line the brief gave, Safari's two steps by their own names", () => {
    expect(INSTALL_TEXT.line).toBe("Install Conquerra: it opens like an app.");
    expect(INSTALL_TEXT.ios).toBe("In Safari, tap Share, then Add to Home Screen.");
    for (const text of Object.values(INSTALL_TEXT)) expect(problems({ file: "install.ts", text, speaker: false })).toEqual([]);
  });
});
