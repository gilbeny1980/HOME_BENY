'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY='bny-data-v1';
let db={tasks:[],events:[],contacts:[],notes:[],fired:{}};
try{db=Object.assign(db,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
const CODE_KEY='bny-code';
const KIDS=[['לינוי','#e0527a'],['רומי','#8e5bd6'],['אלין','#2f9e8f'],['גיל','#e8912d'],['אדה','#3b82c4']];
const kidColor=n=>(KIDS.find(k=>k[0]===n)||[])[1]||'#888';
let kidFilter='';
let adminPw=sessionStorage.getItem('bny-admin')||'';
let syncT;
db.events.forEach(e=>{if(!e.at)e.at=new Date(`${e.date}T${e.time}`).getTime()});
const save=()=>{localStorage.setItem(KEY,JSON.stringify(db));clearTimeout(syncT);syncT=setTimeout(sync,600)};
const touch=o=>{o.u=Date.now();return o};
const live=a=>a.filter(x=>!x.del);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmtDate=s=>new Date(s+'T00:00').toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long'});
function toast(t){const e=$('#toast');e.textContent=t;e.hidden=false;setTimeout(()=>e.hidden=true,2200)}

// tabs
$$('.tabs button').forEach(b=>b.onclick=()=>{$$('.tabs button').forEach(x=>x.classList.toggle('on',x===b));$$('.tab').forEach(t=>t.classList.toggle('active',t.id==='tab-'+b.dataset.t))});
function tick(){const d=new Date();
  $('#clock').textContent=d.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  $('#dateLine').textContent=d.toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  $('#hebLine').textContent=d.toLocaleDateString('he-IL-u-ca-hebrew',{day:'numeric',month:'long',year:'numeric'});}
tick();setInterval(tick,1000);
function renderKids(){
  $('#kids').innerHTML=KIDS.map(([n,c])=>`<button class="kid ${kidFilter===n?'on':''}" style="--c:${c}" data-k="${n}">${n}</button>`).join('');
  const opts='<option value="">כולם</option>'+KIDS.map(k=>`<option>${k[0]}</option>`).join('');
  $('#kidSel').innerHTML=opts;$('#whoSel').innerHTML=opts;
}
$('#kids').onclick=e=>{const b=e.target.closest('.kid');if(!b)return;kidFilter=kidFilter===b.dataset.k?'':b.dataset.k;renderKids();renderCal()};

// sheet
function sheet(title,html){$('#sheetTitle').textContent=title;$('#sheetBody').innerHTML=html;$('#sheet').hidden=false}
$('#sheetClose').onclick=()=>$('#sheet').hidden=true;
$('#sheet').onclick=e=>{if(e.target.id==='sheet')e.target.hidden=true};
const waze=a=>`https://waze.com/ul?q=${encodeURIComponent(a)}&navigate=yes`;
const intl=p=>{p=p.replace(/[^\d+]/g,'');return p.startsWith('+')?p.slice(1):p.replace(/^0/,'972')};

// tasks
let tf='open';
$('#taskFilters').onclick=e=>{const f=e.target.dataset.f;if(!f)return;tf=f;$$('#taskFilters button').forEach(b=>b.classList.toggle('on',b.dataset.f===f));renderTasks()};
$('#taskForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);db.tasks.unshift(touch({id:uid(),title:f.get('title'),who:f.get('who'),due:f.get('due'),done:false}));save();e.target.reset();renderTasks()};
function renderTasks(){
  const today=iso(new Date());
  const l=live(db.tasks).filter(t=>tf==='all'||(tf==='done')===t.done);
  $('#taskList').innerHTML=l.length?l.map(t=>`<li class="item ${t.done?'done':''} ${!t.done&&t.due&&t.due<today?'late':''}"><button class="check" data-id="${t.id}" data-a="tog">${t.done?'✓':''}</button><div class="main"><b>${esc(t.title)}</b><small>${t.who?`<span class="tag" style="--c:${kidColor(t.who)}">${esc(t.who)}</span> `:''}<small class="d">${t.due?'📅 '+fmtDate(t.due):''}</small></small></div><button class="del" data-id="${t.id}" data-a="del">🗑</button></li>`).join(''):'<li class="empty">אין משימות 🎉</li>';
}
$('#taskList').onclick=e=>{const b=e.target.closest('button');if(!b)return;const t=db.tasks.find(x=>x.id===b.dataset.id);if(b.dataset.a==='tog')touch(t).done=!t.done;else if(confirm('למחוק?')){t.del=1;touch(t)}save();renderTasks()};

// calendar
let view=new Date(),sel=iso(new Date());view.setDate(1);
function renderCal(){
  const y=view.getFullYear(),m=view.getMonth(),today=iso(new Date());
  $('#monthLabel').textContent=view.toLocaleDateString('he-IL',{month:'long',year:'numeric'});
  const start=new Date(y,m,1-new Date(y,m,1).getDay());
  const evs=live(db.events).filter(e=>!kidFilter||!e.kid||e.kid===kidFilter);const has=new Set(evs.map(e=>e.date));let h='';
  for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const k=iso(d);
    h+=`<button class="day ${d.getMonth()!==m?'out':''} ${k===today?'today':''} ${k===sel?'sel':''} ${has.has(k)?'has':''}" data-d="${k}">${d.getDate()}</button>`}
  $('#days').innerHTML=h;
  $('#selLabel').textContent=fmtDate(sel);
  const ev=evs.filter(e=>e.date===sel).sort((a,b)=>a.time.localeCompare(b.time));
  $('#eventList').innerHTML=ev.length?ev.map(e=>`<li class="item"><div class="avatar">${esc(e.time)}</div><div class="main"><b>${esc(e.title)}${e.kid?`<span class="tag" style="--c:${kidColor(e.kid)}">${esc(e.kid)}</span>`:''}</b><small>${e.remind>=0?'🔔 '+$('#eventForm [name=remind] option[value="'+e.remind+'"]').textContent:'ללא תזכורת'}</small></div><button class="del" data-id="${e.id}">🗑</button></li>`).join(''):'<li class="empty">אין אירועים ביום זה</li>';
  $('#eventForm [name=date]').value=sel;
}
$('#days').onclick=e=>{const d=e.target.closest('.day');if(!d)return;sel=d.dataset.d;const s=new Date(sel+'T00:00');view=new Date(s.getFullYear(),s.getMonth(),1);renderCal()};
$('#prevM').onclick=()=>{view.setMonth(view.getMonth()-1);renderCal()};
$('#nextM').onclick=()=>{view.setMonth(view.getMonth()+1);renderCal()};
$('#goToday').onclick=()=>{sel=iso(new Date());view=new Date();view.setDate(1);renderCal()};
$('#eventForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);const tm=f.get('time')||'00:00';db.events.push(touch({id:uid(),title:f.get('title'),date:f.get('date'),time:tm,kid:f.get('kid')||'',at:new Date(`${f.get('date')}T${tm}`).getTime(),remind:+f.get('remind')}));sel=f.get('date');save();e.target.title.value='';e.target.closest('details').open=false;renderCal();checkReminders();if(+f.get('remind')>=0&&Notification.permission==='default')askNotif()};
$('#eventList').onclick=e=>{const b=e.target.closest('.del');if(b&&confirm('למחוק?')){const x=db.events.find(x=>x.id===b.dataset.id);x.del=1;touch(x);save();renderCal()}};

// reminders (שרת-פוש חיצוני אינו נדרש: התראות מקומיות בכל מכשיר שבו האפליקציה מותקנת)
async function notify(title,body){
  toast('🔔 '+title);
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  try{const r=await navigator.serviceWorker.ready;await r.showNotification(title,{body,icon:'icon.svg',dir:'rtl',lang:'he',tag:title+body,vibrate:[200,100,200]})}catch{new Notification(title,{body})}
}
function checkReminders(){
  const now=Date.now();let ch=false;
  if(pushOn)return;
  for(const e of live(db.events)){if(e.remind<0)continue;
    const at=new Date(`${e.date}T${e.time}`).getTime(),fire=at-e.remind*60000;
    if(now>=fire&&now<at+3600000&&!db.fired[e.id]){db.fired[e.id]=1;ch=true;
      notify('תזכורת: '+e.title,`${fmtDate(e.date)} בשעה ${e.time}`)}}
  const today=iso(new Date());
  if(!db.fired['d'+today]&&new Date().getHours()>=8){const n=!adminPw?0:live(db.tasks).filter(t=>!t.done&&t.due&&t.due<=today).length;
    if(n){db.fired['d'+today]=1;ch=true;notify('משימות להיום',`יש ${n} משימות פתוחות להיום או באיחור`)}}
  if(ch)save();
}
function askNotif(){if(!('Notification' in window))return toast('הדפדפן לא תומך בהתראות');Notification.requestPermission().then(()=>{updNotifBtn();enablePush()})}
let pushOn=localStorage.getItem('bny-push')==='1';
const b64=s=>{s=(s+'='.repeat((4-s.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s),c=>c.charCodeAt(0))};
const hdr=()=>({'x-family-code':localStorage.getItem(CODE_KEY)||'','x-admin-code':adminPw,'content-type':'application/json'});
async function enablePush(){
  try{
    if(!('PushManager' in window)||Notification.permission!=='granted'||!localStorage.getItem(CODE_KEY))return;
    const {key}=await (await fetch('/api/subscribe',{headers:hdr()})).json();if(!key)return;
    const reg=await navigator.serviceWorker.ready;
    const sub=(await reg.pushManager.getSubscription())||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(key)});
    const r=await fetch('/api/subscribe',{method:'POST',headers:hdr(),body:JSON.stringify(sub)});
    if(r.ok){pushOn=true;localStorage.setItem('bny-push','1')}
  }catch(e){}
}
let syncing=false;
async function sync(){
  if(syncing)return;
  let code=localStorage.getItem(CODE_KEY);
  if(!code){code=prompt('קוד משפחתי לסנכרון בין המכשירים:');if(!code)return;localStorage.setItem(CODE_KEY,code.trim())}
  syncing=true;
  try{
    const {tasks,events,contacts,notes}=db;
    const r=await fetch('/api/data',{method:'POST',headers:hdr(),body:JSON.stringify(adminPw?{tasks,events,contacts,notes}:{events,contacts,notes})});
    if(r.status===401){localStorage.removeItem(CODE_KEY);toast('קוד שגוי');return}
    if(!r.ok)return;
    const m=await r.json();
    if(JSON.stringify(adminPw?{tasks,events,contacts,notes}:{events,contacts,notes})!==JSON.stringify(m)){Object.assign(db,m);localStorage.setItem(KEY,JSON.stringify(db));renderAll()}
    enablePush();
  }catch(e){}finally{syncing=false}
}
setInterval(()=>{if(!document.hidden)sync()},30000);
addEventListener('online',sync);
function updNotifBtn(){const b=$('#notifBtn');if(!('Notification' in window)||Notification.permission==='granted')b.hidden=true}
$('#notifBtn').onclick=askNotif;
setInterval(checkReminders,30000);document.addEventListener('visibilitychange',checkReminders);

// contacts
function renderContacts(){
  const q=$('#search').value.trim().toLowerCase();
  const l=live(db.contacts).filter(c=>!q||(c.name+c.phone+c.address).toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'he'));
  $('#contactList').innerHTML=l.length?l.map(c=>`<li class="item" data-id="${c.id}"><div class="avatar">${esc(c.name[0])}</div><div class="main"><b>${esc(c.name)}</b><small>${esc(c.phone)} ${c.note?'· '+esc(c.note):''}</small>${c.address?`<br><button class="addr" data-w="${c.id}">📍 ${esc(c.address)}</button>`:''}</div><button class="del" data-x="${c.id}">🗑</button></li>`).join(''):'<li class="empty">אין אנשי קשר</li>';
  const sel=$('#noteContact');const v=sel.value;
  sel.innerHTML='<option value="">ללא איש קשר</option>'+live(db.contacts).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');sel.value=v;
}
$('#search').oninput=renderContacts;
$('#contactForm').onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));db.contacts.push(touch({id:uid(),...f}));save();e.target.reset();renderContacts()};
$('#contactList').onclick=e=>{
  const x=e.target.closest('[data-x]');if(x){if(confirm('למחוק?')){const c=db.contacts.find(c=>c.id===x.dataset.x);c.del=1;touch(c);save();renderContacts()}return}
  const w=e.target.closest('[data-w]');if(w){const c=db.contacts.find(c=>c.id===w.dataset.w);open(waze(c.address),'_blank');return}
  const it=e.target.closest('.item');if(!it)return;const c=db.contacts.find(c=>c.id===it.dataset.id);
  const notes=live(db.notes).filter(n=>n.contact===c.id);
  let h='';
  if(c.phone)h+=`<a class="act" href="tel:${esc(c.phone)}">📞 התקשר ${esc(c.phone)}</a><a class="act" href="sms:${esc(c.phone)}">💬 שלח SMS</a><a class="act" href="https://wa.me/${intl(c.phone)}" target="_blank">🟢 וואטסאפ</a>`;
  if(c.address)h+=`<a class="act" href="${waze(c.address)}" target="_blank">🚗 נווט ב-Waze: ${esc(c.address)}</a>`;
  if(notes.length)h+=notes.map(n=>`<div class="act">📝 <span><b>${esc(n.title)}</b><br>${esc(n.text)}</span></div>`).join('');
  sheet(c.name,h||'<p class="empty">אין פרטים</p>');
};

// notes
$('#noteForm').onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));db.notes.unshift(touch({id:uid(),...f}));save();e.target.reset();renderNotes()};
function renderNotes(){
  const nl=live(db.notes).sort((a,b)=>b.u-a.u);$('#noteList').innerHTML=nl.length?nl.map(n=>{const c=live(db.contacts).find(c=>c.id===n.contact);
    return `<li class="item note"><div class="main"><b>${esc(n.title)}</b>${c?`<small>👤 ${esc(c.name)}</small>`:''}<p class="noteText">${esc(n.text)}</p>${c&&c.address?`<button class="addr" data-w="${esc(c.address)}">📍 נווט ב-Waze</button>`:''}</div><button class="del" data-id="${n.id}">🗑</button></li>`}).join(''):'<li class="empty">אין הערות</li>';
}
$('#noteList').onclick=e=>{const w=e.target.closest('[data-w]');if(w)return open(waze(w.dataset.w),'_blank');const b=e.target.closest('.del');if(b&&confirm('למחוק?')){const n=db.notes.find(n=>n.id===b.dataset.id);n.del=1;touch(n);save();renderNotes()}};

function renderAdmin(){const on=!!adminPw;$('#loginForm').hidden=on;$('#adminBody').hidden=!on;if(on)renderTasks()}
$('#loginForm').onsubmit=async e=>{e.preventDefault();const pw=e.target.pw.value;
  if(!localStorage.getItem(CODE_KEY))await sync();
  try{const r=await fetch('/api/auth',{headers:{...hdr(),'x-admin-code':pw}});
    if(!r.ok)return toast('סיסמה שגויה');
    adminPw=pw;sessionStorage.setItem('bny-admin',pw);e.target.reset();renderAdmin();sync()}catch{toast('אין חיבור לשרת')}};
$('#lockBtn').onclick=()=>{adminPw='';sessionStorage.removeItem('bny-admin');renderAdmin()};
function renderAll(){renderKids();renderAdmin();renderCal();renderContacts();renderNotes()}
renderAll();updNotifBtn();checkReminders();sync();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
