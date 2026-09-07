import type {PropsWithChildren} from 'react';
import {View} from '@/platform/react-native';

export function SafeAreaView({children,...props}:PropsWithChildren<any>){return <View {...props}>{children}</View>}
export function SafeAreaProvider({children}:PropsWithChildren){return <>{children}</>}
export function SafeAreaInsetsContext({children}:PropsWithChildren){return <>{children}</>}
export function useSafeAreaInsets(){return {top:0,right:0,bottom:0,left:0}}
export function useSafeAreaFrame(){return {x:0,y:0,width:window.innerWidth,height:window.innerHeight}}
