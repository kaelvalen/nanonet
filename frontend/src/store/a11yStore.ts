import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface A11yPreferences {
  language: 'en' | 'tr';
  fontSize: 80 | 100 | 125 | 150;
  lineHeight: 1.5 | 1.75 | 2.0;
  letterSpacing: 'normal' | 'wide' | 'wider';
  highContrast: boolean;
  reducedMotion: boolean;
}

interface A11yStore {
  preferences: A11yPreferences;
  setLanguage: (lang: 'en' | 'tr') => void;
  setFontSize: (size: 80 | 100 | 125 | 150) => void;
  setLineHeight: (height: 1.5 | 1.75 | 2.0) => void;
  setLetterSpacing: (spacing: 'normal' | 'wide' | 'wider') => void;
  setHighContrast: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  resetToDefaults: () => void;
  applyPreferences: () => void;
}

const defaultPreferences: A11yPreferences = {
  language: 'en',
  fontSize: 100,
  lineHeight: 1.5,
  letterSpacing: 'normal',
  highContrast: false,
  reducedMotion: false,
};

const lineHeightValues = {
  1.5: 'line-height-1.5',
  1.75: 'line-height-1.75',
  2.0: 'line-height-2.0',
};

const letterSpacingValues = {
  normal: '0px',
  wide: '0.05em',
  wider: '0.1em',
};

export const useA11yStore = create<A11yStore>()(
  persist(
    (set, get) => ({
      preferences: defaultPreferences,

      setLanguage: (lang) => {
        set((state) => ({
          preferences: { ...state.preferences, language: lang },
        }));
        setTimeout(() => get().applyPreferences(), 0);
      },

      setFontSize: (size) => {
        set((state) => ({
          preferences: { ...state.preferences, fontSize: size },
        }));
        setTimeout(() => get().applyPreferences(), 0);
      },

      setLineHeight: (height) => {
        set((state) => ({
          preferences: { ...state.preferences, lineHeight: height },
        }));
        setTimeout(() => get().applyPreferences(), 0);
      },

      setLetterSpacing: (spacing) => {
        set((state) => ({
          preferences: { ...state.preferences, letterSpacing: spacing },
        }));
        setTimeout(() => get().applyPreferences(), 0);
      },

      setHighContrast: (enabled) => {
        set((state) => ({
          preferences: { ...state.preferences, highContrast: enabled },
        }));
        setTimeout(() => get().applyPreferences(), 0);
      },

      setReducedMotion: (enabled) => {
        set((state) => ({
          preferences: { ...state.preferences, reducedMotion: enabled },
        }));
        setTimeout(() => get().applyPreferences(), 0);
      },

      resetToDefaults: () => {
        set({ preferences: defaultPreferences });
        setTimeout(() => get().applyPreferences(), 0);
      },

      applyPreferences: () => {
        const prefs = get().preferences;
        const html = document.documentElement;

        // Apply font size
        const fontSizePercent = (prefs.fontSize / 100) * 100;
        html.style.fontSize = `${fontSizePercent}%`;

        // Apply line height
        html.style.setProperty('--line-height', String(prefs.lineHeight));

        // Apply letter spacing
        html.style.setProperty('--letter-spacing', letterSpacingValues[prefs.letterSpacing]);

        // Apply high contrast mode
        if (prefs.highContrast) {
          html.classList.add('high-contrast');
        } else {
          html.classList.remove('high-contrast');
        }

        // Apply reduced motion
        if (prefs.reducedMotion) {
          html.classList.add('reduce-motion');
        } else {
          html.classList.remove('reduce-motion');
        }

        // Update HTML lang attribute
        html.setAttribute('lang', prefs.language);

        // Store language in i18next
        localStorage.setItem('i18nextLng', prefs.language);
      },
    }),
    {
      name: 'nanonet-a11y-preferences',
      version: 1,
    },
  ),
);
