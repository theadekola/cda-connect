export const colors = {
  primary: '#0F8A43', primaryDark: '#08723A', primaryLight: '#E1EAF7', primarySoft: '#EDF3FB',
  background: '#EEF3F8', backgroundSoft: '#E8EEF5', surface: '#FFFFFF',
  textPrimary: '#11243F', textSecondary: '#60708C', textMuted: '#8794A9', text: '#11243F', muted: '#66758F',
  border: '#D7E0EA',
  success: '#0F8A43', successText: '#08723A', successLight: '#E1EAF7', successSoft: '#EDF3FB',
  warning: '#F3A326', warningText: '#9A5B00', warningLight: '#FFF2D8', warningSoft: '#FFF2D8',
  danger: '#DC5575', dangerDark: '#B63D5B', dangerText: '#A73350', dangerLight: '#FCE8EE', dangerSoft: '#FBE5EB', dangerBorder: '#F3C7D2',
  info: '#0F8A43', infoText: '#08723A', infoLight: '#E1EAF7',
  purple: '#667896', purpleText: '#4E607F', purpleLight: '#EDF1F7', orange: '#F3A326', rose: '#DC5575',
  disabled: '#D8E0EA', white: '#FFFFFF', black: '#08172D',
  // Backwards-compatible aliases used by existing screens.
  navy: '#11243F', cyan: '#0F8A43', gold: '#F3A326', green: '#0F8A43', red: '#DC5575',
  secondary: '#667896', accent: '#0F8A43',
};

export const darkColors = {
  ...colors,
  background: '#0C1728', backgroundSoft: '#111F34', surface: '#17263C',
  text: '#F5F8FC', textPrimary: '#F5F8FC', textSecondary: '#CBD5E1', textMuted: '#94A3B8', muted: '#C2CDDC', border: '#34445A',
  primary: '#7FA6E5', primaryDark:'#A8C2EC', accent: '#7FA6E5', primarySoft: '#203655', primaryLight: '#203655',
  dangerSoft: '#452438', warningSoft: '#43351F', successSoft: '#203655', successLight:'#203655',infoLight:'#203655',
};

export const highContrastColors = {
  ...colors,
  background: '#FFFFFF', surface: '#FFFFFF', text: '#000000', textPrimary: '#000000', muted: '#262626', border: '#000000',
  primary: '#174EA6', primaryDark: '#082B67', primarySoft: '#FFFFFF', primaryLight:'#FFFFFF',successSoft:'#FFFFFF',successLight:'#FFFFFF',infoLight:'#FFFFFF',danger: '#B51E3F', success: '#174EA6',
};

export const radii = {sm: 8, md: 12, lg: 16, xl: 20, pill: 999};
export const spacing = {xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32};
// One restrained type scale is shared across native, mobile web and desktop.
export const typography = {display: 25, pageTitle: 21, sectionTitle: 17, cardTitle: 15, body: 14, caption: 12, lineHeight: 1.45};
export const iconSizes = {header:24,action:20,inline:18,feature:32};
