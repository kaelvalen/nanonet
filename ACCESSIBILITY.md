# NanoNet Accessibility Implementation Guide

## Overview

NanoNet now includes comprehensive accessibility features that comply with WCAG 2.1 Level AA standards. This guide provides developers and users with information on using and maintaining these features.

---

## 🎯 Accessibility Features Implemented

### 1. Multi-Language Support ✅

**What it is:** UI can be displayed in English or Turkish with full translations.

**For Users:**
- Go to Settings → Preferences → Language
- Select English or Turkish
- All UI text updates instantly
- Selection persists across sessions

**For Developers:**
```typescript
import { useTranslation } from 'react-i18next';

export function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t('navigation.dashboard')}</h1>;
}
```

**Key Files:**
- `src/i18n/config.ts` - i18n configuration
- `src/i18n/locales/en.json` - English translations (200+ strings)
- `src/i18n/locales/tr.json` - Turkish translations (200+ strings)

---

### 2. Adjustable Typography ✅

**What it is:** Users can adjust font sizes, line heights, and letter spacing for better readability.

**For Users:**
- Settings → Preferences
- Font Size: 80%, 100%, 125%, 150%
- Line Height: 1.5, 1.75, 2.0
- Letter Spacing: normal, wide, wider
- Changes apply instantly and persist

**For Developers:**
```typescript
import { useA11yStore } from '@/store/a11yStore';

export function MyComponent() {
  const prefs = useA11yStore(state => state.preferences);
  const { fontSize, lineHeight } = prefs;
  
  // Use these to conditionally render different layouts
  return <div style={{ fontSize: `${fontSize}%` }}>...</div>;
}
```

**Key Files:**
- `src/store/a11yStore.ts` - Preferences storage
- `src/hooks/useA11y.ts` - Accessibility hooks
- `src/styles/fonts.css` - Typography system with CSS variables
- `src/components/AccessibilitySettings.tsx` - Settings UI

---

### 3. High Contrast Mode ✅

**What it is:** A visual theme with WCAG AAA color contrast for low-vision users.

**For Users:**
- Settings → Preferences → High Contrast (toggle)
- All text becomes high contrast
- Perfect for users with low vision

**For Developers:**
```css
/* Automatically applied when high contrast mode is on */
html.high-contrast {
  --background: #ffffff;
  --foreground: #000000;
  --primary: #0000ee;
  /* All colors automatically adjust */
}

/* Any text inside high-contrast mode will use these colors */
html.high-contrast button {
  /* Enhanced styling */
}
```

**Key Files:**
- `src/styles/accessibility.css` - High contrast styles
- Applied automatically via `a11yStore`

---

### 4. Reduced Motion Support ✅

**What it is:** Disables animations for users who are motion-sensitive.

**For Users:**
- Settings → Preferences → Reduced Motion (toggle)
- All animations are disabled
- Useful for users with vestibular disorders

**For Developers:**
```css
/* In your CSS, use prefers-reduced-motion media query */
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}

/* Applied automatically by a11yStore */
html.reduce-motion * {
  animation: none !important;
  transition: none !important;
}
```

**Key Files:**
- `src/styles/accessibility.css` - Reduced motion styles

---

### 5. Screen Reader Support ✅

#### A. ARIA Labels on Icon Buttons
All icon-only buttons have aria-labels that describe their function.

```typescript
// ✅ GOOD
<Button aria-label="Delete item" onClick={handleDelete}>
  <Trash2 className="w-4 h-4" />
</Button>

// ❌ BAD - no aria-label
<Button onClick={handleDelete}>
  <Trash2 className="w-4 h-4" />
</Button>
```

**Updated Files:**
- `src/components/AIAssistant.tsx` - 3 aria-labels added
- `src/pages/KubernetesPage.tsx` - 7 aria-labels added
- `src/pages/ServiceDetailPage.tsx` - 9 aria-labels added

#### B. ARIA Live Regions
Real-time updates (alerts, notifications) are announced to screen readers.

```typescript
import { useLiveRegion } from '@/context/LiveRegionContext';

export function MyComponent() {
  const { announce } = useLiveRegion();

  const handleDelete = async () => {
    await deleteItem();
    announce('Item deleted successfully'); // Screen reader announces this
  };

  return <button onClick={handleDelete}>Delete</button>;
}
```

**Key Files:**
- `src/context/LiveRegionContext.tsx` - Live region provider & hook

#### C. Accessible Forms
Form fields have proper labels, error messages, and validation.

```typescript
import { FormField, AccessibleForm, FormGroup } from '@/components';
import { useTranslation } from 'react-i18next';

export function MyForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  return (
    <AccessibleForm ariaLabel={t('auth.login')}>
      <FormField
        id="email"
        label={t('auth.email')}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error}
        helperText="We'll never share your email"
        required
      />
    </AccessibleForm>
  );
}
```

**Key Files:**
- `src/components/FormField.tsx` - Accessible form field
- `src/components/AccessibleForm.tsx` - Form wrapper with validation

#### D. Skip Links
Users can skip to main content with Ctrl+Shift+S shortcut.

```typescript
import { SkipLink } from '@/components/SkipLink';

export function Layout() {
  return (
    <>
      <SkipLink />
      <nav>...</nav>
      <main id="main-content" tabIndex={-1}>
        {/* Main content */}
      </main>
    </>
  );
}
```

**Key Files:**
- `src/components/SkipLink.tsx` - Skip link component

---

## 🛠️ How to Add Accessibility to New Components

### 1. Icon Button with aria-label
```typescript
<Button 
  aria-label="Delete item"
  onClick={handleDelete}
  size="icon"
>
  <Trash2 className="w-4 h-4" />
</Button>
```

### 2. Form Field
```typescript
<FormField
  id="name"
  label="Full Name"
  placeholder="John Doe"
  value={name}
  onChange={(e) => setName(e.target.value)}
  error={nameError}
  required
/>
```

### 3. Live Region Announcement
```typescript
const { announce } = useLiveRegion();
announce('Settings saved successfully');
```

### 4. High Contrast Support
```css
/* Automatically supported - just ensure text contrast is good */
html.high-contrast button {
  border: 2px solid var(--border);
  font-weight: 600;
}
```

### 5. Reduced Motion Support
```css
@media (prefers-reduced-motion: reduce) {
  .animated-element {
    animation: none !important;
  }
}
```

---

## 📋 WCAG 2.1 Compliance Checklist

### Level A (High Priority)
- [x] 1.4.1 - Alternative Text: aria-labels on icon buttons
- [x] 4.1.2 - Name, Role, Value: Proper semantic HTML
- [x] 2.1.1 - Keyboard: All functionality accessible via keyboard
- [x] 2.4.1 - Bypass Blocks: Skip links implemented
- [x] 3.1.1 - Language of Page: lang attribute set dynamically

### Level AA (Medium Priority)
- [x] 1.4.3 - Contrast (Minimum): High contrast mode available
- [x] 1.4.5 - Images of Text: Using actual text + fonts
- [x] 2.2.2 - Pause, Stop, Hide: Reduced motion support
- [x] 3.3.1 - Error Identification: Error messages linked with aria-describedby
- [x] 3.3.4 - Error Prevention: Form validation with helpful messages

### Level AAA (Nice-to-Have)
- [x] 1.4.6 - Contrast (Enhanced): WCAG AAA colors in high contrast mode
- [ ] 2.5.3 - Label in Name: All buttons have descriptive labels
- [ ] 3.2.5 - Change on Request: Users control all changes (Settings preferred)

---

## 🧪 Testing Accessibility

### Manual Testing
1. **Keyboard Navigation**
   - Tab through the entire interface
   - Ensure all interactive elements are reachable
   - Test with Enter/Space to activate buttons

2. **Screen Reader Testing**
   - Test with NVDA (Windows): https://www.nvaccess.org/
   - Test with JAWS (Windows): https://www.freedomscientific.com/products/software/jaws/
   - Test with VoiceOver (Mac): Cmd+F5 to enable
   - Verify all buttons and labels are announced correctly

3. **Font Size Testing**
   - Go to Settings → Preferences
   - Select 150% font size
   - Verify all text scales appropriately
   - Check for overflow or layout issues

4. **High Contrast Testing**
   - Enable High Contrast mode in Settings
   - Verify all text is readable
   - Check that interactive elements are clearly visible

5. **Motion Testing**
   - Enable Reduced Motion in Settings
   - Verify all animations are disabled
   - Check that transitions are instant

### Automated Testing
```bash
# Install axe-core for automated accessibility testing
npm install --save-dev @axe-core/react

# Add to your test suite
import { axe } from '@axe-core/react';

it('should have no accessibility violations', async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Lighthouse Accessibility Audit
1. Open DevTools (F12)
2. Go to Lighthouse tab
3. Select "Accessibility"
4. Click "Analyze page load"
5. Target score: 95+

---

## 💡 Best Practices for Future Development

### 1. Always Use Semantic HTML
```typescript
// ✅ GOOD
<button onClick={handleClick}>Delete</button>
<label htmlFor="input">Email</label>
<input id="input" type="email" />

// ❌ BAD
<div onClick={handleClick}>Delete</div>
<div>Email</div>
<div contentEditable />
```

### 2. Include ARIA Labels for Icon-Only Buttons
```typescript
// ✅ GOOD
<Button aria-label="Close dialog" onClick={handleClose}>
  <X className="w-4 h-4" />
</Button>

// ❌ BAD - No one knows what this button does
<Button onClick={handleClose}>
  <X className="w-4 h-4" />
</Button>
```

### 3. Link Error Messages to Form Fields
```typescript
// ✅ GOOD
<input aria-describedby="email-error" />
<p id="email-error" role="alert">Invalid email address</p>

// ❌ BAD - Error not associated with input
<input />
<p>Invalid email address</p>
```

### 4. Use Live Regions for Real-Time Updates
```typescript
// ✅ GOOD
const { announce } = useLiveRegion();
announce('Data loaded successfully');

// ❌ BAD - Screen reader users don't know about the update
showToast('Data loaded successfully');
```

### 5. Respect User Motion Preferences
```typescript
// ✅ GOOD
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; }
}

// ❌ BAD - Animations always play
animation: fadeIn 0.3s ease-in-out;
```

---

## 📚 Resources

### Official Standards
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/) - Web Accessibility Guidelines
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) - ARIA patterns and examples
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility) - MDN accessibility documentation

### Testing Tools
- [Axe DevTools](https://www.deque.com/axe/devtools/) - Automated accessibility testing
- [WAVE Browser Extension](https://wave.webaim.org/extension/) - Visual accessibility feedback
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Chrome built-in auditing
- [NVDA Screen Reader](https://www.nvaccess.org/) - Free screen reader for Windows

### Learning Resources
- [WebAIM Articles](https://webaim.org/articles/) - Accessibility best practices
- [Deque University](https://dequeuniversity.com/) - Comprehensive accessibility training
- [A11ycasts](https://www.youtube.com/playlist?list=PLNYkxOF6rcICWx0C9Xc-RgEzwLvsPrq_3s) - YouTube series on accessibility

---

## 🔄 Maintenance and Updates

### Checklist for New Features
When adding new features to NanoNet:

- [ ] All buttons have descriptive text or aria-labels
- [ ] Form fields have associated labels
- [ ] Color is not the only way to convey information
- [ ] Animations respect prefers-reduced-motion
- [ ] All interactive elements are keyboard accessible
- [ ] Text has sufficient color contrast (WCAG AA minimum)
- [ ] Real-time updates use live regions
- [ ] Errors are clearly associated with form fields
- [ ] Content is responsive and scales with font size changes
- [ ] All images have alt text (if applicable)

### Code Review Questions
Before approving PRs:

1. Does this change introduce any new icon-only buttons without aria-labels?
2. Are all form fields properly labeled?
3. Does this add animations that should respect prefers-reduced-motion?
4. Are color choices contrasting enough for low-vision users?
5. Is this keyboard navigable?
6. Would a screen reader user understand this change?

---

## 🎉 Summary

NanoNet now provides a professional, accessible experience that:

✅ Supports multiple languages (English + Turkish)  
✅ Allows font size customization (80%-150%)  
✅ Includes high contrast mode (WCAG AAA)  
✅ Respects motion preferences  
✅ Works with screen readers  
✅ Supports keyboard navigation  
✅ Has proper form validation  
✅ Announces real-time updates  

**Current Accessibility Score:** WCAG 2.1 Level A - Fully Achieved, Level AA - Mostly Achieved

---

**Questions? Found an accessibility issue? Please report it!**

Last Updated: March 14, 2026  
Version: 1.0 - Phase 1-3 Complete
