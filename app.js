const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const STORAGE_KEY = 'bass-practice-studio-v1';

const PAGE_COPY = {
  today: ['今天练什么','先回答几个问题，再完成一个 5 分钟练习。'],
  library: ['歌曲库','按等级、技术和本地资源筛选 188 首练习曲。'],
  practice: ['歌曲练习台','谱面、伴奏、循环、节拍器和练习记录集中在这里。'],
  lab: ['编一段贝斯','输入和弦，跟着四小节示例练习。'],
  progress: ['我的练习','看见已经做到的事，再开始下一步。'],
  roadmap: ['进阶记录','查看更详细的练习分类。']
};
const ABILITY_DEFS = {
  fretboard: {name:'找到音',short:'找音',description:'知道要弹的音在哪里'},
  harmony: {name:'跟着和弦换音',short:'换音',description:'和弦变化时，知道该换到哪个音'},
  rhythm: {name:'跟稳拍子',short:'跟拍',description:'跟着拍子稳定地弹'},
  technique: {name:'弹得轻松清楚',short:'动作',description:'动作放松，每个音都清楚'},
  expression: {name:'控制声音',short:'声音',description:'控制声音的轻重和长短'},
  transfer: {name:'换个练习也会',short:'活用',description:'换一根弦或换个练习也能做到'}
};
const STARTER_EXERCISES = {
  posture: {
    title:'弹出清楚的声音', ability:'动作', abilityKey:'technique', reason:'先学会放松持琴，用两根手指轮流拨弦。',
    preview:['认识琴身、琴颈和四根弦的位置','观察右手食指与中指交替的动作','记住：动作要小，手腕保持放松'],
    steps:['把贝斯放稳，让琴颈略微向上','右手拇指轻放在拾音器或最粗弦上','用食指、中指交替弹最粗的 E 弦','每次弹 4 个均匀的音，共完成 3 轮'],
    pattern:['E E E E','E E E E','E E E E','休息并放松'], standard:'动作放松，用食指和中指交替弹出 3 轮均匀的声音。'
  },
  openStrings: {
    title:'记住四根空弦 E、A、D、G', ability:'找音', abilityKey:'fretboard', reason:'你已经可以让琴发声，下一步记住四根弦的名字。',
    preview:['从最粗到最细依次是 E、A、D、G','E 是四弦，A 是三弦，D 是二弦，G 是一弦','用“E-A-D-G”大声读出顺序'],
    steps:['从最粗的 E 弦开始，每根弦弹 4 次','依次完成 E、A、D、G 四根弦','弹之前先说出弦名，再弹响','盖住提示，不看文字再完成 3 轮'],
    pattern:['E E E E','A A A A','D D D D','G G G G'], standard:'不看提示，连续 3 次按 E → A → D → G 找到并弹响四根空弦。'
  },
  firstFiveFrets: {
    title:'在五品以内找到 G、A、C、D', ability:'找音', abilityKey:'fretboard', reason:'你已经认识四根空弦，现在学习四个最常用的位置。',
    preview:['E 弦 3 品是 G，5 品是 A','A 弦 3 品是 C，5 品是 D','同一个音也可能出现在另一根弦上'],
    steps:['先弹 E 空弦，再找到 E 弦 3 品 G、5 品 A','再弹 A 空弦，找到 A 弦 3 品 C、5 品 D','每找到一个音，先说音名再弹','打乱顺序，独立找到 G、A、C、D 各 3 次'],
    pattern:['E弦：0品 E','E弦：3品 G · 5品 A','A弦：0品 A','A弦：3品 C · 5品 D'], standard:'不看提示，在五品以内独立找到 G、A、C、D，每个音连续找对 3 次。'
  }
};
const state = {
  library: null,
  demoMode: false,
  songs: [],
  filteredSongs: [],
  page: 'today',
  view: 'list',
  selectedSong: null,
  scoreView: 'pdf',
  planOffset: 0,
  loopA: null,
  loopB: null,
  loopActive: false,
  labStage: 1,
  labVariant: 0,
  storage: loadStorage()
};

function loadStorage(){
  try {
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY))||{};
    return {songs:saved.songs||{},history:saved.history||[],starter:saved.starter||{diagnosis:null,practice:null,history:[]}};
  } catch { return {songs:{},history:[],starter:{diagnosis:null,practice:null,history:[]}}; }
}
function saveStorage(){ try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state.storage));return true;}catch{return false;} }
function starterOnboardingComplete(){ return (state.storage.starter?.history||[]).some(item=>item.passed); }
function importDiagnosisHandoff(){
  const params=new URLSearchParams(location.search), route=params.get('starterRoute'), hasBass=params.get('hasBass');
  if(!STARTER_EXERCISES[route]||!['0','1'].includes(hasBass))return;
  state.storage.starter={diagnosis:{version:2,route,hasBass:hasBass==='1',completedAt:new Date().toISOString(),source:'新手问卷'},practice:{started:false,previewDone:false},history:state.storage.starter?.history||[]};
  const stored=saveStorage();
  try{const clean=new URL(location.href);clean.searchParams.delete('starterRoute');clean.searchParams.delete('hasBass');history.replaceState(null,'',clean.href);}catch{}
  if(!stored)setTimeout(()=>showToast('诊断已接收，但浏览器未保存。刷新后需要重新诊断。'),0);
}
function songState(id){ return state.storage.songs[id] ||= {favorite:false,completed:false,bestBpm:0,lastOpened:null,sessions:[]}; }
function migrateStorageIds(){
  const legacyToStable=new Map(state.songs.map(song=>[song.legacyId,song.id]));
  state.songs.forEach(song=>{
    if(song.legacyId!==song.id&&state.storage.songs[song.legacyId]&&!state.storage.songs[song.id]){
      state.storage.songs[song.id]=state.storage.songs[song.legacyId]; delete state.storage.songs[song.legacyId];
    }
  });
  state.storage.history.forEach(item=>{item.songId=legacyToStable.get(item.songId)||item.songId;}); saveStorage();
}
function abilityEvidence(){
  const result=Object.fromEntries(Object.keys(ABILITY_DEFS).map(key=>[key,{evidence:0,verified:0,attempts:0,score:0}]));
  state.storage.history.forEach(item=>{
    const song=state.songs.find(candidate=>candidate.id===item.songId); if(!song)return;
    const factor=item.result==='steady'?1:item.result==='minor'?.55:.2;
    Object.entries(song.training?.abilityWeights||{}).forEach(([key,weight])=>{if(!result[key]||!weight)return;result[key].evidence+=weight*factor;result[key].attempts++;if(item.passed)result[key].verified+=weight;});
  });
  const starterAbility={posture:'technique',openStrings:'fretboard',firstFiveFrets:'fretboard'};
  (state.storage.starter?.history||[]).forEach(item=>{const key=starterAbility[item.exerciseId];if(!key||!result[key])return;result[key].attempts++;result[key].evidence+=item.passed?1:.25;if(item.passed)result[key].verified+=1;});
  Object.values(result).forEach(item=>{item.score=Math.min(100,Math.round((item.evidence+item.verified*.5)/12*100));}); return result;
}
function weakestAbility(){
  const evidence=abilityEvidence(); return Object.keys(ABILITY_DEFS).sort((a,b)=>evidence[a].score-evidence[b].score||evidence[a].evidence-evidence[b].evidence)[0];
}
function allPracticeHistory(){
  return [...state.storage.history,...(state.storage.starter?.history||[])];
}
function practiceDayNumber(){
  const dates=allPracticeHistory().map(item=>item.date).filter(Boolean).sort();
  if(!dates.length)return 1;
  const first=new Date(`${dates[0]}T00:00:00`), today=new Date(`${todayKey()}T00:00:00`);
  return Math.max(1,Math.floor((today-first)/86400000)+1);
}
function weekPracticeDays(){
  const now=new Date(), monday=new Date(now), offset=(now.getDay()+6)%7; monday.setHours(0,0,0,0); monday.setDate(now.getDate()-offset);
  const sunday=new Date(monday); sunday.setDate(monday.getDate()+7);
  return new Set(allPracticeHistory().filter(item=>{const time=new Date(`${item.date}T00:00:00`);return time>=monday&&time<sunday;}).map(item=>item.date)).size;
}
function levelProgressRows(){
  return [1,2,3,4,5,6,7].map(level=>{const songs=state.songs.filter(song=>song.level===level),done=songs.filter(song=>songState(song.id).completed).length,percent=songs.length?done/songs.length*100:0;return `<div class="level-row"><span>Level ${level}</span><div class="track"><span style="width:${percent}%"></span></div><span>${done}/${songs.length}</span></div>`;}).join('');
}
function abilityCardMarkup(key,ability,item,weakestKey){
  const evidenceLabel=item.attempts?`${item.attempts} 条`:'待建立';
  return `<article class="ability-card ${key===weakestKey?'weakest':''}"><div class="ability-card-head"><div><span>${ability.short}</span><strong>${ability.name}</strong></div><b>${evidenceLabel}</b></div><p>${ability.description}</p><div class="ability-track"><span style="width:${item.score}%"></span></div><small>${item.attempts?`${item.attempts} 条练习记录 · ${item.verified} 条通过记录`:'完成对应练习后，这里会出现证据'}</small></article>`;
}
function abilityRank(score){
  if(score>=80)return '出神入化'; if(score>=60)return '融会贯通'; if(score>=40)return '得心应手'; if(score>=20)return '渐入佳境'; return '初窥门径';
}
function abilityUpgrades(before,after){
  const thresholds=[20,40,60,80], messages=[];
  Object.keys(ABILITY_DEFS).forEach(key=>{const crossed=thresholds.filter(value=>before[key].score<value&&after[key].score>=value).at(-1);if(crossed)messages.push(`恭喜！${ABILITY_DEFS[key].name} 能力达到 ${abilityRank(crossed)}！`);});
  return messages;
}
function drawAbilityRadar(evidence){
  const canvas=$('#abilityRadar'); if(!canvas)return;
  const width=Math.max(280,Math.round(canvas.getBoundingClientRect().width||520)), height=330, ratio=window.devicePixelRatio||1;
  canvas.width=width*ratio; canvas.height=height*ratio; canvas.style.height=`${height}px`;
  const ctx=canvas.getContext('2d'); ctx.scale(ratio,ratio); ctx.clearRect(0,0,width,height);
  const keys=Object.keys(ABILITY_DEFS), centerX=width/2, centerY=height/2+4, radius=Math.min(118,width*.31), point=(index,scale=1)=>{const angle=-Math.PI/2+index*Math.PI/3;return [centerX+Math.cos(angle)*radius*scale,centerY+Math.sin(angle)*radius*scale];};
  ctx.lineWidth=1;
  [0.25,0.5,0.75,1].forEach(scale=>{ctx.beginPath();keys.forEach((key,index)=>{const [x,y]=point(index,scale);index?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.strokeStyle=scale===1?'#46515e':'#2a313a';ctx.stroke();});
  keys.forEach((key,index)=>{const [x,y]=point(index);ctx.beginPath();ctx.moveTo(centerX,centerY);ctx.lineTo(x,y);ctx.strokeStyle='#2a313a';ctx.stroke();});
  ctx.beginPath(); keys.forEach((key,index)=>{const [x,y]=point(index,evidence[key].score/100);index?ctx.lineTo(x,y):ctx.moveTo(x,y);}); ctx.closePath(); ctx.fillStyle='#ff726733';ctx.fill();ctx.strokeStyle='#ff7267';ctx.lineWidth=2;ctx.stroke();
  keys.forEach((key,index)=>{const [x,y]=point(index,evidence[key].score/100);ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fillStyle='#51cfb2';ctx.fill();const [labelX,labelY]=point(index,1.22);ctx.fillStyle='#c9d0d7';ctx.font='600 11px Inter, system-ui, sans-serif';ctx.textAlign=labelX<centerX-8?'right':labelX>centerX+8?'left':'center';ctx.textBaseline=labelY<centerY?'bottom':'top';ctx.fillText(`${ABILITY_DEFS[key].short} ${evidence[key].attempts}条`,labelX,labelY);});
}
function renderRoadmap(){
  if(!state.library)return;
  const evidence=abilityEvidence(), coveredDimensions=Object.values(evidence).filter(item=>item.attempts>0).length, weakestKey=weakestAbility(), weakest=ABILITY_DEFS[weakestKey], enoughEvidence=state.storage.history.length>=3&&coveredDimensions>=3;
  $('#roadmapWeakest').textContent=enoughEvidence?`${weakest.name} · 当前证据较少`:`已建立 ${coveredDimensions}/6 维证据，暂不判断短板`;
  $('#roadmapAlert')?.classList.toggle('visible',enoughEvidence&&evidence[weakestKey].score<30);
  $('#roadmapAbilityGrid').innerHTML=Object.entries(ABILITY_DEFS).map(([key,ability])=>abilityCardMarkup(key,ability,evidence[key],enoughEvidence?weakestKey:null)).join('');
  const recommendations=enoughEvidence?state.songs.filter(song=>song.resources.backing.length&&(song.training?.abilityWeights?.[weakestKey]||0)>0&&!songState(song.id).completed).sort((a,b)=>(b.training.abilityWeights[weakestKey]-a.training.abilityWeights[weakestKey])||(a.level-b.level)).slice(0,5):[];
  $('#roadmapRecommendationNote').textContent=enoughEvidence?`根据现有练习记录，围绕「${weakest.name}」寻找有明确验收条件的训练。`:'先通过原创基础练习建立至少 3 个能力维度的证据。';
  $('#roadmapRecommendations').innerHTML=recommendations.length?recommendations.map(song=>`<article class="roadmap-song" data-song-id="${song.id}"><div><strong>${escapeHtml(song.title)}</strong><span>${escapeHtml(trainingSummary(song))}</span></div><span>L${song.level}</span><span>${song.bpm||'—'} BPM</span><span class="backing-state">✓ 有伴奏</span></article>`).join(''):`<div class="empty-state">${enoughEvidence?'当前没有具备明确验收条件的后续材料。请继续练习原创基础内容。':'当前证据还不足。回到首页完成今天的原创练习。'}</div>`;
  $('#roadmapLevelProgress').innerHTML=levelProgressRows();
  const allHistory=allPracticeHistory(), completed=state.songs.filter(song=>songState(song.id).completed).length, minutes=allHistory.reduce((sum,item)=>sum+(item.minutes||0),0);
  $('#roadmapStats').innerHTML=[['已覆盖能力',`${coveredDimensions}/6`],['已验收曲目',`${completed}/${state.songs.length}`],['累计练习',`${minutes} 分钟`],['本周练习',`${weekPracticeDays()} 天`]].map(([label,value])=>`<div class="roadmap-stat"><span>${label}</span><strong>${value}</strong></div>`).join('');
  requestAnimationFrame(()=>drawAbilityRadar(evidence));
}
function trainingSummary(song){
  const parts=[...(song.training?.rhythm||[]),...(song.training?.techniques||[])]; if(song.training?.harmony)parts.push(song.training.harmony);
  return [...new Set(parts)].slice(0,3).join(' · ')||'基础综合练习';
}
function escapeHtml(value){ return String(value ?? '').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
function fileName(path){ return path.split('/').at(-1); }
function encodeMediaPath(path){ return String(path ?? '').split('/').map(segment=>encodeURIComponent(segment)).join('/'); }
function mediaUrl(path){ return `./media/${encodeMediaPath(path)}`; }
function downloadUrl(path){ return mediaUrl(path); }
function scoreDetailUrl(path,title){ return `./score.html?${new URLSearchParams({file:path,title}).toString()}`; }
function normalizeLibrary(library){
  const source=library||{};
  source.songs=(source.songs||[]).map(song=>({...song,resources:{pdf:[],images:[],gp:[],original:[],backing:[],video:[],...(song.resources||{})}}));
  source.stats={songs:source.songs.length,pdf:0,gp:0,backing:0,original:0,...(source.stats||{})};
  return source;
}
function formatTime(seconds){ if(!Number.isFinite(seconds)) return '0:00'; const m=Math.floor(seconds/60); return `${m}:${String(Math.floor(seconds%60)).padStart(2,'0')}`; }
function todayKey(date=new Date()){ return date.toISOString().slice(0,10); }
function showToast(message){ const toast=$('#toast'); toast.textContent=message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>toast.classList.remove('show'),2200); }

class Metronome {
  constructor(pulseIds){ this.bpm=80; this.timer=null; this.context=null; this.pulseIds=pulseIds; this.beat=0; }
  setBpm(value){ this.bpm=Math.max(30,Math.min(260,Number(value)||80)); if(this.timer){ this.stop(); this.start(); } }
  click(){
    this.context ||= new (window.AudioContext||window.webkitAudioContext)();
    const osc=this.context.createOscillator(), gain=this.context.createGain();
    osc.frequency.value=this.beat%4===0?980:720; gain.gain.setValueAtTime(.0001,this.context.currentTime); gain.gain.exponentialRampToValueAtTime(.16,this.context.currentTime+.004); gain.gain.exponentialRampToValueAtTime(.0001,this.context.currentTime+.055); osc.connect(gain).connect(this.context.destination); osc.start(); osc.stop(this.context.currentTime+.06); this.beat++;
    this.pulseIds.forEach(id=>{ const el=document.getElementById(id); if(el){ el.classList.add('on'); setTimeout(()=>el.classList.remove('on'),90); } });
  }
  start(){ if(this.timer) return; this.click(); this.timer=setInterval(()=>this.click(),60000/this.bpm); }
  stop(){ clearInterval(this.timer); this.timer=null; this.beat=0; this.pulseIds.forEach(id=>document.getElementById(id)?.classList.remove('on')); }
  toggle(){ this.timer?this.stop():this.start(); return Boolean(this.timer); }
}
const quickMetro=new Metronome(['quickPulse']);
const practiceMetro=new Metronome(['practicePulse']);

async function loadLibrary(rescan=false){
  if(location.protocol==='file:'){
    state.fileMode=true;
    $('#libraryStatus').textContent='原创练习可用';
    $('#libraryPath').textContent='歌曲素材没有进入公开版本';
    $('#rescanBtn').disabled=true; $('#rescanBtn').title='公开版本不读取歌曲素材';
    return;
  }
  state.demoMode=true;
  state.library=normalizeLibrary({libraryRoot:'公开安全版',songs:[],stats:{songs:0,pdf:0,gp:0,backing:0,original:0}});
  state.songs=[]; state.filteredSongs=[];
  $('#libraryStatus').textContent='原创练习可用';
  $('#libraryPath').textContent='歌曲素材没有进入公开版本';
  $('.status-dot').classList.add('ready');
  $('#rescanBtn').disabled=true; $('#rescanBtn').title='公开版本不读取歌曲素材';
  setupLevelFilter(); renderAll();
}

function setupLevelFilter(){
  const select=$('#levelFilter');
  select.innerHTML='<option value="all">全部等级</option>'+[1,2,3,4,5,6,7].map(level=>`<option value="${level}">Level ${level}</option>`).join('');
  $('#abilityFilter').innerHTML='<option value="all">全部能力</option>'+Object.entries(ABILITY_DEFS).map(([key,item])=>`<option value="${key}">${item.name}</option>`).join('');
}

function renderAll(){ renderToday(); applyFilters(); renderProgress(); renderRoadmap(); if(state.selectedSong) renderPractice(); renderLab(); }

function navigate(page){
  if(!PAGE_COPY[page]||!$(`#${page}Page`))return;
  state.page=page;
  const primaryPage=['library','practice','roadmap'].includes(page)?'progress':page;
  $$('.nav-item[data-page]').forEach(btn=>btn.classList.toggle('active',btn.dataset.page===primaryPage));
  $$('.page').forEach(section=>section.classList.toggle('active',section.id===`${page}Page`));
  $('#pageTitle').textContent=PAGE_COPY[page][0]; $('#pageSubtitle').textContent=PAGE_COPY[page][1];
  if(page==='progress') renderProgress();
  if(page==='roadmap') renderRoadmap();
  $('#app').classList.toggle('starter-focus',page==='today'&&!starterOnboardingComplete());
  window.scrollTo({top:0,behavior:'smooth'});
}

function renderToday(){
  const root=$('#starterHome'), starter=state.storage.starter, diagnosis=starter.diagnosis;
  $('#app').classList.toggle('starter-focus',!starterOnboardingComplete());
  if(!diagnosis){
    root.innerHTML=`<section class="starter-hero"><span class="eyebrow">第一次练习</span><p class="starter-kicker">第一次来这里？</p><h2>先找出你今天该练什么</h2><p class="starter-lead">用 3 分钟回答几个简单问题。完成后，你只会得到一个 5 分钟练习。</p><div class="starter-promise"><div><strong>不需要懂乐理</strong><span>只问你现在会不会做</span></div><div><strong>没有琴也可以</strong><span>先预习，有琴后再练</span></div><div><strong>不会自动打分</strong><span>结果由你自己确认</span></div></div><a class="primary-btn starter-primary" href="diagnose.html">开始3分钟诊断</a><p class="starter-footnote">结果保存在当前浏览器。清除浏览器数据后，记录也会消失。</p></section>`;
    return;
  }
  const exercise=STARTER_EXERCISES[diagnosis.route]||STARTER_EXERCISES.openStrings;
  const practice=starter.practice||{started:false,previewDone:false}, hasBass=Boolean(diagnosis.hasBass);
  if(!hasBass){
    root.innerHTML=`<section class="starter-session"><div class="starter-session-head"><div><span class="eyebrow">没有琴也能先学</span><p class="starter-kicker">你的起点 · ${escapeHtml(exercise.ability)}</p><h2>${escapeHtml(exercise.title)}</h2><p>${escapeHtml(exercise.reason)}</p></div><div class="time-badge"><strong>5</strong><span>分钟</span></div></div><div class="starter-grid"><article class="practice-card"><h3>${practice.previewDone?'预习已完成':'今天先完成预习'}</h3><ol>${exercise.preview.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ol><p class="practice-standard"><span>有琴后做到什么算会</span>${escapeHtml(exercise.standard)}</p>${practice.previewDone?'<div class="waiting-note"><strong>下一步需要一把真实贝斯</strong><span>准备好琴后，再完成这项练习。</span></div><button class="primary-btn full" id="bassReadyBtn">我已准备好贝斯</button>':'<button class="primary-btn full" id="previewDoneBtn">完成5分钟预习</button>'}</article><aside class="starter-side-note"><strong>为什么先练这个</strong><p>${escapeHtml(exercise.reason)}</p><a href="diagnose.html">重新回答问题</a></aside></div></section>`;
    return;
  }
  const started=Boolean(practice.started), completed=Boolean(practice.completed);
  root.innerHTML=`<section class="starter-session"><div class="starter-session-head"><div><span class="eyebrow">今天的 5 分钟练习</span><p class="starter-kicker">今天只练一件事 · ${escapeHtml(exercise.ability)}</p><h2>${escapeHtml(exercise.title)}</h2><p>${escapeHtml(exercise.reason)}</p></div><div class="time-badge"><strong>5</strong><span>分钟</span></div></div>${completed?starterSuccessMarkup(exercise,practice):`<div class="starter-grid"><article class="practice-card">${started?`<div class="original-label">本站原创 · 4 小节</div><div class="exercise-pattern">${exercise.pattern.map((item,index)=>`<div><span>${index+1}</span><strong>${escapeHtml(item)}</strong></div>`).join('')}</div><h3>跟着做</h3><ol>${exercise.steps.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ol><p class="practice-standard"><span>做到什么算会</span>${escapeHtml(exercise.standard)}</p><fieldset class="practice-check"><legend>你刚才做到了吗？</legend><label><input type="radio" name="starterResult" value="passed"> 做到了</label><label><input type="radio" name="starterResult" value="retry"> 还没有，再练一次</label></fieldset><button class="primary-btn full" id="recordStarterBtn" disabled>保存练习结果</button>`:`<h3>准备开始</h3><p>拿好贝斯，给自己 5 分钟。不追求速度，先把每一步做清楚。</p><p class="practice-standard"><span>做到什么算会</span>${escapeHtml(exercise.standard)}</p><button class="primary-btn full" id="startStarterBtn">开始5分钟练习</button>`}</article><aside class="starter-side-note"><strong>为什么先练这个</strong><p>${escapeHtml(exercise.reason)}</p><strong>谁来判断结果</strong><p>系统不会监听你的演奏。练完后，由你自己确认是否做到。</p><a href="diagnose.html">重新回答问题</a></aside></div>`}</section>`;
}

function starterSuccessMarkup(exercise,practice){
  if(!practice.passed)return `<section class="starter-success retry"><span class="success-mark">↻</span><p class="starter-kicker">练习已记录</p><h3>还差一步，再练一轮</h3><p>这次还没有达到完成标准。休息一下，再用相同方法练一轮。</p><button class="primary-btn" id="retryStarterBtn">继续练习</button></section>`;
  return `<section class="starter-success passed"><span class="success-mark">✓</span><p class="starter-kicker">今天练完了</p><h3>你已经做到：${escapeHtml(exercise.title)}</h3><p>你确认自己达到了标准：${escapeHtml(exercise.standard)}</p><div class="evidence-update"><span>练习结果已保存</span><strong>这是你的自评记录</strong><small>系统没有监听你的演奏。记录保存在这台设备上。</small></div><button class="primary-btn" data-jump="progress">查看我的练习</button><button class="text-btn" id="retryStarterBtn">再练一遍</button><p class="today-done-note">今天先到这里。下次回来继续下一步。</p></section>`;
}

function updateStarter(patch){
  const previous=state.storage.starter; state.storage.starter={...previous,...patch};
  if(!saveStorage()){state.storage.starter=previous;showToast('无法保存进度。请允许浏览器存储数据后再试。');return;}
  renderToday();
}
function recordStarterPractice(){
  const selected=$('input[name="starterResult"]:checked'); if(!selected)return;
  const passed=selected.value==='passed', diagnosis=state.storage.starter.diagnosis, exercise=STARTER_EXERCISES[diagnosis.route]||STARTER_EXERCISES.openStrings;
  const entry={type:'starter',exerciseId:diagnosis.route,title:exercise.title,date:todayKey(),minutes:5,mode:'真实贝斯 · 用户自评',passed,time:new Date().toISOString()};
  const previousPractice=state.storage.starter.practice;state.storage.starter.history||=[];state.storage.starter.history.push(entry);state.storage.starter.practice={started:true,completed:true,passed};
  if(!saveStorage()){state.storage.starter.history.pop();state.storage.starter.practice=previousPractice;renderToday();showToast('本次结果没有保存。请允许浏览器存储数据后再试。');return;}
  renderToday(); renderProgress(); showToast(passed?'练习已记录：你已达到本次标准':'练习已记录：下次继续完成同一标准');
}

function renderWeekChart(){
  const days=['一','二','三','四','五','六','日']; const now=new Date(); const monday=new Date(now); const day=(now.getDay()+6)%7; monday.setDate(now.getDate()-day);
  const values=[];
  for(let i=0;i<7;i++){ const d=new Date(monday); d.setDate(monday.getDate()+i); const key=todayKey(d); values.push(state.storage.history.filter(item=>item.date===key).reduce((sum,item)=>sum+(item.minutes||0),0)); }
  const max=Math.max(...values,30);
  $('#weekChart').innerHTML=values.map((value,index)=>`<div class="day-bar ${value?'active':''}"><i style="height:${Math.max(3,value/max*70)}px"></i><span>${days[index]}</span></div>`).join('');
  const total=values.reduce((a,b)=>a+b,0); $('#weekSummary').textContent=total?`本周已练习 ${total} 分钟，完成 ${values.filter(Boolean).length} 天。`:'本周尚未保存练习记录。';
}

function applyFilters(){
  if(!state.library) return;
  const query=$('#songSearch').value.trim().toLowerCase();
  const level=$('#levelFilter').value, ability=$('#abilityFilter').value, resource=$('#resourceFilter').value;
  state.filteredSongs=state.songs.filter(song=>{
    const hay=[song.title,...song.tags,...song.styles,song.curriculumNote,...(song.training?.rhythm||[]),...(song.training?.techniques||[])].join(' ').toLowerCase();
    return (!query||hay.includes(query))&&(level==='all'||song.level===Number(level))&&(ability==='all'||song.training?.abilityTags?.includes(ability))&&(resource==='all'||song.resources[resource]?.length);
  }); renderLibrary();
}

function resourceChips(song){
  const defs=[['PDF','pdf'],['GP','gp'],['伴奏','backing'],['原曲','original']];
  return defs.map(([label,key])=>`<span class="resource-chip ${song.resources[key].length?'available':''}">${label}</span>`).join('');
}
function renderLibrary(){
  $('#resultCount').textContent=`${state.filteredSongs.length} 首歌曲`;
  const header='<div class="song-row header"><span>歌曲</span><span>等级</span><span>BPM</span><span>训练重点</span><span>可用资源</span><span></span></div>';
  const rows=state.filteredSongs.map(song=>`<article class="song-row" data-song-id="${song.id}"><div class="song-title-cell"><strong>${escapeHtml(song.title)}</strong><span>${escapeHtml(trainingSummary(song))}</span></div><span class="level-pill">L${song.level}</span><span class="bpm-cell">${song.bpm||'—'}</span><span class="style-cell">${escapeHtml((song.training?.abilityTags||[]).slice(0,2).map(key=>ABILITY_DEFS[key].short).join(' / '))}</span><div class="resource-icons">${resourceChips(song)}</div><span class="row-arrow">›</span></article>`).join('');
  const table=$('#songTable'); table.className=`song-table ${state.view==='grid'?'grid-view':''}`; table.innerHTML=(state.view==='list'?header:'')+(rows||'<div class="empty-state">没有符合当前条件的歌曲</div>');
}

function openSong(id){
  const song=state.songs.find(item=>item.id===id); if(!song) return;
  state.selectedSong=song; const progress=songState(id); progress.lastOpened=new Date().toISOString(); saveStorage();
  state.loopA=state.loopB=null; state.loopActive=false; state.scoreView=song.resources.pdf.length?'pdf':song.resources.images.length?'images':'gp';
  renderPractice(); navigate('practice');
}

function renderPractice(){
  const song=state.selectedSong; if(!song) return;
  $('#practiceEmpty').classList.add('hidden'); $('#practiceWorkspace').classList.remove('hidden');
  $('#practiceTitle').textContent=song.title; $('#practiceMeta').textContent=`${song.bpm?`${song.bpm} BPM · `:''}${song.styles.join(' / ')} · ${song.folder}`;
  const abilityTags=(song.training?.abilityTags||[]).slice(0,3).map(key=>`<span class="tag ability">${ABILITY_DEFS[key].name}</span>`).join('');
  const trainingTags=[...(song.training?.rhythm||[]),...(song.training?.techniques||[])].slice(0,3).map(tag=>`<span class="tag">${escapeHtml(tag)}</span>`).join('');
  $('#practiceTags').innerHTML=`<span class="tag accent">Level ${song.level}</span>${abilityTags}${trainingTags}`;
  const progress=songState(song.id); $('#favoriteBtn').textContent=progress.favorite?'已收藏':'收藏';
  $('#completeBtn').textContent=progress.completed?'已通过验收':'尚未通过验收'; $('#completeBtn').classList.toggle('verified',progress.completed);
  $('#acceptanceState').textContent=progress.completed?'已验证':'练习中'; $('#acceptanceState').classList.toggle('verified',progress.completed);
  const bpm=progress.bestBpm||song.bpm||80; $('#practiceBpm').textContent=bpm; $('#goalBpm').value=bpm; practiceMetro.setBpm(bpm);
  $$('#scoreTabs button').forEach(btn=>btn.classList.toggle('active',btn.dataset.scoreView===state.scoreView));
  renderScore(); renderAudioOptions(); renderResources(); renderSongHistory();
}

function renderScore(){
  const song=state.selectedSong, viewer=$('#scoreViewer'), resources=song.resources;
  if(state.scoreView==='pdf'){
    if(resources.pdf.length){
      const pdfUrl=mediaUrl(resources.pdf[0]), detailUrl=scoreDetailUrl(resources.pdf[0],song.title);
      viewer.innerHTML=`<div class="pdf-score-wrap"><div class="pdf-score-actions"><span>${escapeHtml(fileName(resources.pdf[0]))}</span><a href="${escapeHtml(detailUrl)}">打开乐谱详情</a></div><iframe src="${pdfUrl}#toolbar=1&navpanes=0" title="${escapeHtml(song.title)} PDF 乐谱"></iframe></div>`;
    }else{
      viewer.innerHTML='<div class="file-placeholder"><strong>没有 PDF 乐谱</strong><span>可以切换到图片谱或 GP 文件。</span></div>';
    }
  }else if(state.scoreView==='images'){
    viewer.innerHTML=resources.images.length?`<div class="image-score-list">${resources.images.map(path=>`<img src="${mediaUrl(path)}" alt="${escapeHtml(fileName(path))}" loading="lazy">`).join('')}</div>`:'<div class="file-placeholder"><strong>没有图片谱</strong><span>当前歌曲没有单独的谱面图片。</span></div>';
  }else{
    viewer.innerHTML=resources.gp.length?`<div class="file-placeholder"><strong>Guitar Pro 文件</strong><span>${escapeHtml(fileName(resources.gp[0]))}</span><a class="primary-btn" href="${downloadUrl(resources.gp[0])}">下载并用 Guitar Pro 打开</a></div>`:'<div class="file-placeholder"><strong>没有 GP 文件</strong><span>请使用 PDF 或图片谱练习。</span></div>';
  }
}

function renderAudioOptions(){
  const song=state.selectedSong, options=[];
  song.resources.backing.forEach(path=>options.push({path,label:`无贝斯伴奏 · ${fileName(path)}`,type:'伴奏'}));
  song.resources.original.forEach(path=>options.push({path,label:`原曲 · ${fileName(path)}`,type:'原曲'}));
  const select=$('#audioSelect');
  select.innerHTML=options.length?options.map((item,index)=>`<option value="${escapeHtml(item.path)}" data-type="${item.type}">${escapeHtml(item.label)}</option>`).join(''):'<option value="">当前歌曲没有音频文件</option>';
  select.disabled=!options.length; loadSelectedAudio();
}
function loadSelectedAudio(){
  const select=$('#audioSelect'), audio=$('#audioPlayer'); audio.pause(); $('#playBtn').textContent='▶';
  if(!select.value){ audio.removeAttribute('src'); $('#audioModeLabel').textContent='没有可用音频'; return; }
  audio.src=mediaUrl(select.value); audio.playbackRate=1; $('#audioModeLabel').textContent=select.selectedOptions[0]?.dataset.type||'本地音频'; $$('#speedControl button').forEach(btn=>btn.classList.toggle('active',btn.dataset.speed==='1')); resetLoop();
}
function resetLoop(){ state.loopA=state.loopB=null; state.loopActive=false; $('#loopBtn').textContent='循环关闭'; renderLoopStatus(); }
function renderLoopStatus(){ $('#loopStatus').textContent=`A ${state.loopA==null?'—':formatTime(state.loopA)} · B ${state.loopB==null?'—':formatTime(state.loopB)}`; }

function renderResources(){
  const song=state.selectedSong, entries=[];
  [['PDF 乐谱','pdf'],['图片谱','images'],['Guitar Pro','gp'],['无贝斯伴奏','backing'],['原曲','original'],['教学视频','video']].forEach(([label,key])=>song.resources[key].forEach(path=>entries.push({label,path,key})));
  $('#resourceList').innerHTML=entries.length?entries.map(item=>{
    const href=item.key==='pdf'?scoreDetailUrl(item.path,song.title):item.key==='gp'?downloadUrl(item.path):mediaUrl(item.path);
    const target=['images','backing','original','video'].includes(item.key)?'target="_blank" rel="noreferrer"':'';
    return `<div class="resource-item"><div class="resource-name"><strong>${escapeHtml(fileName(item.path))}</strong><span>${item.label}</span></div><a href="${escapeHtml(href)}" ${target}>打开</a></div>`;
  }).join(''):'<div class="empty-state">没有识别到可用资源</div>';
}
function renderSongHistory(){
  const progress=songState(state.selectedSong.id), latest=(progress.sessions||[]).slice(-3).reverse();
  $('#songPracticeHistory').innerHTML=latest.length?latest.map(item=>`<div class="session-line"><span>${item.date} · ${item.bpm} BPM · ${item.minutes} 分钟</span><strong class="${item.passed?'passed':''}">${item.passed?'验收通过':item.result==='steady'?'稳定完成':item.result==='minor'?'有小错':'需要拆分'}</strong></div>`).join(''):'还没有保存过这首歌的练习。';
}

function recordPractice(){
  const song=state.selectedSong; if(!song)return;
  const bpm=Math.max(30,Math.min(260,Number($('#goalBpm').value)||80)), minutes=Math.max(1,Math.min(180,Number($('#practiceMinutes').value)||15));
  const result=$('#practiceResult').value, successRuns=Number($('#successRuns').value)||0, mode=$('#audioSelect').selectedOptions[0]?.dataset.type||'无音频';
  const passed=mode==='伴奏'&&result==='steady'&&successRuns>=3, date=todayKey(), time=new Date().toISOString();
  const entry={songId:song.id,title:song.title,date,bpm,minutes,result,successRuns,mode,passed,time};
  const progress=songState(song.id); progress.bestBpm=Math.max(progress.bestBpm||0,bpm); progress.sessions||=[]; progress.sessions.push(entry); progress.lastOpened=time;
  if(passed){progress.completed=true;progress.passedAt=time;}
  const beforeEvidence=abilityEvidence();
  state.storage.history.push(entry); saveStorage();
  const upgrades=abilityUpgrades(beforeEvidence,abilityEvidence());
  renderSongHistory(); renderPractice(); renderToday(); renderProgress(); renderRoadmap();
  showToast(upgrades[0]||(passed?`已记录：你确认连续稳定完成 3 遍`:`练习已保存。下一次从这里继续。`));
}

function renderProgress(){
  const allHistory=allPracticeHistory(), songEntries=Object.entries(state.storage.songs), completed=songEntries.filter(([,value])=>value.completed).length, sessions=allHistory.length, minutes=allHistory.reduce((sum,item)=>sum+(item.minutes||0),0), verified=allHistory.filter(item=>item.passed).length;
  $('#progressSummary').innerHTML=[['已验收曲目',completed],['练习证据',sessions],['累计分钟',minutes],['通过记录',verified]].map(([label,value])=>`<div class="progress-card"><span>${label}</span><strong>${value}</strong></div>`).join('');
  const evidence=abilityEvidence();
  const weakestKey=weakestAbility();
  $('#abilityGrid').innerHTML=Object.entries(ABILITY_DEFS).map(([key,ability])=>abilityCardMarkup(key,ability,evidence[key],weakestKey)).join('');
  const history=[...allHistory].sort((a,b)=>String(b.time).localeCompare(String(a.time))).slice(0,30);
  $('#historyList').innerHTML=history.length?history.map(item=>item.type==='starter'?`<div class="history-item"><strong>${escapeHtml(item.title)}</strong><span>5 分钟</span><span>${escapeHtml(item.mode)} · ${item.passed?'已完成实操':'继续练习'}</span></div>`:`<div class="history-item"><strong>${escapeHtml(item.title)}</strong><span>${item.bpm} BPM</span><span>${item.mode||'练习'} · ${item.passed?'验收通过':item.result==='steady'?'稳定':item.result==='minor'?'有小错':'需拆分'} · ${item.minutes} 分钟</span></div>`).join(''):'<div class="empty-state">完成第一次练习后，记录会显示在这里。</div>';
  $('#levelProgress').innerHTML=state.library?levelProgressRows():'<div class="empty-state compact-empty">曲库没有加载，但不会影响上面的新手练习记录。</div>';
  renderSimpleProgress(allHistory);
}

function renderSimpleProgress(allHistory=allPracticeHistory()){
  const root=$('#simpleProgress'); if(!root)return;
  const starterHistory=allHistory.filter(item=>item.type==='starter'), passed=starterHistory.filter(item=>item.passed), diagnosis=state.storage.starter?.diagnosis;
  const current=diagnosis?(STARTER_EXERCISES[diagnosis.route]||STARTER_EXERCISES.openStrings):null;
  const doneItems=[...new Map(passed.map(item=>[item.exerciseId,item])).values()];
  const doneMarkup=doneItems.length?doneItems.map(item=>{const currentTitle=STARTER_EXERCISES[item.exerciseId]?.title||item.title;return `<li><span>✓</span><div><strong>${escapeHtml(currentTitle)}</strong><small>${item.date||'已完成'} · 你确认已经做到</small></div></li>`;}).join(''):'<li class="empty-simple"><div><strong>还没有完成练习</strong><small>先做一次 3 分钟诊断，我们会给你一个 5 分钟练习。</small></div></li>';
  const completedIds=new Set(passed.map(item=>item.exerciseId)), starterOrder=['posture','openStrings','firstFiveFrets'], routeIndex=Math.max(0,starterOrder.indexOf(diagnosis?.route)), nextStarterId=starterOrder.slice(routeIndex).find(id=>!completedIds.has(id));
  const nextExercise=nextStarterId?STARTER_EXERCISES[nextStarterId]:null;
  const nextTitle=!diagnosis?'先找出今天练什么':nextExercise?nextExercise.title:'跟着拍子弹四根空弦';
  const nextReason=!diagnosis?'回答几个简单问题，找到适合你的起点。':nextExercise?nextExercise.reason:'三个起步练习已经完成。下一步只增加一个要求：跟稳拍子。';
  const nextCourse=completedIds.has('firstFiveFrets')?'s401':nextStarterId==='firstFiveFrets'?'s102':'s101';
  const nextAction=!diagnosis?'<a class="primary-btn simple-next-btn" href="diagnose.html">开始3分钟诊断</a>':nextExercise&&nextStarterId===diagnosis.route?'<button class="primary-btn simple-next-btn" data-jump="today">开始今天的练习</button>':`<a class="primary-btn simple-next-btn" href="course.html?lesson=${nextCourse}">学习下一步</a>`;
  root.innerHTML=`<section class="simple-progress-hero"><p class="starter-kicker">我的练习</p><h2>${doneItems.length?`你已经完成 ${doneItems.length} 项练习`:'先完成第一项练习'}</h2><p>这里只记录你真正练过、并由你确认达到标准的内容。</p></section><div class="simple-progress-grid"><section class="simple-done"><h3>你已经做到</h3><ul>${doneMarkup}</ul></section><section class="simple-next"><span>下一步</span><h3>${escapeHtml(nextTitle)}</h3><p>${escapeHtml(nextReason)}</p><small>预计 5 分钟</small>${nextAction}</section></div>`;
}

const NOTES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLATS={Db:'C#',Eb:'D#',Gb:'F#',Ab:'G#',Bb:'A#'};
const CHORDS={'':[0,4,7],m:[0,3,7],7:[0,4,7,10],m7:[0,3,7,10],maj7:[0,4,7,11],dim:[0,3,6],sus2:[0,2,7],sus4:[0,5,7]};
const STAGES=[
  {name:'原始形态',desc:'四拍根音',principle:'只弹<strong>根音</strong>，先让换和弦和拍点稳定。'},
  {name:'配合五音',desc:'根音与五音',principle:'在根音之间加入<strong>五音</strong>，获得稳定而开阔的轮廓。'},
  {name:'五音与八度',desc:'扩大音域',principle:'使用五音和<strong>八度音</strong>，但第一拍仍明确落在根音。'},
  {name:'四分音过渡',desc:'级进连接',principle:'第四拍加入<strong>调内经过音</strong>，连接下一小节的根音。'},
  {name:'八分音加花',desc:'五声音阶',principle:'使用<strong>小调或大调五声音阶</strong>增加旋律感，先保持四拍骨架。'},
  {name:'Dorian 色彩',desc:'六级音变化',principle:'在小和弦上尝试<strong>Dorian 大六度</strong>，形成更明亮的色彩。'},
  {name:'和弦琶音',desc:'三、五、七音',principle:'围绕<strong>和弦琶音</strong>构造方向明确的线条。'},
  {name:'休止与十六分',desc:'闷音和留白',principle:'加入<strong>休止、闷音和十六分音符</strong>。界面先显示音高骨架，节奏由演奏者处理。'}
];
const KEY_SCALES={C:['C','D','E','F','G','A','B'],G:['G','A','B','C','D','E','F#'],D:['D','E','F#','G','A','B','C#'],A:['A','B','C#','D','E','F#','G#'],E:['E','F#','G#','A','B','C#','D#'],F:['F','G','A','A#','C','D','E'],Am:['A','B','C','D','E','F','G'],Em:['E','F#','G','A','B','C','D'],Dm:['D','E','F','G','A','A#','C']};
function parseChord(token){ const match=token.trim().match(/^([A-Ga-g])([#b]?)(.*)$/); if(!match) return null; const root=FLATS[match[1].toUpperCase()+match[2]]||match[1].toUpperCase()+match[2]; const quality=CHORDS[match[3]]?match[3]:''; const index=NOTES.indexOf(root); return {token,root,quality,notes:CHORDS[quality].map(n=>NOTES[(index+n)%12])}; }
function stepToward(from,to,scale){ const a=NOTES.indexOf(from),b=NOTES.indexOf(to),dir=((b-a+12)%12)<=6?1:-1; for(let d=1;d<=2;d++){ const n=NOTES[(a+dir*d+12)%12]; if(scale.includes(n)) return n; } return NOTES[(a+dir+12)%12]; }
function labEvent(note,type,pulse,display=note){return {note,type,pulse,display};}
function generateMeasure(chord,next,stage,key,variant=0){
  const root=chord.root, rootIndex=NOTES.indexOf(root), third=chord.notes[1]||root, fifth=chord.notes.find(note=>(NOTES.indexOf(note)-rootIndex+12)%12===7)||chord.notes.at(-1), target=next.root, scale=KEY_SCALES[key]||KEY_SCALES.C, choice=variant%3;
  const q=['1','2','3','4'], eighth=['1','&','2','&','3','&','4','&'], event=(note,type,index,pulses=eighth,display=note)=>labEvent(note,type,pulses[index],display), rest=(index,pulses=eighth)=>labEvent('—','rest',pulses[index],'—'), mute=(index,pulses=eighth)=>labEvent('×','muted',pulses[index],'×');
  const belowTarget=NOTES[(NOTES.indexOf(target)+11)%12], passing=stepToward(fifth,target,scale), seventh=chord.notes[3]||NOTES[(rootIndex+10)%12], sixth=NOTES[(rootIndex+9)%12];
  if(stage===1){
    if(choice===0)return q.map((pulse,index)=>labEvent(root,'root',pulse));
    if(choice===1)return [event(root,'root',0,q,`${root}—`),rest(1,q),event(root,'root',2,q,`${root}—`),rest(3,q)];
    return [event(root,'root',0),rest(1),event(root,'root',2),event(root,'root',3),event(root,'root',4),rest(5),event(root,'root',6),rest(7)];
  }
  if(stage===2){
    const patterns=[[root,fifth,root,fifth],[root,root,fifth,root],[root,fifth,fifth,root]], pattern=patterns[choice];
    return pattern.map((note,index)=>event(note,note===root?'root':'chord',index,q));
  }
  if(stage===3){
    const patterns=[[{n:root,d:root},{n:fifth,d:fifth},{n:root,d:`${root}↑`},{n:fifth,d:fifth}],[{n:root,d:root},{n:root,d:`${root}↑`},{n:fifth,d:fifth},{n:root,d:root}],[{n:root,d:root},{n:fifth,d:fifth},{n:fifth,d:fifth},{n:root,d:`${root}↑`}]], pattern=patterns[choice];
    return pattern.map((item,index)=>event(item.n,item.n===fifth?'chord':'root',index,q,item.d));
  }
  if(stage===4){
    const patterns=[[root,third,fifth,passing],[root,fifth,third,belowTarget],[root,third,passing,belowTarget]], pattern=patterns[choice];
    return pattern.map((note,index)=>event(note,index===0?'root':index===3?(note===belowTarget?'approach':'passing'):'chord',index,q));
  }
  if(stage===5){
    const intervals=chord.quality.startsWith('m')?[0,3,5,7,10]:[0,2,4,7,9], penta=intervals.map(interval=>NOTES[(rootIndex+interval)%12]), patterns=[[0,2,3,2,0,1,2,1],[0,1,2,3,4,3,2,1],[0,2,1,3,2,4,3,1]], pattern=patterns[choice];
    return pattern.map((pentaIndex,index)=>event(penta[pentaIndex],pentaIndex===0?'root':penta[pentaIndex]===fifth?'chord':'passing',index));
  }
  if(stage===6){
    const dorian=[root,third,fifth,sixth,seventh], patterns=[[0,1,2,3,2,1,4,3],[0,2,3,4,3,2,1,0],[0,1,3,2,4,3,2,1]], pattern=patterns[choice];
    return pattern.map((noteIndex,index)=>event(dorian[noteIndex],noteIndex===0?'root':noteIndex===3?'passing':'chord',index));
  }
  if(stage===7){
    const arp=[root,third,fifth,seventh], patterns=[[0,1,2,3,2,1,0,3],[0,2,1,3,2,0,1,3],[0,1,3,2,1,0,2,3]], pattern=patterns[choice];
    return pattern.map((noteIndex,index)=>event(arp[noteIndex],noteIndex===0?'root':'chord',index));
  }
  const patterns=[
    [event(root,'root',0),mute(1),event(fifth,'chord',2),rest(3),event(root,'root',4),mute(5),event(fifth,'chord',6),event(belowTarget,'approach',7)],
    [event(root,'root',0),rest(1),mute(2),event(fifth,'chord',3),rest(4),event(root,'root',5),mute(6),event(belowTarget,'approach',7)],
    [event(root,'root',0),mute(1),rest(2),event(fifth,'chord',3),event(root,'root',4),rest(5),mute(6),event(belowTarget,'approach',7)]
  ];
  return patterns[choice];
}
function renderLab(){
  $('#stageControl').innerHTML=STAGES.map((stage,index)=>`<button class="stage-btn ${state.labStage===index+1?'active':''}" data-stage="${index+1}"><strong>${index+1}. ${stage.name}</strong><span>${stage.desc}</span></button>`).join('');
  generateLabLine();
}
function generateLabLine(){
  const chords=$('#chordInput').value.split(/[\s,，|]+/).filter(Boolean).map(parseChord).filter(Boolean); if(!chords.length){showToast('请输入有效和弦，例如 C Am F G');return;}
  const key=$('#labKey').value, stage=STAGES[state.labStage-1], variant=state.labVariant%3;
  const measures=chords.map((chord,index)=>generateMeasure(chord,chords[(index+1)%chords.length],state.labStage,key,variant));
  $('#lineExplanation').textContent=`阶段 ${state.labStage} · ${stage.name} · 线路变体 ${variant+1}/3`;
  $('#stagePrinciple').innerHTML=`${stage.principle}<p class="variant-note">当前变体 ${variant+1}，点击“换一条线路”可保持同一阶段并改变音型。</p>`;
  $('#generatedLine').innerHTML=measures.map((notes,index)=>`<article class="measure"><div class="measure-head"><strong>${escapeHtml(chords[index].token)}</strong><span>小节 ${index+1}</span></div><div class="beat-grid" style="--beat-count:${notes.length}">${notes.map(item=>`<div class="beat ${item.type}"><small>${item.pulse}</small><strong>${escapeHtml(item.display)}</strong></div>`).join('')}</div></article>`).join('');
  renderFretboard(measures.flat().filter(item=>NOTES.includes(item.note)));
}
function renderFretboard(items){
  const svg=$('#labFretboard'), strings=[['G',7],['D',2],['A',9],['E',4]], types={}; items.forEach(item=>{if(!types[item.note]||item.type==='root')types[item.note]=item.type});
  const colors={root:'#ff7267',chord:'#51cfb2',passing:'#6ea8ff',approach:'#f3bd5c'},W=760,H=230,left=36,right=10,top=28,bottom=18,fretW=(W-left-right)/12,gap=(H-top-bottom)/3; let out=`<rect width="${W}" height="${H}" rx="6" fill="#101318"/>`;
  for(let f=0;f<=12;f++){const x=left+f*fretW;out+=`<line x1="${x}" y1="${top}" x2="${x}" y2="${H-bottom}" stroke="${f===0?'#c9d0d7':'#343b43'}" stroke-width="${f===0?4:1}"/>`;if(f)out+=`<text x="${left+(f-.5)*fretW}" y="15" fill="#59636e" text-anchor="middle" font-size="9">${f}</text>`;}
  strings.forEach(([name,open],row)=>{const y=top+row*gap;out+=`<text x="${left-9}" y="${y}" fill="#89939e" text-anchor="end" dominant-baseline="central" font-size="11">${name}</text><line x1="${left}" y1="${y}" x2="${W-right}" y2="${y}" stroke="#69737d" stroke-width="${1.2+row*.45}"/>`;for(let f=0;f<=12;f++){const note=NOTES[(open+f)%12],x=f===0?left+10:left+(f-.5)*fretW,type=types[note];if(type)out+=`<circle cx="${x}" cy="${y}" r="11" fill="${colors[type]}"/><text x="${x}" y="${y}" fill="#07100e" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="800">${note}</text>`;else out+=`<text x="${x}" y="${y}" fill="#4d5660" text-anchor="middle" dominant-baseline="central" font-size="9">${note}</text>`;}}); svg.innerHTML=out;
}

function bindEvents(){
  document.addEventListener('click',event=>{
    const nav=event.target.closest('.nav-item'); if(nav){navigate(nav.dataset.page);return;}
    const jump=event.target.closest('[data-jump]'); if(jump){navigate(jump.dataset.jump);return;}
    const songEl=event.target.closest('[data-song-id]'); if(songEl){openSong(songEl.dataset.songId);return;}
    if(event.target.closest('#previewDoneBtn')){updateStarter({practice:{started:false,previewDone:true}});showToast('预习已完成：下次请拿贝斯完成实操');return;}
    if(event.target.closest('#bassReadyBtn')){updateStarter({diagnosis:{...state.storage.starter.diagnosis,hasBass:true},practice:{started:false,previewDone:true}});return;}
    if(event.target.closest('#startStarterBtn')){updateStarter({practice:{...state.storage.starter.practice,started:true,completed:false}});return;}
    if(event.target.closest('#recordStarterBtn')){recordStarterPractice();return;}
    if(event.target.closest('#retryStarterBtn')){updateStarter({practice:{...state.storage.starter.practice,started:true,completed:false}});return;}
  });
  document.addEventListener('change',event=>{if(event.target.name==='starterResult')$('#recordStarterBtn').disabled=false;});
  $('#rescanBtn').addEventListener('click',()=>loadLibrary(true));
  $('#songSearch').addEventListener('input',applyFilters); $('#levelFilter').addEventListener('change',applyFilters); $('#abilityFilter').addEventListener('change',applyFilters); $('#resourceFilter').addEventListener('change',applyFilters);
  $('#clearFiltersBtn').addEventListener('click',()=>{$('#songSearch').value='';$('#levelFilter').value='all';$('#abilityFilter').value='all';$('#resourceFilter').value='all';applyFilters();});
  $$('.view-toggle button').forEach(btn=>btn.addEventListener('click',()=>{state.view=btn.dataset.view;$$('.view-toggle button').forEach(x=>x.classList.toggle('active',x===btn));renderLibrary();}));
  $('#scoreTabs').addEventListener('click',event=>{const btn=event.target.closest('button[data-score-view]');if(!btn)return;state.scoreView=btn.dataset.scoreView;$$('#scoreTabs button').forEach(x=>x.classList.toggle('active',x===btn));renderScore();});
  $('#favoriteBtn').addEventListener('click',()=>{const s=songState(state.selectedSong.id);s.favorite=!s.favorite;saveStorage();renderPractice();showToast(s.favorite?'已加入收藏':'已取消收藏');});
  $('#completeBtn').addEventListener('click',()=>showToast(songState(state.selectedSong.id).completed?'你已记录：连续稳定完成 3 遍':'使用无贝斯伴奏稳定完成 3 遍后，再由你确认'));
  $('#audioSelect').addEventListener('change',loadSelectedAudio);
  const audio=$('#audioPlayer');
  $('#playBtn').addEventListener('click',async()=>{if(!audio.src)return;audio.paused?await audio.play():audio.pause();});
  audio.addEventListener('play',()=>$('#playBtn').textContent='Ⅱ'); audio.addEventListener('pause',()=>$('#playBtn').textContent='▶');
  audio.addEventListener('loadedmetadata',()=>{$('#durationTime').textContent=formatTime(audio.duration)});
  audio.addEventListener('timeupdate',()=>{if(audio.duration){$('#seekBar').value=audio.currentTime/audio.duration*1000;$('#currentTime').textContent=formatTime(audio.currentTime);}if(state.loopActive&&state.loopB!=null&&audio.currentTime>=state.loopB)audio.currentTime=state.loopA||0;});
  $('#seekBar').addEventListener('input',()=>{if(audio.duration)audio.currentTime=$('#seekBar').value/1000*audio.duration;});
  $('#restartBtn').addEventListener('click',()=>audio.currentTime=0); $('#skipBtn').addEventListener('click',()=>audio.currentTime=Math.min(audio.duration||Infinity,audio.currentTime+5));
  $('#speedControl').addEventListener('click',event=>{const btn=event.target.closest('button[data-speed]');if(!btn)return;audio.playbackRate=Number(btn.dataset.speed);$$('#speedControl button').forEach(x=>x.classList.toggle('active',x===btn));});
  $('#setABtn').addEventListener('click',()=>{state.loopA=audio.currentTime; if(state.loopB!=null&&state.loopB<=state.loopA)state.loopB=null;renderLoopStatus();});
  $('#setBBtn').addEventListener('click',()=>{if(state.loopA==null){showToast('请先设置 A 点');return;}state.loopB=audio.currentTime;if(state.loopB<=state.loopA){showToast('B 点必须在 A 点之后');state.loopB=null;}renderLoopStatus();});
  $('#loopBtn').addEventListener('click',()=>{if(state.loopA==null||state.loopB==null){showToast('请先设置 A、B 两个循环点');return;}state.loopActive=!state.loopActive;$('#loopBtn').textContent=state.loopActive?'循环开启':'循环关闭';});
  $('#savePracticeBtn').addEventListener('click',recordPractice);
  $$('[data-metro-step]').forEach(btn=>btn.addEventListener('click',()=>{quickMetro.setBpm(quickMetro.bpm+Number(btn.dataset.metroStep));if($('#quickBpm'))$('#quickBpm').textContent=quickMetro.bpm;}));
  if($('#quickMetroBtn'))$('#quickMetroBtn').addEventListener('click',()=>{$('#quickMetroBtn').textContent=quickMetro.toggle()?'停止节拍器':'启动节拍器';});
  $$('[data-practice-step]').forEach(btn=>btn.addEventListener('click',()=>{practiceMetro.setBpm(practiceMetro.bpm+Number(btn.dataset.practiceStep));$('#practiceBpm').textContent=practiceMetro.bpm;}));
  // Metronome removed in static deploy
  $('#stageControl').addEventListener('click',event=>{const btn=event.target.closest('[data-stage]');if(!btn)return;state.labStage=Number(btn.dataset.stage);state.labVariant=0;renderLab();});
  $('#generateLineBtn').addEventListener('click',()=>{state.labVariant=(state.labVariant+1)%3;generateLabLine();}); $('#chordInput').addEventListener('keydown',event=>{if(event.key==='Enter'){state.labVariant=(state.labVariant+1)%3;generateLabLine();}}); $('#labKey').addEventListener('change',()=>{state.labVariant=0;generateLabLine();});
}

function init(){
  const formatter=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'short'}); $('#dateChip').textContent=formatter.format(new Date());
  importDiagnosisHandoff(); bindEvents(); window.addEventListener('resize',()=>{if(state.page==='roadmap')drawAbilityRadar(abilityEvidence());}); renderToday(); renderLab(); loadLibrary();
}
init();






