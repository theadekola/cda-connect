import {useState} from 'react';
import {useParams,Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {ArrowLeft,MoreHorizontal} from 'lucide-react';
import {api,str,type RecordData} from './api';
import {Page,Loading,ErrorBox} from './ui';
import {PostMedia,SocialActions} from './PostMedia';
import {TranslatedText} from './TranslatedText';
import {CommentComposer,CommentThread,type ReplyTarget} from './SocialComments';
export function PostPage(){const{id}=useParams(),[reply,setReply]=useState<ReplyTarget>(),q=useQuery({queryKey:['/posts/'+id],queryFn:({signal})=>api.get<RecordData>('/posts/'+id,signal)});if(q.isPending)return <Loading/>;if(q.error)return <Page title="Post"><ErrorBox error={q.error}/></Page>;const post=q.data;return <section className="social-post-page"><div className="post-detail"><article className="feed-post"><header className="post-author-header"><Link className="post-return" aria-label="Back to feed" to={'/community/'+post.CommunityId+'/feed'}><ArrowLeft size={22}/></Link><Link className="feed-author" to={'/member/'+post.CreatedBy}><span className="post-avatar">{post.ProfileImage?<img src={api.asset(str(post.ProfileImage))} alt=""/>:str(post.FirstName).slice(0,1)}</span><div><strong>{[post.FirstName,post.LastName].filter(Boolean).join(' ')}</strong><small>{new Date(str(post.CreatedAt)).toLocaleString()}</small></div></Link><details className="post-more"><summary aria-label="More post options"><MoreHorizontal size={22}/></summary><nav><Link to={'/member/'+post.CreatedBy}>View member profile</Link><Link to={'/community/'+post.CommunityId+'/feed'}>Community feed</Link></nav></details></header><div className="post-copy"><TranslatedText type="post" id={id!} text={str(post.Body)}/></div><PostMedia post={post}/><SocialActions post={post}/></article><CommentThread postId={id!} onReply={setReply}/><CommentComposer postId={id!} reply={reply} onCancelReply={()=>setReply(undefined)}/></div></section>}
