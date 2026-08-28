import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useAccessibleDialog } from './use-accessible-dialog';

function DialogHarness({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useAccessibleDialog({ dialogRef, initialFocusRef: closeButtonRef, onClose });

  return (
    <section aria-label="Test dialog" ref={dialogRef} role="dialog">
      <button ref={closeButtonRef} type="button">Close</button>
      <button type="button">Last action</button>
    </section>
  );
}

describe('useAccessibleDialog', () => {
  it('moves focus into the dialog, locks scrolling, and restores page overflow', () => {
    document.body.style.overflow = 'auto';
    const { unmount } = render(<DialogHarness onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('wraps keyboard focus within the dialog in both directions', () => {
    render(<DialogHarness onClose={vi.fn()} />);
    const closeButton = screen.getByRole('button', { name: 'Close' });
    const lastButton = screen.getByRole('button', { name: 'Last action' });

    lastButton.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(lastButton).toHaveFocus();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
