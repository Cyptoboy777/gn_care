(function(){
'use strict';
var KEY='gn-care-v2';
var $=function(s,r){return (r||document).querySelector(s)};
var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var pad=function(n){return String(n).padStart(2,'0')};
var dk=function(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
var today=function(){return dk(new Date())};
var inr=new Intl.NumberFormat('en-IN');
var ico=function(id,c){return '<svg class="ico '+(c||'')+'" aria-hidden="true"><use href="#'+id+'"/></svg>'};

/* ---------- state ---------- */
var defaults=function(){return {
  theme:null,ambient:true,motion:true,sound:true,
  steps:{
    am:[{id:'a1',n:'Gentle cleanser'},{id:'a2',n:'Hydrating toner or essence'},{id:'a3',n:'Vitamin C serum'},{id:'a4',n:'Moisturizer'},{id:'a5',n:'Sunscreen SPF 30+'}],
    pm:[{id:'p1',n:'Oil or balm cleanser'},{id:'p2',n:'Water-based cleanser'},{id:'p3',n:'Treatment (retinol or exfoliant)'},{id:'p4',n:'Moisturizer'},{id:'p5',n:'Lip balm'}]
  },
  done:{},water:{},goal:2500,checkins:{},budget:1500,
  shelf:[],
  skin:null,uv:{index:6,appliedAt:null},firstSeen:Date.now(),rated:null,fbSnooze:0,aiProfile:true,onDevice:false,
  remind:{asked:false,on:false,am:'08:00',pm:'21:00',spf:true}
}};
var S=defaults();
try{var raw=localStorage.getItem(KEY);if(raw){var L=JSON.parse(raw);for(var k in L){S[k]=L[k]}}}catch(e){}
/* Old builds seeded made-up sample products and prices. Drop them so every ₹ shown is the user's own data. */
if(Array.isArray(S.shelf))S.shelf=S.shelf.filter(function(i){return i&&!i.sample});else S.shelf=[];
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}

/* ---------- helpers ---------- */
var TABS=[
  {id:'home',n:'Home',i:'i-home'},{id:'routine',n:'Routine',i:'i-check'},{id:'scan',n:'Face Scan',i:'i-scan'},{id:'picks',n:'Shop',i:'i-tag'},
  {id:'timer',n:'Timer',i:'i-timer'},{id:'shelf',n:'Shelf & ₹',i:'i-bag'},{id:'checker',n:'Coach',i:'i-flask'}];
var tab='home',period=new Date().getHours()<15?'am':'pm';
var toastT;
function buzz(ms){try{if(S.motion!==false&&navigator.vibrate&&!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))navigator.vibrate(ms||10)}catch(e){}}
function toast(m){var t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('on')},2200)}

function dayDone(k){var d=S.done[k]||{am:[],pm:[]};return d}
function periodDone(k,p){var steps=S.steps[p];if(!steps.length)return false;var d=dayDone(k)[p]||[];return steps.every(function(s){return d.indexOf(s.id)>-1})}
function dayComplete(k){return periodDone(k,'am')||periodDone(k,'pm')}
function prog(){
  var d=dayDone(today()),r={};var done=0,total=0;
  ['am','pm'].forEach(function(p){var ids=S.steps[p].map(function(s){return s.id});var n=(d[p]||[]).filter(function(i){return ids.indexOf(i)>-1}).length;r[p]={done:n,total:ids.length};done+=n;total+=ids.length});
  r.pct=total?done/total:0;return r}
function lastDays(n){var a=[];for(var i=n-1;i>=0;i--){var d=new Date();d.setDate(d.getDate()-i);a.push({k:dk(d),d:d})}return a}
function streak(){var c=0,d=new Date();if(!dayComplete(dk(d)))d.setDate(d.getDate()-1);while(dayComplete(dk(d))){c++;d.setDate(d.getDate()-1);if(c>3650)break}return c}
function waterLog(){var w=S.water[today()];return Array.isArray(w)?w:[]}
function waterTotal(){return waterLog().reduce(function(a,b){return a+b},0)}

var UVC=[
  {max:2,n:'Low',c:'#2A7550',t:'#fff',adv:'SPF 30 on your face is still a good daily habit. Skip reapplying while indoors.'},
  {max:5,n:'Moderate',c:'#C9B22A',t:'#2A2400',adv:'Use SPF 30 or higher. Look for shade around midday.'},
  {max:7,n:'High',c:'#D9822B',t:'#1E1418',adv:'Use SPF 50. Reapply every 2 hours when outdoors.'},
  {max:10,n:'Very high',c:'#A8372C',t:'#fff',adv:'SPF 50+, a hat and sunglasses. Avoid direct sun from 11 am to 4 pm.'},
  {max:99,n:'Extreme',c:'#8454B8',t:'#fff',adv:'Stay in shade where you can. SPF 50+ and cover up, reapply often.'}];
function uvCat(i){for(var k=0;k<UVC.length;k++){if(i<=UVC[k].max)return UVC[k]}return UVC[4]}
function fmtTime(ms){return new Date(ms).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'})}
function uvNextText(){
  var a=S.uv.appliedAt;if(!a)return 'No sunscreen logged yet today';
  if(dk(new Date(a))!==today()){return 'No sunscreen logged yet today'}
  var left=a+2*3600000-Date.now();
  if(left<=0)return 'Reapply now. Last applied '+fmtTime(a);
  var m=Math.ceil(left/60000);var h=Math.floor(m/60);
  return 'Reapply in '+(h?h+'h ':'')+(m%60)+'m (by '+fmtTime(a+2*3600000)+')'}

/* shelf */
function addMonths(s,m){var p=s.split('-').map(Number);return new Date(p[0],p[1]-1+m,p[2])}
function daysLeft(it){if(!it.o)return null;return Math.ceil((addMonths(it.o,it.m).getTime()-Date.now())/86400000)}
function monthlyCost(){return S.shelf.reduce(function(a,it){return a+(it.m>0?it.p/it.m:0)},0)}
function shelfStatus(it){var d=daysLeft(it);if(d===null)return {t:'Unopened',c:''};if(d<0)return {t:'Expired '+(-d)+'d ago',c:'bad'};if(d<=30)return {t:d+' days left',c:'warn'};return {t:d+' days left',c:'good'}}

/* ---------- ring, glass ---------- */
function ring(pct,size,main,sub,id){
  var r=size/2-9,c=2*Math.PI*r,h=size/2;
  return '<div class="ring" style="width:'+size+'px;height:'+size+'px"><svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'"><circle cx="'+h+'" cy="'+h+'" r="'+r+'" class="r-track"/><circle '+(id?'id="'+id+'" ':'')+'cx="'+h+'" cy="'+h+'" r="'+r+'" class="r-bar" stroke-dasharray="'+c.toFixed(2)+'" stroke-dashoffset="'+(c*(1-pct)).toFixed(2)+'" style="'+(pct<=0?'stroke-opacity:0':'')+'" transform="rotate(-90 '+h+' '+h+')"/></svg><div class="ring-c"><b'+(id?' id="'+id+'-t"':'')+'>'+main+'</b><span'+(id?' id="'+id+'-s"':'')+'>'+sub+'</span></div></div>'}
function glassSVG(level){
  level=Math.max(0,Math.min(1,level));var ty=122-level*114;
  return '<svg viewBox="0 0 100 134" role="img" aria-label="Water level '+Math.round(level*100)+' percent"><path d="M18 8H82L74 122Q73 128 67 128H33Q27 128 26 122Z" fill="var(--acc-soft)"/><g clip-path="url(#glassClip)"><g class="water-g" style="transform:translateY('+ty.toFixed(1)+'px)"><path class="wave" d="M-50 6Q-37.5 0 -25 6T0 6T25 6T50 6T75 6T100 6T125 6T150 6V140H-50Z" fill="url(#gRing)" opacity=".9"/></g></g><path d="M18 8H82L74 122Q73 128 67 128H33Q27 128 26 122Z" fill="none" stroke="var(--acc-3)" stroke-width="2.4" stroke-linejoin="round"/></svg>'}
function tgl(on,act,v,label,sm,extra){return '<button type="button" role="switch" aria-checked="'+on+'" aria-label="'+esc(label)+'" class="spring'+(sm?' sm':'')+'" data-act="'+act+'" data-v="'+esc(v)+'" '+(extra||'')+'><span class="thumb"></span></button>'}

/* ---------- views ---------- */
function viewHome(){
  var p=prog(),st=streak(),tot=waterTotal(),goal=S.goal,h=new Date().getHours();
  var greet=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  var date=new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'});
  var wk=lastDays(7).map(function(x){
    var wd=['S','M','T','W','T','F','S'][x.d.getDay()];
    return '<div class="wd'+(x.k===today()?' today':'')+'">'+wd+'<i><b class="'+(periodDone(x.k,'am')?'on':'')+'" title="Morning"></b><b class="'+(periodDone(x.k,'pm')?'on':'')+'" title="Night"></b></i></div>'}).join('');
  var cat=uvCat(S.uv.index);
  var ci=S.checkins[today()];
  var moods=['Rough','Dull','Okay','Good','Glowing'].map(function(m,i){return '<button data-act="checkin" data-v="'+(i+1)+'" aria-pressed="'+(ci===i+1)+'">'+m+'</button>'}).join('');
  var bars=lastDays(7).map(function(x){var v=S.checkins[x.k];var hgt=v?(v/5*100):6;return '<div><b class="'+(v?'on':'')+'" style="height:'+hgt+'%"></b>'+['S','M','T','W','T','F','S'][x.d.getDay()]+'</div>'}).join('');
  var anyCheck=lastDays(7).some(function(x){return S.checkins[x.k]});
  var alerts=S.shelf.map(function(it){return {it:it,s:shelfStatus(it)}}).filter(function(a){return a.s.c==='bad'||a.s.c==='warn'}).slice(0,3);
  var run=monthlyCost();
  var prof=S.skin?('<div class="result-t">'+esc(S.skin.type)+'</div><div class="row wrap" style="gap:6px">'+(S.skin.sensitive?'<span class="chip warn">Sensitive</span>':'')+'<span class="chip">Sun exposure: '+['low','moderate','high'][S.skin.sun]+'</span>'+(S.skin.flags||[]).map(function(f){var n=window.GNFaceScan&&GNFaceScan.CONCERN_LABELS[f];return n?'<span class="chip">'+esc(n)+'</span>':''}).join('')+'</div><p class="hint">Scanned '+esc(S.skin.at)+'</p><button class="btn ghost sm" data-act="nav" data-v="scan" style="align-self:flex-start">Re-scan</button> <button class="btn sm" data-act="nav" data-v="picks" style="align-self:flex-start">See picks for my skin</button>')
    :('<p style="font-size:14px">A selfie or a short note, your budget, then a kit and a routine you can set in one tap.</p><button class="btn sm" data-act="nav" data-v="scan" style="align-self:flex-start">'+ico('i-scan')+'Start face scan</button>');
  return '<div class="head"><p class="eyebrow">'+date+'</p><h2 class="page-h">'+greet+', <em>glow</em> on.</h2></div>'+
  '<div class="grid">'+
  '<section class="tile tile-hero s7"><h3 class="t">'+ico('i-leaf')+'Today\'s ritual</h3><div class="hero-row">'+ring(p.pct,136,Math.round(p.pct*100)+'%','done')+
    '<div class="hero-copy"><div class="stat-line"><div><b class="num">'+p.am.done+'/'+p.am.total+'</b><span>Morning</span></div><div><b class="num">'+p.pm.done+'/'+p.pm.total+'</b><span>Night</span></div></div>'+
    '<div class="btn-grid"><button class="btn" data-act="goRoutine" data-v="am">'+ico('i-sun')+'Morning</button><button class="btn ghost" data-act="goRoutine" data-v="pm">'+ico('i-moon')+'Night</button></div></div></div></section>'+
  '<section class="tile s5"><h3 class="t">Streak</h3><div class="row" style="align-items:flex-end;gap:10px"><span class="big num">'+st+'</span><span class="hint" style="padding-bottom:6px">day'+(st===1?'':'s')+' in a row<br>finish one full routine a day</span></div><div class="week">'+wk+'</div></section>'+
  '<section class="tile s4"><h3 class="t">'+ico('i-drop')+'Hydration</h3><div class="glass-wrap">'+glassSVG(tot/goal)+'<div style="min-width:0"><div class="row" style="align-items:baseline;gap:6px"><span class="big num" style="font-size:38px">'+inr.format(tot)+'</span><span class="hint">of '+inr.format(goal)+' ml</span></div></div></div>'+
    '<div class="btn-grid"><button class="btn sm" data-act="water" data-v="250">+250</button><button class="btn sm" data-act="water" data-v="500">+500</button><button class="btn ghost sm" data-act="undoWater" aria-label="Undo last glass">'+ico('i-undo')+'</button></div></section>'+
  '<section class="tile s4"><h3 class="t">'+ico('i-sun')+'UV protection</h3><div class="uv-top"><div class="uv-num num" id="uv-val">'+S.uv.index+'</div><div style="min-width:0"><span class="chip" id="uv-cat" style="background:'+cat.c+';color:'+cat.t+'">'+cat.n+'</span><p class="hint" id="uv-adv" style="margin-top:6px">'+cat.adv+'</p></div></div>'+
    '<input type="range" id="uv-range" class="uv-range" min="0" max="11" step="1" value="'+S.uv.index+'" aria-label="UV index"><div class="uv-scale"><span>0</span><span>11+</span></div>'+
    '<div class="row sp wrap"><button class="btn sm" data-act="uvApply">I applied sunscreen</button><span class="hint" id="uv-next">'+uvNextText()+'</span></div></section>'+
  '<section class="tile s4"><h3 class="t">Skin check-in</h3><div class="moods">'+moods+'</div><div class="bars" aria-label="Last 7 days of check-ins">'+bars+'</div>'+(anyCheck?'':'<p class="hint">Tap how your skin feels today. Your week fills in here.</p>')+'</section>'+
  '<section class="tile s6"><h3 class="t">Skin profile</h3>'+prof+'</section>'+
  '<section class="tile s6"><h3 class="t">'+ico('i-bag')+'Shelf watch</h3>'+(!S.shelf.length?'<p class="hint">Add the products you own to track their monthly cost and when they expire after opening.</p><button class="btn ghost sm" data-act="nav" data-v="shelf" style="align-self:flex-start">Add products</button></section>':'<div class="row sp"><div><b class="num" style="font-size:22px">₹'+inr.format(Math.round(run))+'</b><span class="hint"> / month running cost</span></div><span class="chip '+(run>S.budget?'bad':'good')+'">Budget ₹'+inr.format(S.budget)+'</span></div>'+
    '<div class="meter '+(run>S.budget?'over':'')+'"><i style="width:'+Math.min(100,S.budget?run/S.budget*100:0)+'%"></i></div>'+
    (alerts.length?'<div class="list">'+alerts.map(function(a){return '<div class="li"><div class="grow"><b>'+esc(a.it.n)+'</b></div><span class="chip '+a.s.c+'">'+a.s.t+'</span></div>'}).join('')+'</div>':'<p class="hint">Nothing is expiring in the next 30 days.</p>')+
    '<button class="btn ghost sm" data-act="nav" data-v="shelf" style="align-self:flex-start">Open shelf</button></section>')+
  (installHome())+ratePrompt()+'</div>'}

function viewRoutine(){
  var d=dayDone(today()),steps=S.steps[period],done=d[period]||[];
  var n=steps.filter(function(s){return done.indexOf(s.id)>-1}).length;
  var tips={am:'Order matters in the morning: lightest texture first, <b>sunscreen last</b>. Give vitamin C a minute to settle before moisturizer.',
            pm:'At night, cleanse first and put <b>treatments on dry skin</b>. Use exfoliants and retinol on different nights.'};
  var skinTip=S.skin?(' For your '+esc(S.skin.type.toLowerCase())+' skin: '+({Oily:'keep textures light and gel based.',Dry:'layer hydration under a richer cream.',Combination:'use lighter products on the T-zone and richer ones on the cheeks.',Normal:'keep it simple and add one active at a time.'}[S.skin.type]||'')):'';
  return '<div class="head"><p class="eyebrow">Skin ritual</p><h2 class="page-h">Your <em>'+(period==='am'?'morning':'night')+'</em> steps</h2></div>'+
  '<div class="grid"><section class="tile s7" style="gap:16px">'+
    '<div class="row sp wrap"><div class="seg" data-i="'+(period==='am'?0:1)+'" role="group" aria-label="Routine time"><span class="pill"></span><button data-act="period" data-v="am" aria-pressed="'+(period==='am')+'">'+ico('i-sun')+'Morning</button><button data-act="period" data-v="pm" aria-pressed="'+(period==='pm')+'">'+ico('i-moon')+'Night</button></div><span class="chip num">'+n+' of '+steps.length+' done</span></div>'+
    '<div class="meter"><i style="width:'+(steps.length?n/steps.length*100:0)+'%"></i></div>'+
    '<div class="list" style="gap:10px">'+(steps.length?steps.map(function(s,i){var on=done.indexOf(s.id)>-1;return '<div class="step'+(on?' done':'')+'"><span class="ix num">'+(i+1)+'</span><span class="nm">'+esc(s.n)+'</span><button class="x-btn" data-act="delStep" data-v="'+esc(s.id)+'" aria-label="Remove '+esc(s.n)+'">'+ico('i-x')+'</button>'+tgl(on,'step',s.id,s.n+(on?' done':' not done'),true)+'</div>'}).join(''):'<p class="hint">No steps yet. Add your first one below.</p>')+'</div>'+
    '<form class="inline-form" data-form="step"><input class="input" id="step-input" placeholder="Add a step, e.g. Eye cream" maxlength="60" autocomplete="off" aria-label="New step"><button class="btn" type="submit">'+ico('i-plus')+'Add</button></form>'+
  '</section>'+
  '<section class="tile s5"><h3 class="t">Guidance</h3><div class="tip">'+tips[period]+skinTip+'</div><div class="tip"><b>Rule of thumb:</b> thinnest to thickest, water-based before oil-based, and wait about 30 seconds between actives.</div><button class="btn ghost sm" data-act="resetDay" style="align-self:flex-start">'+ico('i-reset')+'Reset today</button></section></div>'}

/* scan */
var scanning=false,scanMsg='',scanErr='',photo=S.savedPhoto||null;
var scanStep=1,scanNote='',scanBudget=1000,scanFlags=[],scanMetrics=null,routineSet=false;
var scanLandmarks=null,scanImageSize=null,scanMirror=false,scanNoFace=false;
function applySkin(photoMetrics,flags){
  var FS=window.GNFaceScan;
  var f=flags||scanFlags||[];
  var r;
  if(FS&&FS.recommend){r=FS.recommend(photoMetrics||null,f)}
  else{r={ok:!!(photoMetrics&&photoMetrics.ok)||!!f.length,needInput:!(photoMetrics&&photoMetrics.ok)&&!f.length,type:'Normal',sensitive:f.indexOf('sensitive')>-1,sensitiveLeaning:false,sun:f.indexOf('tan')>-1?2:0,source:photoMetrics&&photoMetrics.ok?'scan':'note',zones:null,metrics:photoMetrics&&photoMetrics.ok?photoMetrics:null,concerns:f}}
  if(!r||!r.ok)return false;
  S.skin={type:r.type,sensitive:!!r.sensitive,sensitiveLeaning:!!r.sensitiveLeaning,sun:r.sun,flags:r.concerns||f,note:scanNote,at:new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short'}),source:r.source||'note',metrics:r.metrics||null,zones:r.zones||null};
  S.lastScanAt=Date.now();
  var k=kit();k.type=r.type;k.sens=!!(r.sensitive||r.sensitiveLeaning);k.budget=scanBudget;k.swaps={};PK={ai:'',err:'',busy:false,rated:false};
  save();return true}
function zones(type){
  if(S.skin&&S.skin.zones)return S.skin.zones;
  var FS=window.GNFaceScan;
  if(FS)return FS.zonesFromType(type);
  if(type==='Oily')return {f:'oil',n:'oil',c:'oil',ch:'oil'};
  if(type==='Dry')return {f:'dry',n:'dry',c:'dry',ch:'dry'};
  if(type==='Combination')return {f:'oil',n:'oil',c:'dry',ch:'oil'};
  if(type==='Normal')return {f:'bal',n:'bal',c:'bal',ch:'bal'};
  return {f:'',n:'',c:'',ch:''}}
var RECS={
 Oily:['Gel or foaming cleanser morning and night.','Oil-free gel moisturizer. Skipping it can make oil worse.','Niacinamide daily, salicylic acid (BHA) two or three nights a week.'],
 Dry:['Cream or milk cleanser with lukewarm water.','Hyaluronic acid on damp skin, then a ceramide cream to seal it in.','Keep exfoliation to once a week and avoid scrubs.'],
 Combination:['Gentle gel cleanser all over.','Lightweight lotion on the T-zone, a richer cream on the cheeks.','Use BHA only on forehead, nose and chin.'],
 Normal:['Gentle cleanser and a light moisturizer.','Keep sunscreen as the one non-negotiable step.','Add one new active at a time, two weeks apart.']};
function scanDots(n){
  return '<p class="step-lbl">Step '+n+' of 4 · '+['Selfie (optional)','Your note','Budget','Your kit'][n-1]+'</p><div class="steps" aria-hidden="true">'+[1,2,3,4].map(function(i){return '<i'+(i===n?' class="on"':'')+'></i>'}).join('')+'</div>'}
function scanNav(opts){
  opts=opts||{};
  return '<div class="wiz-nav">'+
    (opts.back?'<button class="btn ghost" data-act="scanBack"'+(scanning?' disabled':'')+'>Back</button>':'')+
    (opts.skip?'<button class="btn ghost" data-act="scanSkip"'+(scanning?' disabled':'')+'>Skip</button>':'')+
    (opts.next?'<button class="btn" data-act="scanNext"'+(opts.off||scanning?' disabled':'')+'>'+opts.next+'</button>':'')+
    '</div>'}
function clearScanPhoto(){photo=null;scanErr='';scanMetrics=null;scanLandmarks=null;scanImageSize=null;scanNoFace=false;scanMirror=false}
function faceMap(){
  var z=zones(S.skin?S.skin.type:'');
  var FS=window.GNFaceScan;
  var inner='',msg='';
  if(photo&&scanLandmarks&&scanImageSize&&FS&&FS.overlaySvg){
    inner=FS.overlaySvg(scanLandmarks,scanImageSize.w,scanImageSize.h,200,260,{fit:'cover',mirror:!!scanMirror,dpr:1,zones:z,photo:true});
  }else if(photo&&scanNoFace){
    msg='<p class="face-msg">Face not detected, center your face</p>';
  }else if(!photo){
    inner='<ellipse class="outline" cx="100" cy="130" rx="70" ry="95"/>'+
      '<ellipse class="z '+z.f+'" cx="100" cy="68" rx="48" ry="22"/><ellipse class="z '+z.n+'" cx="100" cy="136" rx="14" ry="36"/>'+
      '<ellipse class="z '+z.c+'" cx="55" cy="150" rx="24" ry="32"/><ellipse class="z '+z.c+'" cx="145" cy="150" rx="24" ry="32"/>'+
      '<ellipse class="z '+z.ch+'" cx="100" cy="213" rx="30" ry="16"/>'+
      '<g class="outline" style="opacity:.4"><path d="M78 112h14M108 112h14M88 176c8 6 16 6 24 0" stroke-linecap="round"/></g>';
  }
  return '<div class="face">'+(photo?'<img src="'+esc(photo)+'" alt="Your photo"'+(scanMirror?' class="mirror"':'')+'>':'')+
    '<svg class="map" viewBox="0 0 200 260" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'+inner+'</svg>'+
    msg+(scanning?'<span class="laser"></span>':'')+'</div>'}
/* Progress photo timeline: small JPEGs kept only in this browser (max 12). Never uploaded. */
function progressHTML(){
  var P=S.progress||[];
  var add=photo?'<button class="btn sm" data-act="progSave">'+ico('i-plus')+'Add this photo to my timeline</button>':'';
  if(!P.length)return add?'<section class="tile" style="max-width:640px;margin:0 auto 14px;width:100%"><h3 class="t">Progress timeline</h3><p class="hint">Save a photo each week in the same light to see real change over time. Stored only on this phone.</p>'+add+'</section>':'';
  var first=P[0],last=P[P.length-1];
  var cmp=P.length>1?'<div class="prog-cmp"><figure><img src="'+esc(first.img)+'" alt="First progress photo, '+esc(first.d)+'"><figcaption>First · '+esc(first.d)+'</figcaption></figure><figure><img src="'+esc(last.img)+'" alt="Latest progress photo, '+esc(last.d)+'"><figcaption>Latest · '+esc(last.d)+'</figcaption></figure></div>':'';
  return '<section class="tile" style="max-width:640px;margin:0 auto 14px;width:100%"><h3 class="t">Progress timeline</h3>'+cmp+
    '<div class="prog-row">'+P.map(function(x,i){return '<div class="prog-item"><img src="'+esc(x.img)+'" alt="Progress photo '+esc(x.d)+'" loading="lazy"><span class="hint">'+esc(x.d)+(x.t?' · '+esc(x.t):'')+'</span><div class="row" style="gap:4px"><a class="btn ghost sm" href="'+esc(x.img)+'" download="gn-care-'+esc(x.k)+'.jpg" aria-label="Download photo '+esc(x.d)+'">Save</a><button class="btn ghost sm" data-act="progDel" data-v="'+i+'" aria-label="Delete photo '+esc(x.d)+'">Delete</button></div></div>'}).join('')+'</div>'+
    add+'<p class="hint">Photos stay in this browser only. Use Save to keep a copy in your gallery.</p></section>'}
function viewScan(){
  var head='<div class="head"><p class="eyebrow">Quick scan</p><h2 class="page-h">Face <em>scan</em></h2>'+scanDots(scanStep)+'</div>';
  if(scanStep===1){
    return head+'<p class="sub">Add a selfie if you like. We read it only on this device. You can skip this step.</p>'+
      '<div style="display:flex;flex-direction:column;gap:12px;max-width:400px;margin:0 auto;width:100%">'+faceMap()+
      '<div class="legend"><span><i style="background:var(--z-oil)"></i>Oily</span><span><i style="background:var(--z-dry)"></i>Dry</span><span><i style="background:var(--z-bal)"></i>Balanced</span></div>'+
      '<input type="file" id="photo-in" accept="image/*" capture="user" hidden>'+
      '<div class="btn-grid">'+
      '<button class="btn" data-act="photo" '+(scanning?'disabled':'')+'>'+ico('i-camera')+(photo?'Change photo':'Add a selfie')+'</button>'+
      (photo&&!S.savedPhoto?'<button class="btn ghost" data-act="savePhoto">Save photo on this device</button>':'')+
      (S.savedPhoto?'<button class="btn ghost" data-act="clearPhoto">Remove saved photo</button>':'')+
      (photo&&!S.savedPhoto?'<button class="btn ghost" data-act="clearSessionPhoto">Remove photo</button>':'')+
      '</div>'+
      (scanErr?'<div class="res bad"><span class="tag">Retake</span><div><p>'+esc(scanErr)+'</p></div></div>':'')+
      (scanning?'<p class="hint" style="text-align:center">'+esc(scanMsg||'Reading your photo on this device…')+'</p>':'')+
      progressHTML()+'<p class="hint consent-note">A selfie is optional. If you add one, it is processed only in this browser to estimate shine, redness, evenness and under-eye darkness. It is never uploaded. It stays in this session unless you tap Save photo on this device.</p>'+
      scanNav({skip:!photo,next:photo?'Next':'',off:scanning})+'</div>'}
  if(scanStep===2){
    return head+'<p class="sub">Anything else we should know? This is optional if you already added a selfie.</p>'+
      '<section class="tile" style="gap:14px;max-width:520px;margin:0 auto;width:100%">'+
      '<label class="f">Anything else about your skin? <span class="hint" style="font-weight:400">(e.g. oily by noon, pimples on chin, dry after wash, sensitive to fragrance)</span>'+
      '<textarea class="input" id="scan-note" maxlength="400" rows="5" placeholder="Oily by noon, pimples on chin…">'+esc(scanNote)+'</textarea></label>'+
      scanNav({back:true,next:'Next'})+'</section>'}
  if(scanStep===3){
    var budgets=(window.GNFaceScan&&GNFaceScan.KIT_BUDGETS)||[{id:'u500',n:'Under ₹500',budget:500},{id:'u1000',n:'₹500–1000',budget:1000},{id:'u2000',n:'₹1000–2000',budget:2000},{id:'open',n:'No limit',budget:0}];
    return head+'<p class="sub">What would you like to spend on a starter kit?</p>'+
      '<section class="tile" style="gap:16px;max-width:520px;margin:0 auto;width:100%">'+
      '<div class="chips budget-picks">'+budgets.map(function(b){return '<button data-act="scanBudget" data-v="'+b.budget+'" aria-pressed="'+(scanBudget===b.budget)+'">'+esc(b.n)+'</button>'}).join('')+'</div>'+
      '<p class="hint">This is the total for a cleanser, moisturizer and sunscreen. No limit picks the best match regardless of price.</p>'+
      scanNav({back:true,next:'See my kit'})+'</section>'}
  var m=S.skin&&S.skin.metrics;
  var src={ 'scan+note':'Selfie + note', scan:'On-device photo', note:'Your note' }[S.skin&&S.skin.source]||'Your profile';
  var chips=S.skin?((S.skin.sensitive?'<span class="chip warn">Sensitive</span>':(S.skin.sensitiveLeaning?'<span class="chip warn">Sensitive-leaning</span>':''))+'<span class="chip">'+esc(src)+'</span>'+(S.skin.flags||[]).map(function(f){var n=window.GNFaceScan&&GNFaceScan.CONCERN_LABELS[f];return n?'<span class="chip">'+esc(n)+'</span>':''}).join('')):'';
  var meters=m?('<div class="metrics" aria-label="Cosmetic estimates">'+
    '<div><b>'+m.shine+'</b><span>Shine</span></div><div><b>'+m.redness+'</b><span>Redness</span></div><div><b>'+m.evenness+'</b><span>Evenness</span></div><div><b>'+m.darkCircles+'</b><span>Under-eye darkness</span></div></div>'):'';
  var kitHtml='';
  if(S.skin&&!(window.GN_PRODUCTS&&GN_PRODUCTS.length))kitHtml='<section class="tile"><h3 class="t">Your best kit</h3><div class="skel" aria-busy="true" aria-label="Loading products"><i></i><i></i><i></i></div></section>';
  else if(S.skin&&window.GNPicks){
    var r=kitBuild();
    var msg=scanBudget>0?(r.fits?('About '+money(r.total)+' of your '+money(scanBudget)+' budget.'):('The lowest kit is about '+money(r.min)+', above your '+money(scanBudget)+' budget. Go back and raise the budget, or still use these picks.')):'About '+money(r.total)+', no budget cap.';
    var avoidScan=(window.GNPicks&&GNPicks.avoidTips)?'<section class="tile kit-span"><h3 class="t">What to avoid</h3><ul class="checks">'+GNPicks.avoidTips(S.skin.type,S.skin.flags||[],S.skin.sensitive||S.skin.sensitiveLeaning).map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ul></section>':'';
    var inKit=r.items.map(function(i){return i.item&&i.item.id});
    var trScan=(window.GNPicks&&GNPicks.treatments)?GNPicks.treatments(S.skin.type,S.skin.flags||[]).filter(function(p){return inKit.indexOf(p.id)<0}).slice(0,3):[];
    var treatScanGrid=trScan.length?'<section class="tile kit-span"><h3 class="t">Other serums that may suit you</h3><div class="prod-grid">'+trScan.map(function(p){return shopCard(p,S.skin.type)}).join('')+'</div></section>':'';
    kitHtml=kitSummary(r,S.skin.type,S.skin.sensitive||S.skin.sensitiveLeaning,scanBudget)+'<h3 class="t kit-detail-h">Product details</h3>'+kitProductGrid(r.items,S.skin.type)+avoidScan+treatScanGrid;
  }
  var routine=S.skin&&window.GNFaceScan?GNFaceScan.buildRoutine(S.skin.type,S.skin.flags,S.skin.sensitive||S.skin.sensitiveLeaning):{am:[],pm:[]};
  var col=function(title,list){return '<div><h3 class="t">'+title+'</h3><ul class="checks">'+list.map(function(s){return '<li>'+esc(s.n)+'</li>'}).join('')+'</ul></div>'};
  return head+(S.skin?('<section class="tile tile-hero" style="margin:0 auto 14px;width:100%"><h3 class="t">Your result</h3>'+faceMap()+'<div class="legend"><span><i style="background:var(--z-oil)"></i>Oily</span><span><i style="background:var(--z-dry)"></i>Dry</span><span><i style="background:var(--z-bal)"></i>Balanced</span></div><div class="result-t">'+esc(S.skin.type)+' skin</div><div class="row wrap" style="gap:6px">'+chips+'</div>'+meters+
    '<p class="hint">This is a cosmetic estimate, not a medical diagnosis. Lighting affects results.</p></section>'+progressHTML()+
    '<div class="scan-kit">'+kitHtml+'</div>'+
    (window.GNSkin?'<section class="tile" style="margin:14px auto 0;width:100%"><h3 class="t">Why this plan</h3><div class="answer">'+fmtAns(GNSkin.explain({type:S.skin.type,sensitive:S.skin.sensitive||S.skin.sensitiveLeaning,concerns:S.skin.flags||[]},copyLang))+'</div></section>':'')+
    '<section class="tile" style="margin:14px auto 0;width:100%;gap:16px"><h3 class="t">A simple AM and PM routine</h3><div class="routine-preview">'+col('Morning',routine.am)+col('Night',routine.pm)+'</div>'+
    '<button class="btn" data-act="setScanRoutine">'+ico('i-check')+(routineSet?'Routine updated — open Routine tab':'Set this routine')+'</button>'+
    '<p class="hint">This replaces the steps in the Routine tab. You can still edit them there.</p></section>'):'')+
    '<div class="wiz-nav" style="margin:16px auto 0"><button class="btn ghost" data-act="scanBack">Back</button><button class="btn ghost" data-act="scanRestart">Start again</button></div>'}

/* timer */
var PRE=[{n:'Cleanser massage',s:60,d:'1 min'},{n:'Face mask',s:600,d:'10 min'},{n:'Sheet mask',s:900,d:'15 min'},{n:'Hair oil',s:1800,d:'30 min'},{n:'Toner pat',s:30,d:'30 sec'},{n:'Eye patches',s:600,d:'10 min'}];
var T={label:'Cleanser massage',total:60,left:60,end:null,running:false};
function fmt(s){return pad(Math.floor(s/60))+':'+pad(s%60)}
function tPct(){return T.total?T.left/T.total:0}
function viewTimer(){
  var c=2*Math.PI*(150/2-9);
  var presets=PRE.map(function(p,i){return '<button class="preset" data-act="tpre" data-v="'+i+'" aria-pressed="'+(T.label===p.n&&T.total===p.s)+'"><b>'+p.n+'</b><span>'+p.d+'</span></button>'}).join('');
  return '<div class="head"><p class="eyebrow">Ritual timer</p><h2 class="page-h">Give it <em>time</em></h2><p class="sub">Masks, cleansers and oils work best when you leave them on for the full time.</p></div>'+
  '<div class="grid"><section class="tile s6"><div class="timer-stage"><div class="eyebrow" id="t-label">'+esc(T.label)+'</div>'+ring(tPct(),210,fmt(T.left),T.running?'running':(T.left===0?'finished':'ready'),'t-ring')+
    '<div class="btn-grid" style="justify-content:center"><button class="btn" data-act="tToggle" id="t-main">'+ico(T.running?'i-pause':'i-play')+(T.running?'Pause':(T.left<T.total&&T.left>0?'Resume':'Start'))+'</button><button class="btn ghost" data-act="tReset">'+ico('i-reset')+'Reset</button></div></div></section>'+
  '<section class="tile s6"><h3 class="t">Presets</h3><div class="presets">'+presets+'</div>'+
    '<form class="inline-form" data-form="timer" style="align-items:flex-end"><label class="f" style="flex:1">Custom minutes<input class="input num" id="t-custom" type="number" min="1" max="180" value="5" inputmode="numeric"></label><button class="btn" type="submit">Set</button></form></section></div>'}
function tickTimer(){
  if(T.running){T.left=Math.max(0,Math.ceil((T.end-Date.now())/1000));if(T.left<=0){T.running=false;T.end=null;finishTimer()}}
  var dot=$('#nav-side [data-tab="timer"] .dot');if(dot)dot.style.display=T.running?'':'none';
  if(tab==='timer'){
    var t=$('#t-ring-t');if(!t)return;t.textContent=fmt(T.left);
    var r=$('#t-ring'),s=$('#t-ring-s');var c=2*Math.PI*(210/2-9);
    r.setAttribute('stroke-dashoffset',(c*(1-tPct())).toFixed(2));r.style.strokeOpacity=T.left<=0?0:1;
    s.textContent=T.running?'running':(T.left===0?'finished':'ready')}
}
function finishTimer(){
  toast(T.label+' is done');
  if(S.sound){try{var ctx=new (window.AudioContext||window.webkitAudioContext)();[0,.28,.56].forEach(function(d,i){var o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=620+i*130;o.connect(g);g.connect(ctx.destination);var t0=ctx.currentTime+d;g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(.18,t0+.03);g.gain.exponentialRampToValueAtTime(.0001,t0+.24);o.start(t0);o.stop(t0+.26)})}catch(e){}}
  if(tab==='timer')render()}

/* shelf */
var CATS=['Cleanser','Toner','Serum','Moisturizer','Sunscreen','Mask','Body','Hair','Other'];
/* Clash check across shelf products, from active-ingredient words in the product names you typed. */
var SHELF_ACT=[['retinol',/retin(ol|al|oid)|adapalene|tretinoin|bakuchiol/],['vitc',/vitamin ?c|vit ?c\b|ascorb|\bvc\b/],['aha',/\baha\b|glycolic|lactic|mandelic|peel/],['bha',/\bbha\b|salicylic/],['bp',/benzoyl|\bbpo?\b/],['niac',/niacinamide/],['ha',/hyaluronic|\bha\b/],['pep',/peptide/],['spf',/\bspf\b|sunscreen|sun ?block/]];
function shelfActives(it){var n=(it.n+' '+(it.c==='Sunscreen'?'spf':'')).toLowerCase();return SHELF_ACT.filter(function(a){return a[1].test(n)}).map(function(a){return a[0]})}
function shelfClashHTML(){
  var who={};S.shelf.forEach(function(it){shelfActives(it).forEach(function(a){(who[a]=who[a]||[]).push(it.n)})});
  var ids=Object.keys(who);if(ids.length<2)return '';
  var c=labelConflicts(ids).filter(function(x){return x.lv!=='good'||ids.length<4}).slice(0,5);if(!c.length)return '';
  return '<section class="tile s12"><h3 class="t">Clash check for your shelf</h3><p class="hint">Based on the active ingredients in your product names. Check the full label to be sure.</p><div class="list">'+c.map(function(x){
    return '<div class="res '+x.lv+'"><span class="tag">'+LAB[x.lv]+'</span><div><p><b>'+esc(who[x.a].join(', '))+'</b> + <b>'+esc(who[x.b].join(', '))+'</b></p><p class="hint">'+esc(x.tx)+'</p></div></div>'}).join('')+'</div></section>'}
function viewShelf(){
  var run=monthlyCost(),total=S.shelf.reduce(function(a,b){return a+b.p},0);
  var by={};S.shelf.forEach(function(it){by[it.c]=(by[it.c]||0)+it.p});
  var cats=Object.keys(by).sort(function(a,b){return by[b]-by[a]});
  var items=S.shelf.slice().sort(function(a,b){var x=daysLeft(a),y=daysLeft(b);return (x===null?9999:x)-(y===null?9999:y)});
  return '<div class="head"><p class="eyebrow">Budget in rupees</p><h2 class="page-h">Shelf &amp; <em>₹</em> budget</h2></div>'+
  '<div class="grid">'+shelfClashHTML()+'<section class="tile s5"><h3 class="t">Monthly running cost</h3><div class="row" style="align-items:baseline;gap:8px"><span class="big num" style="font-size:48px">₹'+inr.format(Math.round(run))+'</span><span class="hint">of ₹'+inr.format(S.budget)+'</span></div>'+
    '<div class="meter '+(run>S.budget?'over':'')+'"><i style="width:'+Math.min(100,S.budget?run/S.budget*100:0)+'%"></i></div>'+
    '<p class="hint">'+(run>S.budget?'Over budget by ₹'+inr.format(Math.round(run-S.budget))+' a month.':'₹'+inr.format(Math.max(0,Math.round(S.budget-run)))+' left each month.')+' Running cost is each price divided by its months of use.</p>'+
    '<label class="f">Monthly budget (₹)<input class="input num" id="budget-input" type="number" min="0" step="50" value="'+S.budget+'" inputmode="numeric"></label>'+
    '<div class="list" style="gap:10px"><div class="row sp"><span class="hint">Shelf value</span><b class="num">₹'+inr.format(total)+'</b></div>'+cats.map(function(c){return '<div><div class="row sp"><span style="font-size:13px;font-weight:600">'+c+'</span><span class="hint num">₹'+inr.format(by[c])+'</span></div><div class="meter"><i style="width:'+(total?by[c]/total*100:0)+'%"></i></div></div>'}).join('')+'</div></section>'+
  '<section class="tile s7"><h3 class="t">Products ('+S.shelf.length+')</h3><div class="list">'+(items.length?items.map(function(it){var s=shelfStatus(it);return '<div class="li"><div class="grow"><b>'+esc(it.n)+(it.sample?'<span class="sample">Sample</span>':'')+'</b><span>'+esc(it.c)+' · ₹'+inr.format(it.p)+' · '+it.m+' mo after opening</span></div>'+(s.c?'<span class="chip '+s.c+'">'+s.t+'</span>':'<span class="chip">'+s.t+'</span>')+'<button class="x-btn" data-act="delItem" data-v="'+esc(it.id)+'" aria-label="Remove '+esc(it.n)+'">'+ico('i-x')+'</button></div>'}).join(''):'<p class="hint">Your shelf is empty. Add a product below.</p>')+'</div>'+
    '<form data-form="item" style="display:flex;flex-direction:column;gap:10px;margin-top:4px"><div class="cols2"><label class="f">Product<input class="input" id="item-name" required maxlength="50" placeholder="Niacinamide serum"></label>'+
    '<label class="f">Category<select class="input" id="item-cat">'+CATS.map(function(c){return '<option>'+c+'</option>'}).join('')+'</select></label>'+
    '<label class="f">Price (₹)<input class="input num" id="item-price" type="number" min="0" required inputmode="numeric" placeholder="599"></label>'+
    '<label class="f">Opened on<input class="input" id="item-open" type="date"></label>'+
    '<label class="f">Months after opening<input class="input num" id="item-pao" type="number" min="1" max="60" value="12" inputmode="numeric"></label></div>'+
    '<button class="btn" type="submit" style="align-self:flex-start">'+ico('i-plus')+'Add product</button></form></section></div>'}

/* checker */
var ACT=[{id:'retinol',n:'Retinol',w:'Night only'},{id:'vitc',n:'Vitamin C',w:'Morning'},{id:'aha',n:'AHA (glycolic, lactic)',w:'Night'},{id:'bha',n:'BHA (salicylic)',w:'Either'},{id:'bp',n:'Benzoyl peroxide',w:'Either'},{id:'niac',n:'Niacinamide',w:'Either'},{id:'ha',n:'Hyaluronic acid',w:'Either'},{id:'pep',n:'Peptides',w:'Either'},{id:'spf',n:'Sunscreen',w:'Morning'}];
var R={
 'aha|retinol':['bad','Both exfoliate and can weaken the skin barrier. Use them on alternate nights.'],
 'bha|retinol':['warn','Together they can over-dry. Alternate nights, or keep BHA to the morning.'],
 'bp|retinol':['warn','Benzoyl peroxide can break retinol down. Use one in the morning and the other at night.'],
 'retinol|vitc':['warn','Different ideal pH and both can sting. Vitamin C in the morning, retinol at night.'],
 'aha|vitc':['warn','Stacking acids can irritate. Pick one per routine.'],
 'bha|vitc':['warn','Stacking acids can irritate. Pick one per routine.'],
 'bp|vitc':['bad','Benzoyl peroxide oxidizes vitamin C and makes it far less effective.'],
 'aha|bha':['warn','Both exfoliate. Use one per night to avoid over-exfoliating.'],
 'aha|bp':['warn','Exfoliating plus drying. Use on separate days.'],
 'bha|bp':['warn','Both can dry the skin. Start on alternate days.'],
 'niac|retinol':['good','Niacinamide can cushion retinol irritation.'],
 'niac|vitc':['good','Safe together. The old warning about this pair is outdated.'],
 'ha|retinol':['good','Hyaluronic acid adds hydration that helps skin tolerate retinol.'],
 'ha|vitc':['good','A hydrating pairing for the morning.'],
 'aha|ha':['good','Hydration helps offset the dryness from acids.'],
 'ha|niac':['good','A gentle, hydrating pair.'],
 'spf|vitc':['good','Vitamin C under sunscreen adds antioxidant protection.'],
 'retinol|spf':['warn','Retinol goes on at night. Sunscreen the next morning is essential.'],
 'aha|spf':['warn','Acids raise sun sensitivity. Wear sunscreen every day after using them.'],
 'aha|pep':['warn','Strong acids can reduce peptide stability. Use on different nights.'],
 'niac|pep':['good','No known issues. A good pair.']};
var picked=[];
function key(a,b){return [a,b].sort().join('|')}
/* ---------- shop: picks by skin type and budget ---------- */
var PK={ai:'',err:'',busy:false,rated:false};
var SH={q:'',cat:'all',sort:'match'};
var SKINS=['Oily','Dry','Combination','Normal'];
var AUDS=[['any','Anyone'],['women','Women'],['men','Men']];
var BUDGETS=[1000,1500,2500,4000];
function kit(){if(!S.kit)S.kit={budget:1500,aud:'any',type:'',sens:null,swaps:{}};if(!S.kit.swaps)S.kit.swaps={};return S.kit}
function kitType(){var k=kit();return k.type||(S.skin&&S.skin.type)||''}
function kitSens(){var k=kit();return (k.sens===null||k.sens===undefined)?!!(S.skin&&S.skin.sensitive):!!k.sens}
function shelfHave(){var h={};S.shelf.forEach(function(i){if(!i.sample&&window.GNPicks&&GNPicks.CORE.indexOf(i.c)>-1)h[i.c]=true});return h}
function money(n){return '₹'+inr.format(Math.round(n))}
function affTag(){return (window.GN_CONFIG&&GN_CONFIG.AFFILIATE_TAG)||''}
function fkAff(){return (window.GN_CONFIG&&GN_CONFIG.FLIPKART_AFFID)||''}
function priceTxt(p){
  if(p.fkPrice!=null)return 'Flipkart '+money(p.fkPrice)+(p.fkCheckedOn?' · checked '+esc(p.fkCheckedOn):'');
  return p.price!=null?'approx. '+money(p.price):'price varies';
}
function affDisc(){return 'As an Amazon Associate and Flipkart affiliate, GN Care earns from qualifying purchases.'}
var fashTab='women';
var copyLang='en';
function phHTML(p,alt){
  return '<div class="p-img ph" role="img" aria-label="'+alt+'" data-brand="'+esc(p&&p.brand||'GN Care')+'" data-cat="'+esc(p&&p.cat||'Product')+'"><span class="ph-brand">'+esc(p&&p.brand||'GN Care')+'</span><span class="ph-cat">'+esc(p&&p.cat||'Product')+'</span></div>';
}
function productImg(p){
  var alt=esc(p.imageAlt||((p.brand||'')+' '+(p.name||'')).trim()||'Product');
  var src=(p.fkProductId&&p.fkImage)?p.fkImage:p.image;
  if(src){
    return '<div class="p-img" data-brand="'+esc(p.brand||'GN Care')+'" data-cat="'+esc(p.cat||'Product')+'"><img src="'+esc(src)+'" alt="'+alt+'" width="160" height="160" loading="lazy" decoding="async"></div>';
  }
  return phHTML(p,alt);
}
function fitChip(p,type){
  if(type&&window.GNPicks&&GNPicks.fitsSkin&&GNPicks.fitsSkin(p,type))return '<span class="chip good">Fits '+esc(type.toLowerCase())+'</span>';
  return '';
}
function couponHtml(p){
  if(!(window.GNPicks&&GNPicks.couponLive&&GNPicks.couponLive(p.coupon)))return '';
  var c=p.coupon,code=String(c.code),save=GNPicks.couponSave(p.price,c),approx=GNPicks.couponApprox(p.price,c);
  var line='Coupon <b>'+esc(code)+'</b>';
  if(save!=null&&approx!=null)line+=': save '+money(save)+' → approx '+money(approx);
  else if(c.minOrder!=null)line+=' (min. order '+money(c.minOrder)+')';
  var meta=[];
  if(c.expires)meta.push('expires '+c.expires);
  if(c.store)meta.push(c.store);
  meta.push('verify at checkout');
  return '<div class="coupon"><p>'+line+'</p><p class="hint">'+esc(meta.join(' · '))+'</p>'+
    '<button type="button" class="btn ghost sm" data-act="copyCoupon" data-v="'+esc(code)+'">Copy code</button></div>';
}
function fashionHtml(){
  if(!(window.GNPicks&&GNPicks.fashionLinks))return '';
  var links=GNPicks.fashionLinks(affTag(),fkAff());
  var tab=fashTab==='men'?'men':'women';
  var list=links[tab]||[];
  return '<section class="tile fashion"><h3 class="t">Fashion deals</h3>'+
    '<p class="hint">Category links to Amazon.in and Flipkart sale sections. We do not list made-up products or prices here. Check the store for today\'s deal.</p>'+
    '<div class="chips" style="margin-bottom:10px">'+
      '<button data-act="fashTab" data-v="women" aria-pressed="'+(tab==='women')+'">Women</button>'+
      '<button data-act="fashTab" data-v="men" aria-pressed="'+(tab==='men')+'">Men</button></div>'+
    '<div class="btn-grid">'+list.map(function(x){return '<a class="btn sm '+(x.store==='Flipkart'?'ghost':'')+'" href="'+esc(x.url)+'" target="_blank" rel="sponsored nofollow noopener">'+esc(x.store+': '+x.label)+'</a>'}).join('')+'</div></section>';
}
function copyLangBar(){
  return '<div class="chips copy-lang" style="margin:8px 0 0">'+
    [['en','English'],['hi','Hinglish'],['te','Tenglish']].map(function(x){
      return '<button type="button" data-act="copyLang" data-v="'+x[0]+'" aria-pressed="'+(copyLang===x[0])+'">'+x[1]+'</button>';
    }).join('')+'</div>';
}
function productCopyHtml(p,type){
  if(!window.GNPicks)return '';
  var why=GNPicks.whyThis(p,type,kitConcerns(),copyLang);
  var how=GNPicks.howToUse?GNPicks.howToUse(p,copyLang):'';
  var avoid=GNPicks.productAvoid?GNPicks.productAvoid(p,copyLang):[];
  var html='';
  if(why)html+='<p class="hint why-this"><b>Why this suits you.</b> '+esc(why)+'</p>';
  if(how)html+='<p class="hint how-to"><b>How to use.</b> '+esc(how)+'</p>';
  if(avoid.length)html+='<p class="hint avoid-this"><b>What to avoid.</b> '+esc(avoid.join(' '))+'</p>';
  return html;
}
function telegramRow(){
  var raw=(window.GN_CONFIG&&GN_CONFIG.TELEGRAM_URL)||'';
  var url=window.GNPicks&&GNPicks.telegramURL?GNPicks.telegramURL(raw):'';
  if(!url)return '';
  return '<p class="hint" style="margin:8px 0 0"><a class="btn sm" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Join our Telegram deals</a></p>';
}
function obfCredit(){return '<p class="hint">Some product photos come from <a href="https://world.openbeautyfacts.org/" target="_blank" rel="noopener">Open Beauty Facts</a> (ODbL). Pack size in a photo may differ from the size we list. Items without a verified photo show a category placeholder. We do not use Amazon or Flipkart images.</p>';}
function kitConcerns(){return (S.skin&&S.skin.flags)||[]}
function dealsHtml(){
  if(!(window.GNPicks&&GNPicks.deals))return '';
  var live=GNPicks.flipkartDeals?GNPicks.flipkartDeals():[];
  var list=(live.length?live:GNPicks.deals()).slice(0,6);
  if(!list.length)return '';
  var amz=esc(GNPicks.amazonDealsURL(affTag()));
  var fk=esc(GNPicks.flipkartOffersURL(fkAff()));
  var hint=live.length
    ?'Live Flipkart prices for catalog products we could match to the same size and variant. Checked on '+(list[0].fkCheckedOn||'today')+'. Verify at checkout. Products without a Flipkart match keep an approx. catalog price.'
    :'Curated from our catalog using typical MRP vs typical price. This is an <b>approx. price, check store for today\'s deal</b>. We do not scrape live prices.';
  return '<section class="tile deals"><h3 class="t">Today\'s best deals</h3><p class="hint">'+hint+'</p><div class="list">'+list.map(function(p){
    var liveOff=GNPicks.flipkartDealDiscount&&GNPicks.flipkartDealDiscount(p);
    var typOff=GNPicks.dealDiscount(p);
    var mrp=liveOff!=null?p.fkMrp:p.mrp;
    var chip=liveOff!=null?' <span class="chip good">'+liveOff+'% off on Flipkart</span>':(typOff!=null?' <span class="chip good">'+typOff+'% off typ.</span>':'');
    return '<div class="li">'+productImg(p)+'<div class="grow"><b>'+esc(p.brand+' '+p.name)+'</b><span>'+(mrp?'<s class="mrp">'+money(mrp)+'</s> ':'')+priceTxt(p)+chip+'</span>'+(p.fkOfferNote?'<p class="hint">'+esc(p.fkOfferNote)+'</p>':'')+couponHtml(p)+'</div>'+buyBtn(p)+'</div>';
  }).join('')+'</div><div class="btn-grid" style="margin-top:10px"><a class="btn sm" href="'+amz+'" target="_blank" rel="sponsored nofollow noopener">Amazon deals</a><a class="btn ghost sm" href="'+fk+'" target="_blank" rel="sponsored nofollow noopener">Flipkart offers</a></div></section>'}
function installHome(){
  if(standalone)return '';
  if(deferredInstall)return '<section class="tile s7"><h3 class="t">Install GN Care</h3><p class="hint">Add the app to your home screen for a faster, full-screen experience and reminders.</p><button class="btn sm" data-act="install">Install app</button></section>';
  return '<section class="tile s7"><h3 class="t">Install GN Care</h3><p class="hint">'+(isIOS?'On iPhone, tap Share, then Add to Home Screen.':'Use your browser menu and choose Install app or Add to Home screen.')+'</p></section>'}
function amzOffer(p){var o=GNPicks.storeOffers?GNPicks.storeOffers(p):[];for(var i=0;i<o.length;i++)if(o[i].store==='Amazon')return o[i];return null}
function amzLbl(p){var a=amzOffer(p);return a?'Buy on Amazon '+money(a.price):'Check price on Amazon'}
function lowestChip(p){var l=GNPicks.lowestOffer&&GNPicks.lowestOffer(p);if(!l)return '';
  return '<span class="chip good">'+(l.tie?'Same price on Flipkart and Amazon':'Lowest on '+esc(l.store)+' · saves '+money(l.saves))+' · checked '+esc(l.checkedOn)+'</span>'}
function fkLbl(p){return GNPicks.isLive&&GNPicks.isLive(p)?'Buy on Flipkart '+money(p.fkPrice):'Find on Flipkart'}
function buyBtn(p){
  return '<div class="btn-grid" style="justify-content:flex-start">'+
    '<a class="btn sm" href="'+esc(GNPicks.flipkartURL(p,fkAff()))+'" target="_blank" rel="sponsored nofollow noopener">'+fkLbl(p)+'</a>'+
    '<a class="btn ghost sm" href="'+esc(GNPicks.buyURL(p,affTag()))+'" target="_blank" rel="sponsored nofollow noopener">'+amzLbl(p)+'</a>'+
    '</div>'}
function shopCard(p,type,opts){
  opts=opts||{};
  var label=esc((p.brand||'')+' '+(p.name||'')+' details');
  var bits=[p.size,p.spf].filter(Boolean).map(esc);
  return '<article class="shop-card">'+
    '<button type="button" class="shop-card-hit" data-act="openProduct" data-v="'+esc(p.id)+'" aria-label="'+label+'">'+
      productImg(p)+
      '<div class="shop-info">'+
        (opts.cat?'<span class="eyebrow">'+esc(opts.cat)+'</span>':'')+
        '<span class="eyebrow">'+esc(p.brand||'')+'</span>'+
        '<h4>'+esc(p.name||'')+'</h4>'+
        (bits.length?'<p class="hint">'+bits.join(' · ')+'</p>':'')+
        '<p class="shop-price">'+priceTxt(p)+'</p>'+
        '<div class="row wrap" style="gap:6px">'+fitChip(p,type)+lowestChip(p)+(p.sens?'<span class="chip good">Sensitive-friendly</span>':'')+'</div>'+
      '</div>'+
    '</button></article>';
}
function productSheetHTML(p,type){
  var alts='';
  return '<div class="prod-sheet">'+productImg(p)+
    '<p class="eyebrow" style="margin-top:10px">'+esc(p.brand||'')+(p.cat?' · '+esc(p.cat):'')+'</p>'+
    '<h3 style="font-size:22px;font-weight:700;line-height:1.25;margin:4px 0 8px">'+esc(p.name||'')+'</h3>'+
    '<p class="hint">'+[p.size,p.spf].filter(Boolean).map(esc).join(' · ')+'</p>'+
    '<div class="row wrap" style="gap:6px;margin:10px 0">'+
      '<span class="chip">'+priceTxt(p)+'</span>'+lowestChip(p)+fitChip(p,type)+(p.sens?'<span class="chip good">Sensitive-friendly</span>':'')+
    '</div>'+
    (p.priceNote?'<p class="hint">'+esc(p.priceNote)+'</p>':'')+
    couponHtml(p)+
    productCopyHtml(p,type)+
    buyBtn(p)+
    '<p class="hint" style="margin-top:10px">Prices shown as approx. are typical catalog prices, not live store prices, unless a Flipkart check date is shown. Verify at checkout. '+affDisc()+'</p>'+
    '</div>';
}
function shopList(){
  var all=window.GN_PRODUCTS||[];
  if(!(window.GNPicks&&GNPicks.browseCatalog))return all.slice();
  return GNPicks.browseCatalog(all,{q:SH.q,cat:SH.cat,sort:SH.sort,type:kitType(),aud:kit().aud});
}
function shopCardsHTML(list,type){
  list=list||shopList();type=type||kitType();
  if(!list.length)return '<p class="hint">No products match that search or filter.</p>';
  return list.map(function(p){return shopCard(p,type)}).join('');
}
function shopCountText(n){
  n=n==null?shopList().length:n;
  return n+' product'+(n===1?'':'s');
}
function allProductsHTML(){
  if(!window.GN_PRODUCTS||!GN_PRODUCTS.length)return '<section class="tile"><h3 class="t">All products</h3><div class="skel" aria-busy="true"><i></i><i></i><i></i></div></section>';
  var cats=window.GNPicks&&GNPicks.catalogCats?GNPicks.catalogCats(GN_PRODUCTS):[];
  var list=shopList();
  var type=kitType();
  return '<section class="tile shop-all" style="gap:14px">'+
    '<h3 class="t">All products</h3>'+
    '<p class="hint">Browse the catalog like a store. Tap a product for why it may suit you, how to use it, and buy links. Prices marked approx. are typical, not live, unless a Flipkart check date is shown. We do not invent ratings or discounts.</p>'+
    '<label class="f">Search<input class="input" id="shop-q" type="search" maxlength="80" placeholder="Brand, name or size" value="'+esc(SH.q)+'" autocomplete="off"></label>'+
    '<div class="chips shop-cats" role="group" aria-label="Category">'+
      '<button type="button" data-act="shopCat" data-v="all" aria-pressed="'+(SH.cat==='all')+'">All</button>'+
      cats.map(function(c){return '<button type="button" data-act="shopCat" data-v="'+esc(c)+'" aria-pressed="'+(SH.cat===c)+'">'+esc(c)+'</button>'}).join('')+
    '</div>'+
    '<div class="row sp wrap" style="gap:8px;align-items:center">'+
      '<div class="chips" role="group" aria-label="Sort">'+
        '<button type="button" data-act="shopSort" data-v="match" aria-pressed="'+(SH.sort==='match')+'">Best match</button>'+
        '<button type="button" data-act="shopSort" data-v="price" aria-pressed="'+(SH.sort==='price')+'">Price: low to high</button>'+
      '</div>'+
      '<p class="hint" id="shop-count">'+shopCountText(list.length)+'</p>'+
    '</div>'+
    (!type?'<p class="hint">Pick a skin type above, or <a href="#scan" style="color:var(--acc)">take the face scan</a>, for a best-match order and fit chips.</p>':'')+
    '<div class="prod-grid" id="shop-grid">'+shopCardsHTML(list,type)+'</div>'+
  '</section>';
}
function refreshShopGrid(){
  var g=$('#shop-grid'),c=$('#shop-count');
  if(!g)return;
  var list=shopList();
  g.innerHTML=shopCardsHTML(list,kitType());
  if(c)c.textContent=shopCountText(list.length);
}
function kitBuild(){var k=kit();return GNPicks.buildKit({type:kitType(),sens:kitSens(),budget:k.budget,swaps:k.swaps,have:shelfHave(),treat:true,concerns:kitConcerns()})}
function kitPriceLbl(p){return GNPicks.isLive(p)?money(p.fkPrice)+' on Flipkart':(p.price!=null?'approx. '+money(p.price):'price varies, est. '+money(GNPicks.effPrice(p)))}
function kitAIBox(r,type,sens){
  if(PK.ai)return '<div class="answer fade-in">'+fmtAns(PK.ai)+'</div>'+thumbs(PK.rated,'aiFbK');
  if(PK.busy)return '<div class="skel" aria-busy="true" aria-label="Getting an AI explanation"><i></i><i></i><i></i></div>';
  return '<div class="answer">'+fmtAns(kitPlain(r,type,sens))+'</div>'+(PK.err?'<p class="hint">AI is busy right now, so this is our standard explanation.</p>':'')}
/* One clear recommendation: the exact kit, real prices, total and the AI explanation of that kit. */
function kitSummary(r,type,sens,budget){
  var rows=r.items.filter(function(i){return i.item}).map(function(i,n){var p=i.item;
    return '<li class="kit-row" style="--i:'+n+'"><span class="kit-step num">'+(n+1)+'</span><div class="grow"><span class="eyebrow">'+esc(i.cat)+(i.optional?' · optional':'')+'</span><b>'+esc(p.brand+' '+p.name)+'</b><span class="hint">'+esc([p.size,kitPriceLbl(p)].filter(Boolean).join(' · '))+'</span></div>'+
      '<div class="kit-buy"><button type="button" class="btn ghost sm" data-act="openProduct" data-v="'+esc(p.id)+'">Details</button><a class="btn sm" href="'+esc(GNPicks.flipkartURL(p,fkAff()))+'" target="_blank" rel="sponsored nofollow noopener" >'+fkLbl(p)+'</a><a class="btn ghost sm" href="'+esc(GNPicks.buyURL(p,affTag()))+'" target="_blank" rel="sponsored nofollow noopener">'+amzLbl(p)+'</a></div>'+lowestChip(p)+'</li>'}).join('');
  var note=[];
  if(r.checkedOn)note.push('Flipkart prices checked on '+r.checkedOn+'.');
  if(r.approx)note.push('“approx.” prices are typical catalog prices, not live.');
  note.push('Verify the price at checkout.');
  var bmsg=budget>0?(r.fits?'Fits your '+money(budget)+' budget.':'Above your '+money(budget)+' budget. The lowest kit is about '+money(r.min)+'.'):'No budget cap.';
  return '<section class="tile kit-best"><p class="eyebrow">Our pick for '+esc(String(type).toLowerCase())+' skin'+(sens?' · sensitive':'')+'</p><h3 class="t">Your best kit</h3>'+
    '<ol class="kit-list">'+rows+'</ol>'+
    '<div class="row sp wrap kit-total"><div><span class="hint">Total'+(r.approx?' (approx.)':'')+'</span><span class="big num">'+money(r.total)+'</span></div><span class="chip '+(r.fits?'good':'warn')+'">'+esc(bmsg)+'</span></div>'+
    '<p class="hint">'+esc(note.join(' '))+' '+affDisc()+'</p>'+
    '<div class="row sp wrap"><h3 class="t">Why this kit</h3><button class="btn sm" data-act="kitAI"'+(PK.busy?' disabled':'')+'>'+ico('i-leaf')+(PK.ai?'AI explained':'Explain with AI')+'</button></div>'+
    kitAIBox(r,type,sens)+'</section>'}
function kitQuestion(r,type,sens,budget){
  var cs=kitConcerns();
  var lines=['Skin type: '+type+(sens?', sensitive':'')+(cs.length?', concerns: '+cs.join(', '):'')+'. Budget: '+(budget>0?money(budget):'no limit')+'.'];
  r.items.forEach(function(i){if(i.item)lines.push(i.cat+': '+i.item.brand+' '+i.item.name+' ('+kitPriceLbl(i.item)+').')});
  lines.push('Kit total: '+money(r.total)+'.');
  return lines.join(' ')}
/* Instant, rule-based kit explanation. No AI, no download, works offline. AI text replaces it only if it arrives. */
function kitPlain(r,type,sens){
  var L=[],t=String(type||'').toLowerCase(),cs=kitConcerns();
  try{r.items.forEach(function(i){if(i.item)L.push('- '+i.cat+': '+i.item.brand+' '+i.item.name+'. '+GNPicks.whyThis(i.item,type,cs,'en'))})}catch(e){}
  if(window.GNSkin&&tab!=='scan'){try{return (L.length?L.join('\n')+'\n':'')+GNSkin.explain({type:type,sensitive:sens,concerns:cs},copyLang)}catch(e){}}
  var has=function(c){return r.items.some(function(i){return i.item&&i.cat===c})};
  var am=['Cleanser','Treatment','Moisturizer','Sunscreen'].filter(has),pm=['Cleanser','Treatment','Serum','Moisturizer'].filter(has);
  if(am.length)L.push('- Morning: '+am.join(', then ').toLowerCase()+'.');
  if(pm.length)L.push('- Night: '+pm.join(', then ').toLowerCase()+'.');
  GNPicks.avoidTips(type,cs,sens).slice(0,2).forEach(function(x){L.push('- '+x)});
  L.push('- Patch test each new product on your inner arm for 24 hours first. General guidance for '+t+' skin, not medical advice.');
  return L.join('\n')}
function pickNotes(items,type){
  return (items||[]).map(function(it){
    if(it.have)return '<p class="shop-note">You already have a '+esc(it.cat.toLowerCase())+' on your shelf, so it is left out of this kit.</p>';
    if(!it.item)return '<p class="shop-note">No match for '+esc((type||'').toLowerCase())+' skin yet in '+esc(it.cat)+'.</p>';
    if(it.noSens)return '<p class="shop-note">No sensitive-skin option in our list for '+esc((type||'').toLowerCase())+' skin in '+esc(it.cat)+'. Patch test first.</p>';
    return '';
  }).join('');
}
function kitProductGrid(items,type){
  var cards=(items||[]).filter(function(it){return it.item}).map(function(it){return shopCard(it.item,type,{cat:it.cat})}).join('');
  return (cards?'<div class="prod-grid">'+cards+'</div>':'')+pickNotes(items,type);
}
function pickCard(it,type){
  if(it.have||!it.item)return pickNotes([it],type);
  return shopCard(it.item,type,{cat:it.cat});
}
function viewPicks(){
  var k=kit(),type=kitType(),sens=kitSens();
  var head='<div class="head"><p class="eyebrow">Shop smart</p><h2 class="page-h">Your skin, your <em>budget</em></h2><p class="sub">Choose your skin type and what you want to spend. You get a starter kit, and you can swap any item.</p></div>';
  var ctl='<section class="tile" style="gap:16px">'+
    '<div><h3 class="t" style="margin-bottom:8px">Shopping for</h3><div class="chips">'+AUDS.map(function(a){return '<button data-act="kAud" data-v="'+a[0]+'" aria-pressed="'+(k.aud===a[0])+'">'+a[1]+'</button>'}).join('')+'</div></div>'+
    '<div><h3 class="t" style="margin-bottom:8px">Skin type</h3><div class="chips">'+SKINS.map(function(s){return '<button data-act="kType" data-v="'+s+'" aria-pressed="'+(type===s)+'">'+s+'</button>'}).join('')+'</div>'+
      (S.skin&&!k.type?'<p class="hint" style="margin-top:8px">Taken from your face scan. Tap another type to change it.</p>':(!type?'<p class="hint" style="margin-top:8px">Pick a type, or <a href="#scan" style="color:var(--acc)">take the face scan</a> to find yours.</p>':''))+'</div>'+
    '<div class="row sp"><div><span style="font-size:14px;font-weight:600;display:block">Sensitive skin</span><span class="hint">Shows sensitive-tested products first.</span></div>'+tgl(sens,'kSens','x','Sensitive skin',true)+'</div>'+
    '<div><label class="f" style="max-width:240px">Budget for the kit (₹)<input class="input num" id="kit-budget" type="number" min="0" step="100" inputmode="numeric" value="'+k.budget+'"></label>'+
      '<div class="chips" style="margin-top:8px">'+BUDGETS.map(function(b){return '<button data-act="kPreset" data-v="'+b+'" aria-pressed="'+(k.budget===b)+'">'+money(b)+'</button>'}).join('')+'</div></div>'+
    '</section>';
  var body='';
  if(type){
    var r=kitBuild();
    var have=r.items.filter(function(i){return i.have}).map(function(i){return i.cat.toLowerCase()});
    var pct=k.budget>0?Math.min(100,r.total/k.budget*100):0;
    var msg=r.fits?('That leaves about '+money(Math.max(0,k.budget-r.total))+' of your budget.'):('The lowest kit for '+type.toLowerCase()+' skin is about '+money(r.min)+', above your '+money(k.budget)+' budget. Raise the budget or skip an item.');
    var aiBox=kitAIBox(r,type,sens);
    var add=GNPicks.addOns(k.aud);
    body=kitSummary(r,type,sens,k.budget)+
      '<section class="tile" style="margin-top:14px"><div class="row sp wrap"><div><h3 class="t">Your kit</h3><div class="row" style="align-items:baseline;gap:8px;margin-top:6px"><span class="big num" style="font-size:44px">'+money(r.total)+'</span><span class="hint">of '+money(k.budget)+'</span></div></div><button class="btn" data-act="kitAI"'+(PK.busy?' disabled':'')+'>'+ico('i-leaf')+'Explain with AI</button></div>'+
        '<div class="meter '+(r.fits?'':'over')+'"><i style="width:'+pct+'%"></i></div><p class="hint">'+msg+(have.length?' Left out because you already have a '+have.join(' and ')+' on your shelf.':'')+'</p>'+aiBox+'</section>'+
      (add.length?'<section class="tile" style="margin-top:14px"><h3 class="t">Add-ons for '+(k.aud==='women'?'women':'men')+'</h3><div class="prod-grid">'+add.map(function(p){return shopCard(p,type)}).join('')+'</div>'+(k.aud==='women'?'<p class="hint">Intimate washes are for external use only. See a doctor for itching, odour or discharge that does not go away.</p>':'')+'</section>':'');
  }
  var src=Object.keys(window.GN_SOURCES||{}).map(function(s){return GN_SOURCES[s]}).join('; ');
  var avoid=(type&&window.GNPicks&&GNPicks.avoidTips)?'<section class="tile"><h3 class="t">What to avoid</h3><ul class="checks">'+GNPicks.avoidTips(type,kitConcerns(),sens).map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ul></section>':'';
  var treatHtml='';
  if(type&&window.GNPicks&&GNPicks.treatments){
    var tr=GNPicks.treatments(type,kitConcerns()).slice(0,4);
    if(tr.length)treatHtml='<section class="tile" style="margin-top:14px"><h3 class="t">Serums and treatments for you</h3><p class="hint">Optional extras. They are not part of the core kit total. Tap a product for details and buy links.</p><div class="prod-grid">'+tr.map(function(p){return shopCard(p,type)}).join('')+'</div></section>';
  }
  var disc='<section class="tile" style="margin-top:14px"><h3 class="t">How this works</h3>'+obfCredit()+'<p class="hint">Buy links go to Amazon.in and Flipkart. If you buy through them, GN Care may earn a small commission at no extra cost to you. '+affDisc()+' Prices marked approx. are estimates from published 2026 reviews ('+esc(src)+'). They are not live store prices, unless a Flipkart check date is shown. Check the price before you buy. Picks match your skin type and budget. They are general suggestions, not medical advice. See a dermatologist for skin conditions.</p></section>';
  return head+dealsHtml()+fashionHtml()+telegramRow()+copyLangBar()+ctl+(body?'<div style="height:14px"></div>'+body+treatHtml:'')+allProductsHTML()+(avoid||'')+disc}

/* ---------- coach, label decoder, ratings ---------- */
var LAB={bad:'Avoid',warn:'Separate',good:'Pairs well'};
var CO={q:'',busy:false,ans:'',err:'',rated:false};
var LB={text:'',res:null,busy:false,ai:'',err:'',rated:false};
var OD={loading:false,pct:0,msg:''};
var FB={stars:0,kind:'app',msg:'',busy:false,done:false,err:''};
var SUG=['Which SPF is right for oily skin?','How do I start using retinol?','Can I use vitamin C and niacinamide together?','How often should I exfoliate?'];
function actName(id){for(var i=0;i<ACT.length;i++){if(ACT[i].id===id)return ACT[i].n.replace(/ \(.*\)/,'')}return id}
function labelConflicts(ids){var o=[];for(var i=0;i<ids.length;i++){for(var j=i+1;j<ids.length;j++){var r=R[key(ids[i],ids[j])];if(r)o.push({a:ids[i],b:ids[j],lv:r[0],tx:r[1]})}}
  var order={bad:0,warn:1,good:2};o.sort(function(x,y){return order[x.lv]-order[y.lv]});return o}
function fmtAns(t){
  var out='',open=false;
  String(t).split(/\n+/).forEach(function(l){
    l=l.replace(/\*\*/g,'').trim().replace(/^\*(.+)\*$/,'$1');if(!l)return;
    var m=/^[-*•]\s+(.*)$/.exec(l);
    if(m){if(!open){out+='<ul class="checks">';open=true}out+='<li>'+esc(m[1])+'</li>'}
    else{if(open){out+='</ul>';open=false}out+='<p>'+esc(l)+'</p>'}
  });
  if(open)out+='</ul>';return out}
function postJSON(url,body){
  return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){
    return r.json().then(function(j){j.status=r.status;return j},function(){return {ok:false,msg:'The service is not available here yet.'}})
  },function(){return {ok:false,msg:'No connection. The label scan and Checker still work offline.'}})}
function aiCtx(){return (S.skin&&S.aiProfile!==false)?{type:S.skin.type,sensitive:!!S.skin.sensitive,sun:S.skin.sun,concerns:(S.skin.flags||[]).slice(0,8)}:null}
function thumbs(on,act){
  if(on)return '<p class="hint">Thanks for the feedback.</p>';
  return '<div class="row wrap" style="gap:8px"><span class="hint">Was this helpful?</span><button class="btn ghost sm" data-act="'+act+'" data-v="5">Yes</button><button class="btn ghost sm" data-act="'+act+'" data-v="1">No</button></div>'}
function busyHTML(t){
  if(OD.loading)return '<div class="list" style="gap:6px"><p class="hint">Downloading the on-device model. This happens once. Keep this tab open and use Wi-Fi. <b id="od-pct" class="num">'+OD.pct+'%</b></p><div class="meter"><i id="od-bar" style="width:'+OD.pct+'%"></i></div><p class="ai-note" id="od-msg">'+esc(OD.msg)+'</p></div>';
  return '<p class="hint pulse">'+t+'</p>'}
function coachTiles(){
  var lb='';
  if(LB.res){
    var ids=LB.res.actives,cf=labelConflicts(ids);
    lb='<div class="list" style="gap:10px">'+
      (ids.length?'<div class="chips" style="gap:6px">'+ids.map(function(id){return '<span class="chip">'+actName(id)+'</span>'}).join('')+'</div>':'<p class="hint">No common actives found. This looks like a basic formula.</p>')+
      LB.res.flags.map(function(f){return '<div class="res warn"><span class="tag">Watch</span><div><b>'+f.n+'</b><p>'+f.tx+'</p></div></div>'}).join('')+
      cf.map(function(o){return '<div class="res '+o.lv+'"><span class="tag">'+LAB[o.lv]+'</span><div><b>'+actName(o.a)+' + '+actName(o.b)+'</b><p>'+o.tx+'</p></div></div>'}).join('')+
      (ids.length>1?'<button class="btn ghost sm" data-act="labelToMix" style="align-self:flex-start">Check these against my other actives</button>':'')+'</div>'}
  var lbAI=LB.busy?busyHTML('Reading the label…'):(LB.err?'<div class="res bad"><span class="tag">Notice</span><div><p>'+esc(LB.err)+'</p></div></div>':(LB.ai?'<div class="answer">'+fmtAns(LB.ai)+'</div>'+thumbs(LB.rated,'aiFbL'):''));
  var coAI=CO.busy?busyHTML('Thinking…'):(CO.err?'<div class="res bad"><span class="tag">Notice</span><div><p>'+esc(CO.err)+'</p></div></div>':(CO.ans?'<div class="answer">'+fmtAns(CO.ans)+'</div>'+thumbs(CO.rated,'aiFb'):''));
  return ''+
  '<section class="tile s6"><h3 class="t">'+ico('i-scan')+'Label decoder</h3>'+
    '<p class="hint">Paste the ingredient list from the back of a product. The scan runs on your device. Add an AI explanation if you want one.</p>'+
    '<label class="f">Ingredient list<textarea class="input" id="label-in" maxlength="1500" placeholder="Aqua, Glycerin, Niacinamide, Retinol, Parfum…">'+esc(LB.text)+'</textarea></label>'+
    '<div class="btn-grid"><button class="btn" data-act="labelScan">Scan label</button><button class="btn ghost" data-act="labelAI"'+(LB.busy?' disabled':'')+'>Explain with AI</button>'+(LB.text||LB.res?'<button class="btn ghost" data-act="labelClear">Clear</button>':'')+'</div>'+lb+lbAI+'</section>'+
  '<section class="tile s6"><h3 class="t">'+ico('i-leaf')+'Ask the coach</h3>'+
    '<div class="chips">'+SUG.map(function(s,i){return '<button data-act="sugg" data-v="'+i+'" aria-pressed="false">'+esc(s)+'</button>'}).join('')+'</div>'+
    '<label class="f">Your question<textarea class="input" id="coach-in" maxlength="500" placeholder="Ask about skin, hair or body hygiene">'+esc(CO.q)+'</textarea></label>'+
    (S.skin?'<div class="row sp"><span style="font-size:13px;font-weight:600">Use my skin profile ('+esc(S.skin.type)+')</span>'+tgl(S.aiProfile!==false,'aiProfile','x','Use my skin profile',true)+'</div>':'')+
    odRow()+'<div><button class="btn" data-act="ask"'+(CO.busy?' disabled':'')+'>Ask</button></div>'+coAI+
    '<p class="ai-note">For ages 18 and over. '+(S.onDevice&&window.GNOnDevice&&GNOnDevice.supported()?'On-device mode keeps your question on your phone. ':'Your question is sent to our AI provider, so do not type your name, contact details or medical history. ')+'General information only, not medical advice.</p></section>'}
function odRow(){
  if(!(window.GNOnDevice&&GNOnDevice.supported()))return '';
  return '<div class="row sp" style="align-items:flex-start;gap:14px"><div style="min-width:0"><span style="font-size:13px;font-weight:600;display:block">Run AI on my device</span><span class="hint">Free and private. Downloads a small Qwen2.5 0.5B model the first time you ask (a larger 1.5B model is the fallback). Needs a recent phone or computer with WebGPU.</span></div>'+tgl(!!S.onDevice,'onDevice','x','Run AI on my device',true)+'</div>'}
function fbHTML(){
  if(FB.done)return '<div class="tip"><b>Thank you.</b> Your feedback was sent.</div>'+(FB.stars>=4?'<div class="btn-grid" style="margin-top:10px"><button class="btn" data-act="share">Share GN Care</button></div>':'')+'<div class="btn-grid" style="margin-top:10px"><button class="btn ghost" data-act="closeSettings">Close</button></div>';
  var kinds=[['app','The app'],['ai','AI coach'],['bug','A problem'],['idea','An idea']];
  return '<form data-form="feedback" style="display:flex;flex-direction:column;gap:14px">'+
    '<div><p class="hint" style="margin-bottom:6px">How would you rate GN Care?</p><div class="stars-row" role="radiogroup" aria-label="Rating">'+[1,2,3,4,5].map(function(n){return '<button type="button" class="star'+(n<=FB.stars?' on':'')+'" role="radio" aria-checked="'+(n===FB.stars)+'" aria-label="'+n+' star'+(n>1?'s':'')+'" data-act="star" data-v="'+n+'">'+ico('i-star')+'</button>'}).join('')+'</div></div>'+
    '<div class="chips">'+kinds.map(function(k){return '<button type="button" data-act="fkind" data-v="'+k[0]+'" aria-pressed="'+(FB.kind===k[0])+'">'+k[1]+'</button>'}).join('')+'</div>'+
    '<label class="f">Tell us more (optional)<textarea class="input" id="fb-msg" maxlength="500" placeholder="What worked, what did not, what should we add?">'+esc(FB.msg)+'</textarea></label>'+
    '<input id="fb-site" name="site" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">'+
    (FB.err?'<div class="res bad"><span class="tag">Notice</span><div><p>'+esc(FB.err)+'</p></div></div>':'')+
    '<p class="ai-note">Do not include personal details. We only receive the rating, type and your message.</p>'+
    '<button class="btn" type="submit"'+(FB.busy?' disabled':'')+'>'+(FB.busy?'Sending…':'Send feedback')+'</button></form>'}
var sheetReturn=null;
function openSheet(title,html){
  if($('#sheet').hidden)sheetReturn=document.activeElement;
  $('#sheet-title').textContent=title;$('#sheet-body').innerHTML=html;$('#sheet').hidden=false;
  var d=$('#sheet .sheet-in');d.setAttribute('aria-modal','true');setTimeout(function(){var c=$('#sheet [data-act="closeSettings"]');if(c)c.focus()},30)}
function closeSheet(){if($('#sheet').hidden)return;$('#sheet').hidden=true;var r=sheetReturn;sheetReturn=null;if(r&&document.contains(r)&&r.focus)try{r.focus({preventScroll:true})}catch(e){}}
function trapFocus(e){
  if(e.key!=='Tab'||$('#sheet').hidden)return;
  var f=[].slice.call($('#sheet .sheet-in').querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')).filter(function(x){return x.offsetParent!==null});
  if(!f.length)return;var first=f[0],last=f[f.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  else if(!$('#sheet .sheet-in').contains(document.activeElement)){e.preventDefault();first.focus()}}
function refreshFB(){$('#sheet-body').innerHTML=fbHTML()}
function openFeedback(stars,kind){FB={stars:stars||0,kind:kind||'app',msg:'',busy:false,done:false,err:''};openSheet('Rate GN Care',fbHTML())}
function feedbackRow(){return '<div class="set"><div><b>Rate and feedback</b><span>Tell us what to improve.</span></div><button class="btn sm" data-act="openFeedback">Rate</button></div>'}
function ratePrompt(){
  if(S.rated)return '';
  if(!S.firstSeen||Date.now()-S.firstSeen<2*86400000)return '';
  if(S.fbSnooze&&Date.now()<S.fbSnooze)return '';
  return '<section class="tile"><div class="row sp wrap"><div><h3 class="t">Enjoying GN Care?</h3><p class="hint" style="margin-top:6px">Tap a star to rate it. It takes ten seconds.</p></div><div class="stars-row" role="group" aria-label="Rate GN Care">'+[1,2,3,4,5].map(function(n){return '<button class="star" data-act="rateNow" data-v="'+n+'" aria-label="'+n+' star'+(n>1?'s':'')+'">'+ico('i-star')+'</button>'}).join('')+'</div><button class="btn ghost sm" data-act="snooze">Not now</button></div></section>'}
var AIOK=null;
function aiReady(){if(AIOK)return AIOK;AIOK=fetch('/api/health').then(function(r){return r.json()}).then(function(j){var ok=!!(j&&j.ai&&j.ai.ready);if(!ok)setTimeout(function(){AIOK=null},60000);return ok},function(){AIOK=null;return false});return AIOK}
function serverAI(mode,q,done){
  var fin=false,end=function(x){if(!fin){fin=true;done(x)}};
  setTimeout(function(){end({err:'The AI took too long. Try again later.'})},12000);
  aiReady().then(function(ok){if(!ok)return end({err:'AI answers are not available right now. Try again later.'});
  postJSON('/api/ai',{mode:mode,q:q,ctx:aiCtx()}).then(function(j){end(j&&j.ok&&j.text?{text:j.text}:{err:(j&&j.msg)||'Something went wrong. Try again later.'})},function(){end({err:'Something went wrong. Try again later.'})})})}
function sendAI(mode,q,done){
  if(!S.odOff){S.odOff=1;S.onDevice=false;save()}
  if(!(S.onDevice&&window.GNOnDevice&&GNOnDevice.supported())){serverAI(mode,q,done);return}
  OD.loading=!GNOnDevice.ready();OD.pct=0;OD.msg='Starting…';
  if(OD.loading&&(tab==='checker'||tab==='picks'))render();
  GNOnDevice.load(function(p){
    OD.pct=Math.max(0,Math.min(100,Math.round((p.progress||0)*100)));OD.msg=p.text||'';
    var a=$('#od-pct');if(a)a.textContent=OD.pct+'%';var b=$('#od-bar');if(b)b.style.width=OD.pct+'%';var m=$('#od-msg');if(m)m.textContent=OD.msg}
  ).then(function(){OD.loading=false;return GNOnDevice.ask(mode,q,aiCtx())}).then(function(text){
    done(text?{text:text}:{err:'The coach could not answer that. Try rephrasing your question.'})
  },function(){
    OD.loading=false;S.onDevice=false;save();toast('On-device AI is not available here. Using the online coach.');serverAI(mode,q,done)})}

function viewChecker(){
  var chips=ACT.map(function(a){return '<button data-act="pick" data-v="'+a.id+'" aria-pressed="'+(picked.indexOf(a.id)>-1)+'">'+a.n+'</button>'}).join('');
  var out=[];
  for(var i=0;i<picked.length;i++)for(var j=i+1;j<picked.length;j++){var r=R[key(picked[i],picked[j])];if(r)out.push({a:picked[i],b:picked[j],lv:r[0],tx:r[1]})}
  var order={bad:0,warn:1,good:2};out.sort(function(x,y){return order[x.lv]-order[y.lv]});
  var nm=function(id){return ACT.filter(function(a){return a.id===id})[0].n.replace(/ \(.*\)/,'')};
  var lab={bad:'Avoid',warn:'Separate',good:'Pairs well'};
  var body=picked.length<2?'<p class="hint">Pick two or more ingredients to see how they combine.</p>':
    (out.length?'<div class="list" style="gap:10px">'+out.map(function(o){return '<div class="res '+o.lv+'"><span class="tag">'+lab[o.lv]+'</span><div><b>'+nm(o.a)+' + '+nm(o.b)+'</b><p>'+o.tx+'</p></div></div>'}).join('')+'</div>':'<p class="hint">No known conflicts between these. Introduce them one at a time.</p>');
  var place=picked.length?'<div class="list">'+picked.map(function(id){var a=ACT.filter(function(x){return x.id===id})[0];return '<div class="li"><div class="grow"><b>'+nm(id)+'</b></div><span class="chip">'+a.w+'</span></div>'}).join('')+'</div>':'';
  return '<div class="head"><p class="eyebrow">AI coach and label decoder</p><h2 class="page-h">Ask the <em>coach</em></h2><p class="sub">Scan a label, ask a question, or check which actives mix well. General guidance from common practice, not medical advice. Patch test, and see a dermatologist if skin stays irritated.</p></div>'+
  '<div class="grid">'+coachTiles()+'<section class="tile s7" id="mix"><h3 class="t">Mix checker: your actives</h3><div class="chips">'+chips+'</div><h3 class="t" style="margin-top:6px">Results</h3>'+body+'</section>'+
  '<section class="tile s5"><h3 class="t">Best time of day</h3>'+(place||'<p class="hint">Selected ingredients appear here with the time they work best.</p>')+'</section></div>'}

/* ---------- render / nav ---------- */
function buildNav(){
  var side=TABS.map(function(t){return '<button data-act="nav" data-v="'+t.id+'" data-tab="'+t.id+'">'+ico(t.i)+'<span>'+t.n+'</span>'+(t.id==='timer'?'<span class="dot" style="display:none"></span>':'')+'</button>'}).join('');
  var dock=TABS.filter(function(t){return MORE.indexOf(t.id)<0}).map(function(t){return '<button data-act="nav" data-v="'+t.id+'" data-tab="'+t.id+'">'+ico(t.i)+'<span>'+t.n.replace(' & ₹','')+'</span></button>'}).join('')+
    '<button data-act="openMore" id="dock-more" aria-haspopup="dialog">'+ico('i-more')+'<span>More</span></button>';
  $('#nav-side').innerHTML=side;$('#nav-dock').innerHTML=dock}
var MORE=['timer','shelf','checker'];
var TITLES={home:'Home',routine:'Routine',scan:'Face scan',picks:'Shop',timer:'Ritual timer',shelf:'Shelf and budget',checker:'Coach and checker'};
function moreHTML(){
  return '<div class="more-list">'+TABS.filter(function(t){return MORE.indexOf(t.id)>-1}).map(function(t){return '<button class="more-item" data-act="moreGo" data-v="'+t.id+'"'+(t.id===tab?' aria-current="page"':'')+'>'+ico(t.i)+'<span>'+esc(t.n)+'</span></button>'}).join('')+
    '<button class="more-item" data-act="openSettings">'+ico('i-gear')+'<span>Settings</span></button></div>'+
    '<div class="legal" style="margin-top:10px"><a href="/guides/">Guides</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/about">About</a></div>'}
function mark(){
  document.querySelectorAll('[data-tab]').forEach(function(b){if(b.dataset.tab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  var dm=$('#dock-more');if(dm){if(MORE.indexOf(tab)>-1)dm.setAttribute('aria-current','page');else dm.removeAttribute('aria-current')}
  document.title=(TITLES[tab]||'Home')+' · GN Care';
  $('#side-skin').textContent=S.skin?S.skin.type+(S.skin.sensitive?' · sensitive':''):'Not scanned yet'}
var views={home:viewHome,routine:viewRoutine,scan:viewScan,picks:viewPicks,timer:viewTimer,shelf:viewShelf,checker:viewChecker};
function render(anim){
  var v=$('#view');v.innerHTML=views[tab]();
  if(anim){v.classList.remove('rise');void v.offsetWidth;v.classList.add('rise')}else v.classList.remove('rise');
  mark();tickTimer();if(window.GNAds)GNAds.show(['home','picks','checker'].indexOf(tab)>-1);remCheck()}
var booted=false;
function go(t,quiet){
  if(!views[t])t='home';
  if(t!==tab||!quiet){tab=t}
  render(true);window.scrollTo(0,0);
  if(booted){var v=$('#view');try{v.focus({preventScroll:true})}catch(e){}}}
function onHash(){var h=location.hash.replace('#','');go(views[h]?h:'home',true)}

/* ---------- theme / prefs ---------- */
function isDark(){var t=document.documentElement.getAttribute('data-theme');if(t)return t==='dark';return window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches}
function syncTheme(){
  var d=isDark();
  document.querySelectorAll('.theme-toggle').forEach(function(b){b.setAttribute('aria-checked',String(d));b.querySelector('use').setAttribute('href',d?'#i-moon':'#i-sun')});
  var l=$('#theme-lab');if(l)l.textContent=d?'Velvet dark':'Silver light'}
function applyPrefs(){
  if(S.theme)document.documentElement.setAttribute('data-theme',S.theme);
  document.body.classList.toggle('no-ambient',!S.ambient);
  document.body.classList.toggle('no-motion',!S.motion);
  syncTheme()}
var deferredInstall=null;
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferredInstall=e;syncInstall();if(tab==='home')render()});
window.addEventListener('appinstalled',function(){deferredInstall=null;standalone=true;syncInstall();if(tab==='home')render();toast('GN Care installed')});
function nudgeInstall(){
  if(S.installNudged||standalone||!(deferredInstall||isIOS))return;
  S.installNudged=true;save();
  var n=document.createElement('div');n.className='nudge';n.setAttribute('role','status');
  n.innerHTML='<span>Install GN Care for one-tap access and reminders.</span><button class="btn sm" data-act="nudgeInstall">Install</button><button class="btn ghost sm" data-act="nudgeClose">Not now</button>';
  document.body.appendChild(n)}
function syncInstall(){var b=document.getElementById('install-top');if(b)b.hidden=!!standalone||!(deferredInstall||isIOS)}
var isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
var standalone=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone;
function installRow(){
  if(standalone)return '';
  if(deferredInstall)return '<div class="set"><div><b>Install app</b><span>Add GN Care to your home screen.</span></div><button class="btn sm" data-act="install">Install</button></div>';
  return '<div class="set"><div><b>Install app</b><span>'+(isIOS?'Tap Share, then Add to Home Screen.':'Use your browser menu and choose Install app or Add to Home screen.')+'</span></div></div>'}
function rem(){S.remind=window.GNRemind?GNRemind.cfgOf(S.remind):(S.remind||{});return S.remind}
function remSnap(){
  var soon=S.shelf.map(function(it){var d=daysLeft(it);return d===null?null:{id:it.id,n:it.n,days:d}}).filter(function(x){return x&&x.days<=14});
  return {amDone:periodDone(today(),'am'),pmDone:periodDone(today(),'pm'),uvAppliedAt:S.uv&&S.uv.appliedAt,waterToday:waterTotal(),lastWaterAt:S.lastWaterAt||0,goal:S.goal,lastScanAt:S.lastScanAt||0,firstSeen:S.firstSeen,shelfSoon:soon}}
var remLast=0;
function remCheck(force){if(!window.GNRemind||!S.remind||!S.remind.on)return;var n=Date.now();if(!force&&n-remLast<20000)return;remLast=n;GNRemind.check(rem(),remSnap())}
/* Apply what notification buttons did while the app was closed (+250 ml, sunscreen reapplied). */
function remPull(){if(!window.GNRemind)return;GNRemind.read().then(function(o){var p=o&&o.st&&o.st.pending;if(!p||(!p.water&&!p.uvAppliedAt))return;
  if(p.water){var l=waterLog().slice();for(var w=p.water;w>0;w-=250)l.push(250);S.water[today()]=l;S.lastWaterAt=Date.now()}
  if(p.uvAppliedAt&&(!S.uv.appliedAt||p.uvAppliedAt>S.uv.appliedAt))S.uv.appliedAt=p.uvAppliedAt;
  save();GNRemind.clearPending();render()})}
var DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function remindRow(){
  var r=rem(),support=window.GNRemind&&GNRemind.supported(),pm=support?GNRemind.perm():'unsupported';
  var head='<div class="set" style="flex-wrap:wrap"><div><b>Reminders</b><span>'+(!support?'This browser does not support notifications.':pm==='denied'?'Notifications are blocked for this site. '+blockedHelp():'Gentle local reminders for your routine, sunscreen, water, a weekly progress check and products about to run out. Free, no account, nothing sent to a server.')+'</span></div>'+(support&&pm!=='denied'?tgl(!!r.on,'remindOn','x','Reminders',true):'')+'</div>';
  if(!(r.on&&support&&pm==='granted'))return head;
  var t=function(k,label,desc){return '<div class="set"><div><b>'+label+'</b><span>'+desc+'</span></div>'+tgl(!!r[k],'remToggle',k,label,true)+'</div>'};
  return head+
    '<div class="set rem-times"><label class="f">Morning<input class="input" id="rem-am" type="time" value="'+esc(r.am)+'"></label><label class="f">Night<input class="input" id="rem-pm" type="time" value="'+esc(r.pm)+'"></label></div>'+
    t('spf','Sunscreen reapply','About two hours after you log sunscreen, in daytime only.')+
    t('water','Water breaks','Every '+r.waterEvery+' hours between 9 am and 9 pm, only until you reach your goal.')+
    t('scan','Weekly progress check','A nudge to rescan or take a progress photo in the same light.')+
    (r.scan?'<div class="set"><label class="f">Check-in day<select class="input" id="rem-day">'+DAYS.map(function(d,i){return '<option value="'+i+'"'+(+r.scanDay===i?' selected':'')+'>'+d+'</option>'}).join('')+'</select></label></div>':'')+
    t('repurchase','Repurchase alerts','When a shelf product is within 14 days of its use-by period after opening.')+
    '<div class="set rem-times"><label class="f">Quiet from<input class="input" id="rem-qf" type="time" value="'+esc(r.quietFrom)+'"></label><label class="f">Quiet until<input class="input" id="rem-qt" type="time" value="'+esc(r.quietTo)+'"></label></div>'+
    '<div class="set"><div><b>Try it</b><span>Send a sample reminder with Done and Snooze buttons.</span></div><button class="btn ghost sm" data-act="remTest">Send test</button></div>'+
    '<p class="hint" style="padding:4px 0 8px">Reminders are most reliable when GN Care is installed and opened now and then. Phones may delay or skip them while the app is closed.</p>'}
function blockedHelp(){return isIOS?'On iPhone, install GN Care to the Home Screen first (iOS 16.4+), then allow notifications in Settings › Notifications › GN Care.':'Tap the lock icon next to the address, open Permissions or Site settings, and set Notifications to Allow. Then come back here.'}
function adRow(){
  var r='<div class="set"><div><b>Cookies and ads</b><span>Change Accept, Reject or Customise anytime. See the <a href="/privacy">Privacy Policy</a>.</span></div><button class="btn ghost sm" data-act="adPrefs">Change</button></div>';
  return remindRow()+r+'<div class="legal" style="padding:14px 0 6px"><a href="/guides/">Guides</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/about">About</a></div>'}
function refreshSettings(){if(!$('#sheet').hidden&&$('#sheet-title').textContent==='Settings')$('#sheet-body').innerHTML=settingsHTML()}
function settingsHTML(){
  var row=function(k,t,d){return '<div class="set"><div><b>'+t+'</b><span>'+d+'</span></div>'+tgl(!!S[k],'pref',k,t,false)+'</div>'};
  return row('ambient','Ambient background','Soft drifting color behind the app.')+row('motion','Animations','Springs, waves and page transitions.')+row('sound','Timer sound','A short chime when a ritual timer ends.')+
    feedbackRow()+installRow()+adRow()+'<div class="set" style="border:0"><div><b>Reset all data</b><span>Clears routines, shelf and history on this device.</span></div><button class="btn ghost sm" data-act="resetAll" id="reset-btn">Reset</button></div>'}

function remExplainHTML(){
  return '<p class="sub" style="margin:4px 0 10px">Want a gentle nudge so your new routine sticks?</p><ul class="checks">'+
    '<li>Morning and night routine at times you choose ('+esc(rem().am)+' and '+esc(rem().pm)+')</li><li>Sunscreen reapply two hours after you log it</li><li>A weekly progress check and repurchase alerts from your shelf</li><li>Quiet hours from '+esc(rem().quietFrom)+' to '+esc(rem().quietTo)+'. Change anything in Settings.</li></ul>'+
    '<p class="hint">Reminders are created on this phone. No account, no server, no spam.</p>'+
    '<div class="btn-grid" style="margin-top:12px"><button class="btn" data-act="remAllow">Turn on reminders</button><button class="btn ghost" data-act="remLater">Not now</button></div>'}
function maybeAskReminders(){
  var r=rem();
  if(r.asked||r.on||!(window.GNRemind&&GNRemind.supported())||GNRemind.perm()==='denied')return;
  r.asked=true;save();
  setTimeout(function(){openSheet('Reminders',remExplainHTML())},700)}
function remEnable(after){
  GNRemind.request(function(p){
    var r=rem();
    if(p==='granted'){r.on=true;save();GNRemind.registerSync();remCheck(true);GNRemind.test();toast('Reminders are on')}
    else{r.on=false;save();toast(p==='unsupported'?'This browser does not support notifications':'Notifications are off. You can allow them later in Settings')}
    if(after)after(p)})}
/* ---------- actions ---------- */
function updateUV(){
  var i=S.uv.index,c=uvCat(i);
  var v=$('#uv-val');if(!v)return;v.textContent=i;
  var ch=$('#uv-cat');ch.textContent=c.n;ch.style.background=c.c;ch.style.color=c.t;
  $('#uv-adv').textContent=c.adv;$('#uv-next').textContent=uvNextText()}
var resetArm=false,resetT;
var A={
 nav:function(v){if(location.hash.replace('#','')===v){go(v)}else{location.hash=v}},
 theme:function(){var d=isDark();S.theme=d?'light':'dark';document.documentElement.setAttribute('data-theme',S.theme);save();syncTheme()},
 openSettings:function(){openSheet('Settings',settingsHTML())},
 labelScan:function(){
   if(LB.text.trim().length<3){toast('Paste an ingredient list first');return}
   LB.res=window.GNLabel?GNLabel.scan(LB.text):{actives:[],flags:[]};LB.ai='';LB.err='';LB.rated=false;render()},
 labelAI:function(){
   if(LB.text.trim().length<3){toast('Paste an ingredient list first');return}
   LB.res=window.GNLabel?GNLabel.scan(LB.text):LB.res;LB.busy=true;LB.err='';LB.ai='';LB.rated=false;render();
   sendAI('decode',LB.text,function(r){LB.busy=false;if(r.err)LB.err=r.err;else LB.ai=r.text;if(tab==='checker')render()})},
 labelToMix:function(){picked=LB.res.actives.slice();render();var m=$('#mix');if(m)m.scrollIntoView({behavior:'smooth',block:'start'})},
 labelClear:function(){LB={text:'',res:null,busy:false,ai:'',err:'',rated:false};render()},
 sugg:function(v){CO.q=SUG[+v];render();var i=$('#coach-in');if(i)i.focus()},
 ask:function(){
   if(CO.q.trim().length<3){toast('Type a question first');return}
   CO.busy=true;CO.err='';CO.ans='';CO.rated=false;render();
   sendAI('coach',CO.q,function(r){CO.busy=false;if(r.err)CO.err=r.err;else CO.ans=r.text;if(tab==='checker')render()})},
 kAud:function(v){kit().aud=v;if(v==='men'||v==='women')fashTab=v;save();render()},
 fashTab:function(v){fashTab=(v==='men'?'men':'women');render()},
 copyLang:function(v){copyLang=(v==='hi'||v==='te')?v:'en';render()},
 copyCoupon:function(v){
   var code=String(v||'');
   if(!code)return;
   var ok=function(){toast('Copied '+code+' — verify at checkout')};
   if(navigator.clipboard&&navigator.clipboard.writeText){
     navigator.clipboard.writeText(code).then(ok).catch(function(){toast('Copy failed. Code: '+code)});
   } else toast('Copy this code and verify at checkout: '+code);
 },
 kType:function(v){var k=kit();k.type=v;k.swaps={};PK={ai:'',err:'',busy:false,rated:false};save();render()},
 kSens:function(){var k=kit();k.sens=!kitSens();k.swaps={};PK={ai:'',err:'',busy:false,rated:false};save();render()},
 kPreset:function(v){kit().budget=+v;save();render()},
 kSwap:function(v,t){kit().swaps[t.dataset.c]=v;PK={ai:'',err:'',busy:false,rated:false};save();render()},
 shopCat:function(v){SH.cat=v||'all';render()},
 shopSort:function(v){SH.sort=v==='price'?'price':'match';render()},
 openProduct:function(v){var p=(window.GN_PRODUCTS||[]).filter(function(x){return x.id===v})[0];if(!p)return;openSheet(p.brand||'Product',productSheetHTML(p,kitType()))},
 kitAI:function(){
   var k=kit(),r=kitBuild();if(!r.items.some(function(i){return i.item})){toast('Pick a skin type first');return}
   PK={ai:'',err:'',busy:true,rated:false};render();
   sendAI('picks',kitQuestion(r,kitType(),kitSens(),k.budget),function(x){PK.busy=false;if(x.err)PK.err=x.err;else PK.ai=x.text;if(tab==='picks'||tab==='scan')render()})},
 aiFbK:function(v){PK.rated=true;render();postJSON('/api/feedback',{stars:+v,kind:'ai',v:'3'})},
 onDevice:function(){S.onDevice=!S.onDevice;save();render()},
 aiProfile:function(){S.aiProfile=S.aiProfile===false;save();render()},
 aiFb:function(v){CO.rated=true;render();postJSON('/api/feedback',{stars:+v,kind:'ai',v:'2'})},
 aiFbL:function(v){LB.rated=true;render();postJSON('/api/feedback',{stars:+v,kind:'ai',v:'2'})},
 openFeedback:function(){openFeedback(0,'app')},
 rateNow:function(v){openFeedback(+v,'app')},
 snooze:function(){S.fbSnooze=Date.now()+7*86400000;save();render()},
 star:function(v){FB.stars=+v;refreshFB()},
 fkind:function(v){FB.kind=v;refreshFB()},
 share:function(){var u=location.origin;if(navigator.share){navigator.share({title:'GN Care',text:'Free skin care routine tracker',url:u}).catch(function(){})}else if(navigator.clipboard){navigator.clipboard.writeText(u).then(function(){toast('Link copied')},function(){toast(u)})}else{toast(u)}},

 remindOn:function(){var r=rem();r.asked=true;if(r.on){r.on=false;save();refreshSettings();return}remEnable(refreshSettings)},
 remToggle:function(v){var r=rem();if(v in GNRemind.DEF){r[v]=!r[v];save();remCheck(true);refreshSettings()}},
 remTest:function(){GNRemind.test().then(function(ok){toast(ok?'Test reminder sent':'Allow notifications first')})},
 remAllow:function(){closeSheet();remEnable()},
 remLater:function(){closeSheet();toast('No problem. Turn reminders on anytime in Settings')},
 closeSettings:function(){closeSheet()},
 openMore:function(){openSheet('More',moreHTML())},
 moreGo:function(v){closeSheet();A.nav(v)},
 nudgeInstall:function(){A.nudgeClose();A.install()},
 nudgeClose:function(){var n=document.querySelector('.nudge');if(n)n.remove()},
 install:function(){
   if(!deferredInstall){toast(isIOS?'Tap Share, then Add to Home Screen':'Use the browser menu, then Install app');return}
   deferredInstall.prompt();deferredInstall.userChoice.then(function(){deferredInstall=null;syncInstall();if(!$('#sheet').hidden)$('#sheet-body').innerHTML=settingsHTML();if(tab==='home')render()})},
 adPrefs:function(){$('#sheet').hidden=true;if(window.GNAds)GNAds.reopen()},
 pref:function(k,t){S[k]=!S[k];t.setAttribute('aria-checked',String(S[k]));save();applyPrefs()},
 resetAll:function(v,t){
   if(!resetArm){resetArm=true;t.textContent='Tap again to erase';clearTimeout(resetT);resetT=setTimeout(function(){resetArm=false;t.textContent='Reset'},3500);return}
   try{localStorage.removeItem(KEY)}catch(e){}S=defaults();picked=[];clearScanPhoto();scanMsg='';scanStep=1;scanNote='';scanBudget=1000;scanFlags=[];routineSet=false;resetArm=false;applyPrefs();$('#sheet').hidden=true;render(true);toast('Data cleared')},
 period:function(v){period=v;render(true)},
 goRoutine:function(v){period=v;A.nav('routine')},
 step:function(v){buzz(10);
   var k=today(),d=S.done[k]||(S.done[k]={am:[],pm:[]});var arr=d[period]||(d[period]=[]);var i=arr.indexOf(v);
   var wasComplete=periodDone(k,period);
   if(i>-1)arr.splice(i,1);else arr.push(v);save();render();
   if(!wasComplete&&periodDone(k,period))toast((period==='am'?'Morning':'Night')+' ritual complete')},
 delStep:function(v){S.steps[period]=S.steps[period].filter(function(s){return s.id!==v});save();render()},
 resetDay:function(){delete S.done[today()];save();render();toast('Today reset')},
 water:function(v){buzz(10);S.lastWaterAt=Date.now();var l=waterLog().slice();l.push(+v);S.water[today()]=l;save();render();if(waterTotal()>=S.goal&&waterTotal()-(+v)<S.goal)toast('Daily water goal reached')},
 undoWater:function(){var l=waterLog().slice();l.pop();S.water[today()]=l;save();render()},
 uvApply:function(){S.uv.appliedAt=Date.now();save();updateUV();toast('Logged. Reapply in 2 hours');remCheck(true)},
 checkin:function(v){S.checkins[today()]=+v;save();render()},
 photo:function(){var i=$('#photo-in');if(i)i.click()},
 progSave:function(){
   if(!photo)return;var P=S.progress=S.progress||[];
   var put=function(url){var d=new Date();P.push({img:url,k:dk(d),d:d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}),t:S.skin?S.skin.type:''});while(P.length>12)P.shift();save();render();buzz(10);toast(P.length>1?'Added. Compare first and latest below':'Saved to your timeline')};
   if(window.GNFaceScan&&GNFaceScan.resizeDataUrl)GNFaceScan.resizeDataUrl(photo,320,0.7).then(put,function(){toast('Could not save this photo')});else toast('Could not save this photo')},
 progDel:function(v){var P=S.progress||[];P.splice(+v,1);save();render();toast('Photo deleted')},
 savePhoto:function(){
   if(!photo)return;
   var done=function(url){S.savedPhoto=url;photo=url;save();render();toast('Photo saved on this device only')};
   if(window.GNFaceScan&&GNFaceScan.resizeDataUrl)GNFaceScan.resizeDataUrl(photo,640,0.72).then(done,function(){done(photo)});
   else done(photo)},
 clearPhoto:function(){delete S.savedPhoto;clearScanPhoto();save();render();toast('Saved photo removed')},
 clearSessionPhoto:function(){clearScanPhoto();render()},
 scanBudget:function(v){scanBudget=+v;if(isNaN(scanBudget))scanBudget=0;render()},
 scanBack:function(){if(scanning)return;if(scanStep>1){scanStep--;render(true)}},
 scanRestart:function(){scanStep=1;scanErr='';routineSet=false;render(true)},
 scanSkip:function(){if(scanning)return;clearScanPhoto();scanStep=2;render(true)},
 scanNext:function(){
   if(scanning)return;
   if(scanStep===1){
     if(!photo){scanStep=2;render(true);return}
     scanErr='';scanMsg='Reading your photo on this device…';scanning=true;render();
     var done=function(metrics,msg,extra){
       extra=extra||{};
       scanMetrics=metrics||null;scanning=false;scanMsg='';
       scanLandmarks=extra.landmarks||null;
       scanImageSize=extra.imageSize||null;
       scanNoFace=extra.reason==='noface';
       if(!metrics)scanErr=msg||'The photo could not be used. You can retake it, or continue and tell us about your skin.';
       else scanErr='';
       scanStep=2;render(true);
       if(metrics)toast('Selfie read on this device');
       else toast(scanNoFace?'Face not detected, center your face':'Continue with a short note, or retake')};
     if(!(window.GNFaceScan&&GNFaceScan.analyze)){setTimeout(function(){done(null,'The on-device face model could not load. You can still write a short note.')},200);return}
     GNFaceScan.analyze(photo,function(msg){scanMsg=msg||scanMsg;var h=$('#view .hint');if(h&&scanMsg)h.textContent=scanMsg}).then(function(r){
       var extra={landmarks:r&&r.landmarks,imageSize:r&&r.imageSize,reason:r&&r.reason};
       if(r&&r.ok)done(r.metrics,'',extra);
       else done(null,(r&&r.message)||'No face was found or the lighting was poor. Retake, or write a short note instead.',extra);
     },function(){done(null,'The on-device face model could not load. You can still write a short note.')});
     return}
   if(scanStep===2){
     scanFlags=window.GNFaceScan?GNFaceScan.parseConcerns(scanNote):[];
     if(!scanMetrics&&!scanFlags.length){toast(scanNote.trim()?'We could not spot a skin type in your note. Try words like oily, dry, pimples, tan (teelu, khushk, mungurulu).':'Write a short note, or go back and add a selfie');return}
     buzz(8);
     scanStep=3;render(true);return}
   if(scanStep===3){
     if(!applySkin(scanMetrics,scanFlags)){toast('Add a selfie or write a short note first');scanStep=2;render(true);return}
     routineSet=false;scanStep=4;render(true);setTimeout(nudgeInstall,2500)}},
 setScanRoutine:function(){
   if(!S.skin||!(window.GNFaceScan&&GNFaceScan.buildRoutine))return;
   var r=GNFaceScan.buildRoutine(S.skin.type,S.skin.flags,S.skin.sensitive||S.skin.sensitiveLeaning);
   S.steps={am:r.am,pm:r.pm};delete S.done[today()];save();routineSet=true;buzz([10,40,10]);toast('Routine set');
   maybeAskReminders();A.nav('routine')},
 tpre:function(v){var p=PRE[+v];T={label:p.n,total:p.s,left:p.s,end:null,running:false};render()},
 tToggle:function(){
   if(T.running){T.left=Math.max(0,Math.ceil((T.end-Date.now())/1000));T.running=false;T.end=null}
   else{if(T.left<=0)T.left=T.total;T.end=Date.now()+T.left*1000;T.running=true}
   render()},
 tReset:function(){T.running=false;T.end=null;T.left=T.total;render()},
 pick:function(v){var i=picked.indexOf(v);if(i>-1)picked.splice(i,1);else picked.push(v);render()},
 delItem:function(v){S.shelf=S.shelf.filter(function(i){return i.id!==v});save();render()}
};
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-act]');
  if(t){var f=A[t.dataset.act];if(f)f(t.dataset.v,t,e);return}
  if(e.target.id==='sheet')A.closeSettings()});
document.addEventListener('keydown',function(e){if(e.key==='Escape')A.closeSettings();trapFocus(e)});
document.addEventListener('submit',function(e){
  var f=e.target.dataset.form;if(!f)return;e.preventDefault();
  if(f==='step'){var i=$('#step-input'),v=i.value.trim();if(!v)return;S.steps[period].push({id:'c'+Date.now(),n:v});save();render();var n=$('#step-input');if(n)n.focus()}
  if(f==='item'){
    var n=$('#item-name').value.trim(),p=+$('#item-price').value;if(!n||isNaN(p))return;
    S.shelf.push({id:'i'+Date.now(),n:n,c:$('#item-cat').value,p:p,o:$('#item-open').value||'',m:Math.max(1,+$('#item-pao').value||12)});save();render();toast('Added to your shelf')}
  if(f==='feedback'){
    if(!FB.stars){FB.err='Please choose a star rating first.';refreshFB();return}
    FB.busy=true;FB.err='';refreshFB();
    postJSON('/api/feedback',{stars:FB.stars,kind:FB.kind,msg:FB.msg,site:($('#fb-site')||{}).value||'',v:'2'}).then(function(j){
      FB.busy=false;
      if(j&&j.ok){FB.done=true;S.rated={stars:FB.stars,at:Date.now()};save();if($('#sheet').hidden===false)refreshFB();if(tab==='home')render()}
      else{FB.err=(j&&j.msg)||'We could not send your feedback. Please try again later.';refreshFB()}})}
  if(f==='timer'){var m=Math.max(1,Math.min(180,+$('#t-custom').value||1));T={label:'Custom timer',total:m*60,left:m*60,end:null,running:false};render()}});
document.addEventListener('input',function(e){
  if(e.target.id==='label-in')LB.text=e.target.value;
  if(e.target.id==='coach-in')CO.q=e.target.value;
  if(e.target.id==='fb-msg')FB.msg=e.target.value;
  if(e.target.id==='scan-note')scanNote=e.target.value;
  if(e.target.id==='shop-q'){SH.q=e.target.value;refreshShopGrid()}
  if(e.target.id==='uv-range'){S.uv.index=+e.target.value;save();updateUV()}
  var remIds={'rem-am':'am','rem-pm':'pm','rem-qf':'quietFrom','rem-qt':'quietTo','rem-day':'scanDay'};
  if(remIds[e.target.id]&&e.target.value!==''){var r=rem();r[remIds[e.target.id]]=e.target.id==='rem-day'?+e.target.value:e.target.value;save()}});
document.addEventListener('change',function(e){
  if(e.target.id==='kit-budget'){kit().budget=Math.max(0,+e.target.value||0);save();render()}
  if(e.target.id==='budget-input'){S.budget=Math.max(0,+e.target.value||0);save();render()}
  if(e.target.id==='photo-in'){var f=e.target.files&&e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(){
      var next=function(url){photo=url;scanErr='';scanMetrics=null;scanLandmarks=null;scanImageSize=null;scanNoFace=false;scanMirror=false;render()};
      if(window.GNFaceScan&&GNFaceScan.resizeDataUrl)GNFaceScan.resizeDataUrl(r.result,1280,0.85).then(next,function(){next(r.result)});
      else next(r.result)};r.readAsDataURL(f)}});
document.addEventListener('gn-catalog',function(){if(tab==='picks'||tab==='scan')render()});
window.addEventListener('hashchange',onHash);

/* ---------- boot ---------- */
(function(){var f=document.getElementById('gf');if(f)f.media='all'})();
buildNav();applyPrefs();syncInstall();
(function(){var lo=(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4)||(navigator.deviceMemory&&navigator.deviceMemory<=4)||(navigator.connection&&navigator.connection.saveData);if(lo)document.documentElement.classList.add('lite')})();
function netPill(){var p=$('#offline-pill');if(!p){p=document.createElement('div');p.id='offline-pill';p.className='offline-pill';p.setAttribute('role','status');p.textContent='Offline · saved data only';document.body.appendChild(p)}p.hidden=navigator.onLine!==false}
setInterval(function(){remCheck()},60000);remPull();
document.addEventListener('visibilitychange',function(){if(!document.hidden){remPull();remCheck(true)}});
if(navigator.serviceWorker)navigator.serviceWorker.addEventListener('message',function(e){if(e.data&&e.data.type==='gn-remind')remPull()});
window.addEventListener('online',netPill);window.addEventListener('offline',netPill);netPill();
document.addEventListener('error',function(e){var t=e.target;if(t&&t.tagName==='IMG'&&t.parentNode&&t.parentNode.classList&&t.parentNode.classList.contains('p-img')){var w=t.parentNode,brand=w.getAttribute('data-brand')||'GN Care',cat=w.getAttribute('data-cat')||'Product';w.classList.add('ph');w.setAttribute('role','img');w.setAttribute('aria-label',t.alt||'Product');w.innerHTML='<span class="ph-brand">'+esc(brand)+'</span><span class="ph-cat">'+esc(cat)+'</span>'}},true);
var h0=location.hash.replace('#','');tab=views[h0]?h0:'home';render(true);booted=true;
if(S.visits=(S.visits||0)+1,save(),S.visits>=3)setTimeout(nudgeInstall,4000);
setInterval(function(){tickTimer();if(tab==='home'&&$('#uv-next'))$('#uv-next').textContent=uvNextText()},500);
try{window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',syncTheme)}catch(e){}
new MutationObserver(syncTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}
})();
