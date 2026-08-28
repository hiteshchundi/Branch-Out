/**
 * Original Branch-Out identity: one grounded path branches into three nodes,
 * representing the product's three evidence-based trust signals.
 */
export function BrandLogo() {
  return (
    <span aria-hidden="true" className="brand-logo">
      <svg className="brand-mark" data-brand-mark viewBox="0 0 48 48">
        <path className="brand-mark-stem" d="M8 39c0-8 4.2-13.4 11.3-16.2" />
        <path className="brand-mark-branches" d="M19.3 22.8C24 20.6 27.5 15.9 29 9M19.3 22.8c6.1.1 11.1-1.8 15.4-5.8M19.3 22.8c5.1 2.4 9 6.7 11.6 12.4" />
        <circle className="brand-mark-root" cx="8" cy="39" r="3.2" />
        <circle cx="29.5" cy="7.5" r="4.2" />
        <circle cx="36.5" cy="16.5" r="4.2" />
        <circle cx="31.8" cy="37" r="4.2" />
      </svg>
      <span className="brand-name">Branch<span>Out</span></span>
    </span>
  );
}
