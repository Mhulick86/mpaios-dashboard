/**
 * Marketing Powered brand logo mark — stylized lightning-bolt arrow.
 * Blue (#2CACE8) outer arrow + black inner arrow, matching the brand.
 */
export function BrandLogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Blue outer arrow (top-right to bottom-left, then forward) */}
      <path
        d="M38 8L12 32L26 32L16 56L52 28L36 28L46 8H38Z"
        fill="#2CACE8"
        stroke="#2CACE8"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Black inner arrow (slightly offset, gives depth) */}
      <path
        d="M34 14L14 34L26 34L18 52L48 30L34 30L42 14H34Z"
        fill="#000000"
        stroke="#000000"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Blue highlight stroke on the forward-pointing edge */}
      <path
        d="M26 34L18 52L48 30"
        fill="none"
        stroke="#2CACE8"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Full brand wordmark: "marketing" + "powered" stacked.
 * For dark backgrounds (sidebar, mobile header).
 */
export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`leading-none ${className}`}>
      <span className="text-white text-[15px] font-semibold tracking-tight block">
        marketing
      </span>
      <span className="text-brand-blue text-[15px] font-semibold tracking-tight">
        powered
      </span>
    </div>
  );
}
