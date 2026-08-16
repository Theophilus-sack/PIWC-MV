// Shared categorisation for the two services the church runs — used by
// Groups/Ministries and Leadership to group ministries/presbyters by
// which service they belong to.
export const ASSEMBLY_SECTIONS = [
  { key: "English", label: "English Service", badgeClass: "badge-blue" },
  { key: "Twi", label: "Twi Service", badgeClass: "badge-gold" },
  { key: "Both", label: "Both Services", badgeClass: "" },
  { key: null, label: "Unassigned", badgeClass: "" },
];

// Groups a list of {..., assembly} items into ASSEMBLY_SECTIONS order,
// dropping any section with no members. assemblyOf lets callers group
// nested data (e.g. ministry_leadership rows grouped by their ministry's
// assembly) without reshaping the source list first.
export function groupByAssembly(items, assemblyOf = (item) => item.assembly) {
  const groups = new Map(ASSEMBLY_SECTIONS.map((s) => [s.key, []]));
  for (const item of items ?? []) {
    const value = assemblyOf(item);
    const key = groups.has(value) ? value : null;
    groups.get(key).push(item);
  }
  return ASSEMBLY_SECTIONS.map((s) => ({ ...s, items: groups.get(s.key) })).filter((s) => s.items.length > 0);
}
