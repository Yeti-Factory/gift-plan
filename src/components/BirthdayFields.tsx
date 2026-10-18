import { BIRTHDAY_MONTHS } from "@/lib/birthday";
import { Input } from "@/components/ui/input";

export function BirthdayFields({
  id,
  day,
  month,
  onDayChange,
  onMonthChange,
  required = false,
}: {
  id: string;
  day: string;
  month: string;
  onDayChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">
        Date d’anniversaire{required ? " (obligatoire)" : ""}
      </legend>
      <div className="flex gap-3">
        <div className="w-24">
          <label htmlFor={`${id}-day`} className="mb-1 block text-xs text-muted-foreground">
            Jour
          </label>
          <Input
            id={`${id}-day`}
            name="birthdayDay"
            type="number"
            min={1}
            max={31}
            inputMode="numeric"
            autoComplete="bday-day"
            required={required}
            value={day}
            onChange={(event) => onDayChange(event.target.value)}
            placeholder="22"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-month`} className="mb-1 block text-xs text-muted-foreground">
            Mois
          </label>
          <select
            id={`${id}-month`}
            name="birthdayMonth"
            autoComplete="bday-month"
            required={required}
            value={month}
            onChange={(event) => onMonthChange(event.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">Choisir un mois</option>
            {BIRTHDAY_MONTHS.map((name, index) => (
              <option key={name} value={String(index + 1).padStart(2, "0")}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Seuls le jour et le mois sont demandés. Ils s’affichent aux personnes autorisées à consulter
        votre profil ; l’année de naissance n’est pas demandée.
      </p>
    </fieldset>
  );
}
