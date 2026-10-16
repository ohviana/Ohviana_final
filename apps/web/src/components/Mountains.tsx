/** Layered ridge-line silhouettes used at the bottom of the hero, banners and trek cards. */
export function Mountains({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <svg className={className} viewBox="0 0 1440 200" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 140 L120 90 L230 128 L360 60 L470 118 L600 50 L730 120 L860 70 L980 126 L1120 64 L1250 116 L1360 84 L1440 110 L1440 200 L0 200 Z"
        fill="rgb(255 255 255 / 0.10)"
      />
      <path
        d="M0 168 L150 120 L290 160 L420 104 L560 156 L700 112 L840 162 L990 116 L1130 160 L1280 122 L1440 150 L1440 200 L0 200 Z"
        fill="rgb(255 255 255 / 0.16)"
      />
      {!compact && <path d="M0 188 L1440 188 L1440 200 L0 200 Z" fill="var(--bg)" />}
    </svg>
  );
}
