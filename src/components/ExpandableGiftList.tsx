import { useState, type ReactNode } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { formatPrice, PRIORITY_COLOR, PRIORITY_LABEL, type Priority } from "@/lib/gift-box";
import { getGiftCategoryOption, type GiftCategory } from "@/lib/gift-category";

export function ExpandableGiftList({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <Card
      role="list"
      aria-label={label}
      className={cn(
        "divide-y divide-border/60 overflow-hidden rounded-2xl border-white/80 bg-white/85 p-0 shadow-sm",
        className,
      )}
    >
      {children}
    </Card>
  );
}

export function ExpandableGiftRow({
  title,
  category,
  imageSrc,
  price,
  currency = "EUR",
  priority,
  description,
  url,
  meta,
  status,
  actions,
  className,
}: {
  title: string;
  category: GiftCategory;
  imageSrc?: string | null;
  price?: number | null;
  currency?: string | null;
  priority?: Priority;
  description?: string | null;
  url?: string | null;
  meta?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const categoryOption = getGiftCategoryOption(category);
  const CategoryIcon = categoryOption.icon;

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <div role="listitem" className={cn("transition-colors", className)}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex min-h-16 w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4"
            aria-label={`${open ? "Masquer" : "Afficher"} les détails de ${title}`}
          >
            {imageSrc ? (
              <img
                src={imageSrc}
                alt=""
                className="h-10 w-10 shrink-0 rounded-lg bg-muted object-cover"
              />
            ) : (
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  categoryOption.surfaceClass,
                )}
                title={categoryOption.label}
              >
                <CategoryIcon className={cn("h-5 w-5", categoryOption.iconClass)} />
              </span>
            )}

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-tight">{title}</span>
              {meta && (
                <span className="mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground">
                  {meta}
                </span>
              )}
            </span>

            <span className="flex shrink-0 items-center gap-1.5">
              {status}
              {price != null && (
                <span className="text-xs font-semibold text-primary">
                  {formatPrice(price, currency ?? "EUR")}
                </span>
              )}
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  open && "rotate-180",
                )}
                aria-hidden="true"
              />
            </span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/50 bg-secondary/20 px-3 py-3 sm:px-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className="h-5 rounded-full bg-white/70 px-1.5 text-[9px] font-medium"
              >
                <CategoryIcon className={cn("h-2.5 w-2.5", categoryOption.iconClass)} />
                {categoryOption.label}
              </Badge>
              {priority && (
                <Badge
                  className={cn("h-5 rounded-full px-1.5 text-[9px]", PRIORITY_COLOR[priority])}
                >
                  {PRIORITY_LABEL[priority]}
                </Badge>
              )}
            </div>

            {description && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
            )}

            {(url || actions) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {url && (
                  <Button asChild size="sm" variant="outline" className="h-8 rounded-lg px-2.5">
                    <a href={url} target="_blank" rel="noreferrer noopener">
                      Voir le cadeau <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
                {actions}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
