const STORAGE_KEY = 'paoyan_apply_panel_v19_stability';
const SETTINGS_KEY = 'paoyan_apply_panel_settings_v20';
const IDB_NAME = 'paoyan-apply-panel';
const IDB_STORE = 'snapshots';
const IDB_DATA_KEY = 'latest';
const stages = ['了解/待投递','申请准备中','已投递/等待初筛','初筛通过/进入复试','复试准备中','已复试/等待结果','获得Offer','已结束'];
const types = ['夏令营','预推免','九推','直博','推免'];
const priorities = ['高','中','低'];
const screeningResults = ['未知','入营','进入复试','未入营','放弃'];
const finalResults = ['未知','优营','Offer','拟录取','候补','未通过','放弃'];
const itemStatuses = ['未准备','准备中','已完成','已提交'];
const baseMaterials = ['个人简历','本科成绩单','专业排名证明','英语水平证明','个人陈述','推荐信','科研成果证明','获奖证书','身份证/学生证'];
const defaultInterviewTasks = ['入营确认','补充材料提交','中文自我介绍','英文自我介绍','科研经历问答','专业课复习','PPT汇报','面试设备测试'];
let projects = [];
let currentPage = 'home';
let currentEditId = null;
let materialView = 'application';
let sortState = { key:'nextNode', dir:'asc' };
let calendarMonth = new Date(); calendarMonth.setDate(1);
let folderSearch = '';
let pendingImportProjects = [];
let todayReminderShown = false; 
let loadedFromPersistedStorage = false;
let filters = { search:'', stage:'全部阶段', type:'全部类型', screening:'全部初筛', priority:'全部优先级' };

function uid(){ return 'p' + Math.random().toString(36).slice(2,9); }
function pad(n){ return String(n).padStart(2,'0'); }
function today(){ const d=new Date(); d.setHours(0,0,0,0); return d; }
function toDate(v){ if(!v) return null; const d = new Date(String(v).replace(' ','T')); return isNaN(d) ? null : d; }
function dateInput(v){ const d=toDate(v); if(!d) return ''; return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function dtInput(v){ const d=toDate(v); if(!d) return ''; return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fmtDate(v){ const d=toDate(v); if(!d) return '待填写'; const hasTime = String(v).includes(':'); return hasTime ? `${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}` : `${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function daysBetween(d){ if(!d) return 99999; return Math.ceil((d.getTime() - new Date().getTime())/86400000); }
function escapeHtml(s=''){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function cssTag(text, kind){ return `<span class="tag ${kind}">${escapeHtml(text||'未知')}</span>`; }
function tagClass(type, val){
  if(type==='stage') return {'了解/待投递':'tag-gray','申请准备中':'tag-blue','已投递/等待初筛':'tag-blue','初筛通过/进入复试':'tag-green','复试准备中':'tag-purple','已复试/等待结果':'tag-orange','获得Offer':'tag-green','已结束':'tag-gray'}[val]||'tag-gray';
  if(type==='type') return {夏令营:'tag-blue',预推免:'tag-purple',九推:'tag-orange'}[val]||'tag-gray';
  if(type==='screen') return ['入营','进入复试'].includes(val)?'tag-green':val==='未入营'?'tag-red':val==='放弃'?'tag-gray':'tag-gray';
  if(type==='final') return ['优营','Offer','拟录取'].includes(val)?'tag-green':val==='候补'?'tag-orange':val==='未通过'?'tag-red':val==='放弃'?'tag-gray':'tag-gray';
  if(type==='priority') return val==='高'?'tag-red':val==='中'?'tag-orange':'tag-gray';
  if(type==='item') return val==='已提交'||val==='已完成'?'tag-green':val==='准备中'?'tag-blue':'tag-gray';
  return 'tag-gray';
}
function progress(list=[]){ const total=list.length; const done=list.filter(x=>['已完成','已提交'].includes(x.status)).length; return {done,total,pct: total?Math.round(done/total*100):0}; }
function progressHtml(list=[], label='项', disabled=false){
  if(disabled) return `<span class="not-started">未开启</span>`;
  const p=progress(list); const done=p.total>0 && p.done===p.total;
  return `<div class="progress-box"><div class="top"><span>${p.done}/${p.total}</span><small>${p.pct}%</small></div><div class="progress-bar ${done?'done':''}"><span style="width:${p.pct}%"></span></div></div>`;
}
function makeItem(name,status='未准备'){ return {name,status}; }
function normalizeMaterialFolder(folder){
  folder = folder || {};
  return {
    name: folder.name || '',
    path: folder.path || folder.folderPath || '',
    linkedAt: folder.linkedAt || '',
    files: []
  };
}
function demoProjects(){
  return [
    {id:uid(),school:'上海交通大学',college:'安泰经济与管理学院',direction:'金融学',type:'夏令营',priority:'高',stage:'申请准备中',note:'需英语成绩，今天截止。',infoUrl:'https://example.com/notice/sjtu',applyUrl:'https://example.com/apply/sjtu',application:{deadline:'2026-05-30T12:00',resultPublishTime:'2026-06-08',screeningResult:'未知',materials:[makeItem('个人简历','已完成'),makeItem('本科成绩单','已完成'),makeItem('专业排名证明','已完成'),makeItem('英语水平证明','准备中'),makeItem('个人陈述','准备中'),makeItem('推荐信','未准备'),makeItem('申请表','准备中'),makeItem('科研成果证明','未准备'),makeItem('获奖证书','未准备')]},interview:{enabled:false,location:'待通知',materialDeadline:'',startTime:'2026-06-12T09:00',endTime:'2026-06-13T17:00',finalResultPublishTime:'',offerConfirmDeadline:'',finalResult:'未知',tasks:[]}},
    {id:uid(),school:'清华大学',college:'计算机系',direction:'人工智能',type:'夏令营',priority:'高',stage:'初筛通过/进入复试',note:'含机试与面试，重点准备英文自我介绍。',infoUrl:'https://example.com/notice/thu',applyUrl:'https://example.com/apply/thu',application:{deadline:'2026-06-10T17:00',resultPublishTime:'2026-06-15',screeningResult:'入营',materials:baseMaterials.concat(['申请表']).map(x=>makeItem(x,'已完成'))},interview:{enabled:true,location:'清华大学计算机系/线上会议',materialDeadline:'2026-06-18T17:00',startTime:'2026-06-20T09:00',endTime:'2026-06-22T17:30',finalResultPublishTime:'2026-06-25',offerConfirmDeadline:'2026-06-28T17:00',finalResult:'未知',tasks:[makeItem('入营确认','已完成'),makeItem('补充材料提交','准备中'),makeItem('中文自我介绍','已完成'),makeItem('英文自我介绍','准备中'),makeItem('科研经历问答','未准备'),makeItem('专业课复习','未准备'),makeItem('PPT汇报','未准备'),makeItem('面试设备测试','未准备')]}},
    {id:uid(),school:'浙江大学',college:'计算机学院',direction:'软件工程',type:'预推免',priority:'中',stage:'已复试/等待结果',note:'已参加复试，等待最终结果公布。',infoUrl:'https://example.com/notice/zju',applyUrl:'https://example.com/apply/zju',application:{deadline:'2026-06-12T17:00',resultPublishTime:'2026-06-18',screeningResult:'进入复试',materials:baseMaterials.concat(['申请表']).map(x=>makeItem(x,'已完成'))},interview:{enabled:true,location:'浙江大学紫金港校区',materialDeadline:'2026-06-21T17:00',startTime:'2026-06-24T14:00',endTime:'2026-06-26T16:30',finalResultPublishTime:'2026-06-30',offerConfirmDeadline:'',finalResult:'未知',tasks:defaultInterviewTasks.map((x,i)=>makeItem(x,i<5?'已完成':'准备中'))}},
    {id:uid(),school:'北京大学',college:'信息科学技术学院',direction:'数据科学',type:'夏令营',priority:'高',stage:'已投递/等待初筛',note:'需提交论文摘要。',infoUrl:'https://example.com/notice/pku',applyUrl:'https://example.com/apply/pku',application:{deadline:'2026-06-05T23:59',resultPublishTime:'2026-06-20',screeningResult:'未知',materials:baseMaterials.concat(['论文摘要']).map((x,i)=>makeItem(x,i<7?'已完成':'准备中'))},interview:{enabled:false,location:'待通知',materialDeadline:'',startTime:'2026-06-15T09:00',endTime:'2026-06-17T17:00',finalResultPublishTime:'',offerConfirmDeadline:'',finalResult:'未知',tasks:[]}},
    {id:uid(),school:'复旦大学',college:'新闻学院',direction:'传播学',type:'预推免',priority:'中',stage:'初筛通过/进入复试',note:'含笔试和面试。',infoUrl:'https://example.com/notice/fdu',applyUrl:'https://example.com/apply/fdu',application:{deadline:'2026-06-08T23:59',resultPublishTime:'2026-06-12',screeningResult:'入营',materials:baseMaterials.slice(0,8).map(x=>makeItem(x,'已完成'))},interview:{enabled:true,location:'复旦大学新闻学院/线下',materialDeadline:'2026-06-16T18:00',startTime:'2026-06-18T08:30',endTime:'2026-06-19T17:00',finalResultPublishTime:'2026-06-24',offerConfirmDeadline:'',finalResult:'未知',tasks:['入营确认','补充材料提交','中文自我介绍','英文自我介绍','作品集整理','新闻热点准备','论文答辩准备'].map((x,i)=>makeItem(x,i<3?'已完成':'未准备'))}},
    {id:uid(),school:'中国科学技术大学',college:'电子工程学院',direction:'集成电路设计',type:'夏令营',priority:'高',stage:'申请准备中',note:'优先准备推荐信。',infoUrl:'https://example.com/notice/ustc',applyUrl:'https://example.com/apply/ustc',application:{deadline:'2026-06-03T17:00',resultPublishTime:'2026-06-20',screeningResult:'未知',materials:[makeItem('个人简历','已完成'),makeItem('本科成绩单','已完成'),makeItem('专业排名证明','未准备'),makeItem('英语水平证明','未准备'),makeItem('推荐信','准备中'),makeItem('个人陈述','未准备'),makeItem('科研成果证明','未准备'),makeItem('申请表','未准备'),makeItem('身份证/学生证','已完成')]},interview:{enabled:false,location:'待通知',materialDeadline:'',startTime:'2026-06-13T09:00',endTime:'2026-06-15T17:00',finalResultPublishTime:'',offerConfirmDeadline:'',finalResult:'未知',tasks:[]}}
  ];
}
function normalizeProject(p){
  p.application = p.application || {}; p.interview = p.interview || {}; p.urls = p.urls || {};
  p.application.materials = p.application.materials || baseMaterials.map(x=>makeItem(x));
  p.application.screeningResult = p.application.screeningResult || '未知';
  p.interview.enabled = !!p.interview.enabled;
  p.interview.location = p.interview.location || '';
  p.interview.tasks = p.interview.tasks || [];
  p.interview.finalResult = p.interview.finalResult || '未知';
  p.materialFolder = normalizeMaterialFolder(p.materialFolder);
  p.stage = normalizeStage(p.stage); applyStageAutomation(p, p.stage);
  p.infoUrl = p.infoUrl || p.urls.infoUrl || ''; p.applyUrl = p.applyUrl || p.urls.applyUrl || '';
  return p;
}
function defaultSettings(){ return {backupIntervalDays:7,lastBackupAt:'',notificationEnabled:false,lastBackupReminderAt:''}; }
function getSettings(){
  try{ return {...defaultSettings(), ...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}; }
  catch{ return defaultSettings(); }
}
function saveSettings(next){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({...getSettings(), ...next}));
  renderDataCenter();
}
function backupPayload(){ return {version:'v20-open-source',exportedAt:new Date().toISOString(),projects}; }
function openDb(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){ reject(new Error('当前浏览器不支持 IndexedDB')); return; }
    const req=indexedDB.open(IDB_NAME,1);
    req.onupgradeneeded=()=>req.result.createObjectStore(IDB_STORE);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function writeIndexedDbSnapshot(){
  try{
    const db=await openDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(IDB_STORE,'readwrite');
      tx.objectStore(IDB_STORE).put({savedAt:new Date().toISOString(),projects}, IDB_DATA_KEY);
      tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
    });
    db.close();
  }catch(e){}
}
async function readIndexedDbSnapshot(){
  try{
    const db=await openDb();
    const result=await new Promise((resolve,reject)=>{
      const tx=db.transaction(IDB_STORE,'readonly');
      const req=tx.objectStore(IDB_STORE).get(IDB_DATA_KEY);
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
    db.close();
    return result;
  }catch(e){ return null; }
}
function load(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY) || localStorage.getItem('paoyan_apply_panel_v17_folder_jump') || localStorage.getItem('paoyan_apply_panel_v10_smart_flow') || localStorage.getItem('paoyan_apply_panel_v9') || localStorage.getItem('paoyan_apply_panel_v8');
    loadedFromPersistedStorage=!!raw;
    projects=raw?JSON.parse(raw).map(normalizeProject):demoProjects();
    if(raw) save(false);
  }catch{projects=demoProjects();}
}
function save(show=true){ localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); writeIndexedDbSnapshot(); if(show){ const s=document.getElementById('saveStatus'); s.textContent='● 已自动保存'; showToast('已自动保存'); } }
function showToast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),2000); }
function getAllNodes(p){
  const arr=[]; const add=(name,date,type)=>{ const d=toDate(date); if(d) arr.push({project:p,name,date:d,type}); };
  add('申请截止',p.application.deadline,'deadline'); add('名单公布',p.application.resultPublishTime,'publish');
  if(p.interview.enabled){ add('复试材料截止',p.interview.materialDeadline,'interviewMaterial'); add('复试开始',p.interview.startTime,'interviewStart'); add('最终结果公布',p.interview.finalResultPublishTime,'finalPublish'); add('Offer确认截止',p.interview.offerConfirmDeadline,'offerDeadline'); }
  return arr;
}
function validFutureNode(p, name, date, type){ const d=toDate(date); return d && d>=new Date() ? {project:p,name,date:d,type} : null; }
function nextNode(p){
  p.stage=normalizeStage(p.stage);
  if(p.stage==='已结束') return null;
  let candidates=[];
  const push=(name,date,type)=>{ const n=validFutureNode(p,name,date,type); if(n) candidates.push(n); };
  if(['了解/待投递','申请准备中'].includes(p.stage)) push('申请截止',p.application.deadline,'deadline');
  if(p.stage==='已投递/等待初筛') push('名单公布',p.application.resultPublishTime,'publish');
  if(['初筛通过/进入复试','复试准备中'].includes(p.stage)){
    push('复试材料截止',p.interview.materialDeadline,'interviewMaterial');
    push('复试开始',p.interview.startTime,'interviewStart');
    push('复试结束',p.interview.endTime,'interviewEnd');
    push('最终结果公布',p.interview.finalResultPublishTime,'finalPublish');
  }
  if(p.stage==='已复试/等待结果') push('最终结果公布',p.interview.finalResultPublishTime,'finalPublish');
  if(p.stage==='获得Offer') push('Offer确认截止',p.interview.offerConfirmDeadline,'offerDeadline');
  if(candidates.length) return candidates.sort((a,b)=>a.date-b.date)[0];
  const fallback=getAllNodes(p).filter(n=>n.date>=new Date()).sort((a,b)=>a.date-b.date);
  return fallback[0] || null;
}
function allFutureNodes(){ return projects.map(nextNode).filter(Boolean).sort((a,b)=>a.date-b.date || ({高:0,中:1,低:2}[a.project.priority]-({高:0,中:1,低:2}[b.project.priority]))); }
function nodeText(n){ if(!n) return '<span class="muted">暂无节点</span>'; const d=daysBetween(n.date); const cls=d<=1?'urgent':d<=3?'soon':''; return `<div class="node ${cls}">${escapeHtml(n.name)}：${fmtDate(n.date.toISOString())}<small>${daysLabel(n.date)}</small></div>`; }
function daysLabel(date){ const d=daysBetween(date); if(d<0) return `已过 ${Math.abs(d)} 天`; if(d===0) return '今天'; if(d===1) return '明天'; return `${d} 天后`; }
function allScheduleNodes(){ return projects.flatMap(getAllNodes).sort((a,b)=>a.date-b.date); }
function projectName(p){ return `${p.school||''}${p.college?` - ${p.college}`:''}`; }
function setOptions(id, arr, first){ const el=document.getElementById(id); if(!el) return; el.innerHTML=(first?[first]:[]).concat(arr).map(x=>`<option value="${x}">${x}</option>`).join(''); }
function initOptions(){
  setOptions('stageFilter', stages, '全部阶段'); setOptions('typeFilter', types, '全部类型'); setOptions('screenFilter', screeningResults, '全部初筛'); setOptions('priorityFilter', priorities, '全部优先级');
  setOptions('fType', types); setOptions('fStage', stages); setOptions('fPriority', priorities); setOptions('fScreening', screeningResults); setOptions('fFinal', finalResults);
}
function filteredProjects(){
  let list=[...projects]; const q=filters.search.trim().toLowerCase();
  if(q) list=list.filter(p=>[p.school,p.college,p.direction,p.type,p.stage,p.note].join(' ').toLowerCase().includes(q));
  if(filters.stage!=='全部阶段') list=list.filter(p=>p.stage===filters.stage);
  if(filters.type!=='全部类型') list=list.filter(p=>p.type===filters.type);
  if(filters.screening!=='全部初筛') list=list.filter(p=>p.application.screeningResult===filters.screening);
  if(filters.priority!=='全部优先级') list=list.filter(p=>p.priority===filters.priority);
  return sortList(list);
}
function valueForSort(p,key){
  const n=nextNode(p);
  const map={school:p.school,direction:p.direction,type:p.type,stage:p.stage,nextNode:n?n.date.getTime():9999999999999,screening:p.application.screeningResult,final:p.interview.finalResult,appProgress:progress(p.application.materials).pct,intProgress:p.interview.enabled?progress(p.interview.tasks).pct:-1,priority:{高:3,中:2,低:1}[p.priority]||0,note:p.note||''};
  return map[key] ?? '';
}
function sortList(list){ return list.sort((a,b)=>{ const av=valueForSort(a,sortState.key), bv=valueForSort(b,sortState.key); return (av>bv?1:av<bv?-1:0)*(sortState.dir==='asc'?1:-1); }); }
function sortableTh(label,key){ return `<th data-sort="${key}">${label}${sortState.key===key?(sortState.dir==='asc'?' ↑':' ↓'):''}</th>`; }
function renderProjectTable(){
  const list=filteredProjects();
  const head=`<thead><tr>${sortableTh('学校（学院）','school')}${sortableTh('方向','direction')}${sortableTh('类型','type')}${sortableTh('当前阶段','stage')}${sortableTh('下一节点','nextNode')}${sortableTh('初筛结果','screening')}${sortableTh('最终结果','final')}${sortableTh('申请材料','appProgress')}${sortableTh('复试准备','intProgress')}${sortableTh('优先级','priority')}${sortableTh('备注','note')}<th>操作</th></tr></thead>`;
  const rows=list.map(p=>`<tr><td class="school-cell"><b>${escapeHtml(p.school)}</b><span>${escapeHtml(p.college)}</span></td><td>${escapeHtml(p.direction)}</td><td>${cssTag(p.type,tagClass('type',p.type))}</td><td>${cssTag(p.stage,tagClass('stage',p.stage))}</td><td>${nodeText(nextNode(p))}</td><td>${cssTag(p.application.screeningResult,tagClass('screen',p.application.screeningResult))}</td><td>${cssTag(p.interview.finalResult,tagClass('final',p.interview.finalResult))}</td><td>${progressHtml(p.application.materials)}</td><td>${progressHtml(p.interview.tasks,'项',!p.interview.enabled)}</td><td>${cssTag(p.priority,tagClass('priority',p.priority))}</td><td class="note-cell" title="${escapeHtml(p.note||'')}">${escapeHtml(p.note||'')}</td><td><button class="action-icon" data-edit="${p.id}" title="详情/编辑">✎</button></td></tr>`).join('');
  document.getElementById('projectTable').innerHTML=head+`<tbody>${rows||`<tr><td colspan="12" class="muted">暂无项目</td></tr>`}</tbody>`;
}
function renderHome(){
  const total=projects.length||1; const appDone=Math.round(projects.reduce((s,p)=>s+progress(p.application.materials).pct,0)/total); const interviewProjects=projects.filter(p=>p.interview.enabled); const intDone=interviewProjects.length?Math.round(interviewProjects.reduce((s,p)=>s+progress(p.interview.tasks).pct,0)/interviewProjects.length):0; const waiting=projects.filter(p=>p.stage==='已复试/等待结果').length; const offers=projects.filter(p=>['Offer','优营','拟录取'].includes(p.interview.finalResult)).length;
  const cards=[['总项目数',projects.length,Math.min(100,projects.length/20*100),'blue'],['申请材料完成率',appDone+'%',appDone,'green'],['已入营项目',interviewProjects.length,Math.min(100,interviewProjects.length/8*100),'purple'],['复试准备完成率',intDone+'%',intDone,'orange'],['等待最终结果',waiting,Math.min(100,waiting/5*100),'red']];
  document.getElementById('homeSummary').innerHTML=cards.map(c=>`<div class="summary-card"><div class="label">${c[0]}</div><div class="num">${c[1]}</div><div class="bar ${c[3]}"><i style="width:${c[2]}%"></i></div></div>`).join('');
  renderPriorityCards();
  const actions=allFutureNodes().slice(0,5).map(n=>`<div class="action-item"><div><b>${escapeHtml(projectName(n.project))}</b><div class="muted">${escapeHtml(n.name)} · ${fmtDate(n.date.toISOString())}</div></div>${cssTag(daysBetween(n.date)<=1?'紧急':daysBetween(n.date)<=3?'近期':'计划',daysBetween(n.date)<=1?'tag-red':daysBetween(n.date)<=3?'tag-orange':'tag-blue')}</div>`).join('');
  document.getElementById('nextActions').innerHTML=actions||'<div class="empty-card">暂无近期节点</div>';
  const counts=stages.map(st=>[st,projects.filter(p=>p.stage===st).length]).filter(x=>x[1]);
  document.getElementById('stageOverview').innerHTML=counts.map(([st,n])=>`<div class="stage-item"><span>${cssTag(st,tagClass('stage',st))}</span><b>${n}</b></div>`).join('')||'<div class="empty-card">暂无阶段数据</div>';
}
function renderPriorityCards(){
  const nodes=allFutureNodes().slice(0,3);
  document.getElementById('priorityCards').innerHTML=nodes.map(n=>{ const d=daysBetween(n.date); const cls=d<=1?'danger':d<=3?'warn':''; const label=d<=0?'今天':d===1?'明天':`还有 ${d} 天`; return `<div class="priority-card ${cls}" data-open-node="${n.project.id}"><h3>${escapeHtml(projectName(n.project))}</h3><p>${escapeHtml(n.name)} · ${fmtDate(n.date.toISOString())}</p><strong>${label}</strong></div>`; }).join('') + (nodes.length<3?`<div class="empty-card">+ 规划下一个项目</div>`.repeat(3-nodes.length):'');
}
function renderInterview(){
  const list=projects.filter(p=>p.interview.enabled || ['入营','进入复试'].includes(p.application.screeningResult) || ['初筛通过/进入复试','复试准备中','已复试/等待结果','获得Offer'].includes(p.stage));
  const soon=list.filter(p=>{const d=daysBetween(toDate(p.interview.startTime)); return d>=0&&d<=7;}).length;
  document.getElementById('interviewStats').innerHTML=[['复试准备中',list.filter(p=>['初筛通过/进入复试','复试准备中'].includes(p.stage)).length],['即将复试',soon],['等待最终结果',list.filter(p=>p.stage==='已复试/等待结果').length]].map(x=>`<div class="mini-card"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');
  const timeCell=(v)=>{ const d=toDate(v); return `<div class="date-stack"><b>${fmtDate(v)}</b>${d?'<small>'+daysLabel(d)+'</small>':''}</div>`; };
  const interviewRange=(p)=>`<div class="date-range">${timeCell(p.interview.startTime)}<span class="muted">至</span>${timeCell(p.interview.endTime)}</div>`;
  const rows=list.map(p=>`<tr><td class="school-cell"><b>${escapeHtml(p.school)}</b><span>${escapeHtml(p.college)}</span></td><td>${escapeHtml(p.direction)}</td><td class="location-cell">${escapeHtml(p.interview.location||'待填写')}</td><td class="mono">${interviewRange(p)}</td><td class="mono ${daysBetween(toDate(p.interview.materialDeadline))<=3?'soon':''}">${timeCell(p.interview.materialDeadline)}</td><td>${progressHtml(p.interview.tasks,'项',!p.interview.enabled)}</td><td class="mono">${timeCell(p.interview.finalResultPublishTime)}</td><td>${cssTag(p.interview.finalResult,tagClass('final',p.interview.finalResult))}</td><td class="note-cell" title="${escapeHtml(p.note||'')}">${escapeHtml(p.note||'')}</td><td><button class="action-icon" data-edit="${p.id}" title="详情/编辑">✎</button></td></tr>`).join('');
  document.getElementById('interviewTable').innerHTML=`<thead><tr><th>学校（学院）</th><th>方向</th><th>复试地点</th><th>复试时间</th><th>复试材料截止</th><th>复试准备</th><th>最终结果公布</th><th>最终结果</th><th>备注</th><th>操作</th></tr></thead><tbody>${rows||'<tr><td colspan="10" class="muted">暂无入营/复试项目</td></tr>'}</tbody>`;
}
function renderMaterials(){
  const useInt=materialView==='interview';
  const list=useInt?projects.filter(p=>p.interview.enabled):projects;
  const rows=list.map(p=>{ const arr=useInt?p.interview.tasks:p.application.materials; const pg=progress(arr); const undone=arr.filter(x=>!['已完成','已提交'].includes(x.status)).map(x=>x.name).slice(0,4).join('、') || '无'; return `<tr><td class="school-cell"><b>${escapeHtml(p.school)}</b><span>${escapeHtml(p.college)}</span></td><td>${progressHtml(arr,'项',useInt&&!p.interview.enabled)}</td><td>${escapeHtml(undone)}</td><td class="row-actions"><button class="action-icon" data-edit="${p.id}" title="查看/编辑">✎</button>${!(useInt&&!p.interview.enabled)?`<button class="success-mini" data-complete-project="${p.id}" data-kind="${useInt?'interview':'application'}">一键完成</button>`:''}</td></tr>`; }).join('');
  document.getElementById('materialsTable').innerHTML=`<thead><tr><th>项目</th><th>${useInt?'复试准备进度':'申请材料进度'}</th><th>未完成${useInt?'任务':'材料'}</th><th>操作</th></tr></thead><tbody>${rows||'<tr><td colspan="4" class="muted">暂无数据</td></tr>'}</tbody>`;
}

function folderProjectName(p){ return `${p.school || '未命名学校'} ${p.college || ''}`.trim(); }
function folderBaseName(path=''){
  const clean=String(path||'').trim().replace(/[\\/]+$/,'');
  if(!clean) return '';
  if(clean.startsWith('file://')){
    const decoded=decodeURIComponent(clean.replace(/^file:\/\//,''));
    return decoded.split(/[\\/]/).filter(Boolean).pop() || '材料文件夹';
  }
  return clean.split(/[\\/]/).filter(Boolean).pop() || clean || '材料文件夹';
}
function folderPathToFileUrl(path=''){
  let raw=String(path||'').trim();
  if(!raw) return '';
  if(/^file:\/\//i.test(raw)) return raw;
  if(/^[A-Za-z]:[\\/]/.test(raw)){
    raw=raw.replace(/\\/g,'/');
    return 'file:///' + encodeURI(raw);
  }
  if(/^\\\\/.test(raw)){
    raw=raw.replace(/\\/g,'/');
    return 'file:' + encodeURI(raw);
  }
  if(raw.startsWith('/')) return 'file://' + encodeURI(raw);
  return encodeURI(raw);
}
function folderPathHtml(folder){
  if(!folder.path) return '<span class="muted">未设置路径</span>';
  return `<code class="folder-path-text" title="${escapeHtml(folder.path)}">${escapeHtml(folder.path)}</code>`;
}
function renderFolderOpenBox(p){
  const folder=normalizeMaterialFolder(p.materialFolder);
  if(!folder.path){
    return '<div class="empty-folder">尚未设置本地材料文件夹路径。点击“设置路径”，填写电脑中的文件夹路径后，可直接跳转打开。</div>';
  }
  return `<div class="folder-open-box">
    <div class="folder-big-icon">📁</div>
    <div class="folder-open-main">
      <b>${escapeHtml(folder.name || folderBaseName(folder.path) || '材料文件夹')}</b>
      ${folderPathHtml(folder)}
      <small>网页不会读取文件夹内部文件，只保存路径用于快速跳转。</small>
    </div>
    <div class="folder-open-actions">
      <button class="primary-mini" data-open-folder="${p.id}">打开文件夹</button>
      <button class="tiny-link" data-copy-folder="${p.id}">复制路径</button>
    </div>
  </div>`;
}
function renderFolderPage(){
  const box=document.getElementById('folderPanel'); if(!box) return;
  const q=folderSearch.trim().toLowerCase();
  let list=[...projects];
  if(q){
    list=list.filter(p=>[p.school,p.college,p.direction,p.note,(p.materialFolder?.name||''),(p.materialFolder?.path||'')].join(' ').toLowerCase().includes(q));
  }
  box.innerHTML=list.map(p=>{
    const folder=normalizeMaterialFolder(p.materialFolder);
    const app=progress(p.application.materials), it=progress(p.interview.tasks);
    const linked=!!folder.path;
    return `<div class="folder-card">
      <div class="folder-card-head">
        <div><h3>${escapeHtml(folderProjectName(p))}</h3><p>${escapeHtml(p.direction)} · ${escapeHtml(p.type)} · ${cssTag(p.stage,tagClass('stage',p.stage))}</p></div>
        <div class="folder-actions"><button class="icon-btn" data-link-folder="${p.id}">${linked?'修改路径':'设置路径'}</button><button class="icon-btn" data-open-folder="${p.id}" ${linked?'':'disabled'}>打开文件夹</button><button class="tiny-danger" data-clear-folder="${p.id}" ${linked?'':'disabled'}>清除</button></div>
      </div>
      <div class="folder-meta-row">
        <span>📁 ${linked?escapeHtml(folder.name || folderBaseName(folder.path)):'未设置材料文件夹'}</span>
        <span>申请材料 ${app.done}/${app.total}</span>
        <span>复试准备 ${p.interview.enabled?`${it.done}/${it.total}`:'未开启'}</span>
      </div>
      ${renderFolderOpenBox(p)}
    </div>`;
  }).join('') || '<div class="empty-card">没有匹配的项目</div>';
}
function renderFolderTab(p){
  const el=document.getElementById('folderTab'); if(!el) return;
  const folder=normalizeMaterialFolder(p.materialFolder);
  el.innerHTML=`<div class="folder-tab-box">
    <div class="folder-tab-head"><div><b>材料整理文件夹</b><p>设置本地文件夹路径后，可从系统中一键跳转打开该文件夹；不会读取内部文件。</p></div><div class="folder-actions"><button class="icon-btn" data-link-folder="${p.id}">${folder.path?'修改路径':'设置路径'}</button><button class="icon-btn" data-open-folder="${p.id}" ${folder.path?'':'disabled'}>打开文件夹</button><button class="tiny-danger" data-clear-folder="${p.id}" ${folder.path?'':'disabled'}>清除</button></div></div>
    <div class="folder-meta-row"><span>📁 ${folder.path?escapeHtml(folder.name || folderBaseName(folder.path)):'未设置'}</span><span class="muted">本功能只跳转文件夹，不扫描文件列表。</span></div>
    ${renderFolderOpenBox(p)}
  </div>`;
}
async function linkFolderToProject(id){
  const p=projects.find(x=>x.id===id); if(!p) return;
  const old=normalizeMaterialFolder(p.materialFolder);
  const input=prompt('请输入本地材料文件夹路径：\n\nMac 示例：/Users/你的名字/Documents/保研材料/清华大学\nWindows 示例：D:\\保研材料\\清华大学\n也可以填写 file:/// 开头的本地地址。', old.path || '');
  if(input===null) return;
  const path=input.trim();
  if(!path){ showToast('未填写文件夹路径'); return; }
  const name=folderBaseName(path) || old.name || '材料文件夹';
  p.materialFolder={name, path, linkedAt:new Date().toISOString(), files:[]};
  save(); renderAll(); if(currentEditId===id) renderFolderTab(p);
  showToast(`已设置文件夹：${name}`);
}
function refreshProjectFolder(id){
  showToast('当前版本不读取文件夹内部文件，直接点击“打开文件夹”即可。');
}
function clearProjectFolder(id){
  const p=projects.find(x=>x.id===id); if(!p) return;
  p.materialFolder=normalizeMaterialFolder(null);
  save(); renderAll(); if(currentEditId===id) renderFolderTab(p);
  showToast('已清除文件夹路径');
}
function copyText(text){
  if(navigator.clipboard && window.isSecureContext){ return navigator.clipboard.writeText(text); }
  const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); return Promise.resolve();
}
function copyFolderPath(id){
  const p=projects.find(x=>x.id===id); const folder=normalizeMaterialFolder(p?.materialFolder);
  if(!folder.path){ showToast('暂无文件夹路径'); return; }
  copyText(folder.path).then(()=>showToast('已复制文件夹路径'));
}
function openFolderPath(id){
  const p=projects.find(x=>x.id===id); const folder=normalizeMaterialFolder(p?.materialFolder);
  if(!folder.path){ showToast('请先设置文件夹路径'); return; }
  const url=folderPathToFileUrl(folder.path);
  const opened=window.open(url,'_blank');
  if(!opened){ copyFolderPath(id); alert('浏览器可能拦截了本地文件夹跳转，已复制路径。请粘贴到浏览器地址栏、访达/Finder 或资源管理器中打开。'); }
}
function renderSchedule(){
  const nodes=allScheduleNodes().filter(n=>n.project.stage!=='已结束' || n.date>=new Date());
  renderScheduleCalendar(nodes);
  const future=nodes.filter(n=>n.date>=new Date()).sort((a,b)=>a.date-b.date);
  const groups={}; future.forEach(n=>{ const d=daysBetween(n.date); const key=d<=0?'今天':d===1?'明天':d<=7?'未来7天':'更晚'; (groups[key]=groups[key]||[]).push(n); });
  const html=Object.entries(groups).map(([day,arr])=>`<div class="day-group"><div class="day-title">${day}</div>${arr.map(n=>`<div class="schedule-item" data-open-node="${n.project.id}"><div><b>${escapeHtml(projectName(n.project))}</b><span>${escapeHtml(n.name)} · ${fmtDate(n.date.toISOString())} · ${daysLabel(n.date)}</span></div>${cssTag(daysBetween(n.date)<=1?'紧急':daysBetween(n.date)<=3?'近期':'计划',daysBetween(n.date)<=1?'tag-red':daysBetween(n.date)<=3?'tag-orange':'tag-blue')}</div>`).join('')}</div>`).join('');
  document.getElementById('scheduleList').innerHTML=html||'<div class="empty-card">暂无未来日程节点</div>';
}
function renderScheduleCalendar(nodes){
  const title=document.getElementById('calendarTitle'), box=document.getElementById('scheduleCalendar'); if(!title||!box) return;
  const y=calendarMonth.getFullYear(), m=calendarMonth.getMonth(); title.textContent=`${y}年${m+1}月日程表`;
  const first=new Date(y,m,1); const start=new Date(first); start.setDate(1-first.getDay());
  const days=[]; for(let i=0;i<42;i++){ const d=new Date(start); d.setDate(start.getDate()+i); days.push(d); }
  const nodesByDay={}; nodes.forEach(n=>{ const k=`${n.date.getFullYear()}-${pad(n.date.getMonth()+1)}-${pad(n.date.getDate())}`; (nodesByDay[k]=nodesByDay[k]||[]).push(n); });
  const week='<div class="calendar-week calendar-head"><b>日</b><b>一</b><b>二</b><b>三</b><b>四</b><b>五</b><b>六</b></div>';
  const cells=days.map(d=>{ const k=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; const arr=(nodesByDay[k]||[]).slice(0,3); const muted=d.getMonth()!==m?'muted-day':''; const todayCls=d.toDateString()===new Date().toDateString()?'today-cell':''; return `<div class="calendar-cell ${muted} ${todayCls}"><div class="date-num">${d.getDate()}</div>${arr.map(n=>`<button class="calendar-event ${n.type}" data-open-node="${n.project.id}" title="${escapeHtml(projectName(n.project))}：${escapeHtml(n.name)}">${escapeHtml(n.name)} · ${escapeHtml(n.project.school)}</button>`).join('')}${(nodesByDay[k]||[]).length>3?`<small class="more-events">+${(nodesByDay[k]||[]).length-3}项</small>`:''}</div>`; }).join('');
  box.innerHTML=week+`<div class="calendar-grid">${cells}</div>`;
}
function renderAll(){ renderHome(); renderProjectTable(); renderInterview(); renderMaterials(); renderFolderPage(); renderSchedule(); }
function stageHintText(stage){
  return {
    '了解/待投递':'当前还在了解项目，只需记录基础信息、申请截止和链接，其他字段会在后续阶段自动解锁。',
    '申请准备中':'正在准备申请材料，请优先完成申请材料清单并关注申请截止时间。',
    '已投递/等待初筛':'申请已提交，请等待名单公布；初筛结果出来后再更新。',
    '初筛通过/进入复试':'恭喜进入复试！系统已开启复试准备清单，请补充复试材料截止和复试时间。',
    '复试准备中':'请集中完成复试任务，并重点关注复试材料截止和复试开始时间。',
    '已复试/等待结果':'复试已结束，请填写最终结果公布时间，并等待最终结果。',
    '获得Offer':'🎉 恭喜获得 Offer！请填写 Offer 确认截止时间，避免错过确认。',
    '已结束':'该项目已结束，将不再进入优先处理提醒。'
  }[stage] || '';
}
function stageTaskHtml(p){
  const st=normalizeStage(p.stage), n=nextNode(p), app=progress(p.application.materials), it=progress(p.interview.tasks);
  if(st==='了解/待投递') return `<div class="task-card"><b>先记录基本信息</b><span>建议填写申请截止、信息网址和报名地址。</span></div><div class="task-card">${nodeText(n)}</div>`;
  if(st==='申请准备中') return `<div class="task-card"><b>申请材料</b>${progressHtml(p.application.materials)}<span>优先补齐未完成材料。</span></div><div class="task-card">${nodeText(n)}</div>`;
  if(st==='已投递/等待初筛') return `<div class="task-card"><b>等待初筛</b><span>请填写名单公布时间，出结果后更新初筛结果。</span></div><div class="task-card">${nodeText(n)}</div>`;
  if(st==='初筛通过/进入复试' || st==='复试准备中') return `<div class="task-card"><b>复试准备</b>${progressHtml(p.interview.tasks,'项',!p.interview.enabled)}<span>补充复试时间，并推进复试任务。</span></div><div class="task-card">${nodeText(n)}</div>`;
  if(st==='已复试/等待结果') return `<div class="task-card"><b>等待最终结果</b><span>请填写最终结果公布时间和最终结果。</span></div><div class="task-card">${nodeText(n)}</div>`;
  if(st==='获得Offer') return `<div class="task-card success"><b>已获得 Offer</b><span>请确认 Offer 截止时间并做好最终选择。</span></div><div class="task-card">${nodeText(n)}</div>`;
  return `<div class="task-card"><b>项目已结束</b><span>保留历史记录，不再进入提醒。</span></div>`;
}
function renderStageStepper(p){
  const stage=normalizeStage(p.stage); let idx=stageIndex(stage); let doneUntil=idx;
  let terminated=false;
  if(stage==='已结束'){
    terminated=true;
    if(isNegativeScreen(p.application.screeningResult) && !isPositiveFinal(p.interview.finalResult)) doneUntil=2;
    else if(isNegativeFinal(p.interview.finalResult)) doneUntil=5;
    else doneUntil=idx;
  }
  document.getElementById('stageStepper').innerHTML=stages.map((st,i)=>{
    const done=!terminated ? i<idx : i<=doneUntil && i<idx;
    const current=i===idx;
    const stopped=terminated && i===idx;
    const blocked=terminated && i>doneUntil && i<idx;
    return `<div class="step ${done?'done':''} ${current?'current':''} ${stopped?'stopped':''} ${blocked?'blocked':''}"><i>${i+1}</i><span>${escapeHtml(st)}</span></div>`;
  }).join('');
}
function applyDetailLocks(p){
  const idx=stageIndex(p.stage);
  const lock=(el, yes)=>{ if(!el) return; el.disabled=!!yes; el.closest('label')?.classList.toggle('locked',!!yes); };
  [fSchool,fCollege,fDirection,fType,fPriority,fInfoUrl,fApplyUrl,fNote,fDeadline].forEach(el=>lock(el,false));
  lock(fResultPub, idx<1);
  lock(fScreening, !(idx===2));
  [fInterviewMatDeadline,fInterviewStart,fInterviewEnd,fFinalPub].forEach(el=>lock(el,idx<3));
  lock(fFinal, idx<5);
  lock(fOfferDeadline, idx<6);
}
function renderSmartDetail(p){
  renderStageStepper(p);
  document.getElementById('stageHint').textContent=stageHintText(p.stage);
  const n=nextNode(p);
  document.getElementById('smartNextNode').innerHTML=n?`${escapeHtml(n.name)} · ${fmtDate(n.date.toISOString())}`:'暂无节点';
  document.getElementById('currentTasksPanel').innerHTML=stageTaskHtml(p);
  applyDetailLocks(p);
}
function openDetail(id){
  currentEditId=id; const p=projects.find(x=>x.id===id); if(!p) return;
  applyStageAutomation(p,p.stage);
  document.getElementById('detailTitle').textContent=`${p.school} ${p.college}｜项目详情`;
  document.getElementById('detailSub').textContent=`${p.direction} · ${p.type}`;
  fSchool.value=p.school||''; fCollege.value=p.college||''; fDirection.value=p.direction||''; fType.value=p.type||types[0]; fStage.value=p.stage||stages[0]; fPriority.value=p.priority||'中'; fScreening.value=p.application.screeningResult||'未知'; fFinal.value=p.interview.finalResult||'未知';
  fDeadline.value=dtInput(p.application.deadline); fResultPub.value=dateInput(p.application.resultPublishTime); fInterviewMatDeadline.value=dtInput(p.interview.materialDeadline); fInterviewLocation.value=p.interview.location||''; fInterviewStart.value=dtInput(p.interview.startTime); fInterviewEnd.value=dtInput(p.interview.endTime); fFinalPub.value=dateInput(p.interview.finalResultPublishTime); fOfferDeadline.value=dtInput(p.interview.offerConfirmDeadline);
  fInfoUrl.value=p.infoUrl||''; fApplyUrl.value=p.applyUrl||''; fNote.value=p.note||''; if(document.getElementById('detailNoticeText')) detailNoticeText.value='';
  renderListEditor('appMats', p.application.materials, 'application', stageIndex(p.stage)<1);
  renderListEditor('intTasks', p.interview.tasks, 'interview', !p.interview.enabled || stageIndex(p.stage)<3);
  renderFolderTab(p);
  renderSmartDetail(p);
  document.getElementById('detailModal').classList.remove('hidden');
}
function renderListEditor(containerId, arr, kind, disabled=false){
  const el=document.getElementById(containerId);
  if(disabled){ const msg=kind==='application'?'申请材料尚未开启。将当前阶段切换为“申请准备中”后，系统会引导你准备材料。':'复试准备尚未开启。进入“初筛通过/进入复试”后，系统会自动生成复试准备清单。'; const btn=kind==='interview'?'<br><button class="primary-btn add-line" data-enable-interview="1">开启复试准备</button>':''; el.innerHTML=`<div class="empty-card">${msg}${btn}</div>`; return; }
  const label = kind==='application'?'材料':'任务';
  const tools = `<div class="list-tools"><button class="icon-btn add-line" data-add-item="${kind}">+ 新增${label}</button><button class="success-btn add-line" data-complete-list="${kind}">一键完成</button></div>`;
  el.innerHTML=tools + arr.map((it,i)=>`<div class="check-row" data-kind="${kind}" data-i="${i}"><input value="${escapeHtml(it.name)}" data-item-name /><select data-item-status>${itemStatuses.map(s=>`<option ${it.status===s?'selected':''}>${s}</option>`).join('')}</select><button class="tiny-danger" data-del-item>×</button></div>`).join('');
}
function enableInterview(p){ if(!p.interview.enabled){ p.interview.enabled=true; p.interview.tasks=defaultInterviewTasks.map(x=>makeItem(x)); } }
function stageIndex(stage){ const i=stages.indexOf(stage); return i<0?0:i; }
function normalizeStage(stage){ const map={'待评估':'了解/待投递','申请准备':'申请准备中','已提交待初筛':'已投递/等待初筛','已入营待复试':'初筛通过/进入复试','复试结束待结果':'已复试/等待结果'}; return map[stage] || stage || '了解/待投递'; }
function isPositiveScreen(v){ return ['入营','进入复试'].includes(v); }
function isNegativeScreen(v){ return ['未入营','放弃'].includes(v); }
function isPositiveFinal(v){ return ['Offer','优营','拟录取'].includes(v); }
function isNegativeFinal(v){ return ['未通过','放弃'].includes(v); }
function applyStageAutomation(p, previousStage=''){
  p.stage = normalizeStage(p.stage);
  p.application.screeningResult = p.application.screeningResult || '未知';
  p.interview.finalResult = p.interview.finalResult || '未知';
  const prevIdx = previousStage ? stageIndex(normalizeStage(previousStage)) : stageIndex(p.stage);
  let idx = stageIndex(p.stage);

  // 允许用户退回阶段：退回到复试或 Offer 之前时，自动清除后续结果，防止再次被结果字段推回。
  if(previousStage && idx < prevIdx){
    if(idx < 6 && isPositiveFinal(p.interview.finalResult)) p.interview.finalResult = '未知';
    if(idx < 5 && p.interview.finalResult && p.interview.finalResult !== '未知') p.interview.finalResult = '未知';
    if(idx < 3 && isPositiveScreen(p.application.screeningResult)) p.application.screeningResult = '未知';
    if(idx < 3){ p.interview.enabled = false; }
  }

  // 结果字段优先级最高：最终结果 > 初筛结果 > 当前阶段。
  if(isPositiveFinal(p.interview.finalResult)){
    p.stage = '获得Offer';
    if(!isPositiveScreen(p.application.screeningResult)) p.application.screeningResult = '进入复试';
    enableInterview(p);
  }else if(isNegativeFinal(p.interview.finalResult)){
    p.stage = '已结束';
    if(!isPositiveScreen(p.application.screeningResult)) p.application.screeningResult = '进入复试';
    enableInterview(p);
  }else if(isPositiveScreen(p.application.screeningResult)){
    enableInterview(p);
    if(stageIndex(p.stage) < 3 || p.stage === '已投递/等待初筛') p.stage = '初筛通过/进入复试';
  }else if(isNegativeScreen(p.application.screeningResult)){
    p.stage = '已结束';
  }

  idx = stageIndex(p.stage);
  if(idx>=1 && (!p.application.materials || !p.application.materials.length)) p.application.materials=baseMaterials.map(x=>makeItem(x));
  if(idx>=3 && p.stage!=='已结束'){
    if(!isPositiveScreen(p.application.screeningResult)) p.application.screeningResult='进入复试';
    enableInterview(p);
  }
  if(p.stage==='已投递/等待初筛' && !isPositiveScreen(p.application.screeningResult) && !isNegativeScreen(p.application.screeningResult)){
    p.application.screeningResult = '未知';
    p.interview.finalResult = '未知';
  }
  if(p.stage==='已复试/等待结果' && !['未知','候补'].includes(p.interview.finalResult)) p.interview.finalResult='未知';
  if(p.stage==='获得Offer'){
    enableInterview(p);
    if(!isPositiveFinal(p.interview.finalResult)) p.interview.finalResult='Offer';
    if(previousStage && previousStage!==p.stage) showToast('🎉 恭喜获得 Offer！记得填写确认截止时间。');
  }
}
function collectDetail(){
  const p=projects.find(x=>x.id===currentEditId); if(!p) return null;
  const prevStage=p.stage;
  Object.assign(p,{school:fSchool.value.trim(),college:fCollege.value.trim(),direction:fDirection.value.trim(),type:fType.value,stage:fStage.value,priority:fPriority.value,note:fNote.value.trim(),infoUrl:fInfoUrl.value.trim(),applyUrl:fApplyUrl.value.trim()});
  Object.assign(p.application,{deadline:fDeadline.value,resultPublishTime:fResultPub.value,screeningResult:fScreening.value});
  Object.assign(p.interview,{materialDeadline:fInterviewMatDeadline.value,location:fInterviewLocation.value.trim(),startTime:fInterviewStart.value,endTime:fInterviewEnd.value,finalResultPublishTime:fFinalPub.value,offerConfirmDeadline:fOfferDeadline.value,finalResult:fFinal.value});
  applyStageAutomation(p, prevStage);
  return p;
}
function addProject(){ const p=normalizeProject({id:uid(),school:'学校',college:'学院/系',direction:'方向',type:'夏令营',priority:'中',stage:'了解/待投递',note:'',infoUrl:'',applyUrl:'',application:{deadline:'',resultPublishTime:'',screeningResult:'未知',materials:baseMaterials.map(x=>makeItem(x))},interview:{enabled:false,location:'',materialDeadline:'',startTime:'',endTime:'',finalResultPublishTime:'',offerConfirmDeadline:'',finalResult:'未知',tasks:[]}}); projects.unshift(p); save(); renderAll(); openDetail(p.id); }

// ===== 规则版半自动通知解析：关键词 + 正则 + 用户确认 =====
const noticeSchoolList = ['清华大学','北京大学','复旦大学','上海交通大学','浙江大学','南京大学','中国科学技术大学','中国人民大学','北京航空航天大学','哈尔滨工业大学','西安交通大学','武汉大学','中山大学','同济大学','华中科技大学','天津大学','南开大学','厦门大学','山东大学','四川大学','电子科技大学','东南大学','北京师范大学','华东师范大学','吉林大学','大连理工大学','北京理工大学','中国农业大学','中央财经大学','对外经济贸易大学','上海财经大学','北京交通大学','北京邮电大学','中国政法大学','中国传媒大学','华南理工大学','湖南大学','重庆大学','兰州大学','东北大学','西北工业大学'];
const materialKeywordMap = [
  ['简历','个人简历'],['成绩单','本科成绩单'],['排名证明','专业排名证明'],['成绩排名','专业排名证明'],['四六级','英语水平证明'],['雅思','英语水平证明'],['托福','英语水平证明'],['英语','英语水平证明'],['个人陈述','个人陈述'],['自述','个人陈述'],['推荐信','推荐信'],['专家推荐','推荐信'],['科研成果','科研成果证明'],['发表论文','科研成果证明'],['论文','科研成果证明'],['获奖','获奖证书'],['奖项','获奖证书'],['证书','获奖证书'],['身份证','身份证/学生证'],['学生证','身份证/学生证'],['申请表','申请表'],['报名表','申请表'],['承诺书','诚信承诺书'],['诚信承诺','诚信承诺书'],['研究计划','研究计划'],['作品集','作品集'],['政审表','政审表'],['体检表','体检表'],['导师同意','导师意向表'],['导师意向','导师意向表'],['论文摘要','论文摘要']
];
const noteKeywordMap = [
  ['线上','线上安排请核对'],['线下','线下安排请核对'],['腾讯会议','含腾讯会议/线上会议信息'],['会议号','含会议号'],['需邮寄','需邮寄纸质材料'],['邮寄','需邮寄纸质材料'],['纸质材料','需准备纸质材料'],['携带原件','需携带原件'],['机试','含机试'],['笔试','含笔试'],['英文面试','可能需要英文面试'],['英语面试','可能需要英文面试'],['PPT','需准备PPT'],['ppt','需准备PPT'],['导师','涉及导师联系/方向，请核对'],['资格审查','含资格审查'],['设备测试','需进行设备测试']
];
function normalizeNoticeText(text=''){
  return String(text).replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0)-0xFEE0)).replace(/[：]/g, ':').replace(/[—–－~～]/g, '-').replace(/\r/g,'\n').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
}
function uniqueArr(arr){ return [...new Set((arr||[]).filter(Boolean).map(x=>String(x).trim()).filter(Boolean))]; }
function fmtParsedDate(year, month, day, hour='', minute='', opts={}){
  const y=Number(year)||new Date().getFullYear(), m=pad(month), d=pad(day);
  if(hour!=='' && hour!=null) return `${y}-${m}-${d}T${pad(hour)}:${pad(minute||0)}`;
  if(opts.deadline) return `${y}-${m}-${d}T23:59`;
  return `${y}-${m}-${d}`;
}
function findDatesInSegment(seg, opts={}){
  seg=normalizeNoticeText(seg||''); const out=[]; const add=(idx,y,m,d,h,mi)=>{ if(m&&d) out.push({idx,value:fmtParsedDate(y,m,d,h,mi,opts)}); };
  let re=/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?\s*(?:(\d{1,2})\s*[:点时]\s*(\d{1,2})?)?/g, mt;
  while((mt=re.exec(seg))) add(mt.index,mt[1],mt[2],mt[3],mt[4]||'',mt[5]||'');
  re=/(\d{1,2})\s*月\s*(\d{1,2})\s*日?\s*(?:(\d{1,2})\s*[:点时]\s*(\d{1,2})?)?/g;
  while((mt=re.exec(seg))) add(mt.index,'',mt[1],mt[2],mt[3]||'',mt[4]||'');
  re=/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\s*(?:(\d{1,2})\s*[:：]\s*(\d{1,2}))?/g;
  while((mt=re.exec(seg))) add(mt.index,mt[1],mt[2],mt[3],mt[4]||'',mt[5]||'');
  re=/(\d{1,2})\.(\d{1,2})\s*(?:(\d{1,2})\s*[:：]\s*(\d{1,2}))?/g;
  while((mt=re.exec(seg))) add(mt.index,'',mt[1],mt[2],mt[3]||'',mt[4]||'');
  return out.sort((a,b)=>a.idx-b.idx);
}
function extractDateByKeywords(text, keywords, opts={}){
  for(const key of keywords){ let idx=text.indexOf(key); while(idx>=0){ const seg=text.slice(Math.max(0,idx-45), idx+140); const dates=findDatesInSegment(seg,opts); if(dates.length) return dates[0].value; idx=text.indexOf(key,idx+key.length); } }
  return '';
}
function extractRangeByKeywords(text, keywords){
  for(const key of keywords){ let idx=text.indexOf(key); while(idx>=0){ const seg=text.slice(Math.max(0,idx-50),idx+180); const r=seg.match(/(?:(20\d{2})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日?\s*(?:(\d{1,2})\s*[:点时]\s*(\d{1,2})?)?\s*(?:至|到|-)\s*(?:(20\d{2})\s*年\s*)?(?:(\d{1,2})\s*月)?\s*(\d{1,2})\s*日?\s*(?:(\d{1,2})\s*[:点时]\s*(\d{1,2})?)?/);
      if(r){ const y1=r[1]||'', m1=r[2], d1=r[3], h1=r[4]||'', mi1=r[5]||''; const y2=r[6]||y1||'', m2=r[7]||m1, d2=r[8], h2=r[9]||'', mi2=r[10]||''; return {start:fmtParsedDate(y1,m1,d1,h1,mi1), end:fmtParsedDate(y2,m2,d2,h2,mi2)}; }
      const dates=findDatesInSegment(seg); if(dates.length>=2) return {start:dates[0].value,end:dates[1].value}; idx=text.indexOf(key,idx+key.length); } }
  return {start:'',end:''};
}
function extractUrlsWithContext(text){
  const re=/https?:\/\/[^\s，。；;、)）】]+/gi, urls=[]; let m; while((m=re.exec(text))) urls.push({url:m[0],ctx:text.slice(Math.max(0,m.index-30),m.index+m[0].length+30)});
  let infoUrl='',applyUrl=''; urls.forEach(u=>{ if(/[报名申请系统登录填报提交]/.test(u.ctx)&&!applyUrl) applyUrl=u.url; if(/[通知详情学院官网公告原文]/.test(u.ctx)&&!infoUrl) infoUrl=u.url; });
  if(!infoUrl&&urls[0]) infoUrl=urls[0].url; if(!applyUrl&&urls.length>1) applyUrl=urls.find(u=>u.url!==infoUrl)?.url||''; return {infoUrl,applyUrl};
}
function extractCollege(text){
  const head=text.slice(0,900); const re=/([\u4e00-\u9fa5A-Za-z0-9·（）()]{2,30}(?:学院|学部|系|研究院|中心|实验室|书院|医学院|商学院|管理学院|法学院|新闻学院|计算机学院|软件学院))/g; const bad=/大学|我院|本院|学院官网|各学院|研究生院|教务处/;
  return ([...head.matchAll(re)].map(x=>x[1]).filter(x=>!bad.test(x))[0]) || '';
}
function extractDirection(text){
  const keys=['专业方向','研究方向','招生专业','接收专业','专业','学科','领域','方向'];
  for(const k of keys){ const idx=text.indexOf(k); if(idx<0) continue; const seg=text.slice(idx,idx+90).replace(/\n/g,' '); const m=seg.match(new RegExp(k+'\\s*[:：为：]?\\s*([\\u4e00-\\u9fa5A-Za-z0-9、，,；;\\/\\-（）() ]{2,40})')); if(m) return m[1].replace(/[。；;，,].*$/,'').trim(); }
  return '';
}
function extractProjectType(text){
  const lower=text.toLowerCase(); if(/预推免|推免预报名|预报名/.test(text)) return '预推免'; if(/九推|正式推免|推免复试/.test(text)) return '九推'; if(/夏令营|暑期学校|summer camp/.test(lower)) return '夏令营'; if(/直博|直博生/.test(text)) return '直博'; if(/推免|硕士推免/.test(text)) return '推免'; return '';
}
function extractMaterialsFromText(text){ let mats=[...baseMaterials]; materialKeywordMap.forEach(([kw,name])=>{ if(text.includes(kw)) mats.push(name); }); return uniqueArr(mats); }
function extractNotes(text){ const notes=[]; noteKeywordMap.forEach(([kw,note])=>{ if(text.includes(kw)) notes.push(note); }); return uniqueArr(notes).join('；'); }
function extractNoticeFields(text){
  const clean=normalizeNoticeText(text), first=clean.slice(0,800), parsed={materials:[]};
  parsed.school=noticeSchoolList.find(s=>first.includes(s))||noticeSchoolList.find(s=>clean.includes(s))||'';
  parsed.college=extractCollege(clean); parsed.type=extractProjectType(clean); parsed.direction=extractDirection(clean);
  const urls=extractUrlsWithContext(clean); parsed.infoUrl=urls.infoUrl; parsed.applyUrl=urls.applyUrl;
  parsed.deadline=extractDateByKeywords(clean,['申请截止','报名截止','截止时间','网上报名截止','材料提交截止','提交截止','前完成报名','前提交','请于'],{deadline:true});
  parsed.resultPublishTime=extractDateByKeywords(clean,['入营名单','复试名单','初审结果','审核结果','名单公布','资格审核结果','入选名单']);
  parsed.interviewMaterialDeadline=extractDateByKeywords(clean,['复试材料','补充材料','资格审查材料','面试材料','复试前提交','补充材料提交截止'],{deadline:true});
  const range=extractRangeByKeywords(clean,['夏令营时间','活动时间','营期','复试时间','面试时间','考核时间','笔试时间']); parsed.interviewStart=range.start; parsed.interviewEnd=range.end;
  parsed.finalResultPublishTime=extractDateByKeywords(clean,['最终结果','录取结果','优秀营员结果','优营结果','拟录取结果','考核结果','结果公布']);
  parsed.offerConfirmDeadline=extractDateByKeywords(clean,['确认截止','接受截止','待录取确认','确认拟录取','确认时间','逾期视为放弃'],{deadline:true});
  parsed.interviewLocation=(clean.match(/(?:复试地点|面试地点|报到地点|活动地点|地点)\s*[:：]?\s*([^\n。；;]{2,40})/)||[])[1]||'';
  parsed.materials=extractMaterialsFromText(clean); parsed.note=extractNotes(clean); return parsed;
}
function toDateTimeInput(v){ const d=toDate(v); if(!d) return ''; return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function toDateInput(v){ const d=toDate(v); if(!d) return ''; return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

function parseBadge(value, critical=false){
  if(value && Array.isArray(value) && value.length) return `<span class="parse-badge recognized">已识别</span>`;
  if(value) return `<span class="parse-badge ${critical?'verify':'recognized'}">${critical?'需核对':'已识别'}</span>`;
  return `<span class="parse-badge missing">未识别</span>`;
}
function reviewInput(label,id,value,type='text',critical=false){
  return `<label><span class="parse-label-row"><b>${label}</b>${parseBadge(value,critical)}</span><input ${type?`type="${type}"`:''} id="${id}" value="${escapeHtml(value||'')}"></label>`;
}
function reviewSelect(label,id,value,options=[]){
  return `<label><span class="parse-label-row"><b>${label}</b>${parseBadge(value,false)}</span><select id="${id}">${options.map(t=>`<option ${t===(value||'')?'selected':''}>${escapeHtml(t)}</option>`).join('')}</select></label>`;
}
function reviewNoticeWarning(parsed){
  const missing=[];
  if(!parsed.deadline) missing.push('申请截止');
  if(!parsed.school) missing.push('学校');
  if(!parsed.applyUrl) missing.push('报名地址');
  const check=['申请截止','名单公布','复试材料截止','复试开始','复试结束','最终结果公布','Offer确认截止'].filter((_,i)=>[parsed.deadline,parsed.resultPublishTime,parsed.interviewMaterialDeadline,parsed.interviewStart,parsed.interviewEnd,parsed.finalResultPublishTime,parsed.offerConfirmDeadline][i]);
  return `<div class="parse-safety-box"><b>请核对关键时间</b><span>规则解析可能误判，所有识别出的时间都标为“需核对”。${missing.length?`未识别：${missing.join('、')}。`:''}${check.length?`已识别时间：${check.join('、')}。`:''}</span></div>`;
}

function renderNoticeReview(container, parsed, mode, projectId){
  const pfx=mode==='detail'?'dp':'np'; container.classList.remove('hidden');
  const typeOptions=uniqueArr(types.concat(['直博','推免']));
  container.innerHTML=`<div class="review-head"><strong>解析结果确认</strong><span>以下内容由规则识别，请确认后再保存。</span></div>
  ${reviewNoticeWarning(parsed)}
  <div class="parse-review-section"><h4>基础信息</h4><div class="parse-grid">
    ${reviewInput('学校',`${pfx}School`,parsed.school)}
    ${reviewInput('学院',`${pfx}College`,parsed.college)}
    ${reviewInput('方向',`${pfx}Direction`,parsed.direction)}
    ${reviewSelect('类型',`${pfx}Type`,parsed.type||'夏令营',typeOptions)}
    ${reviewInput('信息网址',`${pfx}InfoUrl`,parsed.infoUrl)}
    ${reviewInput('报名地址',`${pfx}ApplyUrl`,parsed.applyUrl)}
  </div></div>
  <div class="parse-review-section"><h4>申请阶段</h4><div class="parse-grid">
    ${reviewInput('申请截止',`${pfx}Deadline`,toDateTimeInput(parsed.deadline),'datetime-local',true)}
    ${reviewInput('名单公布',`${pfx}ResultPub`,toDateInput(parsed.resultPublishTime),'date',true)}
  </div></div>
  <div class="parse-review-section"><h4>复试阶段</h4><div class="parse-grid">
    ${reviewInput('复试材料截止',`${pfx}InterviewMat`,toDateTimeInput(parsed.interviewMaterialDeadline),'datetime-local',true)}
    ${reviewInput('复试开始',`${pfx}InterviewStart`,toDateTimeInput(parsed.interviewStart),'datetime-local',true)}
    ${reviewInput('复试结束',`${pfx}InterviewEnd`,toDateTimeInput(parsed.interviewEnd),'datetime-local',true)}
    ${reviewInput('最终结果公布',`${pfx}FinalPub`,toDateInput(parsed.finalResultPublishTime),'date',true)}
    ${reviewInput('Offer确认截止',`${pfx}OfferDeadline`,toDateTimeInput(parsed.offerConfirmDeadline),'datetime-local',true)}
    ${reviewInput('复试地点',`${pfx}InterviewLocation`,parsed.interviewLocation)}
  </div></div>
  <div class="parse-review-section"><h4>材料清单 ${parseBadge(parsed.materials||[])}</h4><textarea class="parse-textarea" id="${pfx}Materials">${escapeHtml((parsed.materials||[]).join('\n'))}</textarea><p class="muted">每行一个材料，确认后会生成 checklist。</p></div>
  <div class="parse-review-section"><h4>备注 ${parseBadge(parsed.note)}</h4><textarea class="parse-textarea small" id="${pfx}Note">${escapeHtml(parsed.note||'')}</textarea></div>
  <div class="parse-actions"><button class="primary-btn" id="${pfx}Confirm">${mode==='detail'?'确认填入当前项目':'确认生成申请项目'}</button><button class="icon-btn" id="${pfx}Cancel">取消</button></div>`;
  document.getElementById(`${pfx}Cancel`).onclick=()=>container.classList.add('hidden');
  document.getElementById(`${pfx}Confirm`).onclick=()=>{ const data=collectParsedReview(pfx); if(mode==='detail'){ const p=projects.find(x=>x.id===projectId); if(!p) return; applyParsedToProject(p,data); applyStageAutomation(p,p.stage); save(); renderAll(); openDetail(p.id); showToast('解析结果已填入当前项目，请核对关键时间'); }else{ const p=normalizeProject({id:uid(),school:data.school||'学校',college:data.college||'学院/系',direction:data.direction||'方向',type:data.type||'夏令营',priority:'中',stage:'了解/待投递',note:data.note||'由通知解析生成，请检查并补充。',infoUrl:data.infoUrl||'',applyUrl:data.applyUrl||'',application:{deadline:data.deadline||'',resultPublishTime:data.resultPublishTime||'',screeningResult:'未知',materials:(data.materials&&data.materials.length?data.materials:baseMaterials).map(x=>makeItem(x))},interview:{enabled:false,location:data.interviewLocation||'',materialDeadline:data.interviewMaterialDeadline||'',startTime:data.interviewStart||'',endTime:data.interviewEnd||'',finalResultPublishTime:data.finalResultPublishTime||'',offerConfirmDeadline:data.offerConfirmDeadline||'',finalResult:'未知',tasks:[]},materialFolder:{path:''}}); projects.unshift(p); save(); renderAll(); openDetail(p.id); switchPage('table'); showToast('已生成项目，请核对关键时间'); } };
}

function collectParsedReview(pfx){ const val=id=>(document.getElementById(pfx+id)?.value||'').trim(); return {school:val('School'),college:val('College'),direction:val('Direction'),type:val('Type'),infoUrl:val('InfoUrl'),applyUrl:val('ApplyUrl'),deadline:val('Deadline'),resultPublishTime:val('ResultPub'),interviewMaterialDeadline:val('InterviewMat'),interviewStart:val('InterviewStart'),interviewEnd:val('InterviewEnd'),finalResultPublishTime:val('FinalPub'),offerConfirmDeadline:val('OfferDeadline'),interviewLocation:val('InterviewLocation'),materials:uniqueArr(val('Materials').split(/\n|、|,|，|;/)),note:val('Note')}; }
function parseNotice(){ const text=noticeText.value; if(!text.trim()){ showToast('请先粘贴通知内容'); return; } renderNoticeReview(parseResult, extractNoticeFields(text), 'new'); }
function applyParsedToProject(p, parsed){
  if(parsed.school) p.school=parsed.school; if(parsed.college) p.college=parsed.college; if(parsed.direction) p.direction=parsed.direction; if(parsed.type) p.type=parsed.type; if(parsed.infoUrl) p.infoUrl=parsed.infoUrl; if(parsed.applyUrl) p.applyUrl=parsed.applyUrl;
  if(parsed.deadline) p.application.deadline=parsed.deadline; if(parsed.resultPublishTime) p.application.resultPublishTime=parsed.resultPublishTime; if(parsed.interviewMaterialDeadline) p.interview.materialDeadline=parsed.interviewMaterialDeadline; if(parsed.interviewLocation) p.interview.location=parsed.interviewLocation; if(parsed.interviewStart) p.interview.startTime=parsed.interviewStart; if(parsed.interviewEnd) p.interview.endTime=parsed.interviewEnd; if(parsed.finalResultPublishTime) p.interview.finalResultPublishTime=parsed.finalResultPublishTime; if(parsed.offerConfirmDeadline) p.interview.offerConfirmDeadline=parsed.offerConfirmDeadline; if(parsed.note) p.note=p.note?`${p.note}；${parsed.note}`:parsed.note;
  if(parsed.materials&&parsed.materials.length){ const existed=new Set((p.application.materials||[]).map(x=>x.name)); parsed.materials.forEach(m=>{ if(!existed.has(m)) p.application.materials.push(makeItem(m)); }); }
}
function parseIntoCurrentProject(){ const p=projects.find(x=>x.id===currentEditId); if(!p) return; const text=document.getElementById('detailNoticeText').value||''; if(!text.trim()){ showToast('请先粘贴通知内容'); return; } renderNoticeReview(document.getElementById('detailParseResult'), extractNoticeFields(text), 'detail', p.id); }


// ===== 本地 Excel 导入：支持 .xlsx、系统导出的 .xls/HTML 表格、CSV/TXT =====
function excelSerialToDateText(num){
  const n = Number(num);
  if(!isFinite(n) || n < 20000 || n > 80000) return String(num ?? '');
  const utcDays = Math.floor(n - 25569);
  const frac = n - Math.floor(n);
  const d = new Date(utcDays * 86400000 + Math.round(frac * 86400000));
  const y=d.getUTCFullYear(), m=pad(d.getUTCMonth()+1), day=pad(d.getUTCDate()), h=pad(d.getUTCHours()), mi=pad(d.getUTCMinutes());
  return frac ? `${y}-${m}-${day} ${h}:${mi}` : `${y}-${m}-${day}`;
}
function normalizeHeader(h=''){
  return String(h).replace(/\s+/g,'').replace(/[（）()]/g,'').trim();
}
function parseDelimited(text){
  const delimiter = text.includes('\t') ? '\t' : ',';
  const rows=[]; let row=[], cur='', quote=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i], next=text[i+1];
    if(ch==='"'){
      if(quote && next==='"'){cur+='"'; i++;}
      else quote=!quote;
    }else if(ch===delimiter && !quote){ row.push(cur); cur=''; }
    else if((ch==='\n' || ch==='\r') && !quote){
      if(ch==='\r' && next==='\n') i++;
      row.push(cur); cur='';
      if(row.some(x=>String(x).trim()!=='')) rows.push(row);
      row=[];
    }else cur+=ch;
  }
  row.push(cur); if(row.some(x=>String(x).trim()!=='')) rows.push(row);
  return rows;
}
function parseHtmlTable(text){
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const table = doc.querySelector('table');
  if(!table) return null;
  return [...table.rows].map(tr=>[...tr.cells].map(td=>td.textContent.trim()));
}
function findEOCD(view){
  for(let i=view.byteLength-22; i>=Math.max(0, view.byteLength-65557); i--){
    if(view.getUint32(i,true)===0x06054b50) return i;
  }
  return -1;
}
function readU16(view, off){ return view.getUint16(off,true); }
function readU32(view, off){ return view.getUint32(off,true); }
async function inflateRaw(bytes){
  if(typeof DecompressionStream === 'undefined') throw new Error('当前浏览器不支持直接解析 xlsx，请使用 Chrome/Edge，或另存为 CSV 后导入。');
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function unzipXlsx(buffer){
  const view = new DataView(buffer);
  const eocd = findEOCD(view);
  if(eocd<0) throw new Error('没有识别到有效的 xlsx 文件结构。');
  const entries = readU16(view, eocd+10);
  let ptr = readU32(view, eocd+16);
  const dec = new TextDecoder('utf-8');
  const files = {};
  for(let i=0;i<entries;i++){
    if(readU32(view,ptr)!==0x02014b50) break;
    const method = readU16(view,ptr+10);
    const compSize = readU32(view,ptr+20);
    const nameLen = readU16(view,ptr+28), extraLen=readU16(view,ptr+30), commentLen=readU16(view,ptr+32);
    const localOff = readU32(view,ptr+42);
    const name = dec.decode(new Uint8Array(buffer, ptr+46, nameLen));
    const lfNameLen=readU16(view,localOff+26), lfExtraLen=readU16(view,localOff+28);
    const dataOff=localOff+30+lfNameLen+lfExtraLen;
    const compBytes = new Uint8Array(buffer, dataOff, compSize);
    let data;
    if(method===0) data=compBytes;
    else if(method===8) data=await inflateRaw(compBytes);
    else throw new Error(`暂不支持压缩方式 ${method} 的 xlsx 文件。`);
    files[name]=dec.decode(data);
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}
function colToIndex(ref){
  const letters = String(ref).replace(/\d+/g,'').toUpperCase();
  let n=0; for(const ch of letters){ n=n*26 + ch.charCodeAt(0)-64; } return n-1;
}
function xmlText(node){ return node ? (node.textContent || '').trim() : ''; }
async function parseXlsxRows(buffer){
  const files = await unzipXlsx(buffer);
  const parser = new DOMParser();
  const shared = [];
  if(files['xl/sharedStrings.xml']){
    const ss = parser.parseFromString(files['xl/sharedStrings.xml'],'application/xml');
    ss.querySelectorAll('si').forEach(si=>{
      const parts=[...si.querySelectorAll('t')].map(t=>t.textContent||'');
      shared.push(parts.join(''));
    });
  }
  let sheetPath = 'xl/worksheets/sheet1.xml';
  try{
    const wb = parser.parseFromString(files['xl/workbook.xml']||'','application/xml');
    const firstSheet = wb.querySelector('sheet');
    const rid = firstSheet?.getAttribute('r:id') || firstSheet?.getAttribute('id');
    if(rid && files['xl/_rels/workbook.xml.rels']){
      const rels = parser.parseFromString(files['xl/_rels/workbook.xml.rels'],'application/xml');
      const rel = [...rels.querySelectorAll('Relationship')].find(r=>r.getAttribute('Id')===rid);
      const target = rel?.getAttribute('Target');
      if(target) sheetPath = 'xl/' + target.replace(/^\//,'').replace(/^xl\//,'');
    }
  }catch(e){}
  const sheetXml = files[sheetPath] || files['xl/worksheets/sheet1.xml'];
  if(!sheetXml) throw new Error('没有找到第一个工作表。');
  const sheet = parser.parseFromString(sheetXml,'application/xml');
  const rows=[];
  sheet.querySelectorAll('sheetData row').forEach(r=>{
    const arr=[];
    r.querySelectorAll('c').forEach(c=>{
      const idx=colToIndex(c.getAttribute('r')||'A1');
      const t=c.getAttribute('t');
      let val='';
      if(t==='s') val=shared[Number(xmlText(c.querySelector('v')))] || '';
      else if(t==='inlineStr') val=xmlText(c.querySelector('is t'));
      else val=xmlText(c.querySelector('v'));
      arr[idx]=val;
    });
    if(arr.some(v=>String(v||'').trim()!=='')) rows.push(arr.map(v=>v??''));
  });
  return rows;
}
function parseLooseDate(value, header=''){
  if(value==null) return '';
  let s = String(value).trim();
  if(!s || ['待填写','暂无','无','-'].includes(s)) return '';
  s = s.replace(/\s+/g,' ').replace(/[年\.\/]/g,'-').replace(/[月]/g,'-').replace(/[日]/g,'').replace(/：/g,':');
  if(/^\d+(\.\d+)?$/.test(s)) s = excelSerialToDateText(s);
  const y = new Date().getFullYear();
  let m = s.match(/(20\d{2})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2}))?/);
  if(m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}${m[4]?`T${pad(m[4])}:${pad(m[5]||0)}`:''}`;
  m = s.match(/(^|\D)(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2}))?/);
  if(m) return `${y}-${pad(m[2])}-${pad(m[3])}${m[4]?`T${pad(m[4])}:${pad(m[5]||0)}`:''}`;
  return value;
}
function parseRangeDate(value){
  const s=String(value||'').trim();
  if(!s) return {start:'',end:''};
  const parts=s.split(/\s*(?:至|到|—|~|–)\s*/);
  if(parts.length>=2) return {start:parseLooseDate(parts[0]), end:parseLooseDate(parts[1])};
  const re=/(?:20\d{2}[-\/年])?\d{1,2}[-\/月]\d{1,2}(?:日)?(?:\s*\d{1,2}[:：]\d{1,2})?/g;
  const found=s.match(re);
  if(found&&found.length>=2) return {start:parseLooseDate(found[0]), end:parseLooseDate(found[1])};
  return {start:parseLooseDate(s),end:''};
}
function makeProgressItems(kind, text, existing=[]){
  const s=String(text||'');
  if(!s || s.includes('未开启')) return kind==='interview'?[]:(existing.length?existing:baseMaterials.map(x=>makeItem(x)));
  const m=s.match(/(\d+)\s*\/\s*(\d+)/);
  if(!m) return existing.length?existing:(kind==='interview'?defaultInterviewTasks:baseMaterials).map(x=>makeItem(x));
  const done=Number(m[1]), total=Number(m[2]);
  const names=(kind==='interview'?defaultInterviewTasks:baseMaterials).slice(0,total);
  while(names.length<total) names.push((kind==='interview'?'复试任务':'材料')+(names.length+1));
  return names.map((name,i)=>makeItem(name,i<done?'已完成':'未准备'));
}
function rowToObject(headers, row){
  const o={}; headers.forEach((h,i)=>{ if(h) o[normalizeHeader(h)] = row[i] ?? ''; }); return o;
}
function pick(o, names){ for(const n of names){ const k=normalizeHeader(n); if(o[k]!==undefined && String(o[k]).trim()!=='') return String(o[k]).trim(); } return ''; }
function projectFromImportedRow(o){
  const p=normalizeProject({
    id:uid(),
    school:pick(o,['学校','学校学院','学校（学院）']),
    college:pick(o,['学院','院系']),
    direction:pick(o,['方向','专业方向']),
    type:pick(o,['类型','项目类型'])||'夏令营',
    stage:pick(o,['当前阶段','阶段'])||'了解/待投递',
    priority:pick(o,['优先级'])||'中',
    note:pick(o,['备注']),
    infoUrl:pick(o,['信息网址','通知网址','信息链接']),
    applyUrl:pick(o,['报名地址','报名网址','申请地址']),
    application:{
      deadline:parseLooseDate(pick(o,['申请截止','申请截止时间']),'申请截止'),
      resultPublishTime:parseLooseDate(pick(o,['名单公布','名单公布时间']),'名单公布'),
      screeningResult:pick(o,['初筛结果','入营结果'])||'未知',
      materials:[]
    },
    interview:{enabled:false,location:pick(o,['复试地点','面试地点']),materialDeadline:'',startTime:'',endTime:'',finalResultPublishTime:'',offerConfirmDeadline:'',finalResult:pick(o,['最终结果'])||'未知',tasks:[]}
  });
  p.application.materials = makeProgressItems('application', pick(o,['申请材料','材料进度']), p.application.materials);
  const intProgress = pick(o,['复试准备','复试材料','复试任务']);
  if(intProgress && !intProgress.includes('未开启')){ p.interview.enabled=true; p.interview.tasks=makeProgressItems('interview', intProgress, p.interview.tasks); }
  p.interview.materialDeadline=parseLooseDate(pick(o,['复试材料截止','复试材料截止时间']),'复试材料截止');
  const range=parseRangeDate(pick(o,['复试时间','夏令营/复试时间','夏令营复试时间']));
  p.interview.startTime=range.start; p.interview.endTime=range.end;
  p.interview.finalResultPublishTime=parseLooseDate(pick(o,['最终结果公布','最终结果公布时间']),'最终结果公布');
  p.interview.offerConfirmDeadline=parseLooseDate(pick(o,['Offer确认截止','Offer确认截止时间']),'Offer确认截止');
  return normalizeProject(p);
}
function importKey(p){ return [p.school,p.college,p.direction,p.type].join('|'); }
function findDuplicateProject(np){ return projects.find(p=>importKey(p)===importKey(np)); }
function mergeImportedProjects(imported, mode='update'){
  let added=0, updated=0, skipped=0;
  imported.forEach(np=>{
    if(!np.school && !np.college && !np.direction) return;
    const hit=findDuplicateProject(np);
    if(hit && mode==='update'){
      const id=hit.id; Object.assign(hit, np); hit.id=id; updated++;
    }else if(hit && mode==='skip'){
      skipped++;
    }else{
      if(hit && mode==='new') np.id=uid();
      projects.unshift(np); added++;
    }
  });
  save(); renderAll(); showToast(`导入完成：新增 ${added} 个，更新 ${updated} 个，跳过 ${skipped} 个`);
}
function showImportPreview(imported){
  pendingImportProjects = imported;
  const duplicateCount = imported.filter(findDuplicateProject).length;
  const addCount = imported.length - duplicateCount;
  const modal=document.getElementById('importPreviewModal');
  document.getElementById('importSummary').innerHTML = `<div class="summary-chip">识别到 <b>${imported.length}</b> 个项目</div><div class="summary-chip">预计新增 <b>${addCount}</b> 个</div><div class="summary-chip">可能重复 <b>${duplicateCount}</b> 个</div>`;
  const preview=imported.slice(0,12).map(p=>`<tr><td>${escapeHtml(p.school)}</td><td>${escapeHtml(p.college)}</td><td>${escapeHtml(p.direction)}</td><td>${escapeHtml(p.type)}</td><td>${escapeHtml(p.stage)}</td><td>${escapeHtml(fmtDate(p.application.deadline))}</td><td>${findDuplicateProject(p)?'<span class="tag tag-orange">可能重复</span>':'<span class="tag tag-green">新增</span>'}</td></tr>`).join('');
  document.getElementById('importPreviewTable').innerHTML = `<thead><tr><th>学校</th><th>学院</th><th>方向</th><th>类型</th><th>当前阶段</th><th>申请截止</th><th>识别结果</th></tr></thead><tbody>${preview}</tbody>`;
  modal.classList.remove('hidden');
}
function confirmImportPreview(){
  const mode=document.getElementById('importModeSelect')?.value || 'update';
  mergeImportedProjects(pendingImportProjects, mode);
  pendingImportProjects=[];
  document.getElementById('importPreviewModal').classList.add('hidden');
}

async function handleLocalExcelImport(file){
  if(!file) return;
  const name=file.name.toLowerCase();
  try{
    let rows=null;
    if(name.endsWith('.xlsx')) rows=await parseXlsxRows(await file.arrayBuffer());
    else {
      const text=await file.text();
      rows=parseHtmlTable(text) || parseDelimited(text);
    }
    if(!rows || rows.length<2) throw new Error('未识别到有效表格，请确认第一行是表头。');
    const headerIndex = rows.findIndex(r=>r.some(c=>['学校','学院','方向','当前阶段','申请截止'].includes(normalizeHeader(c))));
    const headers = rows[headerIndex>=0?headerIndex:0].map(x=>String(x||'').trim());
    const body = rows.slice((headerIndex>=0?headerIndex:0)+1).filter(r=>r.some(c=>String(c||'').trim()!==''));
    const imported = body.map(r=>projectFromImportedRow(rowToObject(headers,r))).filter(p=>p.school||p.college||p.direction);
    if(!imported.length) throw new Error('没有找到可导入的项目行。请检查表头是否包含“学校、学院、方向”等字段。');
    showImportPreview(imported);
  }catch(err){
    alert('导入失败：' + err.message + '\n\n说明：支持本地 .xlsx、CSV，以及本系统导出的 .xls/HTML 表格。若是老版二进制 .xls，请先用 Excel/WPS 另存为 .xlsx 后再导入。');
  }finally{
    const input=document.getElementById('importExcelInput'); if(input) input.value='';
  }
}


function backupAgeDays(){
  const last=getSettings().lastBackupAt;
  if(!last) return Infinity;
  return Math.floor((Date.now()-new Date(last).getTime())/86400000);
}
function backupStatusText(){
  const settings=getSettings();
  if(!settings.lastBackupAt) return '还没有导出过备份';
  const days=backupAgeDays();
  return days<=0 ? '今天已导出备份' : `${days} 天前导出过备份`;
}
function storageStatusText(){
  const idbReady='indexedDB' in window;
  return idbReady ? 'localStorage + IndexedDB 双写保存' : 'localStorage 保存，当前浏览器不支持 IndexedDB';
}
function renderDataCenter(){
  const panel=document.getElementById('dataHealthPanel');
  if(!panel) return;
  const settings=getSettings();
  const nextNodes=allFutureNodes().slice(0,3);
  const notifyState=('Notification' in window) ? Notification.permission : 'unsupported';
  const notifyText={default:'未授权',granted:'已授权',denied:'已拒绝',unsupported:'当前浏览器不支持'}[notifyState] || notifyState;
  const age=backupAgeDays();
  const backupClass=age>settings.backupIntervalDays?'warn':'ok';
  panel.innerHTML=`<div class="health-card ${backupClass}"><span>备份状态</span><b>${escapeHtml(backupStatusText())}</b><small>建议至少每 ${settings.backupIntervalDays} 天导出一次 JSON 备份。</small></div>
  <div class="health-card ok"><span>本地存储</span><b>${escapeHtml(storageStatusText())}</b><small>数据保存在当前浏览器，换设备或清缓存前请导出备份。</small></div>
  <div class="health-card"><span>提醒状态</span><b>${escapeHtml(notifyText)}</b><small>网页打开时会检查今日节点，系统通知取决于浏览器授权。</small></div>
  <div class="health-card"><span>近期节点</span><b>${nextNodes.length?`${nextNodes.length} 个待关注`:'暂无近期节点'}</b><small>${nextNodes.map(n=>`${n.project.school} ${n.name}`).join('；') || '添加项目时间后会自动汇总。'}</small></div>`;
  const select=document.getElementById('backupIntervalSelect');
  if(select) select.value=String(settings.backupIntervalDays);
}
function openDataCenter(){
  renderDataCenter();
  document.getElementById('dataCenterModal').classList.remove('hidden');
}
function checkBackupReminder(){
  const settings=getSettings();
  const key=todayKey();
  if(settings.lastBackupReminderAt===key || backupAgeDays()<=settings.backupIntervalDays) return;
  saveSettings({lastBackupReminderAt:key});
  showToast('建议导出一次备份，避免浏览器数据丢失');
}
async function restoreFromIndexedDbIfNeeded(){
  if(loadedFromPersistedStorage) return;
  const snapshot=await readIndexedDbSnapshot();
  if(snapshot?.projects?.length){
    projects=snapshot.projects.map(normalizeProject);
    save(false);
    renderAll();
    showToast('已从浏览器本地数据库恢复数据');
  }else{
    save(false);
  }
}
async function enableBrowserNotifications(){
  if(!('Notification' in window)){ showToast('当前浏览器不支持系统通知'); return; }
  const permission=await Notification.requestPermission();
  saveSettings({notificationEnabled:permission==='granted'});
  showToast(permission==='granted'?'已开启浏览器通知':'未获得通知权限');
}
function sendTodaySystemNotification(nodes){
  const settings=getSettings();
  if(!settings.notificationEnabled || !('Notification' in window) || Notification.permission!=='granted' || !nodes.length) return;
  const key='paoyan_v20_system_notice_'+todayKey();
  if(localStorage.getItem(key)) return;
  localStorage.setItem(key,'1');
  const first=nodes[0];
  new Notification('今日保研关键节点', {
    body: `${first.project.school} ${first.name}${nodes.length>1?`，另有 ${nodes.length-1} 项`:''}`,
    tag:'paoyan-today-nodes'
  });
}
function copyBackupText(){
  copyText(JSON.stringify(backupPayload(),null,2)).then(()=>showToast('已复制备份文本'));
}
function exportBackup(){
  const payload=backupPayload();
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`你的保研申请面板-备份-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
  saveSettings({lastBackupAt:new Date().toISOString()});
  showToast('已导出备份 JSON');
}
async function importBackup(file){
  if(!file) return;
  try{
    const data=JSON.parse(await file.text());
    const list=Array.isArray(data)?data:data.projects;
    if(!Array.isArray(list)) throw new Error('备份文件格式不正确');
    const normalized=list.map(normalizeProject);
    const action=confirm(`识别到 ${normalized.length} 个备份项目。\n\n点击“确定”将覆盖当前数据；点击“取消”则合并到当前数据。`);
    if(action){ projects=normalized; save(); renderAll(); showToast('已恢复备份'); }
    else { mergeImportedProjects(normalized,'update'); }
  }catch(err){ alert('导入备份失败：'+err.message); }
  finally{ const input=document.getElementById('importBackupInput'); if(input) input.value=''; }
}
function todayNodes(){
  const start=today(); const end=new Date(start); end.setDate(end.getDate()+1);
  return projects.flatMap(getAllNodes).filter(n=>!['已结束'].includes(n.project.stage) && n.date>=start && n.date<end).sort((a,b)=>a.date-b.date);
}
function todayKey(){ const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function showTodayReminder(){
  const key='paoyan_v19_reminder_'+todayKey();
  if(todayReminderShown || localStorage.getItem(key)) return;
  const nodes=todayNodes();
  if(!nodes.length) return;
  todayReminderShown=true;
  localStorage.setItem(key,'1');
  sendTodaySystemNotification(nodes);
  const list=document.getElementById('todayReminderList');
  list.innerHTML=nodes.map(n=>`<button class="reminder-item" data-open-node="${n.project.id}"><b>${escapeHtml(n.project.school)} ${escapeHtml(n.project.college)}</b><span>${escapeHtml(n.name)} · ${fmtDate(n.date.toISOString())}</span></button>`).join('');
  document.getElementById('reminderModal').classList.remove('hidden');
}

function exportExcel(){
  const rows=projects.map(p=>{ const n=nextNode(p); const app=progress(p.application.materials); const it=p.interview.enabled?progress(p.interview.tasks):{done:0,total:0,pct:0}; return `<tr><td>${p.school}</td><td>${p.college}</td><td>${p.direction}</td><td>${p.type}</td><td>${p.stage}</td><td>${n?`${n.name} ${fmtDate(n.date.toISOString())}`:''}</td><td>${p.application.screeningResult}</td><td>${p.interview.finalResult}</td><td>${app.done}/${app.total} ${app.pct}%</td><td>${p.interview.enabled?`${it.done}/${it.total} ${it.pct}%`:'未开启'}</td><td>${p.priority}</td><td>${fmtDate(p.application.deadline)}</td><td>${fmtDate(p.application.resultPublishTime)}</td><td>${fmtDate(p.interview.materialDeadline)}</td><td>${p.interview.location||''}</td><td>${fmtDate(p.interview.startTime)}-${fmtDate(p.interview.endTime)}</td><td>${fmtDate(p.interview.finalResultPublishTime)}</td><td>${p.infoUrl}</td><td>${p.applyUrl}</td><td>${p.note}</td></tr>`; }).join('');
  const html=`<html><head><meta charset="UTF-8"></head><body><table border="1" style="border-collapse:collapse;font-family:微软雅黑;font-size:12px"><tr style="background:#2563eb;color:#fff;font-weight:bold"><th>学校</th><th>学院</th><th>方向</th><th>类型</th><th>当前阶段</th><th>下一节点</th><th>初筛结果</th><th>最终结果</th><th>申请材料</th><th>复试准备</th><th>优先级</th><th>申请截止</th><th>名单公布</th><th>复试材料截止</th><th>复试地点</th><th>复试时间</th><th>最终结果公布</th><th>信息网址</th><th>报名地址</th><th>备注</th></tr>${rows}</table></body></html>`;
  const blob=new Blob([html],{type:'application/vnd.ms-excel'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='你的保研申请面板.xls'; a.click(); URL.revokeObjectURL(a.href);
}
function switchPage(page){ currentPage=page; document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); document.getElementById('page-'+page).classList.add('active'); document.querySelectorAll('.rail-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page)); renderAll(); }
function applyUrlState(){
  const params=new URLSearchParams(location.search);
  const page=params.get('page');
  if(page && document.getElementById('page-'+page)) switchPage(page);
  if(params.get('panel')==='data') setTimeout(openDataCenter, 200);
}
function bind(){
  document.querySelectorAll('.rail-item').forEach(b=>b.onclick=()=>switchPage(b.dataset.page));
  if(document.getElementById('dataCenterBtn')) dataCenterBtn.onclick=openDataCenter;
  if(document.getElementById('dataExportBackupBtn')) dataExportBackupBtn.onclick=exportBackup;
  if(document.getElementById('copyBackupBtn')) copyBackupBtn.onclick=copyBackupText;
  if(document.getElementById('dataImportBackupBtn')) dataImportBackupBtn.onclick=()=>importBackupInput.click();
  if(document.getElementById('enableNotifyBtn')) enableNotifyBtn.onclick=enableBrowserNotifications;
  if(document.getElementById('backupIntervalSelect')) backupIntervalSelect.onchange=e=>saveSettings({backupIntervalDays:Number(e.target.value)||7});
  quickParseBtn.onclick=()=>switchPage('parse'); if(document.getElementById('importExcelBtn')) importExcelBtn.onclick=()=>importExcelInput.click(); if(document.getElementById('importExcelInput')) importExcelInput.onchange=e=>handleLocalExcelImport(e.target.files[0]); if(document.getElementById('exportBackupBtn')) exportBackupBtn.onclick=exportBackup; if(document.getElementById('importBackupBtn')) importBackupBtn.onclick=()=>importBackupInput.click(); if(document.getElementById('importBackupInput')) importBackupInput.onchange=e=>importBackup(e.target.files[0]); if(document.getElementById('confirmImportBtn')) confirmImportBtn.onclick=confirmImportPreview; addProjectBtn.onclick=addProject; resetDemoBtn.onclick=()=>{ if(confirm('恢复示例数据会覆盖当前数据，确定吗？')){projects=demoProjects();save();renderAll();} }; exportBtn.onclick=exportExcel; parseBtn.onclick=parseNotice; clearParseBtn.onclick=()=>{noticeText.value='';parseResult.classList.add('hidden');};
  if(document.getElementById('detailParseBtn')) detailParseBtn.onclick=parseIntoCurrentProject;
  if(document.getElementById('clearDetailParseBtn')) clearDetailParseBtn.onclick=()=>{ detailNoticeText.value=''; };
  if(document.getElementById('prevMonthBtn')) prevMonthBtn.onclick=()=>{ calendarMonth.setMonth(calendarMonth.getMonth()-1); renderSchedule(); };
  if(document.getElementById('nextMonthBtn')) nextMonthBtn.onclick=()=>{ calendarMonth.setMonth(calendarMonth.getMonth()+1); renderSchedule(); };
  if(document.getElementById('folderSearchInput')) folderSearchInput.oninput=e=>{ folderSearch=e.target.value; renderFolderPage(); };
  if(document.getElementById('refreshFoldersBtn')) refreshFoldersBtn.onclick=()=>{ showToast('当前版本不读取文件夹内部文件，无需刷新。'); };
  ['searchInput','stageFilter','typeFilter','screenFilter','priorityFilter'].forEach(id=>{ document.getElementById(id).oninput=e=>{ const map={searchInput:'search',stageFilter:'stage',typeFilter:'type',screenFilter:'screening',priorityFilter:'priority'}; filters[map[id]]=e.target.value; renderProjectTable(); }; });
  fStage.onchange=()=>{ const p=collectDetail(); if(p){ save(false); openDetail(p.id); renderAll(); } };
  ['fSchool','fCollege','fDirection','fType','fPriority','fScreening','fFinal','fDeadline','fResultPub','fInterviewMatDeadline','fInterviewLocation','fInterviewStart','fInterviewEnd','fFinalPub','fOfferDeadline','fInfoUrl','fApplyUrl','fNote'].forEach(id=>{ const el=document.getElementById(id); if(el){ el.onchange=()=>{ const p=collectDetail(); if(p){ save(false); renderSmartDetail(p); renderAll(); } }; }});
  document.body.addEventListener('click',e=>{
    const edit=e.target.dataset.edit; if(edit) openDetail(edit);
    const sort=e.target.dataset.sort; if(sort){ sortState.dir=sortState.key===sort&&sortState.dir==='asc'?'desc':'asc'; sortState.key=sort; renderProjectTable(); }
    if(e.target.dataset.close) document.getElementById(e.target.dataset.close).classList.add('hidden');
    if(e.target.dataset.addItem){ const p=projects.find(x=>x.id===currentEditId); const arr=e.target.dataset.addItem==='application'?p.application.materials:p.interview.tasks; arr.push(makeItem('新项目')); renderListEditor(e.target.dataset.addItem==='application'?'appMats':'intTasks',arr,e.target.dataset.addItem); save(); }
    if(e.target.dataset.completeList){ const p=projects.find(x=>x.id===currentEditId); if(p){ const kind=e.target.dataset.completeList; const arr=kind==='application'?p.application.materials:p.interview.tasks; arr.forEach(x=>x.status='已完成'); renderListEditor(kind==='application'?'appMats':'intTasks',arr,kind); showToast(`${kind==='application'?'申请材料':'复试准备'}已一键完成`); save(); renderAll(); } }
    if(e.target.dataset.completeProject){ const p=projects.find(x=>x.id===e.target.dataset.completeProject); if(p){ const kind=e.target.dataset.kind; const arr=kind==='application'?p.application.materials:p.interview.tasks; arr.forEach(x=>x.status='已完成'); showToast(`${kind==='application'?'申请材料':'复试准备'}已一键完成`); save(); renderAll(); } }
    if(e.target.dataset.delItem!==undefined){ const row=e.target.closest('.check-row'); const p=projects.find(x=>x.id===currentEditId); const arr=row.dataset.kind==='application'?p.application.materials:p.interview.tasks; arr.splice(Number(row.dataset.i),1); renderListEditor(row.dataset.kind==='application'?'appMats':'intTasks',arr,row.dataset.kind); save(); renderAll(); }
    if(e.target.dataset.enableInterview){ const p=projects.find(x=>x.id===currentEditId); if(p){ enableInterview(p); if(stageIndex(p.stage)<3) p.stage='初筛通过/进入复试'; applyStageAutomation(p,p.stage); save(); openDetail(p.id); renderAll(); } }
    if(e.target.dataset.openNode) openDetail(e.target.dataset.openNode);
    if(e.target.dataset.linkFolder) linkFolderToProject(e.target.dataset.linkFolder);
    if(e.target.dataset.refreshFolder) refreshProjectFolder(e.target.dataset.refreshFolder);
    if(e.target.dataset.clearFolder) { if(confirm('确定清除这个项目的文件夹路径吗？')) clearProjectFolder(e.target.dataset.clearFolder); }
    if(e.target.dataset.openFolder) openFolderPath(e.target.dataset.openFolder);
    if(e.target.dataset.copyFolder) copyFolderPath(e.target.dataset.copyFolder);
  });
  document.body.addEventListener('input',e=>{ const row=e.target.closest('.check-row'); if(row){ const p=projects.find(x=>x.id===currentEditId); const arr=row.dataset.kind==='application'?p.application.materials:p.interview.tasks; const it=arr[Number(row.dataset.i)]; if(e.target.dataset.itemName!==undefined) it.name=e.target.value; if(e.target.dataset.itemStatus!==undefined) it.status=e.target.value; save(false); renderAll(); }});
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{ document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active')); b.classList.add('active'); document.getElementById(b.dataset.tab).classList.add('active'); });
  document.querySelectorAll('.seg').forEach(b=>b.onclick=()=>{ document.querySelectorAll('.seg').forEach(x=>x.classList.remove('active')); b.classList.add('active'); materialView=b.dataset.materialView; renderMaterials(); });
  saveDetailBtn.onclick=()=>{ collectDetail(); save(); renderAll(); document.getElementById('detailModal').classList.add('hidden'); };
  deleteProjectBtn.onclick=()=>{ if(confirm('确定删除这个项目吗？')){ projects=projects.filter(p=>p.id!==currentEditId); save(); renderAll(); document.getElementById('detailModal').classList.add('hidden'); } };
  openInfoBtn.onclick=()=>{ const p=projects.find(x=>x.id===currentEditId); if(p?.infoUrl) window.open(p.infoUrl,'_blank'); else showToast('暂无信息网址'); };
  openApplyBtn.onclick=()=>{ const p=projects.find(x=>x.id===currentEditId); if(p?.applyUrl) window.open(p.applyUrl,'_blank'); else showToast('暂无报名地址'); };
  const modal=document.getElementById('detailModal');
  modal.addEventListener('click',e=>{ if(e.target===modal){ collectDetail(); save(false); renderAll(); modal.classList.add('hidden'); } });
  ['importPreviewModal','reminderModal','dataCenterModal'].forEach(mid=>{ const m=document.getElementById(mid); if(m) m.addEventListener('click',e=>{ if(e.target===m) m.classList.add('hidden'); }); });
  modal.addEventListener('keydown',e=>{ if(e.key==='Enter' && !e.shiftKey && e.target.tagName!=='TEXTAREA'){ e.preventDefault(); collectDetail(); save(); renderAll(); modal.classList.add('hidden'); } });
}
load(); initOptions(); bind(); renderAll(); applyUrlState(); restoreFromIndexedDbIfNeeded(); setTimeout(()=>{ showTodayReminder(); checkBackupReminder(); }, 500);
