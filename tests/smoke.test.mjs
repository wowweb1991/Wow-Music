import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const load=p=>readFileSync(new URL(p,root),'utf8');
test('WOW MUSIC identity and separate entrypoint',()=>{
 const h=load('index.html');
 assert.match(h,/WOW MUSIC/);
 assert.match(h,/Your Music\. Your World\./);
 assert.match(h,/js\/app\.js/);
 assert.doesNotMatch(h,/WOW OMNI|wow-super-app/);
});
test('payment integration not activated',()=>{
 assert.match(load('index.html'),/Payments disabled/);
 assert.doesNotMatch(load('js/app.js'),/payment_intents|checkout\.sessions|stripe\.com/i);
});
test('all exposed WOW tables have RLS',()=>{
 const sql=load('supabase/schema.sql');
 for(const table of ['profiles','admins','artists','tracks','playlists','playlist_tracks','favorites','stream_events','memberships']){
  assert.match(sql,new RegExp('alter table public\\.'+table+' enable row level security'));
 }
});
test('no private credentials in config',()=>{
 const s=load('js/config.js');
 assert.match(s,/SUPABASE_PUBLISHABLE_KEY = ''/);
 assert.doesNotMatch(s,/sb_secret_|service_role/);
});
test('audio is private and approval gated',()=>{
 const s=load('supabase/schema.sql');
 assert.match(s,/values\('wow-audio','wow-audio',false/);
 assert.match(s,/t\.status='published' and a\.status='approved'/);
});
