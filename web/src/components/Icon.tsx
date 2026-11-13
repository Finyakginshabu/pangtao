import React from 'react';

interface IconProps {
  /** Material Symbols Outlined ligature name, e.g. `arrow_back`, `add`, `visibility`. */
  name: string;
  /** Size in rem; defaults to 1.25 (20 px). */
  size?: number;
}

/**
 * The project's one icon set: Google Material Symbols Outlined (loaded in global.css).
 * Decorative by default; the control around it carries the accessible name.
 */
export const Icon: React.FC<IconProps> = ({ name, size = 1.25 }) => (
  <span
    className="material-symbols-outlined"
    aria-hidden="true"
    style={{ fontSize: `${size}rem`, verticalAlign: 'middle' }}
  >
    {name}
  </span>
);
