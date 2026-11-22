const rawCardModules = import.meta.glob<string>('../assets/cards/*.svg', {
  eager: true,
  import: 'default',
});

const CARD_ARTWORK_BY_ID: Record<string, string> = {};

for (const [path, url] of Object.entries(rawCardModules)) {
  const filename = path.split('/').pop() ?? '';
  const id = filename.replace(/\.svg$/i, '');
  if (id) {
    CARD_ARTWORK_BY_ID[id] = url;
  }
}

export function getCardArtworkUrl(cardId: string): string | undefined {
  return CARD_ARTWORK_BY_ID[cardId];
}
