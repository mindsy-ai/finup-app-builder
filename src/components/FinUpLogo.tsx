type Props = { size?: number; showWordmark?: boolean };

export function FinUpLogo({ size = 28, showWordmark = true }: Props) {
  return (
    <div className="flex items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="FinUp"
      >
        <defs>
          <linearGradient id="finup-grad" x1="0" y1="64" x2="64" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6B21FF" />
            <stop offset="100%" stopColor="#FF5C1A" />
          </linearGradient>
        </defs>
        {/* Spiral arrow going up-right */}
        <path
          d="M50 18 L56 12 L56 22 M56 12 L40 24 C32 30 28 38 32 44 C36 50 46 50 50 44 C53 40 52 34 46 32 C40 30 34 34 34 40"
          stroke="url(#finup-grad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {showWordmark && (
        <span className="text-[18px] font-bold leading-none tracking-tight text-white">
          Fin<span className="text-gradient-brand">Up</span>
        </span>
      )}
    </div>
  );
}
