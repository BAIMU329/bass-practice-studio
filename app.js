const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const STORAGE_KEY = 'bass-practice-studio-v1';

const PAGE_COPY = {
  today: ['今日练习','从已有资料中安排一套可以完成的练习。'],
  library: ['歌曲库','按等级、技术和本地资源筛选 188 首练习曲。'],
  practice: ['歌曲练习台','谱面、伴奏、循环、节拍器和练习记录集中在这里。'],
  lab: ['线路实验室','按照加花课件的顺序理解并生成 bass line。'],
  progress: ['练习记录','查看完成曲目、最高速度和本周练习节奏。'],
  roadmap: ['学习系统','从六维能力地图选择下一步最值得练习的内容。']
};
const ABILITY_DEFS = {
  fretboard: {name:'指板定位',short:'指板',description:'在任意调快速找到根、五、八度'},
  harmony: {name:'和声跟随',short:'和声',description:'看懂和弦进行并稳定跟随根音'},
  rhythm: {name:'节奏稳定',short:'节奏',description:'在目标速度保持拍点和音符密度'},
  technique: {name:'技术执行',short:'技术',description:'控制跨度、Slap、拨片与击勾弦'},
  expression: {name:'音乐表达',short:'表达',description:'用和弦音、经过音组织 bass line'},
  transfer: {name:'实战迁移',short:'迁移',description:'去掉原贝斯或换调后仍能完成'}
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
    return {songs:saved.songs||{},history:saved.history||[]};
  } catch { return {songs:{},history:[]}; }
}
function saveStorage(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.storage)); }
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
  Object.values(result).forEach(item=>{item.score=Math.min(100,Math.round((item.evidence+item.verified*.5)/12*100));}); return result;
}
function weakestAbility(){
  const evidence=abilityEvidence(); return Object.keys(ABILITY_DEFS).sort((a,b)=>evidence[a].score-evidence[b].score||evidence[a].evidence-evidence[b].evidence)[0];
}
function practiceDayNumber(){
  const dates=state.storage.history.map(item=>item.date).filter(Boolean).sort();
  if(!dates.length)return 1;
  const first=new Date(`${dates[0]}T00:00:00`), today=new Date(`${todayKey()}T00:00:00`);
  return Math.max(1,Math.floor((today-first)/86400000)+1);
}
function weekPracticeDays(){
  const now=new Date(), monday=new Date(now), offset=(now.getDay()+6)%7; monday.setHours(0,0,0,0); monday.setDate(now.getDate()-offset);
  const sunday=new Date(monday); sunday.setDate(monday.getDate()+7);
  return new Set(state.storage.history.filter(item=>{const time=new Date(`${item.date}T00:00:00`);return time>=monday&&time<sunday;}).map(item=>item.date)).size;
}
function levelProgressRows(){
  return [1,2,3,4,5,6,7].map(level=>{const songs=state.songs.filter(song=>song.level===level),done=songs.filter(song=>songState(song.id).completed).length,percent=songs.length?done/songs.length*100:0;return `<div class="level-row"><span>Level ${level}</span><div class="track"><span style="width:${percent}%"></span></div><span>${done}/${songs.length}</span></div>`;}).join('');
}
function abilityCardMarkup(key,ability,item,weakestKey){
  return `<article class="ability-card ${key===weakestKey?'weakest':''}"><div class="ability-card-head"><div><span>${ability.short}</span><strong>${ability.name}</strong></div><b>${item.score}%</b></div><p>${ability.description}</p><div class="ability-track"><span style="width:${item.score}%"></span></div><small>${item.attempts} 次练习 · ${Math.round(item.evidence)} 点证据 · ${item.verified} 次验收</small></article>`;
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
  keys.forEach((key,index)=>{const [x,y]=point(index,evidence[key].score/100);ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fillStyle='#51cfb2';ctx.fill();const [labelX,labelY]=point(index,1.22);ctx.fillStyle='#c9d0d7';ctx.font='600 11px Inter, system-ui, sans-serif';ctx.textAlign=labelX<centerX-8?'right':labelX>centerX+8?'left':'center';ctx.textBaseline=labelY<centerY?'bottom':'top';ctx.fillText(`${ABILITY_DEFS[key].short} ${evidence[key].score}`,labelX,labelY);});
}
function renderRoadmap(){
  if(!state.library)return;
  const evidence=abilityEvidence(), weakestKey=weakestAbility(), weakest=ABILITY_DEFS[weakestKey];
  $('#roadmapWeakest').textContent=`${weakest.name} · ${evidence[weakestKey].score} 分`;
  $('#roadmapAlert').classList.toggle('visible',evidence[weakestKey].score<30);
  $('#roadmapAbilityGrid').innerHTML=Object.entries(ABILITY_DEFS).map(([key,ability])=>abilityCardMarkup(key,ability,evidence[key],weakestKey)).join('');
  const recommendations=state.songs.filter(song=>(song.training?.abilityWeights?.[weakestKey]||0)>0&&!songState(song.id).completed).sort((a,b)=>(b.training.abilityWeights[weakestKey]-a.training.abilityWeights[weakestKey])||(a.level-b.level)).slice(0,5);
  $('#roadmapRecommendationNote').textContent=`围绕「${weakest.name}」选择五个尚未验收的训练场景。`;
  $('#roadmapRecommendations').innerHTML=recommendations.length?recommendations.map(song=>`<article class="roadmap-song" data-song-id="${song.id}"><div><strong>${escapeHtml(song.title)}</strong><span>${escapeHtml(trainingSummary(song))}</span></div><span>L${song.level}</span><span>${song.bpm||'—'} BPM</span><span class="backing-state">${song.resources.backing.length?'✓ 有伴奏':'× 无伴奏'}</span></article>`).join(''):'<div class="empty-state">当前短板暂无可推荐曲目，请先完善曲目能力标签。</div>';
  $('#roadmapLevelProgress').innerHTML=levelProgressRows();
  const scores=Object.values(evidence).map(item=>item.score), average=Math.round(scores.reduce((sum,value)=>sum+value,0)/scores.length), completed=state.songs.filter(song=>songState(song.id).completed).length, minutes=state.storage.history.reduce((sum,item)=>sum+(item.minutes||0),0);
  $('#roadmapStats').innerHTML=[['能力总分',average],['已验收曲目',`${completed}/${state.songs.length}`],['累计练习',`${minutes} 分钟`],['本周练习',`${weekPracticeDays()} 天`]].map(([label,value])=>`<div class="roadmap-stat"><span>${label}</span><strong>${value}</strong></div>`).join('');
  requestAnimationFrame(()=>drawAbilityRadar(evidence));
}
function trainingSummary(song){
  const parts=[...(song.training?.rhythm||[]),...(song.training?.techniques||[])]; if(song.training?.harmony)parts.push(song.training.harmony);
  return [...new Set(parts)].slice(0,3).join(' · ')||'基础综合练习';
}
function escapeHtml(value){ return String(value ?? '').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
function fileName(path){ return path.split('/').at(-1); }
function mediaUrl(path){ return `media/${path}`; }
function downloadUrl(path){ return `media/${path}`; }
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
  $('#libraryStatus').textContent=rescan?'重新扫描中':'正在读取资料库';
  try{
    const response=await fetch('./library.json');
    if(!response.ok) throw new Error('资料库读取失败');
    state.library=await response.json(); state.songs=state.library.songs; state.filteredSongs=[...state.songs]; migrateStorageIds();
    $('#libraryStatus').textContent=`已连接 · ${state.library.stats.songs} 首`;
    $('#libraryPath').textContent=state.library.libraryRoot;
    $('.status-dot').classList.add('ready');
    setupLevelFilter(); renderAll();
    if(rescan) showToast(`重新扫描完成：${state.songs.length} 首歌曲`);
  }catch(error){
    try{
      const response=await fetch('./library.json');
      if(!response.ok) throw new Error('公开曲库读取失败');
      state.demoMode=true;
      state.library=await response.json(); state.songs=state.library.songs; state.filteredSongs=[...state.songs]; migrateStorageIds();
      $('#libraryStatus').textContent=`公开体验 · ${state.library.stats.songs} 首`;
      $('#libraryPath').textContent='课程、分级曲库与训练工具可用';
      $('.status-dot').classList.add('ready');
      $('#rescanBtn').disabled=true;
      $('#rescanBtn').title='公开版不扫描本机文件';
      setupLevelFilter(); renderAll();
      showToast('已进入公开体验，谱面与音频仅在本地完整版提供');
    }catch(demoError){
      $('#libraryStatus').textContent='资料库连接失败'; $('#libraryPath').textContent=demoError.message; showToast(demoError.message);
    }
  }
}

function setupLevelFilter(){
  const select=$('#levelFilter');
  select.innerHTML='<option value="all">全部等级</option>'+[1,2,3,4,5,6,7].map(level=>`<option value="${level}">Level ${level}</option>`).join('');
  $('#abilityFilter').innerHTML='<option value="all">全部能力</option>'+Object.entries(ABILITY_DEFS).map(([key,item])=>`<option value="${key}">${item.name}</option>`).join('');
}

function renderAll(){ renderToday(); applyFilters(); renderProgress(); renderRoadmap(); if(state.selectedSong) renderPractice(); renderLab(); }

function navigate(page){
  state.page=page;
  $$('.nav-item').forEach(btn=>btn.classList.toggle('active',btn.dataset.page===page));
  $$('.page').forEach(section=>section.classList.toggle('active',section.id===`${page}Page`));
  $('#pageTitle').textContent=PAGE_COPY[page][0]; $('#pageSubtitle').textContent=PAGE_COPY[page][1];
  if(page==='progress') renderProgress();
  if(page==='roadmap') renderRoadmap();
  window.scrollTo({top:0,behavior:'smooth'});
}

function renderToday(){
  if(!state.library) return;
  const stats=state.library.stats, evidence=abilityEvidence(), focusKey=weakestAbility(), focus=ABILITY_DEFS[focusKey], focusData=evidence[focusKey];
  $('#libraryStats').innerHTML=[['歌曲',stats.songs],['无贝斯伴奏',stats.backing],['PDF 乐谱',stats.pdf],['GP 文件',stats.gp]].map(([label,value])=>`<div class="stat-card"><strong>${value}</strong><span>${label}</span></div>`).join('');
  $('#focusAbilityName').textContent=focus.name; $('#focusAbilityReason').textContent=focus.description;
  $('#focusAbilityEvidence').innerHTML=`<div class="evidence-meter"><span style="width:${focusData.score}%"></span></div><small>${focusData.attempts} 次相关练习 · ${Math.round(focusData.evidence)} 点证据</small>`;
  const dateFormatter=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'});
  $('#todayDateLabel').textContent=dateFormatter.format(new Date()); $('#practiceDayLabel').textContent=`练习第 ${practiceDayNumber()} 天`;
  $('#sessionHeadline').textContent=`今天补强：${focus.name}`; $('#sessionDescription').textContent=`从曲库中选择与「${focus.name}」关联度高、尚未验收的内容。`;
  $('#sessionMinutes').textContent='20'; renderWeekChart();
  const candidates=state.songs.filter(song=>(song.training?.abilityWeights?.[focusKey]||0)>0&&!songState(song.id).completed).sort((a,b)=>(b.training.abilityWeights[focusKey]-a.training.abilityWeights[focusKey])||(a.level-b.level));
  const pool=candidates.length?candidates:state.songs, start=(state.planOffset*2)%Math.max(pool.length,1), picks=[pool[start],pool[(start+1)%pool.length]].filter(Boolean);
  const plan=picks.map((song,index)=>({title:song.title,desc:index===0?`${trainingSummary(song)} · 先用 70% 速度定位难点`:song.resources.backing.length?`${trainingSummary(song)} · 最后用无贝斯伴奏检验`:`${trainingSummary(song)} · 设置 4–8 小节循环`,time:10,song}));
  $('#planList').innerHTML=plan.map((item,index)=>`<article class="plan-item" ${item.song?`data-song-id="${item.song.id}"`:`data-page-target="${item.page}"`}><span class="plan-index">${index+1}</span><div class="plan-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.desc)}</span></div><span class="plan-time">${item.time} 分钟</span></article>`).join('');
  const recentIds=Object.entries(state.storage.songs).filter(([,value])=>value.lastOpened&&!value.completed).sort((a,b)=>String(b[1].lastOpened).localeCompare(String(a[1].lastOpened))).slice(0,3).map(([id])=>id);
  const cards=recentIds.map(id=>state.songs.find(song=>song.id===id)).filter(Boolean), display=cards.length?cards:picks;
  $('#continueList').innerHTML=display.map(song=>{const progress=songState(song.id),percent=progress.completed?100:Math.min(85,(progress.sessions?.length||0)*22+12);return `<article class="continue-card" data-song-id="${song.id}"><span class="level-label">${progress.completed?'已验收':`LEVEL ${song.level}`}</span><strong>${escapeHtml(song.title)}</strong><p>${trainingSummary(song)}</p><div class="mini-progress"><span style="width:${percent}%"></span></div></article>`;}).join('')||'<div class="empty-state">资料库中暂无可显示歌曲</div>';
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
    viewer.innerHTML=resources.pdf.length?`<iframe src="${mediaUrl(resources.pdf[0])}#toolbar=1&navpanes=0" title="${escapeHtml(song.title)} PDF 乐谱"></iframe>`:'<div class="file-placeholder"><strong>没有 PDF 乐谱</strong><span>可以切换到图片谱或 GP 文件。</span></div>';
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
  $('#resourceList').innerHTML=entries.length?entries.map(item=>`<div class="resource-item"><div class="resource-name"><strong>${escapeHtml(fileName(item.path))}</strong><span>${item.label}</span></div><a href="${item.key==='gp'?downloadUrl(item.path):mediaUrl(item.path)}" ${item.key==='gp'?'':'target="_blank"'}>打开</a></div>`).join(''):'<div class="empty-state">没有识别到可用资源</div>';
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
  showToast(upgrades[0]||(passed?`验收通过：${song.title}`:`已保存能力证据：${song.title}`));
}

function renderProgress(){
  if(!state.library) return;
  const songEntries=Object.entries(state.storage.songs), completed=songEntries.filter(([,value])=>value.completed).length, sessions=state.storage.history.length, minutes=state.storage.history.reduce((sum,item)=>sum+(item.minutes||0),0), verified=state.storage.history.filter(item=>item.passed).length;
  $('#progressSummary').innerHTML=[['已验收曲目',completed],['练习证据',sessions],['累计分钟',minutes],['通过记录',verified]].map(([label,value])=>`<div class="progress-card"><span>${label}</span><strong>${value}</strong></div>`).join('');
  const evidence=abilityEvidence();
  const weakestKey=weakestAbility();
  $('#abilityGrid').innerHTML=Object.entries(ABILITY_DEFS).map(([key,ability])=>abilityCardMarkup(key,ability,evidence[key],weakestKey)).join('');
  const history=[...state.storage.history].sort((a,b)=>String(b.time).localeCompare(String(a.time))).slice(0,30);
  $('#historyList').innerHTML=history.length?history.map(item=>`<div class="history-item"><strong>${escapeHtml(item.title)}</strong><span>${item.bpm} BPM</span><span>${item.mode||'练习'} · ${item.passed?'验收通过':item.result==='steady'?'稳定':item.result==='minor'?'有小错':'需拆分'} · ${item.minutes} 分钟</span></div>`).join(''):'<div class="empty-state">完成一次歌曲练习后，能力证据会显示在这里。</div>';
  $('#levelProgress').innerHTML=levelProgressRows();
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
  });
  $('#rescanBtn').addEventListener('click',()=>loadLibrary(true));
  $('#refreshPlanBtn').addEventListener('click',()=>{state.planOffset++;renderToday();});
  $('#songSearch').addEventListener('input',applyFilters); $('#levelFilter').addEventListener('change',applyFilters); $('#abilityFilter').addEventListener('change',applyFilters); $('#resourceFilter').addEventListener('change',applyFilters);
  $('#clearFiltersBtn').addEventListener('click',()=>{$('#songSearch').value='';$('#levelFilter').value='all';$('#abilityFilter').value='all';$('#resourceFilter').value='all';applyFilters();});
  $$('.view-toggle button').forEach(btn=>btn.addEventListener('click',()=>{state.view=btn.dataset.view;$$('.view-toggle button').forEach(x=>x.classList.toggle('active',x===btn));renderLibrary();}));
  $('#scoreTabs').addEventListener('click',event=>{const btn=event.target.closest('button[data-score-view]');if(!btn)return;state.scoreView=btn.dataset.scoreView;$$('#scoreTabs button').forEach(x=>x.classList.toggle('active',x===btn));renderScore();});
  $('#favoriteBtn').addEventListener('click',()=>{const s=songState(state.selectedSong.id);s.favorite=!s.favorite;saveStorage();renderPractice();showToast(s.favorite?'已加入收藏':'已取消收藏');});
  $('#completeBtn').addEventListener('click',()=>showToast(songState(state.selectedSong.id).completed?'这首歌已通过无贝斯验收':'使用无贝斯伴奏稳定完成 3 遍即可通过'));
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
  $$('[data-metro-step]').forEach(btn=>btn.addEventListener('click',()=>{quickMetro.setBpm(quickMetro.bpm+Number(btn.dataset.metroStep));$('#quickBpm').textContent=quickMetro.bpm;}));
  $('#quickMetroBtn').addEventListener('click',()=>{$('#quickMetroBtn').textContent=quickMetro.toggle()?'停止节拍器':'启动节拍器';});
  $$('[data-practice-step]').forEach(btn=>btn.addEventListener('click',()=>{practiceMetro.setBpm(practiceMetro.bpm+Number(btn.dataset.practiceStep));$('#practiceBpm').textContent=practiceMetro.bpm;}));
  // Metronome removed in static deploy
  $('#stageControl').addEventListener('click',event=>{const btn=event.target.closest('[data-stage]');if(!btn)return;state.labStage=Number(btn.dataset.stage);state.labVariant=0;renderLab();});
  $('#generateLineBtn').addEventListener('click',()=>{state.labVariant=(state.labVariant+1)%3;generateLabLine();}); $('#chordInput').addEventListener('keydown',event=>{if(event.key==='Enter'){state.labVariant=(state.labVariant+1)%3;generateLabLine();}}); $('#labKey').addEventListener('change',()=>{state.labVariant=0;generateLabLine();});
}

function init(){
  const formatter=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'short'}); $('#dateChip').textContent=formatter.format(new Date());
  $('#quickBpm').textContent=quickMetro.bpm; bindEvents(); window.addEventListener('resize',()=>{if(state.page==='roadmap')drawAbilityRadar(abilityEvidence());}); renderLab(); loadLibrary();
}
init();



