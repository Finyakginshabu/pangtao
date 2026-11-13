/**
 * Pangtao Design Tokens
 *
 * Single source of truth for all brand colours, spacing, typography,
 * border-radii and shadows.  Every component should reference these
 * constants instead of raw hex values or magic numbers.
 *
 * CSS custom-properties counterparts live in global.css so that plain
 * CSS rules (glass classes, etc.) can consume the same values.
 */

// ── Colour palette ──────────────────────────────────────────────────
export const colors = {
  /** #0F1E33 — darkest navy; headings, body text */
  midnight: '#0F1E33',
  /** #2E4A67 — mid navy; labels, secondary UI, button bg */
  cobalt: '#2E4A67',
  /** #B8945B — warm gold; logo accent, hover highlight */
  brass: '#B8945B',
  /** #D8CEBE — warm beige; borders, muted backgrounds */
  parchment: '#D8CEBE',
  /** #F4F0E8 — off-white cream; page background */
  porcelain: '#F4F0E8',

  // Semantic aliases
  textPrimary: '#0F1E33',
  textSecondary: '#2E4A67',
  textMuted: '#5A6B80',
  border: 'rgba(216, 206, 190, 0.75)',
  borderFocus: '#2E4A67',
  pageBg: '#F4F0E8',
  surfaceGlass: 'rgba(255, 255, 255, 0.65)',
  surfaceInput: 'rgba(255, 255, 255, 0.70)',
  surfaceSolid: '#FEFCF9',
} as const;

// ── Typography ───────────────────────────────────────────────────────
export const font = {
  family: "'Inter', system-ui, sans-serif",
  size: {
    xs: '0.75rem',   //  12 px
    sm: '0.875rem',  //  14 px
    base: '1rem',      //  16 px
    lg: '1.125rem',  //  18 px
    xl: '1.25rem',   //  20 px
    '2xl': '1.5rem',    //  24 px
    '3xl': '1.875rem',  //  30 px
  },
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

// ── Border radii ─────────────────────────────────────────────────────
export const radius = {
  sm: '0.5rem',   //  8 px  — small elements (error banner)
  md: '0.75rem',  // 12 px  — inputs, small buttons
  lg: '0.875rem', // 14 px  — logo badge
  xl: '1.25rem',  // 20 px  — cards
  '2xl': '1.5rem',   // 24 px  — glass card (login)
  full: '9999px',   //         — pills / badges
} as const;

// ── Shadows ──────────────────────────────────────────────────────────
export const shadow = {
  /** Layered glass-card shadow */
  glassCard: [
    '0 20px 40px -15px rgba(15, 30, 51, 0.07)',
    '0 0 0 1px rgba(216, 206, 190, 0.3)',
    'inset 0 1px 1px 0 rgba(255, 255, 255, 0.9)',
  ].join(', '),

  /** Soft elevation for opaque surfaces */
  card: [
    '0 8px 32px rgba(15, 30, 51, 0.10)',
    '0 1.5px 4px rgba(15, 30, 51, 0.06)',
  ].join(', '),

  /** Button resting shadow */
  btn: '0 8px 20px -6px rgba(15, 30, 51, 0.25), inset 0 1px 1px 0 rgba(255, 255, 255, 0.35)',

  /** Input focus ring */
  inputFocus: '0 0 0 4px rgba(46, 74, 103, 0.12), inset 0 1px 2px rgba(15, 30, 51, 0.03)',

  /** Logo badge */
  badge: '0 2px 6px rgba(184, 148, 91, 0.15)',
} as const;

// ── Spacing scale (rem, 4-px base) ───────────────────────────────────
export const space = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  7: '1.75rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
} as const;

// ── Z-index ──────────────────────────────────────────────────────────
export const zIndex = {
  orb: 0,
  base: 1,
  card: 10,
  modal: 50,
  toast: 100,
} as const;

// Convenience re-export so imports stay short:
// import { colors, font, radius, shadow, space } from '../styles/theme';

