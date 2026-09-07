import type {CSSProperties,ComponentType} from 'react';
import * as Ion from 'react-icons/io5';

type IconProps={name:string|number|symbol;size?:number;color?:string;style?:any;onPress?:()=>void;accessibilityLabel?:string};

const exceptions:Record<string,string>={
  'logo-facebook':'IoLogoFacebook','logo-google':'IoLogoGoogle','logo-apple':'IoLogoApple',
};

function componentName(value:string|number|symbol){
  const name=String(value);
  if(exceptions[name])return exceptions[name];
  return `Io${name.split('-').map(part=>part?part[0].toUpperCase()+part.slice(1):'').join('')}`;
}

export function Ionicons({name,size=24,color='currentColor',style,onPress,accessibilityLabel}:IconProps){
  const Icon=((Ion as unknown) as Record<string,ComponentType<any>>)[componentName(name)]||Ion.IoEllipseOutline;
  const flatStyle=Array.isArray(style)?Object.assign({},...style.filter(Boolean)):style;
  return <Icon aria-label={accessibilityLabel} aria-hidden={accessibilityLabel?undefined:true} onClick={onPress} size={size} color={color} style={flatStyle}/>;
}

Ionicons.glyphMap={} as Record<string,number>;

export const MaterialCommunityIcons=Ionicons;
export const MaterialIcons=Ionicons;
export const FontAwesome=Ionicons;
export const FontAwesome5=Ionicons;
export const Feather=Ionicons;
export const AntDesign=Ionicons;
export const Entypo=Ionicons;
export const EvilIcons=Ionicons;
export const Foundation=Ionicons;
export const Octicons=Ionicons;
export const SimpleLineIcons=Ionicons;
export const Zocial=Ionicons;
