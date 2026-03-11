import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type TutorialIndustry =
  | "defense-manufacturing"
  | "space-satellite"
  | "hardware-ai"
  | "ai-software";

interface AppState {
  mode: "live" | "tutorial";
  tutorialStep: number | null;
  tutorialIndustry: TutorialIndustry | null;
  enterTutorial: () => void;
  exitTutorial: () => void;
  setTutorialStep: (step: number | null) => void;
  setTutorialIndustry: (industry: TutorialIndustry) => void;
}

const cookieStorage = {
  getItem: (name: string): string | null => {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return match ? decodeURIComponent(match[2]) : null;
  },
  setItem: (name: string, value: string): void => {
    document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=86400;SameSite=Lax`;
  },
  removeItem: (name: string): void => {
    document.cookie = `${name}=;path=/;max-age=0`;
  },
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      mode: "live",
      tutorialStep: null,
      tutorialIndustry: null,
      enterTutorial: () => set({ mode: "tutorial", tutorialStep: 1 }),
      exitTutorial: () => set({ mode: "live", tutorialStep: null, tutorialIndustry: null }),
      setTutorialStep: (step) => set({ tutorialStep: step }),
      setTutorialIndustry: (industry) => set({ tutorialIndustry: industry }),
    }),
    {
      name: "aci-tutorial",
      storage: createJSONStorage(() => cookieStorage),
      partialize: (state) => ({ tutorialIndustry: state.tutorialIndustry }),
    }
  )
);
