/** Shapes a picture can take on a card, as width over height: a little taller than wide, up to twice as wide. */
const TALLEST = 4 / 5;
const WIDEST = 2;

/**
 * The shape to show a picture in on a card: its own, unless it's very tall or very wide, when it's
 * trimmed to fit (tapping it shows the whole picture). Without a size, a usual photo's 4:3.
 */
export function pictureAspect(width?: number, height?: number): number {
  if (!width || !height) return 4 / 3;
  return Math.min(WIDEST, Math.max(TALLEST, width / height));
}
