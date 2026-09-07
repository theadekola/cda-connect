import {QRCodeSVG} from 'qrcode.react';

export default function QRCode({value,size=128,color='#000',backgroundColor='#fff'}:any){
  return <QRCodeSVG value={String(value||'')} size={size} fgColor={color} bgColor={backgroundColor}/>;
}
