/**
 * Pixel-font label that renders any digits in the body font (Pixelify's 5
 * reads as S and small digits blur). Use for every `.pixel-label` that can
 * contain a number: dates, "Stop 1 of 6", "Level 5", counts.
 */
export function Px({ children, className = "" }: { children: string; className?: string }) {
  const parts = children.split(/(\d[\d/–\-.]*)/);
  return (
    <span className={`pixel-label ${className}`}>
      {parts.map((p, i) =>
        /^\d/.test(p) ? (
          <span key={i} className="num">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </span>
  );
}
