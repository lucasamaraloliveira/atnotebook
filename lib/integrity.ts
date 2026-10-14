// Helper to calculate string checksum and metrics for data integrity verification

export function calculateChecksum(text: string): string {
  let hash = 0;
  if (text.length === 0) return '00000000';
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return hex.toUpperCase();
}

export function computeTextMetrics(text: string) {
  const trimmed = text.trim();
  const charCount = text.length;
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  // Approximation: 1 token ~= 4 characters for Latin/PT texts
  const estimatedTokens = Math.ceil(charCount / 4);
  const checksum = calculateChecksum(text);

  return {
    charCount,
    wordCount,
    estimatedTokens,
    checksum,
  };
}
