import type {CapacitorConfig} from '@capacitor/cli';

const config:CapacitorConfig={
  appId:'org.cdaconnect.app',
  appName:'CDA Connect',
  webDir:'dist-web',
  server:{androidScheme:'https'},
  plugins:{
    Keyboard:{resize:'body'},
    LocalNotifications:{smallIcon:'ic_stat_icon_config_sample',iconColor:'#0F8A43'},
  },
};

export default config;
