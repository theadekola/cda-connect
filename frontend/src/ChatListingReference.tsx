import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {api,str,type RecordData} from './api';
import {TranslatedText} from './TranslatedText';
export function ChatListingReference({message}:{message:RecordData}){
 const text=str(message.MessageText),match=/^Marketplace listing\nhttps:\/\/cdaconnect\.org(\/community\/([a-f0-9-]{36})\/marketplace\?listing=([a-f0-9-]{36}))$/i.exec(text);
 const listing=useQuery({queryKey:['/marketplace/'+match?.[3]],queryFn:()=>api.get<RecordData>('/marketplace/'+match![3]),enabled:!!match,retry:false});
 if(!match)return <TranslatedText type="message" id={str(message.Id)} text={text}/>;
 const item=listing.data;
 return <Link className="chat-listing-reference" to={match[1]}><small>Marketplace advert</small>{!!item?.ImageUrl&&<img src={api.asset(str(item.ImageUrl))} alt=""/>}<strong>{str(item?.Title)||'View marketplace listing'}</strong><span>{listing.error?'Open original advert (it may no longer be available)':'Open advert'}</span></Link>;
}
