import { useTranslation } from 'react-i18next';
import { useSettingsHistoryStore, generateHistoryDescription } from '@/store/settingsHistoryStore';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Trash2, Clock } from 'lucide-react';

/**
 * Format timestamp as relative time (e.g., "2 minutes ago")
 */
function formatRelativeTime(timestamp: string, language: string): string {
  try {
    let date: Date;
    
    // Handle both string timestamps and timestamps_ms numbers
    if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'string') {
      // Try to parse ISO string or numeric timestamp
      const numTime = parseInt(timestamp, 10);
      if (!isNaN(numTime) && numTime > 1000000000) {
        // Likely a millisecond timestamp
        date = new Date(numTime);
      } else {
        // Try ISO string format
        date = new Date(timestamp);
      }
    } else {
      date = new Date();
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return language === 'tr' ? 'Bilinmeyen tarih' : 'Unknown date';
    }
    
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 0) return language === 'tr' ? 'Şimdi' : 'Now';
    if (seconds < 60) return language === 'tr' ? 'Az önce' : 'Just now';
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      return language === 'tr' ? `${mins} dakika önce` : `${mins} minute${mins > 1 ? 's' : ''} ago`;
    }
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return language === 'tr' ? `${hours} saat önce` : `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    if (seconds < 604800) {
      const days = Math.floor(seconds / 86400);
      return language === 'tr' ? `${days} gün önce` : `${days} day${days > 1 ? 's' : ''} ago`;
    }

    return date.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US');
  } catch (e) {
    console.error('Error formatting date:', timestamp, e);
    return language === 'tr' ? 'Bilinmeyen tarih' : 'Unknown date';
  }
}

/**
 * Settings History Component
 * Displays a timeline of all settings changes made by the user
 */
export function SettingsHistory() {
  const { t, i18n } = useTranslation();
  const history = useSettingsHistoryStore((state) => state.getRecentHistory(50));
  const clearHistory = useSettingsHistoryStore((state) => state.clearHistory);

  const handleClearHistory = () => {
    if (window.confirm(t('settings.clearHistoryConfirm', { defaultValue: 'Clear all history?' }))) {
      clearHistory();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5" aria-hidden="true" />
          <h3 className="text-lg font-semibold">{t('settings.operationHistory', { defaultValue: 'Operation History' })}</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearHistory}
          disabled={history.length === 0}
          aria-label={t('common.delete', { defaultValue: 'Delete' })}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {t('settings.clearHistory', { defaultValue: 'Clear' })}
        </Button>
      </div>

      <Separator />

      {history.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">
          {t('settings.noHistory', { defaultValue: 'No changes recorded yet' })}
        </p>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="p-3 border border-border rounded-lg bg-surface-bg hover:bg-surface-raised transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{entry.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatRelativeTime(entry.timestamp_ms as any, i18n.language)}
                  </p>
                </div>
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded whitespace-nowrap">
                  {entry.setting}
                </code>
              </div>
              {/* Show value change for non-boolean settings */}
              {typeof entry.old_value !== 'boolean' && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="line-through">{String(entry.old_value)}</span>
                  <span className="mx-1">→</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{String(entry.new_value)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <p className="text-xs text-gray-500 text-center py-2">
          {t('settings.showingLastN', {
            defaultValue: `Showing last ${history.length} changes`,
            count: history.length,
          })}
        </p>
      )}
    </div>
  );
}
