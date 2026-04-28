/**
 * Notion-inspired color palette for the SmartOI Growth Plan platform.
 * Reference: awesome-design-md/notion/DESIGN.md
 */

export const notionColors = {
  // Backgrounds
  white: '#ffffff',
  warmWhite: '#f6f5f4',

  // Text
  textPrimary: 'rgba(0,0,0,0.95)',
  textSecondary: '#615d59',
  textMuted: '#a39e98',
  textDisabled: '#c4c0bb',

  // Accent
  accentBlue: '#0075de',
  accentBlueHover: '#0069c8',
  accentBlueActive: '#005bab',
  accentBlueLight: '#f2f9ff',

  // Semantic
  success: '#0f7b6c',
  successLight: '#e3f5f3',
  warning: '#dfab01',
  warningLight: '#fef7e0',
  error: '#eb5757',
  errorLight: '#fde8e8',
  info: '#0075de',
  infoLight: '#e3f0fd',

  // Borders
  borderLight: 'rgba(0,0,0,0.1)',
  borderMedium: 'rgba(0,0,0,0.15)',

  // Hover
  backgroundHover: 'rgba(55,53,47,0.08)',
  backgroundActive: 'rgba(55,53,47,0.16)',

  // Shadows
  shadowColor: 'rgba(0,0,0,0.04)',
  shadowColorSecondary: 'rgba(0,0,0,0.027)',
  shadowColorTertiary: 'rgba(0,0,0,0.02)',
  shadowColorQuaternary: 'rgba(0,0,0,0.01)',

  // Category colors
  categoryGESP: '#0075de',
  categoryGESPBg: '#e3f0fd',
  categoryCustom: '#6b21a8',
  categoryCustomBg: '#f3e8ff',
} as const

export type NotionColor = (typeof notionColors)[keyof typeof notionColors]
