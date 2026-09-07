import React from 'react';
import {Linking,Text,type StyleProp,type TextStyle} from '@/platform/react-native';
import {useAppTheme} from './UI';

const linkPattern=/((?:https?:\/\/|www\.)[^\s<>]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/gi;
const trailing=/[),.!?:;]+$/;

function target(value:string){if(value.includes('@')&&!/^https?:\/\//i.test(value)&&!/^www\./i.test(value))return `mailto:${value}`;return /^https?:\/\//i.test(value)?value:`https://${value}`}

export function LinkText({children,style,numberOfLines}:{children:string;style?:StyleProp<TextStyle>;numberOfLines?:number}){
 const{palette}=useAppTheme();
 const parts=String(children??'').split(linkPattern);
 return <Text allowFontScaling numberOfLines={numberOfLines} style={[{color:palette.text},style]}>{parts.map((part,index)=>{linkPattern.lastIndex=0;if(!part||!linkPattern.test(part)){linkPattern.lastIndex=0;return part}linkPattern.lastIndex=0;const suffix=part.match(trailing)?.[0]||'';const link=suffix?part.slice(0,-suffix.length):part;return <React.Fragment key={`${index}-${part}`}><Text accessibilityRole="link" accessibilityLabel={`Open link ${link}`} onPress={event=>{event.stopPropagation();void Linking.openURL(target(link))}} style={{color:palette.primary,textDecorationLine:'underline',fontWeight:'700'}}>{link}</Text>{suffix}</React.Fragment>})}</Text>
}
