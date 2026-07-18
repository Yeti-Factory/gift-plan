import { Gift, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export function BrandMark({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_24px_oklch(0.67_0.2_22/0.25)]">
        <Gift className="h-5 w-5" />
        <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-secondary p-0.5 text-primary" />
      </span>
      {!compact && (
        <span className="font-display text-xl font-bold tracking-[-0.03em]">Gift-Plan</span>
      )}
    </span>
  );
}
