import {Capacitor} from '@capacitor/core';
export const isDevice=Capacitor.isNativePlatform();
export const modelName=navigator.userAgent;
export const osName=Capacitor.getPlatform();
