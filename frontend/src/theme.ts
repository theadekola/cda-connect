export const colors = {
  primary: '#0F8A43', primaryDark: '#08723A', primaryLight: '#EAF7EF', primarySoft: '#EAF7EF',
  background: '#F7F5F0', backgroundSoft: '#F7F5F0', surface: '#FFFFFF',
  textPrimary: '#0F1F44', textSecondary: '#64748B', textMuted: '#94A3B8', text: '#0F1F44', muted: '#64748B',
  border: '#E2E8F0',
  success: '#16A34A', successText: '#15803D', successLight: '#DCFCE7', successSoft: '#DCFCE7',
  warning: '#F59E0B', warningText: '#B45309', warningLight: '#FEF3C7', warningSoft: '#FEF3C7',
  danger: '#DC2626', dangerDark: '#B91C1C', dangerText: '#B91C1C', dangerLight: '#FEF2F2', dangerSoft: '#FEE2E2', dangerBorder: '#FECACA',
  info: '#0F8A43', infoText: '#08723A', infoLight: '#EAF7EF',
  purple: '#0F1F44', purpleText: '#0F1F44', purpleLight: '#F8FAFC', orange: '#0F8A43', rose: '#DC2626',
  disabled: '#D1E9DB', white: '#FFFFFF', black: '#000000',
  // Backwards-compatible aliases used by existing screens.
  navy: '#0F1F44', cyan: '#0F8A43', gold: '#F59E0B', green: '#0F8A43', red: '#DC2626',
  secondary: '#0F1F44', accent: '#0F8A43',
};

export const darkColors = {
  ...colors,
  background: '#08141D', backgroundSoft: '#0B1B27', surface: '#0F1F44',
  text: '#F8FAFC', textPrimary: '#F8FAFC', textSecondary: '#CBD5E1', textMuted: '#94A3B8', muted: '#CBD5E1', border: '#294052',
  primary: '#22C55E', accent: '#22C55E', primarySoft: '#123D25', primaryLight: '#123D25',
  dangerSoft: '#4A1717', warningSoft: '#422D0A', successSoft: '#123D25',
};

export const highContrastColors = {
  ...colors,
  background: '#FFFFFF', surface: '#FFFFFF', text: '#000000', textPrimary: '#000000', muted: '#262626', border: '#000000',
  primary: '#007A99', primaryDark: '#001A38', primarySoft: '#E6F9FE', danger: '#C81E1E', success: '#087A32',
};

export const radii = {sm: 8, md: 12, lg: 16, xl: 20, pill: 999};
export const spacing = {xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32};
// One restrained type scale is shared across native, mobile web and desktop.
export const typography = {display: 26, pageTitle: 22, sectionTitle: 17, cardTitle: 16, body: 14, caption: 12, lineHeight: 1.45};
