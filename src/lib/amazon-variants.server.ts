export interface AmazonVariant {
  asin: string;
  url: string;
  label: string;
  attributes: Record<string, string>;
  imageUrl?: string | null;
}

function jsonProperty(html: string, name: string): unknown {
  const pattern = new RegExp('"' + name + '"\\s*:\\s*([\\[{])', "g");
  for (const match of html.matchAll(pattern)) {
    const start = match.index! + match[0].length - 1;
    let depth = 0,
      quoted = false,
      escaped = false;
    for (let i = start; i < Math.min(html.length, start + 200000); i++) {
      const char = html[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
        continue;
      }
      if (char === '"') quoted = true;
      else if (char === "[" || char === "{") depth++;
      else if (char === "]" || char === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(html.slice(start, i + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}

export function getAmazonVariants(html: string, sourceUrl: string, displayedAsin?: string) {
  const source = new URL(sourceUrl);
  const requestedAsin =
    source.pathname
      .match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1]
      ?.toUpperCase() ?? null;
  const dimensions = jsonProperty(html, "dimensions");
  const data = jsonProperty(html, "dimensionValuesDisplayData");
  const variants: AmazonVariant[] = [];
  if (
    Array.isArray(dimensions) &&
    dimensions.length > 0 &&
    dimensions.length <= 5 &&
    dimensions.every((key) => typeof key === "string" && /^[a-z][a-z0-9_]{0,40}$/.test(key)) &&
    data &&
    typeof data === "object" &&
    !Array.isArray(data)
  ) {
    for (const [asin, values] of Object.entries(data).slice(0, 300)) {
      if (
        !/^[A-Z0-9]{10}$/.test(asin) ||
        !Array.isArray(values) ||
        values.length !== dimensions.length ||
        !values.every(
          (value) => typeof value === "string" && value.trim().length > 0 && value.length <= 150,
        )
      )
        continue;
      const labels = values.map((value: string) =>
        value
          .replace(/<[^>]*>/g, "")
          .replace(/\s+/g, " ")
          .trim(),
      );
      variants.push({
        asin,
        url: source.origin + "/dp/" + asin + "?th=1&psc=1",
        label: labels.join(" · "),
        attributes: Object.fromEntries(dimensions.map((key, i) => [key, labels[i]])),
      });
    }
  }
  const selected = variants.find((variant) => variant.asin === requestedAsin);
  const parentAsin = html.match(/"parentAsin"\s*:\s*"([A-Z0-9]{10})"/)?.[1] ?? null;
  const visible = displayedAsin && /^[A-Z0-9]{10}$/.test(displayedAsin) ? displayedAsin : null;
  const selectionRequired = Boolean(
    requestedAsin &&
    (requestedAsin === parentAsin ||
      (visible && visible !== requestedAsin) ||
      (variants.length > 1 && !selected)),
  );
  return {
    variants,
    selected,
    selectionRequired,
    selectedLabel: !selectionRequired ? (selected?.label ?? null) : null,
  };
}
