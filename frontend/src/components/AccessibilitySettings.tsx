import { useTranslation } from 'react-i18next';
import { useA11yStore } from '@/store/a11yStore';
import { useSettingsHistoryStore, generateHistoryDescription } from '@/store/settingsHistoryStore';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SettingsHistory } from '@/components/SettingsHistory';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function AccessibilitySettings() {
  const { t } = useTranslation();
  const preferences = useA11yStore((state) => state.preferences);
  const setFontSize = useA11yStore((state) => state.setFontSize);
  const setLineHeight = useA11yStore((state) => state.setLineHeight);
  const setLetterSpacing = useA11yStore((state) => state.setLetterSpacing);
  const setHighContrast = useA11yStore((state) => state.setHighContrast);
  const setReducedMotion = useA11yStore((state) => state.setReducedMotion);
  const resetToDefaults = useA11yStore((state) => state.resetToDefaults);
  const addHistoryEntry = useSettingsHistoryStore((state) => state.addEntry);

  // Wrapper functions to track history
  const handleFontSizeChange = (value: string) => {
    const newSize = Number(value) as 80 | 100 | 125 | 150;
    addHistoryEntry({
      setting: 'fontSize',
      old_value: preferences.fontSize,
      new_value: newSize,
      description: generateHistoryDescription('fontSize', preferences.fontSize, newSize, t),
    });
    setFontSize(newSize);
  };

  const handleLineHeightChange = (value: string) => {
    const newHeight = Number(value) as 1.5 | 1.75 | 2.0;
    addHistoryEntry({
      setting: 'lineHeight',
      old_value: preferences.lineHeight,
      new_value: newHeight,
      description: generateHistoryDescription('lineHeight', preferences.lineHeight, newHeight, t),
    });
    setLineHeight(newHeight);
  };

  const handleLetterSpacingChange = (value: string) => {
    const newSpacing = value as 'normal' | 'wide' | 'wider';
    addHistoryEntry({
      setting: 'letterSpacing',
      old_value: preferences.letterSpacing,
      new_value: newSpacing,
      description: generateHistoryDescription('letterSpacing', preferences.letterSpacing, newSpacing, t),
    });
    setLetterSpacing(newSpacing);
  };

  const handleHighContrastChange = (checked: boolean) => {
    addHistoryEntry({
      setting: 'highContrast',
      old_value: preferences.highContrast,
      new_value: checked,
      description: generateHistoryDescription('highContrast', preferences.highContrast, checked, t),
    });
    setHighContrast(checked);
  };

  const handleReducedMotionChange = (checked: boolean) => {
    addHistoryEntry({
      setting: 'reducedMotion',
      old_value: preferences.reducedMotion,
      new_value: checked,
      description: generateHistoryDescription('reducedMotion', preferences.reducedMotion, checked, t),
    });
    setReducedMotion(checked);
  };

  return (
    <Tabs defaultValue="preferences" className="w-full">
      <TabsList className="grid w-full grid-cols-2" aria-label={t('settings.tabs', { defaultValue: 'Settings tabs' })}>
        <TabsTrigger value="preferences">{t('settings.preferences', { defaultValue: 'Preferences' })}</TabsTrigger>
        <TabsTrigger value="history">{t('settings.history', { defaultValue: 'History' })}</TabsTrigger>
      </TabsList>

      <TabsContent value="preferences" className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">{t('settings.preferences')}</h3>
          <Separator className="mb-4" />
        </div>

        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Font Size */}
        <div className="flex items-center justify-between py-3 px-4 border-b border-border">
          <Label htmlFor="font-size-select" className="text-sm font-medium">
            {t('settings.fontSize')}
          </Label>
          <Select
            value={String(preferences.fontSize)}
            onValueChange={handleFontSizeChange}
          >
            <SelectTrigger id="font-size-select" className="w-32" aria-label={t('settings.fontSize')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="80">80%</SelectItem>
              <SelectItem value="100">100%</SelectItem>
              <SelectItem value="125">125%</SelectItem>
              <SelectItem value="150">150%</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Line Height */}
        <div className="flex items-center justify-between py-3 px-4 border-b border-border">
          <Label htmlFor="line-height-select" className="text-sm font-medium">
            {t('settings.lineHeight')}
          </Label>
          <Select
            value={String(preferences.lineHeight)}
            onValueChange={handleLineHeightChange}
          >
            <SelectTrigger id="line-height-select" className="w-32" aria-label={t('settings.lineHeight')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1.5">1.5</SelectItem>
              <SelectItem value="1.75">1.75</SelectItem>
              <SelectItem value="2">2.0</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Letter Spacing */}
        <div className="flex items-center justify-between py-3 px-4 border-b border-border">
          <Label htmlFor="letter-spacing-select" className="text-sm font-medium">
            {t('settings.letterSpacing')}
          </Label>
          <Select
            value={preferences.letterSpacing}
            onValueChange={handleLetterSpacingChange}
          >
            <SelectTrigger id="letter-spacing-select" className="w-32" aria-label={t('settings.letterSpacing')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">{t('accessibility.normal')}</SelectItem>
              <SelectItem value="wide">{t('accessibility.wide')}</SelectItem>
              <SelectItem value="wider">{t('accessibility.wider')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* High Contrast */}
        <div className="flex items-center justify-between py-3 px-4 border-b border-border">
          <Label className="text-sm font-medium">{t('settings.highContrast')}</Label>
          <Switch
            checked={preferences.highContrast}
            onCheckedChange={handleHighContrastChange}
            aria-label={t('settings.highContrast')}
          />
        </div>

        {/* Reduced Motion */}
        <div className="flex items-center justify-between py-3 px-4 border-b border-border">
          <Label className="text-sm font-medium">{t('settings.reducedMotion')}</Label>
          <Switch
            checked={preferences.reducedMotion}
            onCheckedChange={handleReducedMotionChange}
            aria-label={t('settings.reducedMotion')}
          />
        </div>

        {/* Reset Button */}
        <div className="flex justify-end pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={resetToDefaults}
            aria-label={t('common.refresh')}
          >
            {t('accessibility.resetFontSize')}
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="history" className="py-4">
        <SettingsHistory />
      </TabsContent>
    </Tabs>
  );
}
