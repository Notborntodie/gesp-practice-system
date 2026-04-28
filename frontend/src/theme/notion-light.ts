import type { GlobalThemeOverrides } from 'naive-ui'
import { notionColors } from './colors'

/**
 * Naive UI theme overrides inspired by Notion's design system.
 * Light mode only — dark mode can be added later.
 */
export const notionLightTheme: GlobalThemeOverrides = {
  common: {
    // Colors
    primaryColor: notionColors.accentBlue,
    primaryColorHover: notionColors.accentBlueHover,
    primaryColorPressed: notionColors.accentBlueActive,
    primaryColorSuppl: notionColors.accentBlue,

    // Backgrounds
    bodyColor: notionColors.white,
    cardColor: notionColors.white,
    modalColor: notionColors.white,
    popoverColor: notionColors.white,
    tableColor: notionColors.white,
    inputColor: notionColors.white,
    actionColor: notionColors.warmWhite,
    hoverColor: notionColors.backgroundHover,
    tableColorHover: notionColors.backgroundHover,
    tableColorStriped: notionColors.warmWhite,

    // Text
    textColorBase: notionColors.textPrimary,
    textColor1: notionColors.textPrimary,
    textColor2: notionColors.textSecondary,
    textColor3: notionColors.textMuted,
    placeholderColor: notionColors.textMuted,
    placeholderColorDisabled: notionColors.textDisabled,
    disabledColor: notionColors.textDisabled,

    // Borders
    borderColor: notionColors.borderLight,
    dividerColor: notionColors.borderLight,
    inputBorderColor: notionColors.borderLight,
    inputBorderColorHover: notionColors.borderMedium,
    inputBorderColorFocus: notionColors.accentBlue,

    // Typography
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
    fontSize: '14px',
    fontSizeMedium: '14px',
    fontSizeLarge: '16px',
    fontSizeHuge: '18px',
    lineHeight: '1.6',

    // Dimensions
    heightMedium: '36px',
    heightLarge: '40px',
    heightSmall: '28px',

    // Radius
    borderRadius: '4px',
    borderRadiusSmall: '3px',
    borderRadiusMedium: '8px',
    borderRadiusLarge: '12px',

    // Shadows
    boxShadow1: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.01)',
    boxShadow2: '0 3px 6px rgba(0,0,0,0.02), 0 2px 4px rgba(0,0,0,0.027)',
    boxShadow3: '0 10px 15px rgba(0,0,0,0.02), 0 4px 6px rgba(0,0,0,0.027)',
    boxShadowPopover: '0 4px 18px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.027)',
  },

  Button: {
    borderRadiusMedium: '4px',
    borderRadiusLarge: '9999px',
    borderRadiusSmall: '3px',
    fontSizeMedium: '14px',
    fontSizeSmall: '12px',
    heightMedium: '36px',
    heightLarge: '40px',
    heightSmall: '28px',
    textColorPrimary: '#ffffff',
    textColorHoverPrimary: '#ffffff',
    textColorPressedPrimary: '#ffffff',
    textColorFocusPrimary: '#ffffff',
    colorPrimary: notionColors.accentBlue,
    colorHoverPrimary: notionColors.accentBlueHover,
    colorPressedPrimary: notionColors.accentBlueActive,
    colorFocusPrimary: notionColors.accentBlue,
    textColorTertiary: notionColors.textSecondary,
    colorTertiary: 'transparent',
    colorTertiaryHover: notionColors.backgroundHover,
    borderTertiary: '1px solid transparent',
    borderTertiaryHover: '1px solid transparent',
    textColorQuaternary: notionColors.textMuted,
    colorQuaternary: 'transparent',
    colorQuaternaryHover: notionColors.backgroundHover,
    borderQuaternary: '1px solid transparent',
    borderQuaternaryHover: '1px solid transparent',
  },

  Card: {
    borderRadius: '12px',
    paddingMedium: '20px',
    paddingLarge: '24px',
    borderColor: notionColors.borderLight,
    titleFontWeight: '600',
    titleFontSizeLarge: '18px',
    titleFontSizeMedium: '16px',
  },

  DataTable: {
    borderRadius: '12px',
    borderColor: notionColors.borderLight,
    thColor: notionColors.warmWhite,
    thTextColor: notionColors.textSecondary,
    thFontWeight: '500',
    tdColor: notionColors.white,
    tdTextColor: notionColors.textPrimary,
    tdColorHover: notionColors.backgroundHover,
    thFontWeight: '500',
    borderColorHorizontal: notionColors.borderLight,
    fontSize: '14px',
    thPadding: '12px 16px',
    tdPadding: '12px 16px',
  },

  Dialog: {
    borderRadius: '12px',
    padding: '24px',
    titleFontWeight: '600',
    titleFontSize: '18px',
    contentTextColor: notionColors.textSecondary,
  },

  Input: {
    borderRadius: '4px',
    border: '1px solid rgba(0,0,0,0.1)',
    borderHover: '1px solid rgba(0,0,0,0.15)',
    borderFocus: '1px solid #0075de',
    boxShadowFocus: '0 0 0 2px rgba(0,117,222,0.15)',
    caretColor: notionColors.accentBlue,
    textColor: notionColors.textPrimary,
    placeholderColor: notionColors.textMuted,
    fontSizeMedium: '14px',
    heightMedium: '36px',
  },

  Select: {
    peers: {
      InternalSelection: {
        borderRadius: '4px',
        border: '1px solid rgba(0,0,0,0.1)',
        borderHover: '1px solid rgba(0,0,0,0.15)',
        borderFocus: '1px solid #0075de',
        borderActive: '1px solid #0075de',
        heightMedium: '36px',
        textColor: notionColors.textPrimary,
        placeholderColor: notionColors.textMuted,
      },
      InternalSelectMenu: {
        borderRadius: '8px',
        optionTextColor: notionColors.textPrimary,
        optionTextColorActive: notionColors.accentBlue,
        optionColorPending: notionColors.backgroundHover,
        optionColorActive: notionColors.accentBlueLight,
      },
    },
  },

  Menu: {
    borderRadius: '8px',
    itemTextColor: notionColors.textSecondary,
    itemTextColorHover: notionColors.textPrimary,
    itemTextColorActive: notionColors.accentBlue,
    itemTextColorActiveHover: notionColors.accentBlue,
    itemTextColorChildActive: notionColors.accentBlue,
    itemColorActive: notionColors.backgroundHover,
    itemColorHover: notionColors.backgroundHover,
    itemIconColor: notionColors.textMuted,
    itemIconColorHover: notionColors.textSecondary,
    itemIconColorActive: notionColors.accentBlue,
    itemIconColorActiveHover: notionColors.accentBlue,
    arrowColor: notionColors.textMuted,
    dividerColor: notionColors.borderLight,
    borderRadius: '4px',
  },

  Tabs: {
    tabTextColorActiveLine: notionColors.accentBlue,
    tabTextColorHoverLine: notionColors.textPrimary,
    tabTextColorLine: notionColors.textSecondary,
    barColor: notionColors.accentBlue,
    tabFontSizeMedium: '14px',
    tabFontSizeLarge: '16px',
  },

  Tag: {
    borderRadius: '9999px',
    heightMedium: '26px',
    heightSmall: '22px',
    fontSizeMedium: '12px',
    fontSizeSmall: '11px',
    closeButtonColor: notionColors.textMuted,
    closeButtonColorHover: notionColors.textSecondary,
    closeIconColor: notionColors.textMuted,
    closeIconColorHover: notionColors.textSecondary,
  },

  Modal: {
    borderRadius: '12px',
    color: notionColors.white,
    boxShadow: '0 4px 18px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.027), 0 1px 3px rgba(0,0,0,0.02)',
  },

  Popover: {
    borderRadius: '8px',
    color: notionColors.white,
    boxShadow: '0 4px 18px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.027)',
  },

  Dropdown: {
    borderRadius: '8px',
    optionTextColor: notionColors.textPrimary,
    optionTextColorHover: notionColors.textPrimary,
    optionColorHover: notionColors.backgroundHover,
    optionColorPending: notionColors.backgroundHover,
    dividerColor: notionColors.borderLight,
  },

  Message: {
    borderRadius: '8px',
  },

  Notification: {
    borderRadius: '8px',
  },

  Pagination: {
    itemBorderRadius: '4px',
    itemTextColor: notionColors.textSecondary,
    itemTextColorHover: notionColors.textPrimary,
    itemTextColorActive: '#ffffff',
    itemColor: 'transparent',
    itemColorHover: notionColors.backgroundHover,
    itemColorActive: notionColors.accentBlue,
    itemBorder: '1px solid transparent',
    itemBorderHover: '1px solid transparent',
    itemBorderActive: `1px solid ${notionColors.accentBlue}`,
  },

  Popconfirm: {
    borderRadius: '8px',
  },

  Empty: {
    textColor: notionColors.textMuted,
    iconColor: notionColors.textDisabled,
    fontSizeMedium: '14px',
  },

  Spin: {
    textColor: notionColors.accentBlue,
  },
}
