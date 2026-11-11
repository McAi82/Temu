// web/src/lib/sortBy.js

/**
 * Case-insensitive, locale-aware string comparison.
 * Treats nulls/undefined/empty strings as coming after real values.
 */
const str = (v) => (v == null ? "" : String(v).trim().toLowerCase());

/**
 * Returns a comparator that sorts by the given key fields in order.
 * Empty values always sort to the end, regardless of direction.
 *
 * Usage:
 *   arr.sort(byFields("lastname", "firstname"))
 *   arr.sort(byFields("platenumber"))
 */
export function byFields(...keys) {
  return (a, b) => {
    for (const key of keys) {
      const av = str(a?.[key]);
      const bv = str(b?.[key]);

      // Empty values go last
      if (!av && !bv) continue;
      if (!av) return 1;
      if (!bv) return -1;

      const cmp = av.localeCompare(bv, undefined, {
        sensitivity: "base",
        numeric: true,
      });
      if (cmp !== 0) return cmp;
    }
    return 0;
  };
}

/**
 * Sort an array by one or more keys without mutating the input.
 */
export function sortBy(array, ...keys) {
  if (!Array.isArray(array)) return [];
  return [...array].sort(byFields(...keys));
}