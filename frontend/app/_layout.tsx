import { Stack, usePathname, useRouter } from '@/router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from '@/platform/react-native';
import { Ionicons } from '@/platform/icons';
import { StatusBar } from '@/platform/status-bar';
import { SafeAreaView, useSafeAreaInsets } from '@/platform/safe-area';
import { useAuth } from '@/store/auth';
import { colors } from '@/theme';
import { useAccessibility } from '@/store/accessibility';
import {translate,type TranslationKey} from '@/i18n';
import {useAppTheme} from '@/components/UI';
import {useQuery} from '@tanstack/react-query';
import {api} from '@/lib/api';
import {completePendingCommunityInvite} from '@/lib/communityInvite';
import {notificationKey,useNotificationReads} from '@/store/notificationReads';
import * as Notifications from '@/platform/notifications';
import {notificationPath,registerForPushNotifications} from '@/lib/pushNotifications';
import {useCommunity} from '@/store/community';
import appLogo from '../assets/branding/cda-connect-logo.png';

const qc=new QueryClient();

const desktopLinks=[
  ['home-outline','Home','/(tabs)/home'],
  ['people-outline','Communities','/(tabs)/communities'],
  ['sparkles-outline','Assistant','/(tabs)/assistant'],
  ['settings-outline','Settings','/(tabs)/settings'],
] as const;
const navKey:Record<string,TranslationKey>={Home:'home',Communities:'communities',Assistant:'calendar',Profile:'profile',Settings:'settings'};

function DesktopShell({children}:{children:React.ReactNode}){
  const{width}=useWindowDimensions();
  const pathname=usePathname();
  const router=useRouter();
  const{accessToken,user}=useAuth();
  const{palette}=useAppTheme();
  const language=useAccessibility(x=>x.language);
  const selectedCommunity=useCommunity(state=>state.current);
  const[open,setOpen]=useState(false);
  const[search,setSearch]=useState('');
  const desktop=Platform.OS==='web'&&width>=768;
  const publicPage=pathname==='/'||pathname.startsWith('/login')||pathname.startsWith('/register')||pathname.startsWith('/forgot-password');
  const communityMatch=pathname.match(/^\/community\/([^/]+)/);
  const routeCommunityId=communityMatch?.[1];
  const conversationMatch=pathname.match(/^\/chat\/([^/]+)/);
  const conversationId=conversationMatch?.[1];
  const conversation=useQuery<any>({queryKey:['conversation',conversationId],queryFn:async()=>(await api.get(`/conversations/${conversationId}`)).data,enabled:Boolean(desktop&&accessToken&&conversationId),staleTime:30000});
  const communityId=routeCommunityId||conversation.data?.CommunityId;
  const community=useQuery<any>({queryKey:['community',communityId],queryFn:async()=>(await api.get(`/communities/${communityId}`)).data,enabled:Boolean(desktop&&accessToken&&communityId),staleTime:30000});
  const capabilities=useQuery<any>({queryKey:['capabilities',communityId],queryFn:async()=>(await api.get(`/communities/${communityId}/capabilities`)).data,enabled:Boolean(desktop&&accessToken&&communityId),staleTime:30000});
  if(!desktop||!accessToken||publicPage)return <>{children}</>;
  const sidebarWidth=open?264:84;
  const navigationWidth=sidebarWidth;
  const active=(path:string)=>{const clean=path.replace('/(tabs)','');return pathname===clean||(clean!=='/home'&&pathname.startsWith(clean))};
  const title=conversationId?'Chat':pageTitle(pathname);
  const communityName=community.data?.Name||conversation.data?.CommunityName||(selectedCommunity?.Id===communityId?selectedCommunity?.Name:null);
  const communityRoles=(capabilities.data?.roles||[]).map((role:any)=>String(role).toLowerCase());
  const communityManager=communityRoles.some((role:string)=>['owner','admin','moderator'].includes(role));
  const permitted=(permission:string)=>communityManager&&capabilities.data?.permissions?.includes(permission);
  const name=`${user?.FirstName||''} ${user?.LastName||''}`.trim()||'CDA Member';
  const initials=name.split(' ').filter(Boolean).slice(0,2).map(value=>value[0]).join('').toUpperCase();
  const submitSearch=()=>{const term=search.trim();if(!term)return;router.push({pathname:'/(tabs)/communities',params:{headerSearch:term}} as any)};
  const communityLinks=communityId?[
    ['business-outline','Community Profile',`/community/${communityId}/community-profile`],
    ['newspaper-outline','Feed',`/community/${communityId}/feed`],
    ['chatbubbles-outline','Chat',`/community/${communityId}/chat`],
    ['calendar-outline','Events',`/community/${communityId}/events`],
    ['people-outline','Meetings',`/community/${communityId}/meetings`],
    ['stats-chart-outline','Polls',`/community/${communityId}/polls`],
    ['folder-open-outline','Documents',`/community/${communityId}/document-folders`],
    ['people-circle-outline','Members',`/community/${communityId}/members`],
    ['card-outline','Membership Card',`/community/${communityId}/membership-card`],
    ['wallet-outline','Finance',`/community/${communityId}/finance`],
    ['receipt-outline','Financial Records',`/community/${communityId}/financial-record`],
    ['ribbon-outline','Governance',`/community/${communityId}/governance`],
    ['checkmark-done-outline','Decisions',`/community/${communityId}/decisions`],
    ['storefront-outline','Local Services',`/community/${communityId}/services`],
    ['basket-outline','Marketplace',`/community/${communityId}/marketplace`],
    ['shield-outline','Executive Team',`/community/${communityId}/excos`],
    ['flag-outline','Moderation',`/community/${communityId}/moderation`],
    ['analytics-outline','Analytics',`/community/${communityId}/analytics`],
  ] as const:[];
  const communityTopActions=routeCommunityId?<>
    {pathname===`/community/${communityId}/feed`?<><Pressable accessibilityLabel="Create community content" onPress={()=>router.setParams({createMenu:String(Date.now())} as any)} style={[shellStyles.desktopTopAction,{borderColor:palette.border}]}><Ionicons name="add-circle-outline" size={23} color={palette.text}/></Pressable><Pressable accessibilityLabel="Search community feed" onPress={()=>router.setParams({showSearch:String(Date.now())} as any)} style={[shellStyles.desktopTopAction,{borderColor:palette.border}]}><Ionicons name="search-outline" size={21} color={palette.text}/></Pressable></>:null}
    {pathname===`/community/${communityId}/chat`&&capabilities.data?<Pressable accessibilityLabel="Create group chat" onPress={()=>router.setParams({createGroup:'1'} as any)} style={[shellStyles.desktopTopAction,{borderColor:palette.border}]}><Ionicons name="people-circle-outline" size={22} color={palette.text}/></Pressable>:null}
    {pathname===`/community/${communityId}/events`&&capabilities.data?<Pressable accessibilityLabel="Create event" onPress={()=>router.setParams({createEvent:'1'} as any)} style={[shellStyles.desktopTopAction,{borderColor:palette.border}]}><Ionicons name="calendar-number-outline" size={22} color={palette.text}/></Pressable>:null}
    {pathname===`/community/${communityId}/meetings`&&permitted('MEETING_CREATE')?<Pressable accessibilityLabel="Schedule a meeting" onPress={()=>router.push(`/community/${communityId}/create-meeting` as any)} style={[shellStyles.desktopTopAction,{borderColor:palette.border}]}><Ionicons name="calendar-outline" size={22} color={palette.text}/></Pressable>:null}
    {pathname===`/community/${communityId}/members`&&permitted('MEMBER_INVITE')?<Pressable accessibilityLabel="Invite members" onPress={()=>router.setParams({inviteMembers:'1'} as any)} style={[shellStyles.desktopTopAction,{borderColor:palette.border}]}><Ionicons name="person-add-outline" size={22} color={palette.text}/></Pressable>:null}
    {pathname===`/community/${communityId}/financial-record`&&permitted('FINANCE_MANAGE')?<Pressable accessibilityLabel="Create levy" onPress={()=>router.push(`/community/${communityId}/create-levy` as any)} style={[shellStyles.desktopTopAction,{borderColor:palette.border}]}><Ionicons name="wallet-outline" size={22} color={palette.text}/></Pressable>:null}
    {pathname===`/community/${communityId}/services`&&capabilities.data?<Pressable accessibilityLabel="Add service" onPress={()=>router.setParams({addService:'1'} as any)} style={[shellStyles.desktopTopAction,{borderColor:palette.border}]}><Ionicons name="storefront-outline" size={22} color={palette.text}/></Pressable>:null}
    {pathname===`/community/${communityId}/excos`&&permitted('MEMBER_ROLE_CHANGE')?<Pressable accessibilityLabel="Add Exco" onPress={()=>router.setParams({addExco:'1'} as any)} style={[shellStyles.desktopTopAction,{borderColor:palette.border}]}><Ionicons name="person-add-outline" size={22} color={palette.text}/></Pressable>:null}
    {pathname===`/community/${communityId}/community-profile`?<><Pressable accessibilityLabel="Invite people" onPress={()=>router.setParams({invite:String(Date.now())} as any)} style={[shellStyles.desktopTopAction,{borderColor:palette.border}]}><Ionicons name="person-add-outline" size={22} color={palette.text}/></Pressable>{permitted('MEMBER_ROLE_CHANGE')?<Pressable accessibilityLabel="Edit community profile" onPress={()=>router.setParams({edit:'1'} as any)} style={[shellStyles.desktopTopAction,{borderColor:palette.border}]}><Ionicons name="create-outline" size={22} color={palette.text}/></Pressable>:null}</>:null}
    {pathname===`/community/${communityId}/polls`?<Pressable accessibilityLabel="Create poll" onPress={()=>router.push(`/community/${communityId}/create-poll` as any)} style={[shellStyles.desktopTopAction,{borderColor:palette.border}]}><Ionicons name="add-circle-outline" size={23} color={palette.text}/></Pressable>:null}
    {pathname===`/community/${communityId}/documents`&&permitted('DOCUMENT_MANAGE')?<Pressable accessibilityLabel="Upload document" onPress={()=>router.push({pathname:`/community/${communityId}/documents` as any,params:{create:'1'}})} style={[shellStyles.desktopTopAction,{borderColor:palette.border}]}><Ionicons name="cloud-upload-outline" size={23} color={palette.text}/></Pressable>:null}
    {pathname===`/community/${communityId}/document-folders`&&permitted('DOCUMENT_MANAGE')?<Pressable accessibilityLabel="Create folder" onPress={()=>router.push(`/community/${communityId}/document-folder/create` as any)} style={[shellStyles.desktopTopAction,{borderColor:palette.border}]}><Ionicons name="folder-open-outline" size={23} color={palette.text}/></Pressable>:null}
  </>:null;
  return <View style={[shellStyles.shell,{backgroundColor:palette.background}]}>
    <View {...({onMouseEnter:()=>setOpen(true),onMouseLeave:()=>setOpen(false)} as any)} style={[shellStyles.sidebar,{width:navigationWidth,backgroundColor:palette.background,borderRightColor:palette.border},Platform.OS==='web'&&({transitionProperty:'width',transitionDuration:'180ms',transitionTimingFunction:'ease-out'} as any)]}>
      <View style={shellStyles.desktopBrand}><View style={[shellStyles.desktopBrandMark,{backgroundColor:'#FFFFFF',overflow:'hidden'}]}><Image source={{uri:appLogo}} resizeMode="contain" style={{width:42,height:42,borderRadius:13,transform:[{scale:1.42}]}}/></View>{open?<View><Text style={[shellStyles.desktopBrandName,{color:palette.text}]}>CDA Connect</Text><Text style={[shellStyles.desktopBrandTag,{color:palette.muted}]}>Community workspace</Text></View>:null}</View>
      {open?<Text style={[shellStyles.desktopNavCaption,{color:palette.muted}]}>MAIN MENU</Text>:null}
      <View style={shellStyles.links}>{desktopLinks.map(([icon,label,path])=>{
        const selected=active(path);
        return <Pressable key={label} accessibilityRole="link" accessibilityLabel={label} onPress={()=>router.push(path as any)} style={[shellStyles.link,selected&&shellStyles.linkActive,!open&&shellStyles.linkClosed]}>
          <Ionicons name={(selected?icon.replace('-outline',''):icon) as any} size={22} color={selected?'#FFFFFF':palette.text}/>
          {open?<Text style={[shellStyles.label,{color:selected?'#FFFFFF':palette.text},selected&&shellStyles.labelActive]}>{label==='Assistant'?'CDA Assistant':translate(language,navKey[label])}</Text>:null}
        </Pressable>;
      })}</View>
      <Pressable accessibilityRole="link" accessibilityLabel="Open profile" onPress={()=>router.push('/(tabs)/profile' as any)} style={[shellStyles.desktopSidebarFooter,{borderTopColor:palette.border},active('/(tabs)/profile')&&{backgroundColor:palette.primarySoft}]}><View style={shellStyles.sidebarAvatar}>{user?.ProfileImage?<Image source={{uri:user.ProfileImage}} style={shellStyles.sidebarAvatarImage}/>:<Text style={shellStyles.sidebarAvatarText}>{initials}</Text>}</View>{open?<View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={[shellStyles.sidebarUserName,{color:palette.text}]}>{name}</Text><Text numberOfLines={1} style={[shellStyles.sidebarUserRole,{color:palette.muted}]}>Community member</Text></View>:null}</Pressable>
    </View>
    <View style={[shellStyles.content,{marginLeft:sidebarWidth}]}><View style={[shellStyles.desktopTopbar,{backgroundColor:palette.surface,borderBottomColor:palette.border}]}><View style={shellStyles.desktopTitleBlock}><Text numberOfLines={1} style={[shellStyles.desktopPageTitle,{color:palette.text}]}>{communityId?(communityName||'Community'):title}</Text><Text numberOfLines={1} style={[shellStyles.desktopBreadcrumb,{color:palette.muted}]}>{communityId?title:`CDA Connect  /  ${title}`}</Text></View><View style={[shellStyles.desktopSearch,{backgroundColor:palette.background,borderColor:palette.border}]}><Ionicons name="search-outline" size={20} color={palette.muted}/><TextInput accessibilityLabel="Search CDA Connect" placeholder="Search communities, posts and events" placeholderTextColor={palette.muted} value={search} onChangeText={setSearch} onSubmitEditing={submitSearch} style={[shellStyles.desktopSearchInput,{color:palette.text}]}/>{search?<Pressable accessibilityLabel="Clear search" onPress={()=>setSearch('')}><Ionicons name="close-circle" size={19} color={palette.muted}/></Pressable>:null}</View>{communityTopActions}<Pressable accessibilityLabel="Notifications" onPress={()=>router.push('/notifications' as any)} style={[shellStyles.desktopTopAction,{borderColor:palette.border}]}><Ionicons name="notifications-outline" size={22} color={palette.text}/></Pressable></View><View style={shellStyles.desktopPage}>{communityLinks.length?<View style={shellStyles.communityMenuRail}><View style={[shellStyles.communityMenuCard,{backgroundColor:palette.surface}]}><Text style={[shellStyles.communityMenuTitle,{color:palette.text}]}>Community Menu</Text><ScrollView style={shellStyles.communityMenuScroll} contentContainerStyle={shellStyles.communityMenuList} showsVerticalScrollIndicator={false}>{(communityLinks as ReadonlyArray<readonly [string,string,string]>).map(([icon,label,path])=>{const selected=pathname===path||(label==='Chat'&&Boolean(conversationId));return <Pressable key={label} accessibilityRole="link" accessibilityLabel={label} onPress={()=>router.push(path as any)} style={[shellStyles.communityMenuLink,selected&&{backgroundColor:palette.primarySoft}]}><Ionicons name={icon as any} size={21} color={selected?palette.primary:palette.navy}/><Text numberOfLines={1} style={[shellStyles.communityMenuText,{color:selected?palette.primary:palette.text}]}>{label}</Text></Pressable>})}</ScrollView></View></View>:null}<View style={shellStyles.desktopPageContent}>{children}</View></View></View>
  </View>;
}

const mobileLinks=[
  ['home-outline','Home','/(tabs)/home'],
  ['people-outline','Communities','/(tabs)/communities'],
  ['sparkles-outline','Assistant','/(tabs)/assistant'],
  ['person-outline','Profile','/(tabs)/profile'],
  ['settings-outline','Settings','/(tabs)/settings'],
] as const;

const routeTitles:Record<string,string>={
  '/communities':'Communities','/calendar':'Calendar','/assistant':'CDA Assistant','/profile':'Profile','/profile-edit':'Edit Profile','/settings':'Settings','/notifications':'Notifications',
  '/create-community':'Create Community','/privacy':'Privacy & Safety','/notifications-settings':'Notifications',
  '/accessibility':'Appearance','/language':'Language','/communications':'Communications','/community-preferences':'Community Preferences',
  '/data-usage':'Data & Storage','/security':'Security','/help':'Help & Support','/about':'About CDA Connect','/change-password':'Change Password',
  '/two-factor':'Two-Factor Authentication','/delete-account':'Delete Account','/trusted-contacts':'Trusted Contacts','/search':'Search',
  '/terms-of-service':'Terms of Service','/privacy-policy':'Privacy Policy','/community-guidelines':'Community Guidelines',
  '/our-mission':'Our Mission','/our-vision':'Our Vision','/our-values':'Our Values','/built-for-communities':'Built for Communities',
  '/join-community':'Join Community','/blocked-users':'Blocked Users',
};
const communityRouteTitles:Record<string,string>={
  feed:'Feed','create-post':'Post to Feed',members:'Members',member:'Member Profile',chat:'Chat',events:'Events',issues:'Report Issue','create-announcement':'Post Announcement',alerts:'Emergency','membership-card':'Member Card',meetings:'Meetings',
  'create-meeting':'Schedule a Meeting',meeting:'General Meeting','take-attendance':'Take Attendance','mark-attendance':'Mark Attendance','attendance-history':'Attendance History',
  attendance:'Take Attendance','financial-record':'Financial Record','my-financial-record':'My Financial Record','create-levy':'Create Levy',levy:'Levy','pay-levy':'Pay Levy',
  announcements:'Announcements',requests:'Join Requests',services:'Local Services',excos:'Excos','past-excos':'Past Excos',marketplace:'Marketplace','post-marketplace-item':'Post Item',governance:'Governance',
  'formal-voting':'Formal Voting',decisions:'Decisions',documents:'Document Center','document-folders':'Document Folders','document-folder':'Document Folder',document:'Document Viewer',finance:'Finance',polls:'Polls',moderation:'Moderation',
  analytics:'Analytics',assistant:'CDA Assistant','smart-summary':'Summary',verification:'Community Verification','community-profile':'Community Profile','scan-card':'Scan Membership Card','emergency-command':'Emergency Command',proposal:'Proposal',poll:'Poll Details',
};
function pageTitle(pathname:string){
  if(routeTitles[pathname])return routeTitles[pathname];
  const community=pathname.match(/^\/community\/[^/]+(?:\/([^/]+))?/);
  if(community)return community[1]?communityRouteTitles[community[1]]||'Community':'Community';
  const part=pathname.split('/').filter(Boolean).pop()||'CDA Connect';
  return part.split('-').map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(' ');
}
function AuthenticatedShell({children}:{children:React.ReactNode}){
  const insets=useSafeAreaInsets();
  const{width}=useWindowDimensions();
  const pathname=usePathname();
  const router=useRouter();
  const{accessToken,user,updateUser}=useAuth();
  const currentCommunity=useCommunity(state=>state.current);
  const accessibility=useAccessibility();
  const[modeOpen,setModeOpen]=useState(false);
  const[headerSearchOpen,setHeaderSearchOpen]=useState(false);
  const[headerSearch,setHeaderSearch]=useState('');
  const language=accessibility.language;
  const{palette,dark}=useAppTheme();
  const desktop=Platform.OS==='web'&&width>=768;
  const publicPage=pathname==='/'||pathname.startsWith('/login')||pathname.startsWith('/register')||pathname.startsWith('/forgot-password');
  const homePage=pathname==='/home';
  const communitiesPage=pathname==='/communities';
  const calendarPage=pathname==='/calendar';
  const profileEditPage=pathname==='/profile-edit';
  const settingsBackPage=pathname==='/privacy'||pathname==='/blocked-users'||pathname==='/notifications-settings'||pathname==='/language'||pathname==='/communications'||pathname==='/community-preferences'||pathname==='/data-usage'||pathname==='/security'||pathname==='/change-password'||pathname==='/two-factor'||pathname==='/help'||pathname==='/about'||pathname==='/delete-account'||pathname==='/terms-of-service'||pathname==='/privacy-policy'||pathname==='/community-guidelines'||pathname==='/our-mission'||pathname==='/our-vision'||pathname==='/our-values'||pathname==='/built-for-communities';
  const communityMatch=pathname.match(/^\/community\/([^/]+)/);
  const communityId=communityMatch?.[1];
  const communityPage=Boolean(communityId);
  const communityWorkspacePage=Boolean(communityId)&&pathname===`/community/${communityId}`;
  const conversationPage=/^\/chat\/[^/]+/.test(pathname);
  const postDetailPage=/^\/community\/[^/]+\/post\/[^/]+/.test(pathname);
  const focusedContentPage=conversationPage||postDetailPage;
  const translatedPageKey=pathname==='/home'?'home':pathname==='/communities'?'communities':pathname==='/calendar'?'calendar':pathname==='/profile'?'profile':pathname==='/settings'?'settings':pathname==='/language'?'language':null;
  const currentPageTitle=translatedPageKey?translate(language,translatedPageKey):pageTitle(pathname);
  const profile=useQuery({queryKey:['current-user-profile'],queryFn:async()=>(await api.get('/users/me')).data,enabled:Boolean(accessToken),refetchInterval:30000,refetchOnWindowFocus:true,staleTime:10000});
  const community=useQuery<any>({queryKey:['community',communityId],queryFn:async()=>(await api.get(`/communities/${communityId}`)).data,enabled:Boolean(accessToken&&communityId),staleTime:30000});
  const{readIds,load:loadNotificationReads}=useNotificationReads();
  const[notificationClock,setNotificationClock]=useState(Date.now());
  const handledNotificationIds=useRef(new Set<string>());
  const notifications=useQuery<any[]>({queryKey:['notifications'],queryFn:async()=>(await api.get('/me/notifications')).data,enabled:Boolean(accessToken&&!publicPage),refetchInterval:30000,refetchOnWindowFocus:true,staleTime:10000});
  useEffect(()=>{if(accessToken)void loadNotificationReads()},[accessToken,loadNotificationReads]);
  useEffect(()=>{
    if(!accessToken||Platform.OS==='web')return;
    void registerForPushNotifications().catch(error=>console.warn('Push notification registration failed',error));
    const openNotification=async(response:Notifications.NotificationResponse)=>{const request=response.notification.request,id=request.identifier;if(handledNotificationIds.current.has(id))return;handledNotificationIds.current.add(id);const data=request.content.data??{},communityId=typeof data.communityId==='string'?data.communityId:null;try{if(communityId)await api.get(`/communities/${communityId}`);router.push(notificationPath(data) as any)}catch{router.push('/notifications' as any)}finally{setTimeout(()=>handledNotificationIds.current.delete(id),30_000)}};
    const subscription=Notifications.addNotificationResponseReceivedListener(response=>{void openNotification(response)});
    void Notifications.getLastNotificationResponseAsync().then(response=>{
      if(response)void openNotification(response);
    });
    return()=>subscription.remove();
  },[accessToken,router]);
  useEffect(()=>{const timer=setInterval(()=>setNotificationClock(Date.now()),60000);return()=>clearInterval(timer)},[]);
  const unreadNotifications=(notifications.data||[]).filter(item=>new Date(item.CreatedAt).getTime()>notificationClock-336*60*60*1000&&!readIds[notificationKey(item)]).length;
  const openNotifications=()=>{if(pathname==='/notifications'){router.canGoBack()?router.back():router.replace('/(tabs)/home' as any);return}router.push('/notifications' as any)};
  const closeHeaderSearch=()=>{Keyboard.dismiss();setHeaderSearch('');setHeaderSearchOpen(false)};
  const submitHeaderSearch=()=>{
    const term=headerSearch.trim();
    if(!term)return;
    if(communityPage&&pathname.endsWith('/feed'))router.setParams({showSearch:String(Date.now()),headerSearch:term} as any);
    else router.push({pathname:'/(tabs)/communities',params:{headerSearch:term}} as any);
    closeHeaderSearch();
  };
const communityCapabilities=useQuery<any>({queryKey:['capabilities',communityId],queryFn:async()=>(await api.get(`/communities/${communityId}/capabilities`)).data,enabled:Boolean(accessToken&&communityId&&(pathname===`/community/${communityId}/chat`||pathname===`/community/${communityId}/events`||pathname===`/community/${communityId}/meetings`||pathname===`/community/${communityId}/members`||pathname===`/community/${communityId}/financial-record`||pathname===`/community/${communityId}/services`||pathname===`/community/${communityId}/excos`||pathname===`/community/${communityId}/community-profile`||pathname===`/community/${communityId}/documents`||pathname===`/community/${communityId}/document-folders`)),staleTime:30000});
  const communityRoles=(communityCapabilities.data?.roles||[]).map((role:any)=>String(role).toLowerCase());
  const hasCommunityManagementRole=communityRoles.some((role:string)=>['owner','admin','moderator'].includes(role));
  const canCreateChatGroup=Boolean(communityCapabilities.data);
  const canCreateEvent=Boolean(communityCapabilities.data);
  const canCreateMeeting=communityCapabilities.data?.permissions?.includes('MEETING_CREATE')&&hasCommunityManagementRole;
  const canInviteMembers=communityCapabilities.data?.permissions?.includes('MEMBER_INVITE')&&hasCommunityManagementRole;
const canManageFinance=communityCapabilities.data?.permissions?.includes('FINANCE_MANAGE')&&hasCommunityManagementRole;
const canAddDirectory=Boolean(communityCapabilities.data);
const canManageExcos=communityCapabilities.data?.permissions?.includes('MEMBER_ROLE_CHANGE')&&hasCommunityManagementRole;
const canEditCommunity=communityCapabilities.data?.permissions?.includes('MEMBER_ROLE_CHANGE')&&hasCommunityManagementRole;
const canManageDocuments=communityCapabilities.data?.permissions?.includes('DOCUMENT_MANAGE')&&hasCommunityManagementRole;
  useEffect(()=>{if(profile.data)void updateUser(profile.data)},[profile.data,updateUser]);
  useEffect(()=>{if(accessToken)void completePendingCommunityInvite().then(joined=>{if(joined)router.replace(`/community/${joined.Id}` as any)}).catch(()=>{})},[accessToken]);
  if(desktop||!accessToken||publicPage)return <>{children}</>;
  const selected=pathname==='/home'?'Home':pathname==='/assistant'?'Assistant':pathname==='/profile'||pathname.startsWith('/profile-edit')||pathname==='/language'?'Profile':pathname==='/communities'||pathname.startsWith('/community/')||pathname==='/calendar'?'Communities':pathname==='/settings'||pathname.startsWith('/privacy')||pathname.startsWith('/security')||pathname.startsWith('/change-password')||pathname.startsWith('/two-factor')||pathname.startsWith('/delete-account')||pathname.startsWith('/notifications-settings')||pathname.startsWith('/accessibility')||pathname.startsWith('/communications')||pathname.startsWith('/community-preferences')||pathname.startsWith('/data-usage')||pathname.startsWith('/help')||pathname.startsWith('/about')?'Settings':'';
  const name=`${user?.FirstName||''} ${user?.LastName||''}`.trim()||'CDA Member',initials=name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
  return <View style={[shellStyles.mobileShell,{backgroundColor:palette.background}]}>
    {!focusedContentPage?<SafeAreaView key={headerSearchOpen?'search-header':'page-header'} edges={['top']} style={[shellStyles.mobileHeader,Platform.OS==='web'&&({boxSizing:'border-box'} as any),{backgroundColor:palette.background,borderBottomColor:palette.border}]}>
      {headerSearchOpen?<View style={shellStyles.headerSearchRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close search" onPress={closeHeaderSearch} style={shellStyles.headerAction}><Ionicons name="chevron-back" size={22} color={palette.text}/></Pressable>
        <View style={[shellStyles.headerSearchBox,{backgroundColor:accessibility.themeMode==='dark'?palette.surface:'rgba(226,232,240,.62)'}]}>
          <Ionicons name="search-outline" size={21} color={palette.text}/>
          <TextInput autoFocus value={headerSearch} onChangeText={setHeaderSearch} onSubmitEditing={submitHeaderSearch} returnKeyType="search" placeholder={communityPage?'Search this community':'Search communities, posts and events'} placeholderTextColor={palette.muted} selectionColor={palette.primary} style={[shellStyles.headerSearchInput,{color:palette.text}]}/>
          {headerSearch?<Pressable accessibilityLabel="Clear search" onPress={()=>setHeaderSearch('')} style={shellStyles.headerSearchClear}><Ionicons name="close-circle" size={20} color={palette.text}/></Pressable>:null}
        </View>
      </View>:<>
      {homePage?<View style={shellStyles.mobileBrand}><Text numberOfLines={1} style={[shellStyles.homeBrandName,{color:palette.primary}]}>CDA Connect</Text></View>:communityPage?<View style={shellStyles.mobileBrand}><Pressable accessibilityLabel="Go back" onPress={()=>(router.canGoBack()?router.back():router.replace('/(tabs)/communities' as any))} style={shellStyles.headerAction}><Ionicons name="chevron-back" size={22} color={palette.text}/></Pressable><View style={shellStyles.pageHeaderCopy}><Text numberOfLines={1} style={[shellStyles.pageHeaderTitle,{color:palette.text}]}>{currentPageTitle}</Text><Text numberOfLines={1} style={[shellStyles.pageHeaderSubtitle,{color:palette.muted}]}>{community.data?.Name||'Community'}</Text></View></View>:<View style={shellStyles.mobileBrand}>{profileEditPage||settingsBackPage||calendarPage?<Pressable accessibilityLabel="Go back" onPress={()=>calendarPage?router.replace(currentCommunity?.Id?`/community/${currentCommunity.Id}` as any:'/(tabs)/communities' as any):(router.canGoBack()?router.back():router.replace(profileEditPage?'/(tabs)/profile':pathname==='/blocked-users'?'/privacy':pathname==='/change-password'||pathname==='/two-factor'?'/security':pathname==='/delete-account'?'/help':pathname==='/terms-of-service'||pathname==='/privacy-policy'||pathname==='/community-guidelines'||pathname==='/our-mission'||pathname==='/our-vision'||pathname==='/our-values'||pathname==='/built-for-communities'?'/about':'/(tabs)/settings' as any))} style={shellStyles.headerAction}><Ionicons name="chevron-back" size={22} color={palette.text}/></Pressable>:null}<Text numberOfLines={1} style={[shellStyles.pageHeaderTitle,{color:palette.text}]}>{currentPageTitle}</Text></View>}
      <View style={shellStyles.mobileHeaderActions}>
        {pathname==='/language'?<Pressable accessibilityRole="button" accessibilityLabel="Save language" disabled={!accessibility.draftLanguage} onPress={()=>void accessibility.saveLanguage().then(()=>router.replace('/(tabs)/profile' as any))} style={[shellStyles.headerAction,!accessibility.draftLanguage&&{opacity:.42}]}><Ionicons name="save-outline" size={22} color={accessibility.draftLanguage?palette.text:palette.muted}/></Pressable>:communityPage&&!communityWorkspacePage?<>
          {pathname===`/community/${communityId}/feed`?<><Pressable accessibilityRole="button" accessibilityLabel="Create community content" onPress={()=>router.setParams({createMenu:String(Date.now())} as any)} style={shellStyles.headerIconAction}><Ionicons name="add-circle-outline" size={25} color={palette.text}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Search community feed" onPress={()=>setHeaderSearchOpen(true)} style={shellStyles.headerAction}><Ionicons name="search-outline" size={22} color={palette.text}/></Pressable></>:null}
          {pathname===`/community/${communityId}/chat`&&canCreateChatGroup?<Pressable accessibilityRole="button" accessibilityLabel="Create group chat" onPress={()=>router.setParams({createGroup:'1'} as any)} style={shellStyles.headerIconAction}><Ionicons name="people-circle-outline" size={22} color={palette.text}/></Pressable>:null}
          {pathname===`/community/${communityId}/events`&&canCreateEvent?<Pressable accessibilityRole="button" accessibilityLabel="Create event" onPress={()=>router.setParams({createEvent:'1'} as any)} style={shellStyles.headerIconAction}><Ionicons name="calendar-number-outline" size={22} color={palette.text}/></Pressable>:null}
          {pathname===`/community/${communityId}/meetings`&&canCreateMeeting?<Pressable accessibilityRole="button" accessibilityLabel="Schedule a meeting" onPress={()=>router.push(`/community/${communityId}/create-meeting` as any)} style={shellStyles.headerIconAction}><Ionicons name="calendar-outline" size={22} color={palette.text}/></Pressable>:null}
          {pathname===`/community/${communityId}/members`&&canInviteMembers?<Pressable accessibilityRole="button" accessibilityLabel="Invite members" onPress={()=>router.setParams({inviteMembers:'1'} as any)} style={shellStyles.headerIconAction}><Ionicons name="person-add-outline" size={22} color={palette.text}/></Pressable>:null}
          {pathname===`/community/${communityId}/financial-record`&&canManageFinance?<Pressable accessibilityRole="button" accessibilityLabel="Create levy" onPress={()=>router.push(`/community/${communityId}/create-levy` as any)} style={shellStyles.headerIconAction}><Ionicons name="wallet-outline" size={22} color={palette.text}/></Pressable>:null}
          {pathname===`/community/${communityId}/services`&&canAddDirectory?<Pressable accessibilityRole="button" accessibilityLabel="Add service" onPress={()=>router.setParams({addService:'1'} as any)} style={shellStyles.headerIconAction}><Ionicons name="storefront-outline" size={22} color={palette.text}/></Pressable>:null}
          {pathname===`/community/${communityId}/excos`&&canManageExcos?<Pressable accessibilityRole="button" accessibilityLabel="Add Exco" onPress={()=>router.setParams({addExco:'1'} as any)} style={shellStyles.headerIconAction}><Ionicons name="person-add-outline" size={22} color={palette.text}/></Pressable>:null}
          {pathname===`/community/${communityId}/community-profile`?<><Pressable accessibilityRole="button" accessibilityLabel="Invite people" onPress={()=>router.setParams({invite:String(Date.now())} as any)} style={shellStyles.headerAction}><Ionicons name="person-add-outline" size={22} color={palette.text}/></Pressable>{canEditCommunity?<Pressable accessibilityRole="button" accessibilityLabel="Edit community profile" onPress={()=>router.setParams({edit:'1'} as any)} style={shellStyles.headerAction}><Ionicons name="create-outline" size={22} color={palette.text}/></Pressable>:null}</>:<>{pathname===`/community/${communityId}/polls`?<Pressable accessibilityRole="button" accessibilityLabel="Create poll" onPress={()=>router.push(`/community/${communityId}/create-poll` as any)} style={shellStyles.headerIconAction}><Ionicons name="add-circle-outline" size={23} color={palette.text}/></Pressable>:null}{pathname===`/community/${communityId}/documents`&&canManageDocuments?<Pressable accessibilityRole="button" accessibilityLabel="Upload document" onPress={()=>router.push({pathname:`/community/${communityId}/documents` as any,params:{create:'1'}})} style={shellStyles.headerIconAction}><Ionicons name="cloud-upload-outline" size={24} color={palette.text}/></Pressable>:null}{pathname===`/community/${communityId}/document-folders`&&canManageDocuments?<Pressable accessibilityRole="button" accessibilityLabel="Create folder" onPress={()=>router.push(`/community/${communityId}/document-folder/create` as any)} style={shellStyles.headerIconAction}><Ionicons name="folder-open-outline" size={24} color={palette.text}/></Pressable>:null}<Pressable accessibilityLabel="Open community menu" onPress={()=>router.push(`/community/${communityId}` as any)} style={shellStyles.headerAction}><Ionicons name="menu-outline" size={22} color={palette.text}/></Pressable></>}
        </>:communitiesPage?<Pressable accessibilityLabel="Join with invite code" onPress={()=>router.push('/join-community' as any)} style={shellStyles.headerAction}><Ionicons name="enter-outline" size={22} color={palette.text}/></Pressable>:!communityPage?<>{pathname==='/settings'?<View><Pressable accessibilityRole="button" accessibilityLabel="Choose appearance mode" accessibilityState={{expanded:modeOpen}} onPress={()=>setModeOpen(value=>!value)} style={shellStyles.headerAction}><Ionicons name={accessibility.themeMode==='dark'?'moon':accessibility.themeMode==='system'?'desktop-outline':'sunny'} size={22} color={palette.text}/></Pressable>{modeOpen?<View style={[shellStyles.modeMenu,{backgroundColor:palette.surface,borderColor:palette.border,shadowColor:palette.navy}]}>{([['light','Light','sunny-outline'],['dark','Dark','moon-outline'],['system','System','desktop-outline']] as const).map(([value,label,icon])=>{const selected=accessibility.themeMode===value;return <Pressable key={value} accessibilityRole="menuitem" accessibilityLabel={`${label} mode`} accessibilityState={{selected}} onPress={()=>{void accessibility.update({themeMode:value});setModeOpen(false)}} style={[shellStyles.modeOption,selected&&{backgroundColor:palette.surface,borderColor:palette.primary}]}><Ionicons name={icon} size={22} color={palette.text}/>{selected?<View style={[shellStyles.modeSelectedDot,{backgroundColor:palette.primary}]}/>:null}</Pressable>})}</View>:null}</View>:null}{homePage?<Pressable accessibilityRole="button" accessibilityLabel="Search communities, posts and events" onPress={()=>setHeaderSearchOpen(true)} style={shellStyles.headerAction}><Ionicons name="search-outline" size={22} color={palette.text}/></Pressable>:null}{pathname==='/security'?<Pressable accessibilityRole="button" accessibilityLabel="Run security check" onPress={()=>router.setParams({securityCheck:String(Date.now())} as any)} style={shellStyles.headerAction}><Ionicons name="shield-checkmark-outline" size={22} color={palette.text}/></Pressable>:null}<Pressable accessibilityLabel={unreadNotifications?`${unreadNotifications} new notifications`:'Notifications'} onPress={openNotifications} style={shellStyles.headerAction}><Ionicons name={unreadNotifications?'notifications':'notifications-outline'} size={22} color={palette.text}/>{unreadNotifications?<View style={[shellStyles.notificationBadge,{backgroundColor:palette.danger}]}><Text style={shellStyles.notificationBadgeText}>{unreadNotifications>99?'99+':unreadNotifications}</Text></View>:null}</Pressable></>:null}
        {homePage?<Pressable accessibilityLabel="Profile" onPress={()=>router.replace('/(tabs)/profile')} style={shellStyles.headerAvatar}>{user?.ProfileImage?<Image source={{uri:user.ProfileImage}} style={shellStyles.headerAvatarImage}/>:<Ionicons name="person-outline" size={22} color={palette.text}/>}</Pressable>:communitiesPage?<Pressable accessibilityLabel="Create community" onPress={()=>router.push('/create-community' as any)} style={shellStyles.createCommunity}><Ionicons name="add-circle-outline" size={25} color={palette.text}/></Pressable>:null}
      </View></>}
    </SafeAreaView>:null}
    <View style={[shellStyles.mobileContent,!focusedContentPage&&{marginTop:-insets.top}]}>{children}</View>
    {!focusedContentPage?<View style={[shellStyles.mobileNav,{backgroundColor:palette.surface,borderColor:palette.border,shadowColor:palette.navy}]}>{mobileLinks.map(([icon,label,path])=>{const active=selected===label;const translated=label==='Assistant'?'CDA Assistant':translate(language,navKey[label]);return <Pressable key={label} accessibilityRole="tab" accessibilityLabel={translated} accessibilityState={{selected:active}} onPress={()=>router.replace(path as any)} style={[shellStyles.mobileLink,Platform.OS==='web'&&({outlineStyle:'none'} as any),active&&{backgroundColor:'rgba(15,138,67,.12)'}]}><Ionicons name={(active?icon.replace('-outline',''):icon) as any} size={24} color={active?palette.primary:palette.navy}/></Pressable>})}</View>:null}
  </View>;
}

export default function Root(){
  const {hydrated,load}=useAuth();
  const a=useAccessibility();
  const{palette,dark}=useAppTheme();
  useEffect(()=>{load();a.load()},[]);
  if(Platform.OS!=='web'&&(!hydrated||!a.hydrated))return <View style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.background}}><ActivityIndicator color={colors.primary}/></View>;
  return <QueryClientProvider client={qc}><StatusBar style={dark?'light':'dark'}/><DesktopShell><AuthenticatedShell><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:palette.background},animation:a.reducedMotion?'none':'slide_from_right',animationDuration:260,gestureEnabled:true}}><Stack.Screen name="index"/><Stack.Screen name="(auth)"/><Stack.Screen name="(tabs)"/><Stack.Screen name="community/[id]"/><Stack.Screen name="chat/[id]"/></Stack></AuthenticatedShell></DesktopShell></QueryClientProvider>;
}

const shellStyles=StyleSheet.create({
  shell:{flex:1,width:'100%',minHeight:'100%' as any},
  sidebar:{position:'fixed' as any,left:0,top:0,bottom:0,zIndex:2000,paddingHorizontal:14,paddingTop:18,overflow:'hidden',borderRightWidth:1,shadowColor:'#11243F',shadowOpacity:.1,shadowRadius:18,shadowOffset:{width:4,height:0}},
  desktopBrand:{height:58,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:6,marginBottom:22},desktopBrandMark:{width:42,height:42,borderRadius:13,backgroundColor:'#0F8A43',alignItems:'center',justifyContent:'center',shadowColor:'#000',shadowOpacity:.2,shadowRadius:7},desktopBrandMarkText:{fontSize:23,fontWeight:'900',color:'#FFFFFF'},desktopBrandName:{fontSize:18,fontWeight:'900',color:'#11243F'},desktopBrandTag:{fontSize:10,color:'#667895',marginTop:2},desktopCollapse:{position:'absolute',right:-14,top:70,width:28,height:28,borderRadius:14,backgroundColor:'#0F8A43',borderWidth:2,borderColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},desktopNavCaption:{fontSize:10,fontWeight:'900',letterSpacing:1.2,paddingHorizontal:12,marginBottom:8},
  links:{gap:5},
  link:{height:50,borderRadius:13,paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:14},
  linkClosed:{paddingHorizontal:15,justifyContent:'center'},
  linkActive:{backgroundColor:'#0F8A43'},
  label:{fontSize:14,fontWeight:'800',color:'#CBD5E1'},
  labelActive:{color:'#FFFFFF'},
  desktopSidebarFooter:{position:'absolute',left:14,right:14,bottom:18,minHeight:62,borderTopWidth:1,borderRadius:13,paddingTop:15,paddingHorizontal:6,flexDirection:'row',alignItems:'center',gap:11},sidebarAvatar:{width:38,height:38,borderRadius:12,backgroundColor:'#0F8A43',alignItems:'center',justifyContent:'center',overflow:'hidden'},sidebarAvatarImage:{width:'100%',height:'100%'},sidebarAvatarText:{fontSize:13,fontWeight:'900',color:'#FFFFFF'},sidebarUserName:{fontSize:13,fontWeight:'900'},sidebarUserRole:{fontSize:10,marginTop:2},
  content:{flex:1,minWidth:0,minHeight:'100vh' as any},desktopTopbar:{height:86,borderBottomWidth:1,paddingHorizontal:30,flexDirection:'row',alignItems:'center',gap:14,position:'sticky' as any,top:0,zIndex:1500},desktopTitleBlock:{flex:1,minWidth:180},desktopPageTitle:{fontSize:21,fontWeight:'900'},desktopBreadcrumb:{fontSize:11,marginTop:3},desktopSearch:{width:'34%',maxWidth:420,minWidth:240,height:44,borderWidth:1,borderRadius:13,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:9},desktopSearchInput:{flex:1,minWidth:0,fontSize:13,outlineStyle:'none' as any},desktopTopAction:{width:44,height:44,borderWidth:1,borderRadius:13,alignItems:'center',justifyContent:'center'},desktopProfile:{height:48,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:4},desktopAvatar:{width:40,height:40,borderRadius:12,alignItems:'center',justifyContent:'center',overflow:'hidden'},desktopAvatarText:{fontSize:13,fontWeight:'900',color:'#FFFFFF'},desktopProfileName:{fontSize:13,fontWeight:'900'},desktopProfileRole:{fontSize:10,marginTop:2},desktopPage:{flex:1,minHeight:0,width:'100%',height:'calc(100vh - 86px)' as any,flexDirection:'row',overflow:'hidden'},desktopPageContent:{flex:1,minWidth:0,height:'100%'},communityMenuRail:{width:286,height:'100%',paddingLeft:20,paddingTop:18,paddingBottom:18,flexShrink:0},communityMenuCard:{height:'100%',borderRadius:20,paddingHorizontal:12,paddingTop:20,paddingBottom:12,shadowColor:'#11243F',shadowOpacity:.08,shadowRadius:14,shadowOffset:{width:0,height:5}},communityMenuTitle:{fontSize:17,fontWeight:'900',paddingHorizontal:12,marginBottom:10},communityMenuScroll:{flex:1},communityMenuList:{gap:4,paddingBottom:12},communityMenuLink:{minHeight:52,borderRadius:13,paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:13},communityMenuText:{fontSize:14,fontWeight:'800',flexShrink:1},
  mobileShell:{flex:1,width:'100%',maxWidth:'100%',minWidth:0,overflow:'hidden'},
  mobileHeader:{zIndex:2900,width:'100%',maxWidth:'100%',minWidth:0,minHeight:68,paddingHorizontal:12,paddingVertical:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,shadowColor:'#11243F',shadowOpacity:.12,shadowRadius:9,shadowOffset:{width:0,height:5},elevation:8,overflow:'visible'},
  mobileBrand:{flexDirection:'row',alignItems:'center',gap:9,flex:1,minWidth:0},
  mobileLogo:{width:54,height:54,resizeMode:'contain'},
  mobileBrandName:{fontSize:18,fontWeight:'900',letterSpacing:.2},
  homeBrandName:{fontSize:22,fontWeight:'900',letterSpacing:.1},
  pageHeaderTitle:{fontSize:22,fontWeight:'900'},
  pageHeaderCopy:{flex:1,minWidth:0},
  pageHeaderSubtitle:{fontSize:11,fontWeight:'700',marginTop:1},
  mobileTagline:{fontSize:9.5,marginTop:2},
  mobileHeaderActions:{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:2,flexShrink:0,maxWidth:'55%'},
  headerAction:{width:40,height:40,alignItems:'center',justifyContent:'center'},
  headerSearchRow:{flex:1,minWidth:0,maxWidth:'100%',flexDirection:'row',alignItems:'center',gap:6},
  headerSearchBox:{flex:1,minWidth:0,height:44,borderRadius:22,flexDirection:'row',alignItems:'center',paddingLeft:14},
  headerSearchInput:{flex:1,minWidth:0,fontSize:15,paddingHorizontal:9,paddingVertical:10},
  headerSearchClear:{width:38,height:42,alignItems:'center',justifyContent:'center'},
  notificationBadge:{position:'absolute',right:0,top:0,minWidth:18,height:18,borderRadius:9,paddingHorizontal:4,alignItems:'center',justifyContent:'center'},
  notificationBadgeText:{color:'#FFFFFF',fontSize:9,fontWeight:'900'},
  modeMenu:{position:'absolute',right:0,top:46,width:58,borderWidth:1,borderRadius:14,padding:5,elevation:18,shadowOpacity:.18,shadowRadius:16,shadowOffset:{width:0,height:8},zIndex:4000},
  modeOption:{height:48,borderWidth:1,borderColor:'transparent',borderRadius:10,alignItems:'center',justifyContent:'center'},
  modeSelectedDot:{position:'absolute',right:5,top:5,width:7,height:7,borderRadius:4},
  headerIconAction:{width:40,height:40,borderWidth:0,borderRadius:20,backgroundColor:'transparent',alignItems:'center',justifyContent:'center'},
  headerAvatar:{width:40,height:40,borderRadius:20,backgroundColor:'transparent',alignItems:'center',justifyContent:'center',overflow:'hidden'},
  createCommunity:{width:40,height:40,borderRadius:20,backgroundColor:'transparent',alignItems:'center',justifyContent:'center'},
  headerAvatarImage:{width:40,height:40,borderRadius:20},headerInitials:{color:'#000000',fontSize:13,fontWeight:'900'},
  mobileContent:{flex:1,minHeight:0},
  mobileNav:{position:'absolute',left:12,right:12,bottom:10,height:72,zIndex:3000,flexDirection:'row',alignItems:'center',justifyContent:'space-around',borderWidth:1.25,borderRadius:36,padding:6,shadowOpacity:.14,shadowRadius:11,shadowOffset:{width:0,height:6},elevation:8,overflow:'hidden'},
  mobileLink:{flex:1,minHeight:58,borderRadius:29,alignItems:'center',justifyContent:'center',gap:4},
  mobileLabel:{fontSize:10,fontWeight:'800'},
  mobileLabelActive:{fontWeight:'900'},
});
