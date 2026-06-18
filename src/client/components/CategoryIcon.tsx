/**
 * Renders a category's icon for HTML contexts (Sidebar, dialogs).
 * - `name` set    → the lucide icon (via DynamicIcon), tinted with `color`
 * - `name` unset  → a small round color swatch, so every category still reads as colored
 *
 * The SVG link graph renders icons inline itself (see GraphPage) rather than reusing this.
 */
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';

interface Props {
  /** lucide icon name (kebab-case). When omitted, a color swatch is shown. */
  name?: string;
  /** Tint for the icon / fill for the swatch. */
  color: string;
  /** Pixel size of the icon / swatch. Defaults to 14. */
  size?: number;
}

export function CategoryIcon({ name, color, size = 14 }: Props) {
  if (name) {
    return (
      <DynamicIcon
        name={name as IconName}
        size={size}
        color={color}
        aria-hidden="true"
        fallback={() => <Swatch color={color} size={size} />}
      />
    );
  }
  return <Swatch color={color} size={size} />;
}

function Swatch({ color, size }: { color: string; size: number }) {
  const dot = Math.round(size * 0.7);
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: dot,
        height: dot,
        borderRadius: '50%',
        background: color,
      }}
    />
  );
}
