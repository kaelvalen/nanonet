import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { A11yPreferences } from './a11yStore';

export interface SettingsHistoryEntry {
  id: string;
  timestamp: string;
  timestamp_ms: number;
  setting: keyof A11yPreferences;
  old_value: any;
  new_value: any;
  description: string;
}

interface SettingsHistoryStore {
  history: SettingsHistoryEntry[];
  addEntry: (entry: Omit<SettingsHistoryEntry, 'id' | 'timestamp' | 'timestamp_ms'>) => void;
  clearHistory: () => void;
  getHistory: () => SettingsHistoryEntry[];
  getRecentHistory: (limit?: number) => SettingsHistoryEntry[];
}

export const useSettingsHistoryStore = create<SettingsHistoryStore>()(
  persist(
    (set, get) => ({
      history: [],

      addEntry: (entry) => {
        const now = new Date();
        const id = `history-${now.getTime()}-${Math.random()}`;
        
        const newEntry: SettingsHistoryEntry = {
          ...entry,
          id,
          timestamp: now.toISOString(),
          timestamp_ms: now.getTime(),
        };

        set((state) => {
          const updatedHistory = [newEntry, ...state.history];
          // Keep only last 100 entries to avoid storage bloat
          return {
            history: updatedHistory.slice(0, 100),
          };
        });
      },

      clearHistory: () => {
        set({ history: [] });
      },

      getHistory: () => {
        return get().history;
      },

      getRecentHistory: (limit = 20) => {
        return get().history.slice(0, limit);
      },
    }),
    {
      name: 'nanonet-settings-history',
      version: 1,
    },
  ),
);

/**
 * Generate human-readable descriptions for settings changes
 */
export function generateHistoryDescription(
  setting: keyof A11yPreferences,
  oldValue: any,
  newValue: any,
  t?: (key: string) => string,
): string {
  switch (setting) {
    case 'language':
      return `Language changed from ${oldValue} to ${newValue}`;
    case 'fontSize':
      return `Font size changed from ${oldValue}% to ${newValue}%`;
    case 'lineHeight':
      return `Line height changed from ${oldValue} to ${newValue}`;
    case 'letterSpacing':
      return `Letter spacing changed from ${oldValue} to ${newValue}`;
    case 'highContrast':
      return newValue ? 'High contrast mode enabled' : 'High contrast mode disabled';
    case 'reducedMotion':
      return newValue ? 'Reduced motion enabled' : 'Reduced motion disabled';
    default:
      return `${setting} changed`;
  }
}
