import { cn } from "@/lib/utils";

export function PoweredByYetiLab({ className }: { className?: string }) {
  return (
    <span
      aria-label="Powered by YetiLab"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 shadow-sm",
        className,
      )}
    >
      <span aria-hidden="true">powered by</span>
      <img
        src="/yetilab-logo.png"
        alt=""
        aria-hidden="true"
        width="4199"
        height="1507"
        loading="lazy"
        decoding="async"
        className="h-[18px] w-auto"
      />
    </span>
  );
}
