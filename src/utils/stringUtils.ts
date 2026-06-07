export function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function formatLocation(parentName: string | null | undefined, boxName: string | null | undefined): string {
  if (parentName && boxName) return `${parentName} › ${boxName}`;
  return boxName ?? parentName ?? "";
}
