'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY='bny-data-v1';
let db={tasks:[],events:[],contacts:[],notes:[],fired:{}};
try{db=Object.assign(db,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
let token=localStorage.getItem('bny-token')||'';
let myName=localStorage.getItem('bny-name')||'';
const KIDS=[['לינוי','#e0527a'],['רומי','#8e5bd6'],['אלין','#2f9e8f'],['גיל','#e8912d'],['אדוה','#3b82c4']];
const kidColor=n=>(KIDS.find(k=>k[0]===n)||[])[1]||'#888';
let kidFilter='';
let adminTok=localStorage.getItem('bny-admin')||'';
let syncT;
db.events.forEach(e=>{if(!e.at)e.at=new Date(`${e.date}T${e.time}`).getTime()});
// שינוי שם: אדה -> אדוה (נתונים קיימים)
db.events.forEach(e=>{if(e.kid==='אדה')e.kid='אדוה'});db.tasks.forEach(t=>{if(t.who==='אדה')t.who='אדוה'});
db.contacts.forEach(c=>{if((c.kids||[]).includes('אדה'))c.kids=c.kids.map(k=>k==='אדה'?'אדוה':k)});
// העברת הערות ישנות אל איש הקשר
if(!db.notesMigrated){for(const n of db.notes){if(n.del||!n.contact)continue;const c=db.contacts.find(c=>c.id===n.contact);if(c&&!(c.info||'').includes(n.text||'')){c.info=((c.info?c.info+'\n':'')+(n.title?n.title+': ':'')+(n.text||'')).trim();c.u=Date.now()}}db.notesMigrated=1}
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
  $('#dateLine').textContent=d.toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long',year:'numeric'});}
function renderToday(){
  const d=new Date(),h=d.getHours();
  $('#greet').textContent=(h<5?'לילה טוב':h<12?'בוקר טוב':h<18?'צהריים טובים':h<22?'ערב טוב':'לילה טוב')+' '+(myName||'משפחת בן יהודה');
  const t=iso(d),hm=`${pad(h)}:${pad(d.getMinutes())}`;
  const ev=live(db.events).filter(e=>e.date===t).sort((a,b)=>a.time.localeCompare(b.time));
  const nxt=ev.find(e=>e.time>=hm);
  $('#todaySum').textContent=ev.length?`היום ${ev.length} אירועים`+(nxt?` · הבא: ${nxt.title} ב־${nxt.time}`:''):'';
}
tick();setInterval(tick,1000);setInterval(()=>{renderToday();renderKids()},30000);
function renderKids(){
  const today=iso(new Date());
  $('#kids').innerHTML=KIDS.map(([n,c])=>{const cnt=live(db.events).filter(e=>e.date===today&&e.kid===n).length;
    return `<button class="kid ${kidFilter===n?'on':''}" style="--c:${c}" data-k="${n}"><span class="av">${n[0]}</span><span class="nm">${n}</span>${cnt?`<b class="bd">${cnt}</b>`:''}</button>`}).join('');
  const opts='<option value="">כולם</option>'+KIDS.map(k=>`<option>${k[0]}</option>`).join('');
  $('#kidChecks').innerHTML=KIDS.map(([n,c])=>`<label class="ck" style="--c:${c}"><input type="checkbox" name="kids" value="${n}"><span>${n}</span></label>`).join('');
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
  $('#taskList').innerHTML=l.length?l.map(t=>`<li class="item ${t.done?'done':''} ${!t.done&&t.due&&t.due<today?'late':''}" style="--c:${t.who?kidColor(t.who):'var(--b1)'}"><button class="check" data-id="${t.id}" data-a="tog">${t.done?'✓':''}</button><div class="main"><b>${esc(t.title)}</b><small>${t.who?`<span class="tag" style="--c:${kidColor(t.who)}">${esc(t.who)}</span> `:''}<small class="d">${t.due?'📅 '+fmtDate(t.due):''}</small></small></div><button class="del" data-id="${t.id}" data-a="del">🗑</button></li>`).join(''):'<li class="empty">אין משימות 🎉</li>';
}
$('#taskList').onclick=e=>{const b=e.target.closest('button');if(!b)return;const t=db.tasks.find(x=>x.id===b.dataset.id);if(b.dataset.a==='tog')touch(t).done=!t.done;else if(confirm('למחוק?')){t.del=1;touch(t)}save();renderTasks()};

// calendar
let view=new Date(),sel=iso(new Date());view.setDate(1);
function renderCal(){
  const y=view.getFullYear(),m=view.getMonth(),today=iso(new Date());
  $('#monthLabel').textContent=view.toLocaleDateString('he-IL',{month:'long',year:'numeric'});
  const start=new Date(y,m,1-new Date(y,m,1).getDay());
  const evs=live(db.events).filter(e=>!kidFilter||!e.kid||e.kid===kidFilter);const dm={};evs.forEach(e=>{(dm[e.date]=dm[e.date]||new Set()).add(e.kid?kidColor(e.kid):'#ffc24a')});let h='';
  for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const k=iso(d);
    h+=`<button class="day ${d.getMonth()!==m?'out':''} ${k===today?'today':''} ${k===sel?'sel':''} " data-d="${k}">${d.getDate()}${dm[k]?`<i class="dots">${[...dm[k]].slice(0,3).map(c=>`<s style="background:${c}"></s>`).join('')}</i>`:''}</button>`}
  $('#days').innerHTML=h;
  $('#selLabel').textContent=fmtDate(sel);
  const ev=evs.filter(e=>e.date===sel).sort((a,b)=>a.time.localeCompare(b.time));
  $('#eventList').innerHTML=ev.length?ev.map(e=>`<li class="item" style="--c:${e.kid?kidColor(e.kid):'var(--b1)'}"><div class="avatar">${esc(e.time)}</div><div class="main"><b>${esc(e.title)}${e.kid?`<span class="tag" style="--c:${kidColor(e.kid)}">${esc(e.kid)}</span>`:''}</b><small>${e.remind>=0?'🔔 '+$('#eventForm [name=remind] option[value="'+e.remind+'"]').textContent:'ללא תזכורת'}</small></div><button class="share" data-s="${e.id}" title="שלח תזכורת">📤</button><button class="del" data-id="${e.id}">🗑</button></li>`).join(''):'<li class="empty">אין אירועים ביום זה</li>';
  $('#eventForm [name=date]').value=sel;
  renderToday();renderKids();
}
$('#days').onclick=e=>{const d=e.target.closest('.day');if(!d)return;sel=d.dataset.d;const s=new Date(sel+'T00:00');view=new Date(s.getFullYear(),s.getMonth(),1);renderCal()};
$('#prevM').onclick=()=>{view.setMonth(view.getMonth()-1);renderCal()};
$('#nextM').onclick=()=>{view.setMonth(view.getMonth()+1);renderCal()};
$('#goToday').onclick=()=>{sel=iso(new Date());view=new Date();view.setDate(1);renderCal()};
$('#eventForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);const tm=f.get('time')||'00:00';db.events.push(touch({id:uid(),title:f.get('title'),date:f.get('date'),time:tm,kid:f.get('kid')||'',at:new Date(`${f.get('date')}T${tm}`).getTime(),remind:+f.get('remind')}));sel=f.get('date');save();e.target.title.value='';e.target.closest('details').open=false;renderCal();checkReminders();if(+f.get('remind')>=0&&Notification.permission==='default')askNotif()};
function shareEvent(ev){
  const txt=`תזכורת: ${ev.title}${ev.kid?' ('+ev.kid+')':''} – ${fmtDate(ev.date)} בשעה ${ev.time}`;
  const cs=live(db.contacts).filter(c=>(c.phone||c.email)&&(!ev.kid||!(c.kids||[]).length||c.kids.includes(ev.kid)));
  let h=`<p class="mut">${esc(txt)}</p>`;
  h+=cs.map(c=>`<div class="act"><b style="flex:1">${esc(c.name)}</b>${c.phone?`<a href="https://wa.me/${intl(c.phone)}?text=${encodeURIComponent(txt)}" target="_blank">🟢</a><a href="sms:${esc(c.phone)}?&body=${encodeURIComponent(txt)}">💬</a>`:''}${c.email?`<a href="mailto:${esc(c.email)}?subject=${encodeURIComponent('תזכורת: '+ev.title)}&body=${encodeURIComponent(txt)}">✉️</a>`:''}</div>`).join('')||'<p class="empty">אין אנשי קשר מתאימים</p>';
  h+=`<a class="act" href="https://wa.me/?text=${encodeURIComponent(txt)}" target="_blank">🟢 וואטסאפ – בחירת נמען / קבוצה</a>`;
  sheet('שליחת תזכורת',h);
}
$('#eventList').onclick=e=>{const s=e.target.closest('.share');if(s)return shareEvent(db.events.find(x=>x.id===s.dataset.s));const b=e.target.closest('.del');if(b&&confirm('למחוק?')){const x=db.events.find(x=>x.id===b.dataset.id);x.del=1;touch(x);save();renderCal()}};

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
  if(!db.fired['d'+today]&&new Date().getHours()>=8){const n=!adminTok?0:live(db.tasks).filter(t=>!t.done&&t.due&&t.due<=today).length;
    if(n){db.fired['d'+today]=1;ch=true;notify('משימות להיום',`יש ${n} משימות פתוחות להיום או באיחור`)}}
  if(ch)save();
}
function askNotif(){if(!('Notification' in window))return toast('הדפדפן לא תומך בהתראות');Notification.requestPermission().then(()=>{updNotifBtn();enablePush()})}
let pushOn=localStorage.getItem('bny-push')==='1';
const b64=s=>{s=(s+'='.repeat((4-s.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s),c=>c.charCodeAt(0))};
const hdr=()=>({'x-token':token,'x-admin-code':adminTok,'content-type':'application/json'});
async function enablePush(){
  try{
    if(!('PushManager' in window)||Notification.permission!=='granted'||!token)return;
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
  if(!token){showLogin();return}
  syncing=true;
  try{
    const {tasks,events,contacts,notes}=db;
    const body=adminTok?{tasks,events,contacts,notes}:{events,contacts,notes};
    const r=await fetch('/api/data',{method:'POST',headers:hdr(),body:JSON.stringify(body)});
    if(r.status===401){logout(true);return}
    if(!r.ok)return;
    const m=await r.json();
    if(JSON.stringify(body)!==JSON.stringify(m)){Object.assign(db,m);localStorage.setItem(KEY,JSON.stringify(db));renderAll()}
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
  const l=live(db.contacts).filter(c=>(!kidFilter||(c.kids||[]).includes(kidFilter))&&(!q||(c.name+c.phone+c.address+(c.email||'')).toLowerCase().includes(q))).sort((a,b)=>a.name.localeCompare(b.name,'he'));
  $('#contactList').innerHTML=l.length?l.map(c=>`<li class="item" data-id="${c.id}"><div class="avatar">${esc(c.name[0])}</div><div class="main"><b>${esc(c.name)}</b><small>${esc(c.phone)} ${c.note?'· '+esc(c.note):''}</small>${c.info?`<p class="info">📝 ${esc(c.info)}</p>`:''}<div>${(c.kids||[]).map(k=>`<span class="tag" style="--c:${kidColor(k)}">${esc(k)}</span>`).join('')}</div>${c.address?`<br><button class="addr" data-w="${c.id}">📍 ${esc(c.address)}</button>`:''}</div>${c.address?`<button class="wazeBtn" data-w="${c.id}" aria-label="Waze">🚗<span>Waze</span></button>`:''}<button class="del" data-x="${c.id}">🗑</button></li>`).join(''):'<li class="empty">אין אנשי קשר</li>';
}
$('#search').oninput=renderContacts;
let editId='';
function endEdit(){editId='';$('#contactForm').reset();$('#contactForm h3').textContent='איש קשר חדש';$('#contactSave').textContent='＋ שמור';$('#contactCancel').hidden=true}
function editContact(c){editId=c.id;const f=$('#contactForm');
  for(const k of ['name','phone','email','address','note','info'])f.elements[k].value=c[k]||'';
  $$('#kidChecks input').forEach(i=>i.checked=(c.kids||[]).includes(i.value));
  f.querySelector('h3').textContent='עריכת איש קשר';$('#contactSave').textContent='שמור שינויים';$('#contactCancel').hidden=false;
  f.scrollIntoView({behavior:'smooth',block:'center'})}
$('#contactCancel').onclick=endEdit;
$('#contactForm').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.target);const f=Object.fromEntries(fd);delete f.kids;f.kids=fd.getAll('kids');
  if(editId){const c=db.contacts.find(c=>c.id===editId);Object.assign(c,f);touch(c)}else db.contacts.push(touch({id:uid(),...f}));
  save();endEdit();renderContacts()};
$('#contactList').onclick=e=>{
  const x=e.target.closest('[data-x]');if(x){if(confirm('למחוק?')){const c=db.contacts.find(c=>c.id===x.dataset.x);c.del=1;touch(c);save();renderContacts()}return}
  const w=e.target.closest('[data-w]');if(w){const c=db.contacts.find(c=>c.id===w.dataset.w);open(waze(c.address),'_blank');return}
  const it=e.target.closest('.item');if(!it)return;const c=db.contacts.find(c=>c.id===it.dataset.id);
  let h=c.address?`<a class="act waze" href="${waze(c.address)}" target="_blank" rel="noopener">🚗 <span><b>נווט ב-Waze</b><br><small>${esc(c.address)}</small></span></a>`:`<div class="act" style="opacity:.7">📍 אין כתובת – לחץ "ערוך" כדי להוסיף</div>`;
  if(c.info)h+=`<div class="act info2">📝 <span>${esc(c.info)}</span></div>`;
  if(c.phone)h+=`<a class="act" href="tel:${esc(c.phone)}">📞 התקשר ${esc(c.phone)}</a><a class="act" href="sms:${esc(c.phone)}">💬 שלח SMS</a><a class="act" href="https://wa.me/${intl(c.phone)}" target="_blank">🟢 וואטסאפ</a>`;
  if(c.email)h+=`<a class="act" href="mailto:${esc(c.email)}">✉️ שלח מייל ${esc(c.email)}</a>`;
  h+=`<button class="act" data-edit="${c.id}">✏️ ערוך איש קשר</button>`;
  sheet(c.name,h);
  $('#sheetBody [data-edit]').onclick=()=>{$('#sheet').hidden=true;editContact(c)};
};


function renderAdmin(){const on=!!adminTok;$('#adminGate').hidden=on;if(on)$('#otpForm').hidden=true;$('#adminBody').hidden=!on;if(on){renderTasks();loadUsers()}}
async function requestOtp(){
  try{const r=await fetch('/api/otp',{method:'POST',headers:hdr(),body:JSON.stringify({action:'request'})});
    if(r.status===429){toast('יותר מדי בקשות, נסה בעוד כמה דקות');return false}
    if(!r.ok){toast('שליחת המייל נכשלה');return false}
    toast('הקוד נשלח למייל המנהל');return true}catch{toast('אין חיבור לשרת');return false}}
async function verifyOtp(code){
  try{const r=await fetch('/api/otp',{method:'POST',headers:hdr(),body:JSON.stringify({action:'verify',code})});
    if(!r.ok){toast('קוד שגוי או שפג תוקפו');return null}
    return await r.json()}catch{toast('אין חיבור לשרת');return null}}
$('#sendOtp').onclick=async()=>{if(await requestOtp())$('#otpForm').hidden=false};
$('#otpForm').onsubmit=async e=>{e.preventDefault();const t=await verifyOtp(e.target.code.value);if(!t)return;
  adminTok=t.token;localStorage.setItem('bny-admin',adminTok);e.target.reset();renderAdmin();sync()};
$('#lockBtn').onclick=()=>{adminTok='';localStorage.removeItem('bny-admin');renderAdmin()};
// users + password (manager)
async function usersCall(body){
  const r=await fetch('/api/users',{method:body?'POST':'GET',headers:hdr(),body:body?JSON.stringify(body):undefined});
  if(!r.ok){toast(r.status===401?'אין הרשאת מנהל':'שגיאה');return null}return r.json()}
async function loadUsers(){const d=await usersCall();if(d)renderUsers(d.users)}
function renderUsers(us){$('#userList').innerHTML=us.map(u=>`<li class="item"><div class="avatar">${esc(u.n[0])}</div><div class="main"><b>${esc(u.n)}</b><small dir="ltr">${esc(u.u)}</small></div><button class="del" data-u="${esc(u.u)}">🗑</button></li>`).join('')}
$('#userList').onclick=async e=>{const b=e.target.closest('[data-u]');if(!b||!confirm('להסיר את המשתמש?'))return;const d=await usersCall({action:'remove',u:b.dataset.u});if(d)renderUsers(d.users)};
$('#userForm').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const d=await usersCall({action:'save',...f});if(d){renderUsers(d.users);e.target.reset();toast('נשמר')}};
$('#pwForm').onsubmit=async e=>{e.preventDefault();const d=await usersCall({action:'password',password:e.target.pw.value});if(d){e.target.reset();toast('הסיסמה שונתה – כולם יתחברו מחדש')}};
// login screen
function showLogin(){$('#login').hidden=false;$('#meBtn').hidden=true}
function renderMe(){const b=$('#meBtn');b.hidden=!token;b.textContent='👤 '+(myName||'')}
function logout(expired){token='';adminTok='';myName='';['bny-token','bny-admin','bny-name'].forEach(k=>localStorage.removeItem(k));renderAdmin();renderToday();showLogin();if(expired)toast('יש להתחבר מחדש')}
function loggedIn(t,name){token=t;myName=name;localStorage.setItem('bny-token',t);localStorage.setItem('bny-name',name);$('#login').hidden=true;renderMe();renderToday();sync()}
$('#loginFormMain').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));
  try{const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(f)});
    if(r.status===429)return toast('יותר מדי ניסיונות, נסה בעוד כמה דקות');
    if(!r.ok)return toast('שם משתמש או סיסמה שגויים');
    const d=await r.json();e.target.reset();loggedIn(d.token,d.name)}catch{toast('אין חיבור לשרת')}};
$('#mgrBtn').onclick=async()=>{if(await requestOtp())$('#loginOtp').hidden=false};
$('#loginOtp').onsubmit=async e=>{e.preventDefault();const t=await verifyOtp(e.target.code.value);if(!t)return;
  adminTok=t.token;localStorage.setItem('bny-admin',adminTok);e.target.reset();e.target.hidden=true;renderAdmin();loggedIn(t.token,'מנהל')};
$('#meBtn').onclick=()=>{sheet(myName||'משתמש','<button class="act" id="logoutBtn">🚪 התנתק</button>');$('#logoutBtn').onclick=()=>{$('#sheet').hidden=true;logout()}};
function renderAll(){renderToday();renderKids();renderAdmin();renderCal();renderContacts()}
renderAll();renderMe();updNotifBtn();checkReminders();sync();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});

// התקנה כאפליקציה (אנדרואיד / אייפון)
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
let installEv=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEv=e;if(!standalone)$('#installBtn').hidden=false});
if(isIOS&&!standalone)$('#installBtn').hidden=false;
$('#installBtn').onclick=async()=>{
  if(installEv){installEv.prompt();await installEv.userChoice;installEv=null;$('#installBtn').hidden=true}
  else if(isIOS){const t=$('#iosHint');t.hidden=false;setTimeout(()=>t.hidden=true,7000)}
};
addEventListener('appinstalled',()=>$('#installBtn').hidden=true);
