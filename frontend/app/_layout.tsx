import { Stack, usePathname, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/store/auth';
import { colors } from '@/theme';
import { useAccessibility } from '@/store/accessibility';
import {translate,type TranslationKey} from '@/i18n';
import {useAppTheme} from '@/components/UI';
import {useQuery} from '@tanstack/react-query';
import {api} from '@/lib/api';
import {completePendingCommunityInvite} from '@/lib/communityInvite';
import {notificationKey,useNotificationReads} from '@/store/notificationReads';
import * as Notifications from 'expo-notifications';
import {notificationPath,registerForPushNotifications} from '@/lib/pushNotifications';

const qc=new QueryClient();

const desktopLinks=[
  ['home-outline','Home','/(tabs)/home'],
  ['people-outline','Communities','/(tabs)/communities'],
  ['calendar-outline','Calendar','/(tabs)/calendar'],
  ['person-outline','Profile','/(tabs)/profile'],
  ['settings-outline','Settings','/(tabs)/settings'],
] as const;
const navKey:Record<string,TranslationKey>={Home:'home',Communities:'communities',Calendar:'calendar',Profile:'profile',Settings:'settings'};

function DesktopShell({children}:{children:React.ReactNode}){
  const{width}=useWindowDimensions();
  const pathname=usePathname();
  const router=useRouter();
  const{accessToken}=useAuth();
  const language=useAccessibility(x=>x.language);
  const[open,setOpen]=useState(true);
  const desktop=Platform.OS==='web'&&width>=980;
  const publicPage=pathname==='/'||pathname.startsWith('/login')||pathname.startsWith('/register')||pathname.startsWith('/forgot-password');
  if(!desktop||!accessToken||publicPage)return <>{children}</>;
  const sidebarWidth=open?238:76;
  const active=(path:string)=>pathname===path.replace('/(tabs)','')||(path.includes('/home')&&pathname==='/home');
  return <View style={shellStyles.shell}>
    <View style={[shellStyles.sidebar,{width:sidebarWidth}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={open?'Collapse navigation':'Expand navigation'} accessibilityState={{expanded:open}} onPress={()=>setOpen(value=>!value)} style={shellStyles.menuButton}>
        <Ionicons name={open?'close':'menu'} size={24} color="#FFFFFF"/>
      </Pressable>
      <View style={shellStyles.links}>{desktopLinks.map(([icon,label,path])=>{
        const selected=active(path);
        return <Pressable key={label} accessibilityRole="link" accessibilityLabel={label} onPress={()=>router.push(path as any)} style={[shellStyles.link,selected&&shellStyles.linkActive,!open&&shellStyles.linkClosed]}>
          <Ionicons name={icon} size={24} color={selected?'#FFFFFF':'#CBD5E1'}/>
          {open?<Text style={[shellStyles.label,selected&&shellStyles.labelActive]}>{translate(language,navKey[label])}</Text>:null}
        </Pressable>;
      })}</View>
    </View>
    <View style={[shellStyles.content,{marginLeft:sidebarWidth}]}>{children}</View>
  </View>;
}

const mobileLinks=[
  ['home-outline','Home','/(tabs)/home'],
  ['people-outline','Communities','/(tabs)/communities'],
  ['calendar-outline','Calendar','/(tabs)/calendar'],
  ['person-outline','Profile','/(tabs)/profile'],
  ['settings-outline','Settings','/(tabs)/settings'],
] as const;

const routeTitles:Record<string,string>={
  '/communities':'Communities','/calendar':'Calendar','/profile':'Profile','/profile-edit':'Edit Profile','/settings':'Settings','/notifications':'Notifications',
  '/create-community':'Create Community','/privacy':'Privacy & Safety','/notifications-settings':'Notifications',
  '/accessibility':'Appearance','/language':'Language','/communications':'Communications','/community-preferences':'Community Preferences',
  '/data-usage':'Data & Storage','/security':'Security','/help':'Help & Support','/about':'About CDA Connect','/change-password':'Change Password',
  '/two-factor':'Two-Factor Authentication','/delete-account':'Delete Account','/trusted-contacts':'Trusted Contacts','/search':'Search',
  '/terms-of-service':'Terms of Service','/privacy-policy':'Privacy Policy','/community-guidelines':'Community Guidelines',
  '/our-mission':'Our Mission','/our-vision':'Our Vision','/our-values':'Our Values','/built-for-communities':'Built for Communities',
  '/join-community':'Join Community','/blocked-users':'Blocked Users',
};
const communityRouteTitles:Record<string,string>={
  feed:'Feed','create-post':'Post to Feed',members:'Members',chat:'Chat',events:'Events',issues:'Report Issue','create-announcement':'Post Announcement',alerts:'Emergency','membership-card':'Member Card',meetings:'Meetings',
  'create-meeting':'Schedule a Meeting',meeting:'General Meeting','take-attendance':'Take Attendance','mark-attendance':'Mark Attendance','attendance-history':'Attendance History',
  attendance:'Take Attendance','financial-record':'Financial Record','my-financial-record':'My Financial Record','create-levy':'Create Levy',levy:'Levy','pay-levy':'Pay Levy',
  announcements:'Announcements',requests:'Join Requests',services:'Local Services',excos:'Excos','past-excos':'Past Excos',marketplace:'Marketplace','post-marketplace-item':'Post Item',governance:'Governance',
  'formal-voting':'Formal Voting',decisions:'Decisions',documents:'Documents',finance:'Finance',polls:'Polls',moderation:'Moderation',
  analytics:'Analytics',assistant:'CDA Assistant','smart-summary':'Summary',verification:'Community Verification','scan-card':'Scan Membership Card','emergency-command':'Emergency Command',proposal:'Proposal',
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
  const accessibility=useAccessibility();
  const[modeOpen,setModeOpen]=useState(false);
  const[headerSearchOpen,setHeaderSearchOpen]=useState(false);
  const[headerSearch,setHeaderSearch]=useState('');
  const language=accessibility.language;
  const{palette,dark}=useAppTheme();
  const desktop=Platform.OS==='web'&&width>=980;
  const publicPage=pathname==='/'||pathname.startsWith('/login')||pathname.startsWith('/register')||pathname.startsWith('/forgot-password');
  const homePage=pathname==='/home';
  const communitiesPage=pathname==='/communities';
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
  const notifications=useQuery<any[]>({queryKey:['notifications'],queryFn:async()=>(await api.get('/me/notifications')).data,enabled:Boolean(accessToken&&!publicPage),refetchInterval:30000,refetchOnWindowFocus:true,staleTime:10000});
  useEffect(()=>{if(accessToken)void loadNotificationReads()},[accessToken,loadNotificationReads]);
  useEffect(()=>{
    if(!accessToken||Platform.OS==='web')return;
    void registerForPushNotifications().catch(error=>console.warn('Push notification registration failed',error));
    const subscription=Notifications.addNotificationResponseReceivedListener(response=>{
      router.push(notificationPath(response.notification.request.content.data) as any);
    });
    void Notifications.getLastNotificationResponseAsync().then(response=>{
      if(response)router.push(notificationPath(response.notification.request.content.data) as any);
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
const communityCapabilities=useQuery<any>({queryKey:['capabilities',communityId],queryFn:async()=>(await api.get(`/communities/${communityId}/capabilities`)).data,enabled:Boolean(accessToken&&communityId&&(pathname===`/community/${communityId}/chat`||pathname===`/community/${communityId}/events`||pathname===`/community/${communityId}/meetings`||pathname===`/community/${communityId}/members`||pathname===`/community/${communityId}/financial-record`||pathname===`/community/${communityId}/services`||pathname===`/community/${communityId}/excos`)),staleTime:30000});
  const communityRoles=(communityCapabilities.data?.roles||[]).map((role:any)=>String(role).toLowerCase());
  const hasCommunityManagementRole=communityRoles.some((role:string)=>['owner','admin','moderator'].includes(role));
  const canCreateChatGroup=Boolean(communityCapabilities.data);
  const canCreateEvent=Boolean(communityCapabilities.data);
  const canCreateMeeting=communityCapabilities.data?.permissions?.includes('MEETING_CREATE')&&hasCommunityManagementRole;
  const canInviteMembers=communityCapabilities.data?.permissions?.includes('MEMBER_INVITE')&&hasCommunityManagementRole;
const canManageFinance=communityCapabilities.data?.permissions?.includes('FINANCE_MANAGE')&&hasCommunityManagementRole;
const canAddDirectory=Boolean(communityCapabilities.data);
const canManageExcos=communityCapabilities.data?.permissions?.includes('MEMBER_ROLE_CHANGE')&&hasCommunityManagementRole;
  useEffect(()=>{if(profile.data)void updateUser(profile.data)},[profile.data,updateUser]);
  useEffect(()=>{if(accessToken)void completePendingCommunityInvite().then(joined=>{if(joined)router.replace(`/community/${joined.Id}` as any)}).catch(()=>{})},[accessToken]);
  if(desktop||!accessToken||publicPage)return <>{children}</>;
  const selected=pathname==='/home'?'Home':pathname==='/calendar'?'Calendar':pathname==='/profile'||pathname.startsWith('/profile-edit')||pathname==='/language'?'Profile':pathname==='/communities'||pathname.startsWith('/community/')?'Communities':pathname==='/settings'||pathname.startsWith('/privacy')||pathname.startsWith('/security')||pathname.startsWith('/change-password')||pathname.startsWith('/two-factor')||pathname.startsWith('/delete-account')||pathname.startsWith('/notifications-settings')||pathname.startsWith('/accessibility')||pathname.startsWith('/communications')||pathname.startsWith('/community-preferences')||pathname.startsWith('/data-usage')||pathname.startsWith('/help')||pathname.startsWith('/about')?'Settings':'';
  const name=`${user?.FirstName||''} ${user?.LastName||''}`.trim()||'CDA Member',initials=name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
  return <View style={[shellStyles.mobileShell,{backgroundColor:palette.background}]}>
    {!focusedContentPage?<SafeAreaView key={headerSearchOpen?'search-header':'page-header'} edges={['top']} style={[shellStyles.mobileHeader,Platform.OS==='web'&&({boxSizing:'border-box'} as any),{backgroundColor:palette.background,borderBottomColor:palette.border}]}>
      {headerSearchOpen?<View style={shellStyles.headerSearchRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close search" onPress={closeHeaderSearch} style={shellStyles.headerAction}><Ionicons name="chevron-back" size={24} color={palette.text}/></Pressable>
        <View style={[shellStyles.headerSearchBox,{backgroundColor:accessibility.themeMode==='dark'?palette.surface:'rgba(226,232,240,.62)'}]}>
          <Ionicons name="search-outline" size={21} color={palette.muted}/>
          <TextInput autoFocus value={headerSearch} onChangeText={setHeaderSearch} onSubmitEditing={submitHeaderSearch} returnKeyType="search" placeholder={communityPage?'Search this community':'Search communities, posts and events'} placeholderTextColor={palette.muted} selectionColor={palette.primary} style={[shellStyles.headerSearchInput,{color:palette.text}]}/>
          {headerSearch?<Pressable accessibilityLabel="Clear search" onPress={()=>setHeaderSearch('')} style={shellStyles.headerSearchClear}><Ionicons name="close-circle" size={20} color={palette.muted}/></Pressable>:null}
        </View>
      </View>:<>
      {homePage?<View style={shellStyles.mobileBrand}><Text numberOfLines={1} style={[shellStyles.homeBrandName,{color:palette.primary}]}>CDA Connect</Text></View>:communityPage?<View style={shellStyles.mobileBrand}><Pressable accessibilityLabel="Go back" onPress={()=>(router.canGoBack()?router.back():router.replace('/(tabs)/communities' as any))} style={shellStyles.headerAction}><Ionicons name="chevron-back" size={24} color={palette.text}/></Pressable><View style={shellStyles.pageHeaderCopy}><Text numberOfLines={1} style={[shellStyles.pageHeaderTitle,{color:palette.text}]}>{currentPageTitle}</Text><Text numberOfLines={1} style={[shellStyles.pageHeaderSubtitle,{color:palette.muted}]}>{community.data?.Name||'Community'}</Text></View></View>:<View style={shellStyles.mobileBrand}>{profileEditPage||settingsBackPage?<Pressable accessibilityLabel="Go back" onPress={()=>(router.canGoBack()?router.back():router.replace(profileEditPage?'/(tabs)/profile':pathname==='/blocked-users'?'/privacy':pathname==='/change-password'||pathname==='/two-factor'?'/security':pathname==='/delete-account'?'/help':pathname==='/terms-of-service'||pathname==='/privacy-policy'||pathname==='/community-guidelines'||pathname==='/our-mission'||pathname==='/our-vision'||pathname==='/our-values'||pathname==='/built-for-communities'?'/about':'/(tabs)/settings' as any))} style={shellStyles.headerAction}><Ionicons name="chevron-back" size={24} color={palette.text}/></Pressable>:null}<Text numberOfLines={1} style={[shellStyles.pageHeaderTitle,{color:palette.text}]}>{currentPageTitle}</Text></View>}
      <View style={shellStyles.mobileHeaderActions}>
        {pathname==='/language'?<Pressable accessibilityRole="button" accessibilityLabel="Save language" disabled={!accessibility.draftLanguage} onPress={()=>void accessibility.saveLanguage().then(()=>router.replace('/(tabs)/profile' as any))} style={[shellStyles.headerAction,!accessibility.draftLanguage&&{opacity:.42}]}><Ionicons name="save-outline" size={24} color={accessibility.draftLanguage?palette.primary:palette.muted}/></Pressable>:communityPage&&!communityWorkspacePage?<>
          {pathname===`/community/${communityId}/feed`?<><Pressable accessibilityRole="button" accessibilityLabel="Create community content" onPress={()=>router.setParams({createMenu:String(Date.now())} as any)} style={[shellStyles.headerIconAction,{backgroundColor:palette.primarySoft,borderColor:palette.primary}]}><Ionicons name="add" size={24} color={palette.primary}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Search community feed" onPress={()=>setHeaderSearchOpen(true)} style={shellStyles.headerAction}><Ionicons name="search-outline" size={24} color={palette.text}/></Pressable></>:null}
          {pathname===`/community/${communityId}/chat`&&canCreateChatGroup?<Pressable accessibilityRole="button" accessibilityLabel="Create group chat" onPress={()=>router.setParams({createGroup:'1'} as any)} style={[shellStyles.headerIconAction,{backgroundColor:palette.primarySoft,borderColor:palette.primary}]}><Ionicons name="people-circle-outline" size={24} color={palette.primary}/></Pressable>:null}
          {pathname===`/community/${communityId}/events`&&canCreateEvent?<Pressable accessibilityRole="button" accessibilityLabel="Create event" onPress={()=>router.setParams({createEvent:'1'} as any)} style={[shellStyles.headerIconAction,{backgroundColor:palette.primarySoft,borderColor:palette.primary}]}><Ionicons name="calendar-number-outline" size={23} color={palette.primary}/></Pressable>:null}
          {pathname===`/community/${communityId}/meetings`&&canCreateMeeting?<Pressable accessibilityRole="button" accessibilityLabel="Schedule a meeting" onPress={()=>router.push(`/community/${communityId}/create-meeting` as any)} style={[shellStyles.headerIconAction,{backgroundColor:palette.primarySoft,borderColor:palette.primary}]}><Ionicons name="calendar-outline" size={23} color={palette.primary}/></Pressable>:null}
          {pathname===`/community/${communityId}/members`&&canInviteMembers?<Pressable accessibilityRole="button" accessibilityLabel="Invite members" onPress={()=>router.setParams({inviteMembers:'1'} as any)} style={[shellStyles.headerIconAction,{backgroundColor:palette.primarySoft,borderColor:palette.primary}]}><Ionicons name="person-add-outline" size={23} color={palette.primary}/></Pressable>:null}
          {pathname===`/community/${communityId}/financial-record`&&canManageFinance?<Pressable accessibilityRole="button" accessibilityLabel="Create levy" onPress={()=>router.push(`/community/${communityId}/create-levy` as any)} style={[shellStyles.headerIconAction,{backgroundColor:palette.primarySoft,borderColor:palette.primary}]}><Ionicons name="wallet-outline" size={23} color={palette.primary}/></Pressable>:null}
          {pathname===`/community/${communityId}/services`&&canAddDirectory?<Pressable accessibilityRole="button" accessibilityLabel="Add service" onPress={()=>router.setParams({addService:'1'} as any)} style={[shellStyles.headerIconAction,{backgroundColor:palette.primarySoft,borderColor:palette.primary}]}><Ionicons name="storefront-outline" size={23} color={palette.primary}/></Pressable>:null}
          {pathname===`/community/${communityId}/excos`&&canManageExcos?<Pressable accessibilityRole="button" accessibilityLabel="Add Exco" onPress={()=>router.setParams({addExco:'1'} as any)} style={[shellStyles.headerIconAction,{backgroundColor:palette.primarySoft,borderColor:palette.primary}]}><Ionicons name="person-add-outline" size={23} color={palette.primary}/></Pressable>:null}
          <Pressable accessibilityLabel="Open community menu" onPress={()=>router.push(`/community/${communityId}` as any)} style={shellStyles.headerAction}><Ionicons name="menu-outline" size={24} color={palette.text}/></Pressable>
        </>:communitiesPage?<Pressable accessibilityLabel="Join with invite code" onPress={()=>router.push('/join-community' as any)} style={shellStyles.headerAction}><Ionicons name="enter-outline" size={24} color={palette.primary}/></Pressable>:!communityPage?<>{pathname==='/settings'?<View><Pressable accessibilityRole="button" accessibilityLabel="Choose appearance mode" accessibilityState={{expanded:modeOpen}} onPress={()=>setModeOpen(value=>!value)} style={shellStyles.headerAction}><Ionicons name={accessibility.themeMode==='dark'?'moon':accessibility.themeMode==='system'?'desktop-outline':'sunny'} size={24} color={palette.primary}/></Pressable>{modeOpen?<View style={[shellStyles.modeMenu,{backgroundColor:palette.surface,borderColor:palette.border,shadowColor:palette.navy}]}>{([['light','Light','sunny-outline'],['dark','Dark','moon-outline'],['system','System','desktop-outline']] as const).map(([value,label,icon])=>{const selected=accessibility.themeMode===value;return <Pressable key={value} accessibilityRole="menuitem" accessibilityLabel={`${label} mode`} accessibilityState={{selected}} onPress={()=>{void accessibility.update({themeMode:value});setModeOpen(false)}} style={[shellStyles.modeOption,selected&&{backgroundColor:palette.primarySoft,borderColor:palette.primary}]}><Ionicons name={icon} size={24} color={selected?palette.primary:palette.text}/>{selected?<View style={[shellStyles.modeSelectedDot,{backgroundColor:palette.primary}]}/>:null}</Pressable>})}</View>:null}</View>:null}{homePage?<Pressable accessibilityRole="button" accessibilityLabel="Search communities, posts and events" onPress={()=>setHeaderSearchOpen(true)} style={shellStyles.headerAction}><Ionicons name="search-outline" size={24} color={palette.text}/></Pressable>:null}{pathname==='/security'?<Pressable accessibilityRole="button" accessibilityLabel="Run security check" onPress={()=>router.setParams({securityCheck:String(Date.now())} as any)} style={shellStyles.headerAction}><Ionicons name="shield-checkmark-outline" size={24} color={palette.primary}/></Pressable>:null}<Pressable accessibilityLabel={unreadNotifications?`${unreadNotifications} new notifications`:'Notifications'} onPress={openNotifications} style={shellStyles.headerAction}><Ionicons name={unreadNotifications?'notifications':'notifications-outline'} size={24} color={unreadNotifications?palette.primary:palette.text}/>{unreadNotifications?<View style={[shellStyles.notificationBadge,{backgroundColor:palette.danger}]}><Text style={shellStyles.notificationBadgeText}>{unreadNotifications>99?'99+':unreadNotifications}</Text></View>:null}</Pressable></>:null}
        {homePage?<Pressable accessibilityLabel="Profile" onPress={()=>router.replace('/(tabs)/profile')} style={[shellStyles.headerAvatar,{backgroundColor:palette.primary}]}>{user?.ProfileImage?<Image source={{uri:user.ProfileImage}} style={shellStyles.headerAvatarImage}/>:<Text style={shellStyles.headerInitials}>{initials}</Text>}</Pressable>:communitiesPage?<Pressable accessibilityLabel="Create community" onPress={()=>router.push('/create-community' as any)} style={[shellStyles.createCommunity,{backgroundColor:palette.primary}]}><Ionicons name="add" size={24} color="#FFFFFF"/></Pressable>:null}
      </View></>}
    </SafeAreaView>:null}
    <View style={[shellStyles.mobileContent,!focusedContentPage&&{marginTop:-insets.top}]}>{children}</View>
    {!focusedContentPage?<View style={[shellStyles.mobileNav,{backgroundColor:'#FFFFFF',borderColor:'#CFE2D5',shadowColor:palette.navy}]}>{mobileLinks.map(([icon,label,path])=>{const active=selected===label;const translated=translate(language,navKey[label]);return <Pressable key={label} accessibilityRole="tab" accessibilityLabel={translated} accessibilityState={{selected:active}} onPress={()=>router.replace(path as any)} style={[shellStyles.mobileLink,Platform.OS==='web'&&({outlineStyle:'none'} as any),active&&{backgroundColor:'rgba(15,138,67,.12)'}]}><Ionicons name={(active?icon.replace('-outline',''):icon) as any} size={24} color={active?palette.primary:palette.navy}/></Pressable>})}</View>:null}
  </View>;
}

export default function Root(){
  const {hydrated,load}=useAuth();
  const a=useAccessibility();
  const{palette,dark}=useAppTheme();
  useEffect(()=>{load();a.load()},[]);
  if(!hydrated||!a.hydrated)return <View style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.background}}><ActivityIndicator color={colors.primary}/></View>;
  return <QueryClientProvider client={qc}><StatusBar style={dark?'light':'dark'} backgroundColor={palette.background}/><DesktopShell><AuthenticatedShell><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:palette.background},animation:a.reducedMotion?'none':'fade_from_bottom',animationDuration:220,gestureEnabled:true}}><Stack.Screen name="index"/><Stack.Screen name="(auth)"/><Stack.Screen name="(tabs)"/><Stack.Screen name="community/[id]"/><Stack.Screen name="chat/[id]"/></Stack></AuthenticatedShell></DesktopShell></QueryClientProvider>;
}

const shellStyles=StyleSheet.create({
  shell:{flex:1,width:'100%',minHeight:'100%' as any},
  sidebar:{position:'fixed' as any,left:0,top:0,bottom:0,zIndex:2000,backgroundColor:'#0F1F44',paddingHorizontal:10,paddingTop:84,overflow:'hidden',shadowColor:'#0F1F44',shadowOpacity:.14,shadowRadius:16,shadowOffset:{width:3,height:0}},
  menuButton:{position:'absolute',top:18,left:15,width:48,height:48,borderRadius:12,backgroundColor:'rgba(255,255,255,.14)',alignItems:'center',justifyContent:'center'},
  links:{gap:7},
  link:{height:56,borderRadius:12,paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:14},
  linkClosed:{paddingHorizontal:15,justifyContent:'center'},
  linkActive:{backgroundColor:'#0F8A43'},
  label:{fontSize:16,fontWeight:'800',color:'#CBD5E1'},
  labelActive:{color:'#FFFFFF'},
  content:{flex:1,minWidth:0,minHeight:'100vh' as any},
  mobileShell:{flex:1,width:'100%',maxWidth:'100%',minWidth:0,overflow:'hidden'},
  mobileHeader:{zIndex:2900,width:'100%',maxWidth:'100%',minWidth:0,minHeight:76,paddingHorizontal:14,paddingBottom:10,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',borderBottomWidth:1,shadowColor:'#0F1F44',shadowOpacity:.05,shadowRadius:10,elevation:4,overflow:'visible'},
  mobileBrand:{flexDirection:'row',alignItems:'center',gap:9,flex:1,minWidth:0},
  mobileLogo:{width:54,height:54,resizeMode:'contain'},
  mobileBrandName:{fontSize:18,fontWeight:'900',letterSpacing:.2},
  homeBrandName:{fontSize:24,fontWeight:'900',letterSpacing:.1},
  pageHeaderTitle:{fontSize:24,fontWeight:'900'},
  pageHeaderCopy:{flex:1,minWidth:0},
  pageHeaderSubtitle:{fontSize:11,fontWeight:'700',marginTop:1},
  mobileTagline:{fontSize:9.5,marginTop:2},
  mobileHeaderActions:{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:3,flexShrink:0,maxWidth:'55%'},
  headerAction:{width:42,height:42,alignItems:'center',justifyContent:'center'},
  headerSearchRow:{flex:1,minWidth:0,maxWidth:'100%',flexDirection:'row',alignItems:'center',gap:6},
  headerSearchBox:{flex:1,minWidth:0,height:44,borderRadius:22,flexDirection:'row',alignItems:'center',paddingLeft:14},
  headerSearchInput:{flex:1,minWidth:0,fontSize:15,paddingHorizontal:9,paddingVertical:10},
  headerSearchClear:{width:38,height:42,alignItems:'center',justifyContent:'center'},
  notificationBadge:{position:'absolute',right:0,top:0,minWidth:18,height:18,borderRadius:9,paddingHorizontal:4,alignItems:'center',justifyContent:'center'},
  notificationBadgeText:{color:'#FFFFFF',fontSize:9,fontWeight:'900'},
  modeMenu:{position:'absolute',right:0,top:46,width:58,borderWidth:1,borderRadius:14,padding:5,elevation:18,shadowOpacity:.18,shadowRadius:16,shadowOffset:{width:0,height:8},zIndex:4000},
  modeOption:{height:48,borderWidth:1,borderColor:'transparent',borderRadius:10,alignItems:'center',justifyContent:'center'},
  modeSelectedDot:{position:'absolute',right:5,top:5,width:7,height:7,borderRadius:4},
  headerIconAction:{width:40,height:40,borderWidth:1,borderRadius:20,alignItems:'center',justifyContent:'center'},
  headerAvatar:{width:46,height:46,borderRadius:23,alignItems:'center',justifyContent:'center',overflow:'hidden'},
  createCommunity:{width:46,height:46,borderRadius:23,alignItems:'center',justifyContent:'center'},
  headerAvatarImage:{width:46,height:46},headerInitials:{color:'#fff',fontSize:15,fontWeight:'900'},
  mobileContent:{flex:1,minHeight:0},
  mobileNav:{position:'absolute',left:12,right:12,bottom:10,height:72,zIndex:3000,flexDirection:'row',alignItems:'center',justifyContent:'space-around',borderWidth:1.25,borderRadius:36,padding:6,shadowOpacity:.14,shadowRadius:11,shadowOffset:{width:0,height:6},elevation:8,overflow:'hidden'},
  mobileLink:{flex:1,minHeight:58,borderRadius:29,alignItems:'center',justifyContent:'center',gap:4},
  mobileLabel:{fontSize:10,fontWeight:'800'},
  mobileLabelActive:{fontWeight:'900'},
});
