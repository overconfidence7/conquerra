import { useEffect, useState } from "react";
import { create } from "zustand";
import { chooseLayout, isMobileAgent, type Layout, type LayoutChoice, type ScreenFacts } from "../logic/layout";

const KEY = "conquerra.layout";

const readChoice = (): LayoutChoice => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "phone" || v === "desktop" ? v : "auto";
  } catch {
    return "auto";
  }
};

/** Settings → Layout: Auto, Phone or Desktop, remembered on this device. */
export const useLayoutChoice = create<{ choice: LayoutChoice; set(c: LayoutChoice): void }>((set) => ({
  choice: readChoice(),
  set(choice) {
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      // Private browsing: the choice lasts until the page closes.
    }
    set({ choice });
  },
}));

const media = (q: string) => typeof window.matchMedia === "function" && window.matchMedia(q).matches;

export function readScreenFacts(): ScreenFacts {
  const nav = navigator as Navigator & { standalone?: boolean; userAgentData?: { mobile?: boolean } };
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    screenWidth: window.screen?.width ?? 0,
    screenHeight: window.screen?.height ?? 0,
    devicePixelRatio: window.devicePixelRatio || 1,
    standalone: media("(display-mode: standalone)") || media("(display-mode: fullscreen)") || nav.standalone === true,
    coarse: media("(pointer: coarse)"),
    mobileAgent: nav.userAgentData?.mobile === true || isMobileAgent(navigator.userAgent),
  };
}

/** The screen facts, kept up to date as the window resizes or the phone turns. */
export function useScreenFacts(): ScreenFacts {
  const [facts, setFacts] = useState(readScreenFacts);
  useEffect(() => {
    const update = () => setFacts(readScreenFacts());
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    const queries = ["(display-mode: standalone)", "(pointer: coarse)"].map((q) => window.matchMedia?.(q)).filter(Boolean) as MediaQueryList[];
    for (const m of queries) m.addEventListener("change", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      for (const m of queries) m.removeEventListener("change", update);
    };
  }, []);
  return facts;
}

/** Phone or desktop layout, from the screen and the Settings choice. */
export function useLayout(): { layout: Layout; why: string; facts: ScreenFacts; choice: LayoutChoice } {
  const facts = useScreenFacts();
  const choice = useLayoutChoice((s) => s.choice);
  return { ...chooseLayout(facts, choice), facts, choice };
}
