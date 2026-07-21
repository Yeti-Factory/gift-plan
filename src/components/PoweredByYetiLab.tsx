import { cn } from "@/lib/utils";

export function PoweredByYetiLab({ className }: { className?: string }) {
  return (
    <span
      aria-label="Powered by YetiLab"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500 shadow-sm",
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
        className="h-3.5 w-auto"
      />
    </span>
  );
}
