import {HomeWeather} from './HomeWeather';
import {useEffect,useState} from 'react';
import {useInfiniteQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {MessageCircle,Megaphone,CalendarDays,ShoppingBag,Vote} from 'lucide-react';
import {api,str,type RecordData} from './api';
import {useSession} from './auth';
import {Page,Loading,ErrorBox} from './ui';
import {HeaderSearch} from './HeaderSearch';
import {getLocale} from './i18n';
import './home-activities.css';
const sources=[['feed','Post',MessageCircle],['announcements','Announcement',Megaphone],['meetings','Meeting',CalendarDays],['events','Event',CalendarDays],['marketplace','Marketplace',ShoppingBag],['polls','Poll',Vote]] as const;
export function activityLink(type:string,community:string,id:string){const base='/community/'+encodeURIComponent(community);switch(type){case 'feed':return '/post/'+encodeURIComponent(id);case 'announcements':return base+'/announcements?announcement='+encodeURIComponent(id);case 'meetings':return base+'/meetings?meeting='+encodeURIComponent(id);case 'events':return base+'/events?event='+encodeURIComponent(id);case 'marketplace':return base+'/marketplace?listing='+encodeURIComponent(id);case 'polls':return '/poll/'+encodeURIComponent(community)+'/'+encodeURIComponent(id);default:return base+'/feed'}}
export function greeting(hour:number){return hour<12?'Good morning':hour<17?'Good afternoon':'Good evening'}
type ActivityPage={items:RecordData[];nextCursor:string|null};
export function Home(){const session=useSession(),[now,setNow]=useState(()=>new Date()),[search,setSearch]=useState(''),[query,setQuery]=useState('');
 useEffect(()=>{const timer=setTimeout(()=>setQuery(search.trim()),300);return()=>clearTimeout(timer)},[search]);
 useEffect(()=>{const update=()=>setNow(new Date()),timer=setInterval(update,60000);window.addEventListener('focus',update);return()=>{clearInterval(timer);window.removeEventListener('focus',update)}},[]);
 const feed=useInfiniteQuery({queryKey:['recent-activity',query],initialPageParam:'',queryFn:({pageParam,signal})=>api.get<ActivityPage>('/me/recent-activity?q='+encodeURIComponent(query)+'&cursor='+encodeURIComponent(pageParam),signal),getNextPageParam:last=>last.nextCursor??undefined,staleTime:30000});
 const activities=feed.data?.pages.flatMap(p=>p.items)||[];
 return <Page title={greeting(now.getHours())+(session?.user.FirstName?', '+session.user.FirstName:'')} subtitle="Catch up on what’s happening in your communities." action={<HomeWeather/>}><div className="home-activities"><HeaderSearch label="Search activities"><input aria-label="Search recent activities" placeholder="Search activities and communities…" value={search} maxLength={200} onChange={e=>setSearch(e.target.value)}/></HeaderSearch><h2>Recent activities</h2><ErrorBox error={feed.error}/>{feed.isPending?<Loading/>:<>{!activities.length&&!feed.error&&<div className="empty"><p>{query?'No activities match your search.':'No recent activities in your communities.'}</p><Link className="button" to="/communities">Find communities</Link></div>}<div className="home-activity-list">{activities.map(r=>{const [type,label,Icon]=sources.find(x=>x[0]===r.Kind)||sources[0];return <Link className="home-activity-card" key={type+str(r.Id)} to={activityLink(type,str(r.CommunityId),str(r.Id))}><span className="home-activity-icon"><Icon size={21}/></span><div className="home-activity-copy"><div className="home-activity-meta"><span>{str(r.CommunityName)}</span><span>{label}</span></div><h3>{str(r.Title)||label}</h3>{!!r.Body&&<p>{str(r.Body)}</p>}<time dateTime={str(r.CreatedAt)}>{new Date(str(r.CreatedAt)).toLocaleString(getLocale(),{dateStyle:'medium',timeStyle:'short'})}</time></div></Link>})}</div>{feed.isFetchNextPageError?<button onClick={()=>void feed.fetchNextPage()}>Retry loading more activities</button>:feed.hasNextPage&&<button className="home-activity-more" disabled={feed.isFetchingNextPage} onClick={()=>void feed.fetchNextPage()}>{feed.isFetchingNextPage?'Loading…':'Load more activities'}</button>}{feed.isError&&!feed.isFetchNextPageError&&<button onClick={()=>void feed.refetch()}>Retry</button>}</>}</div></Page>
}
