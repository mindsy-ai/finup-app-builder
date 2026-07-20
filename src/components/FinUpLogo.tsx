type Props = { size?: number; showWordmark?: boolean };

export function FinUpLogo({ size = 28, showWordmark = true }: Props) {
  return (
    <div className="flex items-center gap-2">
      <img
        src="/logo-icon.png"
        alt="FinUp"
        width={size}
        height={size}
        style={{ objectFit: "contain" }}
      />
      {showWordmark && (
        <span className="text-[18px] font-bold leading-none tracking-tight text-white">
          Fin<span className="text-gradient-brand">Up</span>
        </span>
      )}
    </div>
  );
}
