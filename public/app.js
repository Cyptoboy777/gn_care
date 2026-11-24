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
  shelf:[
    {id:'s1',n:'Hydrating cleanser',c:'Cleanser',p:450,o:'2026-09-20',m:12,sample:true},
    {id:'s2',n:'Vitamin C serum',c:'Serum',p:799,o:'2026-10-12',m:3,sample:true},
    {id:'s3',n:'Ceramide moisturizer',c:'Moisturizer',p:620,o:'2026-08-30',m:12,sample:true},
    {id:'s4',n:'SPF 50 gel sunscreen',c:'Sunscreen',p:550,o:'2026-06-15',m:6,sample:true}
  ],
  skin:null,uv:{index:6,appliedAt:null},firstSeen:Date.now(),rated:null,fbSnooze:0,aiProfile:true,onDevice:false
}};
var S=defaults();
try{var raw=localStorage.getItem(KEY);if(raw){var L=JSON.parse(raw);for(var k in L){S[k]=L[k]}}}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}

/* ---------- helpers ---------- */
var TABS=[
  {id:'home',n:'Home',i:'i-home'},{id:'routine',n:'Routine',i:'i-check'},{id:'scan',n:'Face Scan',i:'i-scan'},{id:'picks',n:'Shop',i:'i-tag'},
  {id:'timer',n:'Timer',i:'i-timer'},{id:'shelf',n:'Shelf & ₹',i:'i-bag'},{id:'checker',n:'Coach',i:'i-flask'}];
var tab='home',period=new Date().getHours()<15?'am':'pm';
var toastT;
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
  {max:2,n:'Low',c:'#3E9B6B',t:'#fff',adv:'SPF 30 on your face is still a good daily habit. Skip reapplying while indoors.'},
  {max:5,n:'Moderate',c:'#C9B22A',t:'#2A2400',adv:'Use SPF 30 or higher. Look for shade around midday.'},
  {max:7,n:'High',c:'#D9822B',t:'#fff',adv:'Use SPF 50. Reapply every 2 hours when outdoors.'},
  {max:10,n:'Very high',c:'#C9473A',t:'#fff',adv:'SPF 50+, a hat and sunglasses. Avoid direct sun from 11 am to 4 pm.'},
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
  '<section class="tile s6"><h3 class="t">'+ico('i-bag')+'Shelf watch</h3><div class="row sp"><div><b class="num" style="font-size:22px">₹'+inr.format(Math.round(run))+'</b><span class="hint"> / month running cost</span></div><span class="chip '+(run>S.budget?'bad':'good')+'">Budget ₹'+inr.format(S.budget)+'</span></div>'+
    '<div class="meter '+(run>S.budget?'over':'')+'"><i style="width:'+Math.min(100,S.budget?run/S.budget*100:0)+'%"></i></div>'+
    (alerts.length?'<div class="list">'+alerts.map(function(a){return '<div class="li"><div class="grow"><b>'+esc(a.it.n)+'</b></div><span class="chip '+a.s.c+'">'+a.s.t+'</span></div>'}).join('')+'</div>':'<p class="hint">Nothing is expiring in the next 30 days.</p>')+
    '<button class="btn ghost sm" data-act="nav" data-v="shelf" style="align-self:flex-start">Open shelf</button></section>'+
  ratePrompt()+'</div>'}

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
  var k=kit();k.type=r.type;k.sens=!!(r.sensitive||r.sensitiveLeaning);k.budget=scanBudget;k.swaps={};
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
  return '<div class="steps" aria-label="Step '+n+' of 4">'+[1,2,3,4].map(function(i){return '<i'+(i===n?' class="on"':'')+'></i>'}).join('')+'</div>'}
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
  return '<div class="face">'+(photo?'<img src="'+photo+'" alt="Your photo"'+(scanMirror?' class="mirror"':'')+'>':'')+
    '<svg class="map" viewBox="0 0 200 260" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'+inner+'</svg>'+
    msg+(scanning?'<span class="laser"></span>':'')+'</div>'}
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
      '<p class="hint consent-note">A selfie is optional. If you add one, it is processed only in this browser to estimate shine, redness, evenness and under-eye darkness. It is never uploaded. It stays in this session unless you tap Save photo on this device.</p>'+
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
  if(S.skin&&window.GNPicks){
    var r=kitBuild();
    var msg=scanBudget>0?(r.fits?('About '+money(r.total)+' of your '+money(scanBudget)+' budget.'):('The lowest kit is about '+money(r.min)+', above your '+money(scanBudget)+' budget. Go back and raise the budget, or still use these picks.')):'About '+money(r.total)+', no budget cap.';
    kitHtml='<section class="tile"><h3 class="t">Your kit</h3><p class="hint">'+esc(msg)+' '+affDisc()+'</p></section>'+r.items.map(function(it){return pickCard(it,S.skin.type)}).join('');
  }
  var routine=S.skin&&window.GNFaceScan?GNFaceScan.buildRoutine(S.skin.type,S.skin.flags,S.skin.sensitive||S.skin.sensitiveLeaning):{am:[],pm:[]};
  var col=function(title,list){return '<div><h3 class="t">'+title+'</h3><ul class="checks">'+list.map(function(s){return '<li>'+esc(s.n)+'</li>'}).join('')+'</ul></div>'};
  return head+(S.skin?('<section class="tile tile-hero" style="max-width:640px;margin:0 auto 14px;width:100%"><h3 class="t">Your result</h3>'+faceMap()+'<div class="legend"><span><i style="background:var(--z-oil)"></i>Oily</span><span><i style="background:var(--z-dry)"></i>Dry</span><span><i style="background:var(--z-bal)"></i>Balanced</span></div><div class="result-t">'+esc(S.skin.type)+' skin</div><div class="row wrap" style="gap:6px">'+chips+'</div>'+meters+
    '<p class="hint">This is a cosmetic estimate, not a medical diagnosis. Lighting affects results.</p></section>'+
    '<div class="scan-kit">'+kitHtml+'</div>'+
    '<section class="tile" style="max-width:640px;margin:14px auto 0;width:100%;gap:16px"><h3 class="t">A simple AM and PM routine</h3><div class="routine-preview">'+col('Morning',routine.am)+col('Night',routine.pm)+'</div>'+
    '<button class="btn" data-act="setScanRoutine">'+ico('i-check')+(routineSet?'Routine updated — open Routine tab':'Set this routine')+'</button>'+
    '<p class="hint">This replaces the steps in the Routine tab. You can still edit them there.</p></section>'):'')+
    '<div class="wiz-nav" style="max-width:640px;margin:16px auto 0"><button class="btn ghost" data-act="scanBack">Back</button><button class="btn ghost" data-act="scanRestart">Start again</button></div>'}

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
function viewShelf(){
  var run=monthlyCost(),total=S.shelf.reduce(function(a,b){return a+b.p},0);
  var by={};S.shelf.forEach(function(it){by[it.c]=(by[it.c]||0)+it.p});
  var cats=Object.keys(by).sort(function(a,b){return by[b]-by[a]});
  var items=S.shelf.slice().sort(function(a,b){var x=daysLeft(a),y=daysLeft(b);return (x===null?9999:x)-(y===null?9999:y)});
  return '<div class="head"><p class="eyebrow">Budget in rupees</p><h2 class="page-h">Shelf &amp; <em>₹</em> budget</h2></div>'+
  '<div class="grid"><section class="tile s5"><h3 class="t">Monthly running cost</h3><div class="row" style="align-items:baseline;gap:8px"><span class="big num" style="font-size:48px">₹'+inr.format(Math.round(run))+'</span><span class="hint">of ₹'+inr.format(S.budget)+'</span></div>'+
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
function priceTxt(p){return p.price!=null?'about '+money(p.price):'price varies'}
function affDisc(){return 'As an Amazon Associate and Flipkart affiliate, GN Care earns from qualifying purchases.'}
function buyBtn(p){
  return '<div class="btn-grid" style="justify-content:flex-start">'+
    '<a class="btn sm" href="'+esc(GNPicks.buyURL(p,affTag()))+'" target="_blank" rel="sponsored nofollow noopener">Amazon</a>'+
    '<a class="btn ghost sm" href="'+esc(GNPicks.flipkartURL(p,fkAff()))+'" target="_blank" rel="sponsored nofollow noopener">Flipkart</a>'+
    '</div>'}
function kitBuild(){var k=kit();return GNPicks.buildKit({type:kitType(),sens:kitSens(),budget:k.budget,swaps:k.swaps,have:shelfHave()})}
function kitQuestion(r,type,sens,budget){
  var lines=['Skin type: '+type+(sens?', sensitive':'')+'. Budget: '+money(budget)+'.'];
  r.items.forEach(function(i){if(i.item)lines.push(i.cat+': '+i.item.brand+' '+i.item.name+'.')});
  return lines.join(' ')}
function pickCard(it,type){
  if(it.have)return '<section class="tile s4"><h3 class="t">'+it.cat+'</h3><p class="hint">You already have a '+it.cat.toLowerCase()+' on your shelf, so it is left out of this kit.</p></section>';
  if(!it.item)return '<section class="tile s4"><h3 class="t">'+it.cat+'</h3><p class="hint">No match for '+esc(type.toLowerCase())+' skin yet. Add products in products.js.</p></section>';
  var p=it.item;
  var alts=it.alts.filter(function(a){return a.id!==p.id}).slice(0,3);
  return '<section class="tile s4"><h3 class="t">'+it.cat+'</h3>'+
    '<div><span class="eyebrow">'+esc(p.brand)+'</span><h4 style="font-size:17px;font-weight:700;line-height:1.25;margin-top:2px;overflow-wrap:anywhere">'+esc(p.name)+'</h4><p class="hint">'+[p.size,p.spf].filter(Boolean).map(esc).join(' · ')+'</p></div>'+
    '<div class="row wrap" style="gap:6px"><span class="chip">'+priceTxt(p)+'</span><span class="chip good">Fits '+esc(type.toLowerCase())+'</span>'+(p.sens?'<span class="chip good">Sensitive-friendly</span>':'')+'</div>'+
    (p.priceNote?'<p class="hint">'+esc(p.priceNote)+'</p>':'')+
    (it.noSens?'<p class="hint">No sensitive-skin option in our list for '+esc(type.toLowerCase())+' skin. Patch test first.</p>':'')+
    buyBtn(p)+
    (alts.length?'<div class="list" style="gap:6px"><span class="hint">Other options</span>'+alts.map(function(a){return '<div class="li"><div class="grow"><b>'+esc(a.brand+' '+a.name)+'</b><span>'+priceTxt(a)+'</span></div><button class="btn ghost sm" data-act="kSwap" data-v="'+a.id+'" data-c="'+it.cat+'" aria-label="Use '+esc(a.brand+' '+a.name)+'">Use</button></div>'}).join('')+'</div>':'')+
    '</section>'}
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
    var aiBox=PK.busy?busyHTML('Thinking…'):(PK.err?'<div class="res bad"><span class="tag">Notice</span><div><p>'+esc(PK.err)+'</p></div></div>':(PK.ai?'<div class="answer">'+fmtAns(PK.ai)+'</div>'+thumbs(PK.rated,'aiFbK'):''));
    var add=GNPicks.addOns(k.aud);
    body='<div class="grid">'+r.items.map(function(i){return pickCard(i,type)}).join('')+
      '<section class="tile"><div class="row sp wrap"><div><h3 class="t">Your kit</h3><div class="row" style="align-items:baseline;gap:8px;margin-top:6px"><span class="big num" style="font-size:44px">'+money(r.total)+'</span><span class="hint">of '+money(k.budget)+'</span></div></div><button class="btn" data-act="kitAI"'+(PK.busy?' disabled':'')+'>'+ico('i-leaf')+'Explain my kit with AI</button></div>'+
        '<div class="meter '+(r.fits?'':'over')+'"><i style="width:'+pct+'%"></i></div><p class="hint">'+msg+(have.length?' Left out because you already have a '+have.join(' and ')+' on your shelf.':'')+'</p>'+aiBox+'</section>'+
      (add.length?'<section class="tile"><h3 class="t">Add-ons for '+(k.aud==='women'?'women':'men')+'</h3><div class="list">'+add.map(function(p){return '<div class="li"><div class="grow"><b>'+esc(p.brand+' '+p.name)+'</b><span>'+[p.size,priceTxt(p),p.note].filter(Boolean).map(esc).join(' · ')+'</span></div>'+buyBtn(p)+'</div>'}).join('')+'</div>'+(k.aud==='women'?'<p class="hint">Intimate washes are for external use only. See a doctor for itching, odour or discharge that does not go away.</p>':'')+'</section>':'')+
    '</div>';
  }
  var src=Object.keys(window.GN_SOURCES||{}).map(function(s){return GN_SOURCES[s]}).join('; ');
  var disc='<section class="tile" style="margin-top:14px"><h3 class="t">How this works</h3><p class="hint">Links go to Amazon.in and Flipkart search. If you buy through them, GN Care may earn a small commission at no extra cost to you. '+affDisc()+' Prices are estimates from published 2026 reviews ('+esc(src)+'). They are not live store prices, so check the price before you buy. Picks match your skin type and budget. They are general suggestions, not medical advice. See a dermatologist for skin conditions.</p></section>';
  return head+ctl+(body?'<div style="height:14px"></div>'+body:'')+disc}

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
    l=l.replace(/\*\*/g,'').trim();if(!l)return;
    var m=/^[-*•]\s+(.*)$/.exec(l);
    if(m){if(!open){out+='<ul class="checks">';open=true}out+='<li>'+esc(m[1])+'</li>'}
    else{if(open){out+='</ul>';open=false}out+='<p>'+esc(l)+'</p>'}
  });
  if(open)out+='</ul>';return out}
function postJSON(url,body){
  return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){
    return r.json().then(function(j){j.status=r.status;return j},function(){return {ok:false,msg:'The service is not available here yet.'}})
  },function(){return {ok:false,msg:'No connection. The label scan and Checker still work offline.'}})}
function aiCtx(){return (S.skin&&S.aiProfile!==false)?{type:S.skin.type,sensitive:!!S.skin.sensitive,sun:S.skin.sun}:null}
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
  return '<div class="row sp" style="align-items:flex-start;gap:14px"><div style="min-width:0"><span style="font-size:13px;font-weight:600;display:block">Run AI on my device</span><span class="hint">Free and private. Downloads a model of roughly 1 GB the first time you ask. Needs a recent phone or computer.</span></div>'+tgl(!!S.onDevice,'onDevice','x','Run AI on my device',true)+'</div>'}
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
function openSheet(title,html){$('#sheet-title').textContent=title;$('#sheet-body').innerHTML=html;$('#sheet').hidden=false}
function refreshFB(){$('#sheet-body').innerHTML=fbHTML()}
function openFeedback(stars,kind){FB={stars:stars||0,kind:kind||'app',msg:'',busy:false,done:false,err:''};openSheet('Rate GN Care',fbHTML())}
function feedbackRow(){return '<div class="set"><div><b>Rate and feedback</b><span>Tell us what to improve.</span></div><button class="btn sm" data-act="openFeedback">Rate</button></div>'}
function ratePrompt(){
  if(S.rated)return '';
  if(!S.firstSeen||Date.now()-S.firstSeen<2*86400000)return '';
  if(S.fbSnooze&&Date.now()<S.fbSnooze)return '';
  return '<section class="tile"><div class="row sp wrap"><div><h3 class="t">Enjoying GN Care?</h3><p class="hint" style="margin-top:6px">Tap a star to rate it. It takes ten seconds.</p></div><div class="stars-row" role="group" aria-label="Rate GN Care">'+[1,2,3,4,5].map(function(n){return '<button class="star" data-act="rateNow" data-v="'+n+'" aria-label="'+n+' star'+(n>1?'s':'')+'">'+ico('i-star')+'</button>'}).join('')+'</div><button class="btn ghost sm" data-act="snooze">Not now</button></div></section>'}
function serverAI(mode,q,done){
  postJSON('/api/ai',{mode:mode,q:q,ctx:aiCtx()}).then(function(j){done(j&&j.ok?{text:j.text}:{err:(j&&j.msg)||'Something went wrong. Try again later.'})})}
function sendAI(mode,q,done){
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
  var dock=TABS.map(function(t){return '<button data-act="nav" data-v="'+t.id+'" data-tab="'+t.id+'">'+ico(t.i)+'<span>'+t.n.replace(' & ₹','')+'</span></button>'}).join('');
  $('#nav-side').innerHTML=side;$('#nav-dock').innerHTML=dock}
function mark(){
  document.querySelectorAll('[data-tab]').forEach(function(b){if(b.dataset.tab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  $('#side-skin').textContent=S.skin?S.skin.type+(S.skin.sensitive?' · sensitive':''):'Not scanned yet'}
var views={home:viewHome,routine:viewRoutine,scan:viewScan,picks:viewPicks,timer:viewTimer,shelf:viewShelf,checker:viewChecker};
function render(anim){
  var v=$('#view');v.innerHTML=views[tab]();
  if(anim){v.classList.remove('rise');void v.offsetWidth;v.classList.add('rise')}
  mark();tickTimer();if(window.GNAds)GNAds.show(['home','shelf','checker'].indexOf(tab)>-1)}
function go(t,quiet){
  if(!views[t])t='home';
  if(t!==tab||!quiet){tab=t}
  render(true);window.scrollTo(0,0)}
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
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferredInstall=e});
var isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
var standalone=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone;
function installRow(){
  if(standalone)return '';
  if(deferredInstall)return '<div class="set"><div><b>Install app</b><span>Add GN Care to your home screen.</span></div><button class="btn sm" data-act="install">Install</button></div>';
  return '<div class="set"><div><b>Install app</b><span>'+(isIOS?'Tap Share, then Add to Home Screen.':'Use your browser menu and choose Install app or Add to Home screen.')+'</span></div></div>'}
function adRow(){
  var r=(window.GNAds&&GNAds.enabled())?'<div class="set"><div><b>Ad preferences</b><span>Switch between personalised and non-personalised ads.</span></div><button class="btn ghost sm" data-act="adPrefs">Change</button></div>':'';
  return r+'<div class="legal" style="padding:14px 0 6px"><a href="/guides/">Guides</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="/about.html">About</a></div>'}
function settingsHTML(){
  var row=function(k,t,d){return '<div class="set"><div><b>'+t+'</b><span>'+d+'</span></div>'+tgl(!!S[k],'pref',k,t,false)+'</div>'};
  return row('ambient','Ambient background','Soft drifting color behind the app.')+row('motion','Animations','Springs, waves and page transitions.')+row('sound','Timer sound','A short chime when a ritual timer ends.')+
    feedbackRow()+installRow()+adRow()+'<div class="set" style="border:0"><div><b>Reset all data</b><span>Clears routines, shelf and history on this device.</span></div><button class="btn ghost sm" data-act="resetAll" id="reset-btn">Reset</button></div>'}

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
 kAud:function(v){kit().aud=v;save();render()},
 kType:function(v){var k=kit();k.type=v;k.swaps={};PK={ai:'',err:'',busy:false,rated:false};save();render()},
 kSens:function(){var k=kit();k.sens=!kitSens();k.swaps={};PK={ai:'',err:'',busy:false,rated:false};save();render()},
 kPreset:function(v){kit().budget=+v;save();render()},
 kSwap:function(v,t){kit().swaps[t.dataset.c]=v;PK={ai:'',err:'',busy:false,rated:false};save();render()},
 kitAI:function(){
   var k=kit(),r=kitBuild();if(!r.items.some(function(i){return i.item})){toast('Pick a skin type first');return}
   PK={ai:'',err:'',busy:true,rated:false};render();
   sendAI('picks',kitQuestion(r,kitType(),kitSens(),k.budget),function(x){PK.busy=false;if(x.err)PK.err=x.err;else PK.ai=x.text;if(tab==='picks')render()})},
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

 closeSettings:function(){$('#sheet').hidden=true},
 install:function(){if(!deferredInstall)return;deferredInstall.prompt();deferredInstall.userChoice.then(function(){deferredInstall=null;$('#sheet-body').innerHTML=settingsHTML()})},
 adPrefs:function(){$('#sheet').hidden=true;if(window.GNAds)GNAds.reopen()},
 pref:function(k,t){S[k]=!S[k];t.setAttribute('aria-checked',String(S[k]));save();applyPrefs()},
 resetAll:function(v,t){
   if(!resetArm){resetArm=true;t.textContent='Tap again to erase';clearTimeout(resetT);resetT=setTimeout(function(){resetArm=false;t.textContent='Reset'},3500);return}
   try{localStorage.removeItem(KEY)}catch(e){}S=defaults();picked=[];clearScanPhoto();scanMsg='';scanStep=1;scanNote='';scanBudget=1000;scanFlags=[];routineSet=false;resetArm=false;applyPrefs();$('#sheet').hidden=true;render(true);toast('Data cleared')},
 period:function(v){period=v;render(true)},
 goRoutine:function(v){period=v;A.nav('routine')},
 step:function(v){
   var k=today(),d=S.done[k]||(S.done[k]={am:[],pm:[]});var arr=d[period]||(d[period]=[]);var i=arr.indexOf(v);
   var wasComplete=periodDone(k,period);
   if(i>-1)arr.splice(i,1);else arr.push(v);save();render();
   if(!wasComplete&&periodDone(k,period))toast((period==='am'?'Morning':'Night')+' ritual complete')},
 delStep:function(v){S.steps[period]=S.steps[period].filter(function(s){return s.id!==v});save();render()},
 resetDay:function(){delete S.done[today()];save();render();toast('Today reset')},
 water:function(v){var l=waterLog().slice();l.push(+v);S.water[today()]=l;save();render();if(waterTotal()>=S.goal&&waterTotal()-(+v)<S.goal)toast('Daily water goal reached')},
 undoWater:function(){var l=waterLog().slice();l.pop();S.water[today()]=l;save();render()},
 uvApply:function(){S.uv.appliedAt=Date.now();save();updateUV();toast('Logged. Reapply in 2 hours')},
 checkin:function(v){S.checkins[today()]=+v;save();render()},
 photo:function(){var i=$('#photo-in');if(i)i.click()},
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
     if(!scanMetrics&&!scanFlags.length){toast('Add a selfie or write a short note first');return}
     scanStep=3;render(true);return}
   if(scanStep===3){
     if(!applySkin(scanMetrics,scanFlags)){toast('Add a selfie or write a short note first');scanStep=2;render(true);return}
     routineSet=false;scanStep=4;render(true)}},
 setScanRoutine:function(){
   if(!S.skin||!(window.GNFaceScan&&GNFaceScan.buildRoutine))return;
   var r=GNFaceScan.buildRoutine(S.skin.type,S.skin.flags,S.skin.sensitive||S.skin.sensitiveLeaning);
   S.steps={am:r.am,pm:r.pm};delete S.done[today()];save();routineSet=true;toast('Routine set');A.nav('routine')},
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
document.addEventListener('keydown',function(e){if(e.key==='Escape')A.closeSettings()});
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
  if(e.target.id==='uv-range'){S.uv.index=+e.target.value;save();updateUV()}});
document.addEventListener('change',function(e){
  if(e.target.id==='kit-budget'){kit().budget=Math.max(0,+e.target.value||0);save();render()}
  if(e.target.id==='budget-input'){S.budget=Math.max(0,+e.target.value||0);save();render()}
  if(e.target.id==='photo-in'){var f=e.target.files&&e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(){
      var next=function(url){photo=url;scanErr='';scanMetrics=null;scanLandmarks=null;scanImageSize=null;scanNoFace=false;scanMirror=false;render()};
      if(window.GNFaceScan&&GNFaceScan.resizeDataUrl)GNFaceScan.resizeDataUrl(r.result,1280,0.85).then(next,function(){next(r.result)});
      else next(r.result)};r.readAsDataURL(f)}});
window.addEventListener('hashchange',onHash);

/* ---------- boot ---------- */
buildNav();applyPrefs();
var h0=location.hash.replace('#','');tab=views[h0]?h0:'home';render(true);
setInterval(function(){tickTimer();if(tab==='home'&&$('#uv-next'))$('#uv-next').textContent=uvNextText()},500);
try{window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',syncTheme)}catch(e){}
new MutationObserver(syncTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}
})();
