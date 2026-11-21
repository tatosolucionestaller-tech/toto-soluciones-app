import {chileLocalToIso,savePendingDraft,readPendingDraft,clearPendingDraft} from './workflow-utils.mjs';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js';
const authCallbackPresent=/(?:^|[?&#])(?:code|access_token|refresh_token|error|error_description|type)=/i.test(location.search+location.hash);
const db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{detectSessionInUrl:true,autoRefreshToken:true,persistSession:true}});
const $=id=>document.getElementById(id);
const DRAFT='tato_intake_pending_v1';
const focusMessage=()=>document.querySelector('.status-card')?.scrollIntoView({behavior:'smooth',block:'center'});
const msg=(s,focus=false)=>{$('message').textContent=s;$('message').style.whiteSpace='pre-line';if(focus)requestAnimationFrame(focusMessage)};
const val=id=>$(id).value.trim();
const fields=['service_type','complaint','customer_name','customer_phone','customer_email','plate','make','model','model_year','odometer_km','preferred_at'];
const saveDraft=d=>savePendingDraft(localStorage,DRAFT,d);
const readDraft=()=>readPendingDraft(localStorage,DRAFT);
const clearDraft=()=>clearPendingDraft(localStorage,DRAFT);
function chileSlot(v){if(!v)return true;let iso;try{iso=chileLocalToIso(v)}catch{return false}const [date,time]=v.split('T');const day=new Date(date+'T12:00:00Z').getUTCDay();const [hour,minute]=time.split(':').map(Number);const h=hour*60+minute;return day>=1&&day<=5&&h>=540&&h<1020&&minute%30===0&&new Date(iso).getTime()>Date.now()}
const dateInput=$('preferred_date'),timeInput=$('preferred_time'),combined=$('preferred_at'),summary=$('appointment_summary');
const localToday=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
dateInput.min=localToday;
function renderAppointment(){
  const day=dateInput.value;
  timeInput.replaceChildren(new Option(day?'Selecciona una hora':'Primero selecciona una fecha',''));
  combined.value='';
  const weekday=day?new Date(day+'T12:00:00Z').getUTCDay():0;
  if(!day){timeInput.disabled=true;summary.textContent='Todavía no has elegido fecha y hora. Puedes enviar la solicitud sin horario preferido.';return}
  if(day<localToday||weekday===0||weekday===6){timeInput.disabled=true;summary.textContent='Selecciona una fecha futura de lunes a viernes.';return}
  for(let h=9;h<=16;h++)for(const m of [0,30]){
    const t=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
    if(chileSlot(day+'T'+t))timeInput.add(new Option(t+' hrs.',t));
  }
  timeInput.disabled=timeInput.options.length===1;
  summary.textContent=timeInput.disabled?'No quedan horarios para esta fecha. Selecciona otro día.':'Ahora selecciona la hora que prefieres.';
}
dateInput.addEventListener('change',renderAppointment);
timeInput.addEventListener('change',()=>{
  combined.value=dateInput.value&&timeInput.value?dateInput.value+'T'+timeInput.value:'';
  summary.textContent=combined.value?'Preferencia seleccionada: '+dateInput.value.split('-').reverse().join('/')+' a las '+timeInput.value+' hrs. (Arica). Pendiente de confirmación del taller.':'Selecciona una hora para completar tu preferencia.';
});
function restoreAppointment(v){
  if(!v)return;
  const [day,time]=v.split('T');dateInput.value=day;renderAppointment();if([...timeInput.options].some(o=>o.value===time)){timeInput.value=time;timeInput.dispatchEvent(new Event('change'))}
}
document.querySelectorAll('[data-service]').forEach(a=>a.addEventListener('click',()=>{ $('service_type').value=a.dataset.service; }));
function readForm(){const d=Object.fromEntries(fields.map(id=>[id,val(id)]));d.customer_email=d.customer_email.toLowerCase();d.plate=d.plate.toUpperCase().replace(/[^A-Z0-9]/g,'');return d}
function validate(d){if(d.complaint.length<15||!d.customer_name||!d.customer_phone||!/^\S+@\S+\.\S+$/.test(d.customer_email))throw Error('Completa la falla, nombre, teléfono y correo.');if(!chileSlot(d.preferred_at))throw Error('Elige una fecha futura de lunes a viernes entre 09:00 y 16:30, cada 30 minutos.');if(d.model_year&&(Number(d.model_year)<1950||Number(d.model_year)>2035))throw Error('Revisa el año del vehículo.');return d}
function showVerify(){ $('entry').classList.add('hidden');$('verify').classList.remove('hidden') }
async function finish(){const draft=readDraft();if(!draft){if(authCallbackPresent)msg('El correo quedó verificado, pero esta pestaña no encontró la solicitud pendiente. No se registró. Vuelve al formulario en el mismo navegador y envíalo nuevamente; no necesitarás verificar el correo otra vez.',true);return}const {data:{user},error:ue}=await db.auth.getUser();if(ue||!user){msg('Aún falta confirmar el correo. Abre el enlace recibido y vuelve a esta página.',true);return}if(user.email?.toLowerCase()!==draft.customer_email){msg('La cuenta verificada no coincide con el correo de la solicitud. Por seguridad no se enviará.',true);return}const payload={customer_user_id:user.id,customer_name:draft.customer_name,customer_phone:draft.customer_phone,customer_email:draft.customer_email,complaint:draft.service_type?'['+draft.service_type+'] '+draft.complaint:draft.complaint,plate:draft.plate||null,make:draft.make||null,model:draft.model||null,model_year:draft.model_year?Number(draft.model_year):null,odometer_km:draft.odometer_km?Number(draft.odometer_km):null,preferred_at:draft.preferred_at?chileLocalToIso(draft.preferred_at):null};const {data,error}=await db.from('service_requests').insert(payload).select('id,status').single();if(error){msg('No se pudo registrar la solicitud: '+error.message+'. No vuelvas a enviar antes de verificar con el taller si se guardó.',true);return}clearDraft();$('verify').classList.add('hidden');$('entry').classList.add('hidden');const requested=draft.preferred_at?new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',dateStyle:'short',timeStyle:'short'}).format(new Date(chileLocalToIso(draft.preferred_at)))+' (hora de Arica)':'Sin horario preferido';msg('Solicitud recibida correctamente.\nCódigo: '+data.id+'\nEstado: recibida.\nHorario solicitado: '+requested+'.\nEste horario es una preferencia, no una reserva; el taller debe confirmarlo.',true);}
$('intake').addEventListener('submit',async e=>{e.preventDefault();const btn=$('send');btn.disabled=true;try{const d=validate(readForm());saveDraft(d);const {data:{user}}=await db.auth.getUser();if(user&&user.email?.toLowerCase()===d.customer_email){await finish();return}const redirectTo=new URL('solicitud.html',location.href).href;const {error}=await db.auth.signInWithOtp({email:d.customer_email,options:{emailRedirectTo:redirectTo,shouldCreateUser:true}});if(error)throw error;showVerify();msg('Revisa tu correo y confirma el enlace. No necesitas inventar una contraseña.')}catch(err){msg(err.message||'No fue posible continuar.')}finally{btn.disabled=false}});
$('check').addEventListener('click',()=>finish().catch(e=>msg(e.message)));
$('restart').addEventListener('click',()=>{$('verify').classList.add('hidden');$('entry').classList.remove('hidden')});
(async()=>{const draft=readDraft();if(!draft){if(authCallbackPresent)msg('El correo se verificó, pero no encontramos el formulario pendiente en este navegador. No se creó la solicitud ni se reservó una hora. Vuelve al formulario y envíalo nuevamente.',true);return}for(const id of fields)$(id).value=draft[id]||'';restoreAppointment(draft.preferred_at);showVerify();await finish()})().catch(e=>msg(e.message,true));

