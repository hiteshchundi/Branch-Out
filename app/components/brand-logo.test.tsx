import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandLogo } from './brand-logo';

describe('BrandLogo', () => {
  it('renders the original branching vector mark and product name', () => {
    const { container } = render(<BrandLogo />);
    const mark = container.querySelector('[data-brand-mark]');

    expect(mark).toBeInTheDocument();
    expect(mark?.querySelectorAll('path')).toHaveLength(2);
    expect(mark?.querySelectorAll('circle')).toHaveLength(4);
    expect(container).toHaveTextContent('BranchOut');
  });

  it('keeps decorative geometry hidden from assistive technology', () => {
    const { container } = render(<BrandLogo />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
