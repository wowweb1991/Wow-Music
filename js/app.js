import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
const $ = id => document.getElementById(id);
const configured = !!(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
let db, session=null, artist=null, admin=false, tracks=[], current=-1, shuffle=false, repeat=false, counted=false;
const audio=$('player'), localURLs=[];
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(s){$('toast').textContent=s; $('toast').style.display='block'; clearTimeout(toast.t);toast.t=setTimeout(()=>$('toast').style.display='none',4000)}
function err(e){toast(e?.message||String(e))}
async function request(p){const {data,error}=await p;if(error)throw error;return data}
function requireLogin(){if(session)return true;$('auth-dialog').showModal();toast('Please sign in first');return false}
function showPage(name){for(const s of document.querySelectorAll('.page:not(#membership)'))s.hidden=s.id!==name;for(const b of document.querySelectorAll('[data-view]'))b.classList.toggle('active',b.dataset.view===name);if(name==='library')loadLibrary();if(name==='studio')loadStudio();if(name==='admin')loadAdmin()}
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>showPage(b.dataset.view);
$('start-listening').onclick=()=>{showPage('discover');$('search').focus()};
$('open-auth').onclick=()=>$('auth-dialog').showModal();
async function start(){
 if(!configured){$('setup-banner').textContent='Preview mode: configure a dedicated WOW MUSIC Supabase project to enable accounts, uploads and playlists. Local audio is private to your device.'; const pick=document.createElement('input');pick.type='file';pick.multiple=true;pick.accept='audio/*';pick.onchange=()=>{for(const f of pick.files){const url=URL.createObjectURL(f);localURLs.push(url);tracks.push({id:'local-'+tracks.length,title:f.name,url,artists:{name:'Local preview'}})}renderTracks()};$('setup-banner').append(document.createElement('br'),pick);renderTracks();return}
 try{
  const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.57.4');
  db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  session=(await db.auth.getSession()).data.session;
  db.auth.onAuthStateChange((_event,s)=>{session=s;setTimeout(()=>identity().catch(err),0)});
  await identity();await loadTracks();
  $('setup-banner').textContent='Independent music worldwide. Artists and tracks are reviewed before publication.';
 }catch(e){$('setup-banner').textContent='Backend unavailable. Verify WOW MUSIC Supabase configuration.';err(e)}
}
async function identity(){
 $('auth-area').replaceChildren();
 if(session){
  const label=document.createElement('span');label.textContent=session.user.email+' ';
  const b=document.createElement('button');b.textContent='Sign out';b.onclick=async()=>{try{await request(db.auth.signOut())}catch(e){err(e)}};
  $('auth-area').append(label,b);
  admin=(await request(db.from('admins').select('user_id').eq('user_id',session.user.id).limit(1))).length>0;
 }else{
  admin=false;
  const b=document.createElement('button');b.textContent='Sign in / Join';b.onclick=()=>$('auth-dialog').showModal();$('auth-area').append(b)
 }
 $('admin-nav').hidden=!admin;
 if(!admin&&!$('admin').hidden)showPage('discover');
 if(!$('library').hidden)await loadLibrary();
 if(!$('studio').hidden)await loadStudio();
}
async function auth(kind){
 if(!db)return toast('Supabase has not been connected');
 const email=$('email').value.trim(),password=$('password').value;
 if(!email||!password)return toast('Enter email and password');
 try{
  if(kind==='signup'){await request(db.auth.signUp({email,password}));toast('Check your inbox to verify your email')}
  else{await request(db.auth.signInWithPassword({email,password}));toast('Signed in')}
  $('auth-dialog').close();
 }catch(e){err(e)}
}
$('login').onclick=()=>auth('login');
$('signup').onclick=()=>auth('signup');
$('reset-password').onclick=async()=>{
 if(!db)return toast('Connect the database first');
 const email=$('email').value.trim();if(!email.includes('@'))return toast('Enter your email');
 try{await request(db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname}));toast('If the account exists, check your inbox')}catch(e){err(e)}
};
async function loadTracks(){
 if(!db)return;
 try{tracks=await request(db.from('tracks').select('id,title,genre,audio_path,artists!inner(name,status)').eq('status','published').eq('artists.status','approved').order('created_at',{ascending:false}).limit(100));renderTracks()}catch(e){err(e)}
}
function card(t,extras=''){return '<article class="song"><div class="art">♫</div><h3>'+escapeHTML(t.title)+'</h3><p class="muted">'+escapeHTML(t.artists?.name||'Independent Artist')+' · '+escapeHTML(t.genre||'Music')+'</p><button class="primary" data-play="'+escapeHTML(t.id)+'">▶ Play</button>'+extras+'</article>'}
function bindButtons(parent){
 for(const b of parent.querySelectorAll('[data-play]'))b.onclick=()=>play(b.dataset.play);
 for(const b of parent.querySelectorAll('[data-fav]'))b.onclick=()=>favorite(b.dataset.fav);
 for(const b of parent.querySelectorAll('[data-add]'))b.onclick=()=>addPlaylistTrack(b.dataset.add);
}
function renderTracks(){
 const search=$('search').value.toLowerCase().trim();
 const rows=tracks.filter(t=>[t.title,t.genre,t.artists?.name].some(v=>String(v||'').toLowerCase().includes(search)));
 $('tracks').innerHTML=rows.map(t=>card(t,db?'<button data-fav="'+t.id+'">♡</button><button data-add="'+t.id+'">+ Playlist</button>':'')).join('');
 $('empty-tracks').hidden=rows.length>0;bindButtons($('tracks'))
}
$('search').oninput=renderTracks;
async function play(id){
 const pos=tracks.findIndex(t=>t.id===id);if(pos<0)return;
 const t=tracks[pos];try{
  let url=t.url;
  if(!url){if(!t.audio_path)throw Error('Audio not available');const {data,error}=await db.storage.from('wow-audio').createSignedUrl(t.audio_path,900);if(error)throw error;url=data.signedUrl}
  current=pos;counted=false;audio.src=url;$('now').textContent=t.title+' — '+(t.artists?.name||'Artist');await audio.play();
 }catch(e){err(e)}
}
function next(){if(!tracks.length)return;const index=shuffle?Math.floor(Math.random()*tracks.length):(current+1)%tracks.length;play(tracks[index].id)}
$('next').onclick=next;
$('shuffle').onclick=()=>{shuffle=!shuffle;$('shuffle').classList.toggle('active',shuffle)};
$('repeat').onclick=()=>{repeat=!repeat;$('repeat').textContent=repeat?'↻ On':'↻ Off'};
audio.onended=()=>{if(repeat&&current>=0)play(tracks[current].id);else next()};
audio.addEventListener('timeupdate',async()=>{
 if(!db||!session||current<0||counted||audio.paused||audio.seeking)return;
 const t=tracks[current];if(t.id.startsWith('local-'))return;
 const threshold=Number.isFinite(audio.duration)?Math.min(30,Math.max(10,audio.duration*.8)):30;
 if(audio.currentTime<threshold)return;counted=true;
 try{await request(db.rpc('record_wow_stream',{p_track_id:t.id,p_seconds:Math.floor(audio.currentTime)}))}catch(e){console.warn('Analytics not recorded',e)}
});
async function favorite(id){
 if(!requireLogin())return;
 try{
  const old=await request(db.from('favorites').select('track_id').eq('track_id',id).eq('user_id',session.user.id).maybeSingle());
  if(old){await request(db.from('favorites').delete().eq('user_id',session.user.id).eq('track_id',id));toast('Favorite removed')}
  else{await request(db.from('favorites').insert({track_id:id,user_id:session.user.id}));toast('Saved to favorites')}
  if(!$('library').hidden)loadLibrary();
 }catch(e){err(e)}
}
async function loadLibrary(){
 if(!db||!requireLogin())return;
 try{
  const [favorites,lists]=await Promise.all([
   request(db.from('favorites').select('track_id').eq('user_id',session.user.id)),
   request(db.from('playlists').select('id,title,is_public').eq('user_id',session.user.id).order('created_at',{ascending:false}))
  ]);
  const songs=favorites.map(f=>tracks.find(t=>t.id===f.track_id)).filter(Boolean);
  $('favorites').innerHTML=songs.map(t=>card(t,'<button data-fav="'+t.id+'">Remove ♡</button>')).join('')||'<p class="muted">No favorite songs yet.</p>';
  bindButtons($('favorites'));
  $('playlists').innerHTML=lists.map(p=>'<article class="song"><h3>'+escapeHTML(p.title)+'</h3><p>'+ (p.is_public?'Public':'Private')+'</p><button data-list="'+p.id+'">Show songs</button><button data-remove-list="'+p.id+'">Delete</button><div id="list-'+p.id+'"></div></article>').join('')||'<p class="muted">Create a playlist.</p>';
  for(const b of $('playlists').querySelectorAll('[data-list]'))b.onclick=()=>viewPlaylist(b.dataset.list);
  for(const b of $('playlists').querySelectorAll('[data-remove-list]'))b.onclick=()=>removeList(b.dataset.removeList);
 }catch(e){err(e)}
}
$('create-playlist').onclick=async()=>{
 if(!requireLogin())return;
 const title=prompt('Name your playlist');if(!title?.trim()||title.length>100)return;
 try{await request(db.from('playlists').insert({title:title.trim(),user_id:session.user.id}));loadLibrary()}catch(e){err(e)}
};
async function removeList(id){if(!confirm('Delete this playlist?'))return;try{await request(db.from('playlists').delete().eq('id',id).eq('user_id',session.user.id));loadLibrary()}catch(e){err(e)}}
async function viewPlaylist(id){
 try{const rows=await request(db.from('playlist_tracks').select('track_id').eq('playlist_id',id));const target=$('list-'+id);target.replaceChildren();
  for(const item of rows){const t=tracks.find(x=>x.id===item.track_id);if(!t)continue;const b=document.createElement('button');b.textContent='▶ '+t.title;b.onclick=()=>play(t.id);target.append(b)}
  if(!target.children.length)target.textContent='Playlist empty';
 }catch(e){err(e)}
}
async function addPlaylistTrack(id){
 if(!requireLogin())return;
 try{const lists=await request(db.from('playlists').select('id,title').eq('user_id',session.user.id));
  if(!lists.length)return toast('Create a playlist in My Library first');
  const answer=prompt('Select playlist number:\n'+lists.map((p,i)=>(i+1)+'. '+p.title).join('\n'));
  if(answer===null)return;const target=lists[Number(answer)-1];if(!target)return toast('Invalid selection');
  await request(db.from('playlist_tracks').upsert({playlist_id:target.id,track_id:id},{onConflict:'playlist_id,track_id'}));toast('Added to playlist');
 }catch(e){err(e)}
}
async function loadStudio(){
 if(!db||!requireLogin())return;
 try{
  const rows=await request(db.from('artists').select('id,name,status').eq('owner_id',session.user.id).limit(1));
  artist=rows[0]||null;
  $('artist-form').hidden=!!artist;$('upload-form').hidden=!artist;
  $('artist-status').textContent=artist?artist.name+' — application '+artist.status+'. Uploads require admin review.':'Register an artist profile to upload authorized music.';
  if(!artist){$('my-tracks').replaceChildren();return}
  const songs=await request(db.from('tracks').select('id,title,status').eq('artist_id',artist.id));
  $('my-tracks').innerHTML=songs.map(s=>'<article class="song"><h3>'+escapeHTML(s.title)+'</h3><p>'+escapeHTML(s.status)+'</p></article>').join('')||'<p class="muted">No submissions yet.</p>';
  const ids=songs.map(s=>s.id);const plays=ids.length?await request(db.from('stream_events').select('track_id,seconds_played').in('track_id',ids).limit(10000)):[];
  $('analytics').textContent=plays.length+' recorded listens, '+Math.round(plays.reduce((n,p)=>n+p.seconds_played,0)/60)+' listening minutes (up to latest 10,000 events)';
 }catch(e){err(e)}
}
$('artist-form').onsubmit=async e=>{
 e.preventDefault();if(!requireLogin())return;const f=new FormData(e.currentTarget);
 try{await request(db.from('artists').insert({owner_id:session.user.id,name:String(f.get('name')).trim(),bio:String(f.get('bio')||'').trim()}));toast('Artist submitted for approval');loadStudio()}catch(e){err(e)}
};
const types={'audio/mpeg':'mp3','audio/mp4':'m4a','audio/wav':'wav','audio/x-wav':'wav','audio/ogg':'ogg','audio/flac':'flac'};
$('upload-form').onsubmit=async e=>{
 e.preventDefault();if(!artist||!requireLogin())return;
 const f=new FormData(e.currentTarget),file=f.get('audio');
 if(!(file instanceof File)||!types[file.type]||file.size>52428800||file.size<=0)return toast('Unsupported file or larger than 50 MB');
 if(!f.get('rights'))return toast('You must confirm your legal rights');
 const title=String(f.get('title')||'').trim(),genre=String(f.get('genre')||'Independent').trim();
 if(!title)return;
 const path=session.user.id+'/'+crypto.randomUUID()+'.'+types[file.type];
 try{
  await request(db.storage.from('wow-audio').upload(path,file,{contentType:file.type,upsert:false}));
  await request(db.from('tracks').insert({artist_id:artist.id,title,genre,audio_path:path,rights_confirmed:true,status:'pending'}));
  toast('Track uploaded and queued for review');e.currentTarget.reset();loadStudio();
 }catch(error){err(error)}
};
async function loadAdmin(){
 if(!db||!admin)return;
 try{
  const [artists,songs]=await Promise.all([
   request(db.from('artists').select('id,name,status').order('created_at',{ascending:false}).limit(100)),
   request(db.from('tracks').select('id,title,status,audio_path,artists(name)').order('created_at',{ascending:false}).limit(100))
  ]);
  $('admin-stats').textContent=artists.length+' artists • '+songs.length+' tracks • payments disabled';
  $('admin-artists').innerHTML=artists.map(a=>'<article class="song"><h3>'+escapeHTML(a.name)+'</h3><p>'+escapeHTML(a.status)+'</p>'+(a.status==='pending'?'<button data-artist-approve="'+a.id+'">Approve</button><button data-artist-reject="'+a.id+'">Reject</button>':'')+'</article>').join('');
  $('admin-tracks').innerHTML=songs.map(t=>'<article class="song"><h3>'+escapeHTML(t.title)+'</h3><p>'+escapeHTML(t.artists?.name)+' · '+escapeHTML(t.status)+'</p>'+(t.audio_path?'<button data-review="'+escapeHTML(t.audio_path)+'">Listen</button>':'')+(t.status==='pending'?'<button data-track-approve="'+t.id+'">Publish</button><button data-track-reject="'+t.id+'">Reject</button>':'')+'</article>').join('');
  for(const b of $('admin-artists').querySelectorAll('button'))b.onclick=()=>moderate('artists',b.dataset.artistApprove||b.dataset.artistReject,!!b.dataset.artistApprove);
  for(const b of $('admin-tracks').querySelectorAll('[data-track-approve],[data-track-reject]'))b.onclick=()=>moderate('tracks',b.dataset.trackApprove||b.dataset.trackReject,!!b.dataset.trackApprove);
  for(const b of $('admin-tracks').querySelectorAll('[data-review]'))b.onclick=async()=>{try{const {data,error}=await db.storage.from('wow-audio').createSignedUrl(b.dataset.review,600);if(error)throw error;audio.src=data.signedUrl;current=-1;$('now').textContent='Admin review audio';await audio.play()}catch(e){err(e)}};
 }catch(e){err(e)}
}
async function moderate(table,id,approve){
 if(!confirm((approve?'Approve':'Reject')+' this '+table+'? Verify licensing and identity first.'))return;
 try{await request(db.from(table).update({status:approve?(table==='tracks'?'published':'approved'):'rejected'}).eq('id',id));toast('Status saved');await loadAdmin();await loadTracks()}catch(e){err(e)}
}
window.addEventListener('beforeunload',()=>localURLs.forEach(URL.revokeObjectURL));
start();
