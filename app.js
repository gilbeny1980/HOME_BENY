'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY='bny-data-v1';
let db={tasks:[],events:[],contacts:[],notes:[],fired:{}};
try{db=Object.assign(db,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
const save=()=>localStorage.setItem(KEY,JSON.stringify(db));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmtDate=s=>new Date(s+'T00:00').toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long'});
function toast(t){const e=$('#toast');e.textContent=t;e.hidden=false;setTimeout(()=>e.hidden=true,2200)}

// tabs
$$('.tabs button').forEach(b=>b.onclick=()=>{$$('.tabs button').forEach(x=>x.classList.toggle('on',x===b));$$('.tab').forEach(t=>t.classList.toggle('active',t.id==='tab-'+b.dataset.t))});
$('#todayLabel').textContent=new Date().toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

// sheet
function sheet(title,html){$('#sheetTitle').textContent=title;$('#sheetBody').innerHTML=html;$('#sheet').hidden=false}
$('#sheetClose').onclick=()=>$('#sheet').hidden=true;
$('#sheet').onclick=e=>{if(e.target.id==='sheet')e.target.hidden=true};
const waze=a=>`https://waze.com/ul?q=${encodeURIComponent(a)}&navigate=yes`;
const intl=p=>{p=p.replace(/[^\d+]/g,'');return p.startsWith('+')?p.slice(1):p.replace(/^0/,'972')};

// tasks
let tf='open';
$('#taskFilters').onclick=e=>{const f=e.target.dataset.f;if(!f)return;tf=f;$$('#taskFilters button').forEach(b=>b.classList.toggle('on',b.dataset.f===f));renderTasks()};
$('#taskForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);db.tasks.unshift({id:uid(),title:f.get('title'),who:f.get('who'),due:f.get('due'),done:false});save();e.target.reset();renderTasks()};
function renderTasks(){
  const today=iso(new Date());
  const l=db.tasks.filter(t=>tf==='all'||(tf==='done')===t.done);
  $('#taskList').innerHTML=l.length?l.map(t=>`<li class="item ${t.done?'done':''} ${!t.done&&t.due&&t.due<today?'late':''}"><button class="check" data-id="${t.id}" data-a="tog">${t.done?'✓':''}</button><div class="main"><b>${esc(t.title)}</b><small>${t.who?'👤 '+esc(t.who)+' ':''}<small class="d">${t.due?'📅 '+fmtDate(t.due):''}</small></small></div><button class="del" data-id="${t.id}" data-a="del">🗑</button></li>`).join(''):'<li class="empty">אין משימות 🎉</li>';
}
$('#taskList').onclick=e=>{const b=e.target.closest('button');if(!b)return;const t=db.tasks.find(x=>x.id===b.dataset.id);if(b.dataset.a==='tog')t.done=!t.done;else if(confirm('למחוק?'))db.tasks=db.tasks.filter(x=>x!==t);save();renderTasks()};

// calendar
let view=new Date(),sel=iso(new Date());view.setDate(1);
function renderCal(){
  const y=view.getFullYear(),m=view.getMonth(),today=iso(new Date());
  $('#monthLabel').textContent=view.toLocaleDateString('he-IL',{month:'long',year:'numeric'});
  const start=new Date(y,m,1-new Date(y,m,1).getDay());
  const has=new Set(db.events.map(e=>e.date));let h='';
  for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const k=iso(d);
    h+=`<button class="day ${d.getMonth()!==m?'out':''} ${k===today?'today':''} ${k===sel?'sel':''} ${has.has(k)?'has':''}" data-d="${k}">${d.getDate()}</button>`}
  $('#days').innerHTML=h;
  $('#selLabel').textContent=fmtDate(sel);
  const ev=db.events.filter(e=>e.date===sel).sort((a,b)=>a.time.localeCompare(b.time));
  $('#eventList').innerHTML=ev.length?ev.map(e=>`<li class="item"><div class="avatar">${esc(e.time)}</div><div class="main"><b>${esc(e.title)}</b><small>${e.remind>=0?'🔔 '+$('#eventForm [name=remind] option[value="'+e.remind+'"]').textContent:'ללא תזכורת'}</small></div><button class="del" data-id="${e.id}">🗑</button></li>`).join(''):'<li class="empty">אין אירועים ביום זה</li>';
  $('#eventForm [name=date]').value=sel;
}
$('#days').onclick=e=>{const d=e.target.closest('.day');if(!d)return;sel=d.dataset.d;const s=new Date(sel+'T00:00');view=new Date(s.getFullYear(),s.getMonth(),1);renderCal()};
$('#prevM').onclick=()=>{view.setMonth(view.getMonth()-1);renderCal()};
$('#nextM').onclick=()=>{view.setMonth(view.getMonth()+1);renderCal()};
$('#goToday').onclick=()=>{sel=iso(new Date());view=new Date();view.setDate(1);renderCal()};
$('#eventForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);db.events.push({id:uid(),title:f.get('title'),date:f.get('date'),time:f.get('time')||'00:00',remind:+f.get('remind')});sel=f.get('date');save();e.target.title.value='';renderCal();checkReminders();if(+f.get('remind')>=0&&Notification.permission==='default')askNotif()};
$('#eventList').onclick=e=>{const b=e.target.closest('.del');if(b&&confirm('למחוק?')){db.events=db.events.filter(x=>x.id!==b.dataset.id);save();renderCal()}};

// reminders (שרת-פוש חיצוני אינו נדרש: התראות מקומיות בכל מכשיר שבו האפליקציה מותקנת)
async function notify(title,body){
  toast('🔔 '+title);
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  try{const r=await navigator.serviceWorker.ready;await r.showNotification(title,{body,icon:'icon.svg',dir:'rtl',lang:'he',tag:title+body,vibrate:[200,100,200]})}catch{new Notification(title,{body})}
}
function checkReminders(){
  const now=Date.now();let ch=false;
  for(const e of db.events){if(e.remind<0)continue;
    const at=new Date(`${e.date}T${e.time}`).getTime(),fire=at-e.remind*60000;
    if(now>=fire&&now<at+3600000&&!db.fired[e.id]){db.fired[e.id]=1;ch=true;
      notify('תזכורת: '+e.title,`${fmtDate(e.date)} בשעה ${e.time}`)}}
  const today=iso(new Date());
  if(!db.fired['d'+today]&&new Date().getHours()>=8){const n=db.tasks.filter(t=>!t.done&&t.due&&t.due<=today).length;
    if(n){db.fired['d'+today]=1;ch=true;notify('משימות להיום',`יש ${n} משימות פתוחות להיום או באיחור`)}}
  if(ch)save();
}
function askNotif(){if(!('Notification' in window))return toast('הדפדפן לא תומך בהתראות');Notification.requestPermission().then(()=>updNotifBtn())}
function updNotifBtn(){const b=$('#notifBtn');if(!('Notification' in window)||Notification.permission==='granted')b.hidden=true}
$('#notifBtn').onclick=askNotif;
setInterval(checkReminders,30000);document.addEventListener('visibilitychange',checkReminders);

// contacts
function renderContacts(){
  const q=$('#search').value.trim().toLowerCase();
  const l=db.contacts.filter(c=>!q||(c.name+c.phone+c.address).toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'he'));
  $('#contactList').innerHTML=l.length?l.map(c=>`<li class="item" data-id="${c.id}"><div class="avatar">${esc(c.name[0])}</div><div class="main"><b>${esc(c.name)}</b><small>${esc(c.phone)} ${c.note?'· '+esc(c.note):''}</small>${c.address?`<br><button class="addr" data-w="${c.id}">📍 ${esc(c.address)}</button>`:''}</div><button class="del" data-x="${c.id}">🗑</button></li>`).join(''):'<li class="empty">אין אנשי קשר</li>';
  const sel=$('#noteContact');const v=sel.value;
  sel.innerHTML='<option value="">ללא איש קשר</option>'+db.contacts.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');sel.value=v;
}
$('#search').oninput=renderContacts;
$('#contactForm').onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));db.contacts.push({id:uid(),...f});save();e.target.reset();renderContacts()};
$('#contactList').onclick=e=>{
  const x=e.target.closest('[data-x]');if(x){if(confirm('למחוק?')){db.contacts=db.contacts.filter(c=>c.id!==x.dataset.x);save();renderContacts()}return}
  const w=e.target.closest('[data-w]');if(w){const c=db.contacts.find(c=>c.id===w.dataset.w);open(waze(c.address),'_blank');return}
  const it=e.target.closest('.item');if(!it)return;const c=db.contacts.find(c=>c.id===it.dataset.id);
  const notes=db.notes.filter(n=>n.contact===c.id);
  let h='';
  if(c.phone)h+=`<a class="act" href="tel:${esc(c.phone)}">📞 התקשר ${esc(c.phone)}</a><a class="act" href="sms:${esc(c.phone)}">💬 שלח SMS</a><a class="act" href="https://wa.me/${intl(c.phone)}" target="_blank">🟢 וואטסאפ</a>`;
  if(c.address)h+=`<a class="act" href="${waze(c.address)}" target="_blank">🚗 נווט ב-Waze: ${esc(c.address)}</a>`;
  if(notes.length)h+=notes.map(n=>`<div class="act">📝 <span><b>${esc(n.title)}</b><br>${esc(n.text)}</span></div>`).join('');
  sheet(c.name,h||'<p class="empty">אין פרטים</p>');
};

// notes
$('#noteForm').onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));db.notes.unshift({id:uid(),...f,at:Date.now()});save();e.target.reset();renderNotes()};
function renderNotes(){
  $('#noteList').innerHTML=db.notes.length?db.notes.map(n=>{const c=db.contacts.find(c=>c.id===n.contact);
    return `<li class="item note"><div class="main"><b>${esc(n.title)}</b>${c?`<small>👤 ${esc(c.name)}</small>`:''}<p class="noteText">${esc(n.text)}</p>${c&&c.address?`<button class="addr" data-w="${esc(c.address)}">📍 נווט ב-Waze</button>`:''}</div><button class="del" data-id="${n.id}">🗑</button></li>`}).join(''):'<li class="empty">אין הערות</li>';
}
$('#noteList').onclick=e=>{const w=e.target.closest('[data-w]');if(w)return open(waze(w.dataset.w),'_blank');const b=e.target.closest('.del');if(b&&confirm('למחוק?')){db.notes=db.notes.filter(n=>n.id!==b.dataset.id);save();renderNotes()}};

renderTasks();renderCal();renderContacts();renderNotes();updNotifBtn();checkReminders();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
