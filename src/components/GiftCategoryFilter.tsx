import { ListFilter } from "lucide-react";

import {
  GIFT_CATEGORY_OPTIONS,
  getGiftCategoryOption,
  type GiftCategoryFilterValue,
} from "@/lib/gift-category";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function GiftCategoryFilter({
  value,
  onValueChange,
  className = "",
}: {
  value: GiftCategoryFilterValue;
  onValueChange: (value: GiftCategoryFilterValue) => void;
  className?: string;
}) {
  return (
    <div className={`flex ${className}`.trim()}>
      <Select
        value={value}
        onValueChange={(next) => onValueChange(next as GiftCategoryFilterValue)}
      >
        <SelectTrigger
          aria-label="Filtrer les cadeaux par catégorie"
          className="h-8 w-full max-w-56 rounded-lg bg-white/70 px-2.5 text-xs shadow-none"
        >
          <SelectValue placeholder="Toutes les catégories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <span className="flex items-center gap-2">
              <ListFilter className="h-3.5 w-3.5" /> Tous les cadeaux
            </span>
          </SelectItem>
          {GIFT_CATEGORY_OPTIONS.map((option) => {
            const CategoryIcon = getGiftCategoryOption(option.value).icon;
            return (
              <SelectItem key={option.value} value={option.value}>
                <span className="flex items-center gap-2">
                  <CategoryIcon className="h-3.5 w-3.5" /> {option.label}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
