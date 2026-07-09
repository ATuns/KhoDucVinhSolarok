export function removeAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function searchMatch(text: string | null | undefined, query: string | null | undefined): boolean {
  if (!query) return true;
  if (!text) return false;
  
  const normalizedText = removeAccents(text).toLowerCase();
  const words = removeAccents(query).toLowerCase().split(/\s+/).filter(Boolean);
  
  return words.every(word => normalizedText.includes(word));
}
