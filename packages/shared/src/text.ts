/** URL slug from free text: "Kumara Parvatha (Pushpagiri)" -> "kumara-parvatha-pushpagiri". */
export function slugify(input: string, maxLength = 80): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/** Escapes `%`, `_` and `\` so user input is matched literally inside a LIKE/ILIKE pattern. */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}
