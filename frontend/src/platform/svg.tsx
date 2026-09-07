import type {PropsWithChildren} from 'react';
export default function Svg({children,...props}:PropsWithChildren<any>){return <svg {...props}>{children}</svg>}
export function Circle(props:any){return <circle {...props}/>}
export function Polyline(props:any){return <polyline {...props}/>}
