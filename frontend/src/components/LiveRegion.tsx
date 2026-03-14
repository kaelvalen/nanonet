import { useEffect, useRef } from 'react';

interface LiveRegionProps {
  message: string | null;
  type?: 'polite' | 'assertive';
  className?: string;
}

/**
 * Live Region component for screen reader announcements
 * Use this for dynamic content updates that should be announced to screen reader users
 * 
 * @param message - The message to announce (null to clear)
 * @param type - 'polite' (default) waits for pause, 'assertive' interrupts
 * @param className - Additional CSS classes
 */
export function LiveRegion({ message, type = 'polite', className = '' }: LiveRegionProps) {
  const regionRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (message && regionRef.current) {
      // Set the message
      regionRef.current.textContent = message;

      // Clear after a delay to allow screen readers to pick up the next message
      timeoutRef.current = setTimeout(() => {
        if (regionRef.current) {
          regionRef.current.textContent = '';
        }
      }, 5000); // Clear after 5 seconds
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [message]);

  return (
    <div
      ref={regionRef}
      role="status"
      aria-live={type}
      aria-atomic="true"
      className={`sr-only ${className}`}
    />
  );
}

/**
 * Hook to manage live region announcements
 * Usage: const { announce } = useLiveRegion();
 *        announce("Item deleted successfully");
 */
export function useLiveRegion() {
  const messageRef = useRef<string | null>(null);

  const announce = (message: string) => {
    messageRef.current = message;
    // Trigger a re-render by updating the ref
    messageRef.current = message;
  };

  return { announce, message: messageRef.current };
}
