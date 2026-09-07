import React,{forwardRef,useEffect,useState,type CSSProperties,type PropsWithChildren} from 'react';
import {createPortal} from 'react-dom';
import {Capacitor} from '@capacitor/core';
const rawFlat=(style:any):Record<string,any>=>Array.isArray(style)?Object.assign({},...style.filter(Boolean).map(rawFlat)):style||{};
const px=(value:any)=>typeof value==='number'?`${value}px`:value;
const normalize=(style:any):CSSProperties=>{
  const source=rawFlat(style);
  const result:Record<string,any>={};
  for(const [key,value] of Object.entries(source)){
    if(value==null)continue;
    if(key==='paddingHorizontal'){result.paddingLeft=value;result.paddingRight=value;continue}
    if(key==='paddingVertical'){result.paddingTop=value;result.paddingBottom=value;continue}
    if(key==='marginHorizontal'){result.marginLeft=value;result.marginRight=value;continue}
    if(key==='marginVertical'){result.marginTop=value;result.marginBottom=value;continue}
    if(key==='transform'&&Array.isArray(value)){
      result.transform=value.map(item=>Object.entries(item).map(([name,amount])=>`${name}(${name.startsWith('scale')?amount:px(amount)})`).join(' ')).join(' ');
      continue;
    }
    if(key==='textShadowColor'||key==='textShadowOffset'||key==='textShadowRadius'||key==='shadowColor'||key==='shadowOffset'||key==='shadowOpacity'||key==='shadowRadius'||key==='elevation')continue;
    result[key]=value;
  }
  if(source.shadowColor){
    const offset=source.shadowOffset||{width:0,height:2};
    const opacity=source.shadowOpacity??.18;
    const radius=source.shadowRadius??Math.max(2,Number(source.elevation)||2);
    result.boxShadow=`${px(offset.width||0)} ${px(offset.height||0)} ${px(radius)} color-mix(in srgb, ${source.shadowColor} ${Math.round(opacity*100)}%, transparent)`;
  }
  if(source.textShadowColor){
    const offset=source.textShadowOffset||{width:0,height:1};
    result.textShadow=`${px(offset.width||0)} ${px(offset.height||0)} ${px(source.textShadowRadius||1)} ${source.textShadowColor}`;
  }
  return result as CSSProperties;
};
const flat=(style:any):CSSProperties|undefined=>style?normalize(style):undefined;
const uri=(source:any)=>typeof source==='string'?source:source?.uri||source?.default||'';
const clean=({accessibilityLabel,accessibilityRole,accessibilityState,accessibilityViewIsModal,accessible,testID,onPress,hitSlop,contentContainerStyle,showsVerticalScrollIndicator,keyboardShouldPersistTaps,pointerEvents,numberOfLines,resizeMode,allowFontScaling,maxFontSizeMultiplier,adjustsFontSizeToFit,minimumFontScale,scrollEventThrottle,refreshControl,keyboardDismissMode,behavior,presentationStyle,statusBarTranslucent,animationType,thumbColor,trackColor,...props}:any)=>({...props,role:accessibilityRole==='header'?'heading':accessibilityRole,'aria-label':accessibilityLabel,'aria-current':accessibilityState?.selected?'page':undefined,'aria-selected':accessibilityState?.selected,'aria-disabled':accessibilityState?.disabled,'aria-busy':accessibilityState?.busy,'aria-expanded':accessibilityState?.expanded,'data-testid':testID});
const flexBase:CSSProperties={display:'flex',flexDirection:'column',minWidth:0,minHeight:0};
export const View=forwardRef<any,any>(({style,children,...props},ref)=><div ref={ref} style={{...flexBase,...flat(style)}} {...clean(props)}>{children}</div>);
export const Text=forwardRef<any,any>(({style,children,numberOfLines,...props},ref)=><span ref={ref} style={{...flat(style),...(numberOfLines?{display:'-webkit-box',WebkitLineClamp:numberOfLines,WebkitBoxOrient:'vertical',overflow:'hidden'}:{})}} {...clean(props)}>{children}</span>);
export const Pressable=forwardRef<any,any>(({style,children,onPress,disabled,...props},ref)=>{const[pressed,setPressed]=useState(false);const resolved=typeof style==='function'?style({pressed}):style;return <button ref={ref} type="button" disabled={disabled} onClick={onPress} onPointerDown={()=>setPressed(true)} onPointerUp={()=>setPressed(false)} onPointerLeave={()=>setPressed(false)} style={{...flexBase,border:0,padding:0,font:'inherit',textAlign:'inherit',background:'transparent',cursor:disabled?'default':'pointer',...flat(resolved)}} {...clean(props)}>{typeof children==='function'?children({pressed}):children}</button>});
export const TextInput=forwardRef<any,any>(({style,multiline,onChangeText,onSubmitEditing,secureTextEntry,value,defaultValue,keyboardType,inputMode,editable=true,placeholderTextColor,selectionColor,selectTextOnFocus,...props},ref)=>{const type=secureTextEntry?'password':keyboardType==='email-address'?'email':keyboardType==='phone-pad'?'tel':keyboardType==='url'?'url':'text';const mode=inputMode??(keyboardType==='numeric'?'numeric':keyboardType==='decimal-pad'?'decimal':keyboardType==='phone-pad'?'tel':keyboardType==='email-address'?'email':undefined);const shared={ref,value,defaultValue,disabled:editable===false,inputMode:mode,style:{...flat(style),...(placeholderTextColor?{'--cda-placeholder':placeholderTextColor} as any:{}),...(selectionColor?{caretColor:selectionColor}:{})},onFocus:(e:any)=>{if(selectTextOnFocus)e.currentTarget.select();props.onFocus?.(e)},onChange:(e:any)=>onChangeText?.(e.target.value),onKeyDown:(e:any)=>{props.onKeyDown?.(e);if(e.key==='Enter'&&!multiline)onSubmitEditing?.({nativeEvent:{text:e.currentTarget.value},target:e.currentTarget})},...clean({...props,onFocus:undefined,onKeyDown:undefined})};return multiline?<textarea {...shared}/>:<input type={type} {...shared}/>});
export const Image=forwardRef<any,any>(({source,style,resizeMode='cover',...props},ref)=><img ref={ref} src={uri(source)} style={{display:'block',objectFit:resizeMode,...flat(style)}} {...clean(props)}/>);
export function ImageBackground({source,style,imageStyle,children,...props}:PropsWithChildren<any>){
  const image=rawFlat(imageStyle);
  return <div style={{...flexBase,backgroundImage:`url("${uri(source)}")`,backgroundSize:image.resizeMode||'cover',backgroundPosition:'center',backgroundRepeat:'no-repeat',...flat(style),...(image.borderRadius!=null?{borderRadius:image.borderRadius}:{})}} {...clean(props)}>{children}</div>
}
export const ScrollView=forwardRef<any,any>(({style,contentContainerStyle,children,horizontal,onScroll,...props},ref)=>{const outer=flat(style);const inner=flat(contentContainerStyle)||{};const grows=Number((inner as any).flexGrow)>0;return <div ref={ref} onScroll={onScroll?(e:any)=>onScroll({nativeEvent:{contentOffset:{x:e.currentTarget.scrollLeft,y:e.currentTarget.scrollTop},contentSize:{width:e.currentTarget.scrollWidth,height:e.currentTarget.scrollHeight},layoutMeasurement:{width:e.currentTarget.clientWidth,height:e.currentTarget.clientHeight}}}):undefined} style={{...flexBase,flex:'1 1 0%',width:'100%',maxWidth:'100%',overflowX:horizontal?'auto':'hidden',overflowY:horizontal?'hidden':'auto',WebkitOverflowScrolling:'touch',...outer}} {...clean(props)}><div style={{...flexBase,width:'100%',maxWidth:'100%',...(grows?{minHeight:'100%',flexGrow:0}:{}),...inner,...(grows?{minHeight:'100%',flexGrow:0}:{})}}>{children}</div></div>});
export function FlatList({data=[],renderItem,keyExtractor,ListHeaderComponent,ListEmptyComponent,ListFooterComponent,ItemSeparatorComponent,style,contentContainerStyle,numColumns=1,horizontal,...props}:any){const component=(value:any)=>typeof value==='function'?React.createElement(value):value;return <div style={{...flexBase,overflowX:horizontal?'auto':undefined,...flat(style)}} {...clean(props)}><div style={{...flexBase,...flat(contentContainerStyle),...(numColumns>1?{display:'grid',gridTemplateColumns:`repeat(${numColumns},minmax(0,1fr))`}:horizontal?{flexDirection:'row'}:{})}}>{component(ListHeaderComponent)}{data.length?data.map((item:any,index:number)=><React.Fragment key={keyExtractor?.(item,index)??index}>{renderItem({item,index,separators:{}})}{index<data.length-1?component(ItemSeparatorComponent):null}</React.Fragment>):component(ListEmptyComponent)}{component(ListFooterComponent)}</div></div>}
export function Modal({visible=true,children,onRequestClose,transparent,...props}:PropsWithChildren<any>){useEffect(()=>{if(!visible)return;const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')onRequestClose?.()};window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc)},[visible,onRequestClose]);if(!visible||typeof document==='undefined')return null;return createPortal(<div role="dialog" aria-modal="true" style={{position:'fixed',inset:0,zIndex:1000,display:'flex',...(transparent?{}:{background:'#fff'})}} {...clean(props)}>{children}</div>,document.body)}
export function ActivityIndicator({size=24,color='#0F8A43',style}:any){const px=size==='large'?36:size==='small'?18:size;return <span aria-label="Loading" style={{width:px,height:px,border:`3px solid ${color}33`,borderTopColor:color,borderRadius:'50%',display:'inline-block',animation:'cda-spin .8s linear infinite',...flat(style)}}/>}
export function Switch({value,onValueChange,disabled,style,...props}:any){return <label className="cda-switch" style={flat(style)}><input aria-label={props.accessibilityLabel} type="checkbox" role="switch" checked={!!value} disabled={disabled} onChange={e=>onValueChange?.(e.target.checked)}/><span/></label>}
export function KeyboardAvoidingView({children,style,...props}:PropsWithChildren<any>){return <View style={style} {...props}>{children}</View>}
export function RefreshControl(_props:any){return null}
export const Platform={OS:Capacitor.getPlatform(),select:(values:any)=>values[Capacitor.getPlatform()]??values.default,isPad:false};
export const StyleSheet={create:<T,>(styles:T)=>styles,flatten:flat,absoluteFill:{position:'absolute',inset:0},absoluteFillObject:{position:'absolute',inset:0},hairlineWidth:1};
export const Alert={alert:(title:string,message?:string,buttons?:any[])=>{const choice=buttons?.find(x=>x.style!=='cancel');if(choice&&window.confirm(`${title}\n\n${message||''}`))choice.onPress?.();else if(!buttons)window.alert(`${title}${message?`\n\n${message}`:''}`)}};
export const Linking={openURL:async(url:string)=>{window.open(url,'_blank','noopener,noreferrer')},canOpenURL:async()=>true,openSettings:async()=>{window.location.href='about:preferences'}};
export const Share={share:async(data:any)=>navigator.share?navigator.share(data):navigator.clipboard.writeText(data.url||data.message||'')};
export const Keyboard={dismiss:()=>{(document.activeElement as HTMLElement)?.blur?.()},addListener:()=>({remove(){}})};
export const NativeModules={};
export function useWindowDimensions(){const[size,setSize]=useState(()=>({width:window.innerWidth,height:window.innerHeight,scale:window.devicePixelRatio,fontScale:1}));useEffect(()=>{const update=()=>setSize({width:window.innerWidth,height:window.innerHeight,scale:window.devicePixelRatio,fontScale:1});window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update)},[]);return size}
export function useColorScheme(){return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
export type NativeScrollEvent=any;export type NativeSyntheticEvent<T=any>=any;export type PressableProps=any;export type SwitchProps=any;export type TextInputProps=any;export type TextProps=any;export type TextInput=any;export type View=any;export type ViewStyle=any;export type TextStyle=any;export type StyleProp<T=any>=T|T[]|null|undefined;
