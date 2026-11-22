/* Общие помощники для сайта клуба и админки */
(function(){
"use strict";
const HOUR = 3600e3, DAY = 24*HOUR;
const KIND = {standard:{n:"Стандарт",c:"#3ED3E6"},vip:{n:"VIP",c:"#F4B740"},bootcamp:{n:"Буткемп",c:"#FF5C93"},console:{n:"Консоли",c:"#8C7CFF"},other:{n:"Другое",c:"#5BE39B"}};
const STATUS = {
  booked:{n:"Забронировано",c:"#3ED3E6"},
  arrived:{n:"Пришёл, играет",c:"#5BE39B"},
  done:{n:"Завершено",c:"#9A9ECB"},
  cancelled:{n:"Отменено",c:"#FF5C6C"},
  noshow:{n:"Не пришёл",c:"#F4B740"}
};
const WD = ["вс","пн","вт","ср","чт","пт","сб"];
const MON = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const esc = s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = n=>Math.round(n||0).toLocaleString("ru-RU").replace(/[\s,]/g," ")+" ₸";
const pad = n=>String(n).padStart(2,"0");
const dayStart = t=>{const d=new Date(t);d.setHours(0,0,0,0);return d.getTime()};
const dayKey = t=>{const d=new Date(t);return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())};
const keyToTs = k=>{const [y,m,d]=k.split("-").map(Number);return new Date(y,m-1,d).getTime()};
const hm = t=>{const d=new Date(t);return pad(d.getHours())+":"+pad(d.getMinutes())};
const dLabel = t=>{const d=new Date(t);const today=dayStart(Date.now());const ds=dayStart(t);
  if(ds===today) return "сегодня"; if(ds===today+DAY) return "завтра"; if(ds===today-DAY) return "вчера";
  return d.getDate()+" "+MON[d.getMonth()]+", "+WD[d.getDay()]};
const plural=(n,a,b,c)=>{n=Math.abs(n)%100;const n1=n%10;if(n>10&&n<20)return c;if(n1>1&&n1<5)return b;if(n1===1)return a;return c};
function normPhone(v){let d=String(v||"").replace(/\D/g,"");if(d.length===12&&d[0]==="7")d="7"+d.slice(2);if(d.length===11&&d[0]==="8")d="7"+d.slice(1);if(d.length===10)d="7"+d;if(d.length!==11)return null;return "+"+d[0]+" "+d.slice(1,4)+" "+d.slice(4,7)+" "+d.slice(7,9)+" "+d.slice(9,11)}
function hourIn(ts,tz){try{return +new Intl.DateTimeFormat("en-GB",{hour:"numeric",hourCycle:"h23",timeZone:tz||"Asia/Almaty"}).format(new Date(ts))}catch(e){return new Date(ts).getHours()}}
function isNight(h,club){const f=club.nightFrom,t=club.nightTo;return f>t?(h>=f||h<t):(h>=f&&h<t)}
function calcPrice(zone,start,hours,count,club){
  let sum=0,nH=0,dH=0;
  for(let h=0;h<hours;h++){const hr=hourIn(start+h*HOUR,club.tz);if(isNight(hr,club)){sum+=zone.night;nH++}else{sum+=zone.price;dH++}}
  return {total:sum*count,nH,dH};
}
function mkCode(){const a="ABCDEFHKMNPRSTXZ";return a[Math.floor(Math.random()*a.length)]+a[Math.floor(Math.random()*a.length)]+"-"+(1000+Math.floor(Math.random()*9000))}

/* storage that never throws */
const mem={};
const store={get(k){try{return localStorage.getItem(k)}catch(e){return mem[k]??null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){mem[k]=v}}};

/* modal + toast */
function openModal(html,onMount){
  const root=$("#modalRoot"); root.innerHTML=`<div class="modal" role="dialog" aria-modal="true"><div class="box">${html}</div></div>`;
  const m=root.firstChild; m.addEventListener("click",e=>{if(e.target===m||e.target.closest("[data-close]"))closeModal()});
  document.addEventListener("keydown",escClose); if(onMount) onMount(m);
  const f=m.querySelector("input,select,button"); if(f) f.focus();
}
function escClose(e){if(e.key==="Escape")closeModal()}
function closeModal(){$("#modalRoot").innerHTML="";document.removeEventListener("keydown",escClose)}
const modalOpen=()=>!!$("#modalRoot").innerHTML;
function confirmModal(title,text,okLabel,onOk){
  openModal(`<h3 style="font-family:var(--display);margin:0 0 8px">${esc(title)}</h3><p class="muted">${esc(text)}</p><div class="row mt"><button class="btn ghost" data-close type="button">Назад</button><button class="btn danger" id="okBtn" type="button">${esc(okLabel)}</button></div>`,
    m=>m.querySelector("#okBtn").addEventListener("click",()=>{closeModal();onOk()}));
}
let toastT; function toast(t){let el=$(".toast");if(!el){el=document.createElement("div");el.className="toast";el.setAttribute("role","status");document.body.appendChild(el)}el.textContent=t;clearTimeout(toastT);toastT=setTimeout(()=>el.remove(),3200)}

/* Supabase */
const cfg=window.CLUB_CONFIG||{};
const configured=!!(cfg.SUPABASE_URL&&cfg.SUPABASE_KEY&&window.supabase);
const sb=configured? window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true}}) : null;

const ERR={
  seat_taken:"Эти места только что заняли. Выберите другие.",
  bad_phone:"Укажите телефон полностью, например +7 701 123 45 67.",
  bad_name:"Укажите имя, на которое оформить бронь.",
  bad_time:"Это время уже прошло или слишком далеко. Выберите другое.",
  bad_hours:"Можно забронировать от 1 до 12 часов.",
  bad_seats:"Выберите места на карте заново.",
  too_many:"На этот номер уже 3 активные брони. Отмените лишнюю или позвоните в клуб.",
  zone_not_found:"Эта зона больше недоступна. Обновите страницу.",
  seat_out_of_range:"Такого места в зоне нет.",
  duplicate_seat:"Место выбрано дважды."
};
function errText(e){
  const m=(e&&(e.message||e.details||e.hint))||String(e||"");
  for(const k in ERR) if(m.includes(k)) return ERR[k];
  if(e&&e.code==="23P01"||/exclusion constraint/.test(m)) return "На это время место уже занято.";
  if(/Failed to fetch|NetworkError|network/i.test(m)) return "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.";
  if(/JWT|permission denied|row-level security/i.test(m)) return "Нет прав на это действие. Войдите заново.";
  return "Не получилось: "+m;
}

window.Club={HOUR,DAY,KIND,STATUS,WD,MON,$,$$,esc,money,pad,dayStart,dayKey,keyToTs,hm,dLabel,plural,normPhone,hourIn,isNight,calcPrice,mkCode,store,openModal,closeModal,modalOpen,confirmModal,toast,sb,configured,errText};
})();
