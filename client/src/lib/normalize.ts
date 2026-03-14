export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ð/g, "d")
    .replace(/þ/g, "th")
    .replace(/đ/g, "d")
    .replace(/['\-\s]/g, "");
}

export function getCommonSurname(p: { displayName: string; lastName: string }): string {
  const displayParts = p.displayName.trim().split(/\s+/);
  if (displayParts.length > 1) {
    return displayParts[displayParts.length - 1];
  }
  return p.lastName;
}

export const PL_MONONYMS: Record<string, string> = {
  gilberto: "gilbertosilva",
  gabriel: "gabrielmagalhaes",
  eduardo: "eduardodasilva",
};

export const PL_ALTERNATES: Record<string, string> = {
  vannistelrooij: "vannistelrooy",
  nistelrooij: "nistelrooy",
};
