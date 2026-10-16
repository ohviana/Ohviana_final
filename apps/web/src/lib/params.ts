export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** First value of a query parameter, trimmed; undefined when absent or blank. */
export function one(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const t = v?.trim();
  return t ? t : undefined;
}

/** YYYY-MM-DD only; anything else is dropped rather than sent to the API. */
export function isoDay(value: string | string[] | undefined): string | undefined {
  const v = one(value);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}

/** Search text the API accepts (2+ characters); shorter input is ignored rather than an error. */
export function searchText(value: string | string[] | undefined): string | undefined {
  const v = one(value);
  return v && v.length >= 2 ? v.slice(0, 100) : undefined;
}
