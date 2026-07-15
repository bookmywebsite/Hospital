export function chunkText(text: string, chunkSize = 600, overlap = 100) {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let start = 0; start < words.length; start += chunkSize - overlap) {
    const slice = words.slice(start, Math.min(start + chunkSize, words.length));
    chunks.push(slice.join(" ").trim());
  }

  return chunks.filter((chunk) => chunk.length > 0);
}
