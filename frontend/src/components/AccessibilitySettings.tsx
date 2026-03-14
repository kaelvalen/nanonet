import { useTranslation } from 'react-i18next';
import { useA11yStore } from '@/store/a11yStore';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
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

export function AccessibilitySettings() {
  const { t } = useTranslation();
  const preferences = useA11yStore((state) => state.preferences);
  const setFontSize = useA11yStore((state) => state.setFontSize);
  const setLineHeight = useA11yStore((state) => state.setLineHeight);
  const setLetterSpacing = useA11yStore((state) => state.setLetterSpacing);
  const setHighContrast = useA11yStore((state) => state.setHighContrast);
  const setReducedMotion = useA11yStore((state) => state.setReducedMotion);
  const resetToDefaults = useA11yStore((state) => state.resetToDefaults);

  return (
    <div className="space-y-6">
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
          onValueChange={(value) => setFontSize(Number(value) as 80 | 100 | 125 | 150)}
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
          onValueChange={(value) => setLineHeight(Number(value) as 1.5 | 1.75 | 2.0)}
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
          onValueChange={(value) => setLetterSpacing(value as 'normal' | 'wide' | 'wider')}
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
          onCheckedChange={setHighContrast}
          aria-label={t('settings.highContrast')}
        />
      </div>

      {/* Reduced Motion */}
      <div className="flex items-center justify-between py-3 px-4 border-b border-border">
        <Label className="text-sm font-medium">{t('settings.reducedMotion')}</Label>
        <Switch
          checked={preferences.reducedMotion}
          onCheckedChange={setReducedMotion}
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
    </div>
  );
}
