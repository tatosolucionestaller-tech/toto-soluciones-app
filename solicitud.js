import {chileLocalToIso} from './workflow-utils.mjs';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js';
const $=id=>document.getElementById(id);
const KEY='tato_express_key_v18',RECEIPT='tato_express_receipt_v18';
const api=SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/express-intake';
const workshopPhone='56999346293';
const msg=text=>{$('message').textContent=text;};
const value=id=>$(id).value.trim();
const priority=()=>document.querySelector('[name="priority"]:checked')?.value||'normal';
const selectedContact=()=>document.querySelector('[name="contact_method"]:checked')?.value||'whatsapp';
function uuid(){
 if(crypto.randomUUID)return crypto.randomUUID();
 throw new Error('La conexión debe ser segura (HTTPS).');
}
function requestKey(){
 let k=sessionStorage.getItem(KEY);
 if(!k){k=uuid();sessionStorage.setItem(KEY,k);}
 return k;
}
function receipt(r){
 $('entry').classList.add('hidden');
 $('success').classList.remove('hidden');
 $('receipt_short').textContent='TATO-'+r.code.slice(0,8).toUpperCase();
 $('receipt_full').textContent=r.code;
 $('receipt_status').textContent=r.duplicate?'Solicitud ya recibida, sin duplicados.':'Estado: recibida · pendiente de revisión del taller.';
 $('whatsapp_followup').href='https://wa.me/'+workshopPhone+'?text='+encodeURIComponent('Hola Tato Soluciones. Mi solicitud web es '+r.code+'. ¿Podemos coordinar una atención?');
 $('success').focus();
 $('success').scrollIntoView({behavior:'smooth',block:'center'});
}
function reset(){
 sessionStorage.removeItem(KEY);sessionStorage.removeItem(RECEIPT);
 $('intake').reset();$('success').classList.add('hidden');$('entry').classList.remove('hidden');
 $('preferred_date').value='';refreshHours();$('safety_message').hidden=true;msg('');requestKey();
 $('entry').scrollIntoView({behavior:'smooth',block:'start'});
}
$('start_new').addEventListener('click',reset);
document.querySelectorAll('[name="priority"]').forEach(input=>input.addEventListener('change',()=>{$('safety_message').hidden=priority()!=='urgent';}));
const date=$('preferred_date'),time=$('preferred_time'),combined=$('preferred_at');
const localToday=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
date.min=localToday;
function validSlot(day,t){
 try {return new Date(chileLocalToIso(day+'T'+t)).getTime()>Date.now();}catch{return false;}
}
function refreshHours(){
 const d=date.value;
 time.replaceChildren(new Option(d?'Selecciona una hora':'Primero selecciona fecha',''));
 time.disabled=true;combined.value='';
 $('appointment_summary').textContent='Puedes enviar la solicitud sin fecha. El taller confirmará disponibilidad.';
 if(!d)return;
 const dow=new Date(d+'T12:00:00Z').getUTCDay();
 if(d<localToday||dow===0||dow===6){$('appointment_summary').textContent='Selecciona un día futuro de lunes a viernes.';return;}
 for(let h=9;h<=16;h++)for(const m of [0,30]){
  const t=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
  if(validSlot(d,t))time.add(new Option(t+' hrs.',t));
 }
 time.disabled=time.options.length<=1;
}
date.addEventListener('change',refreshHours);
time.addEventListener('change',()=>{
 combined.value=(date.value&&time.value)?date.value+'T'+time.value:'';
 $('appointment_summary').textContent=combined.value?'Solicitaremos el horario indicado. No es una reserva confirmada.':'Sin horario preferido.';
});
document.querySelectorAll('[data-service]').forEach(link=>link.addEventListener('click',()=>{
 $('service_type').value=link.dataset.service||'';
 $('intake').querySelector('details').open=true;
}));
$('intake').addEventListener('submit',async event=>{
 event.preventDefault();
 const btn=$('send');if(btn.disabled)return;
 const phone=value('customer_phone').replace(/[^\d+()\s.-]/g,'');
 const payload={
  request_key:requestKey(),priority:priority(),contact_method:selectedContact(),
  customer_name:value('customer_name'),customer_phone:phone,
  customer_email:value('customer_email').toLowerCase(),
  complaint:value('complaint'),service_type:value('service_type'),asset_type:value('asset_type'),
  plate:value('plate').toUpperCase().replace(/[^A-Z0-9]/g,''),
  make:value('make'),model:value('model'),model_year:value('model_year'),
  odometer_km:value('odometer_km'),preferred_at:null,website:value('website')
 };
 if(payload.customer_name.length<2||phone.replace(/\D/g,'').length<7||payload.complaint.length<15||!$('consent').checked){
  msg('Ingresa tu nombre, un teléfono válido y describe la falla con al menos 15 caracteres.');return;
 }
 if(payload.plate&&payload.plate.length!==6&&payload.plate.length!==5&&payload.plate.length!==7&&payload.plate.length!==8){
  msg('Revisa la patente o déjala vacía.');return;
 }
 if(combined.value){try{payload.preferred_at=chileLocalToIso(combined.value);}catch{msg('La fecha elegida no es válida.');return;}}
 if(!payload.model_year)payload.model_year=null;
 if(!payload.odometer_km)payload.odometer_km=null;
 btn.disabled=true;btn.textContent='Enviando solicitud…';msg('Registrando en Tato Soluciones…');
 try{
  const response=await fetch(api,{
   method:'POST',mode:'cors',cache:'no-store',
   headers:{'Content-Type':'application/json','apikey':SUPABASE_PUBLISHABLE_KEY},
   body:JSON.stringify(payload)
  });
  let result={};
  try{result=await response.json();}catch{}
  if(!response.ok||!result.ok||!result.code)throw Error(result.error||'No recibimos confirmación. Si el envío falló, vuelve a intentar con los mismos datos; el sistema evitará duplicados.');
  const saved={code:result.code,duplicate:!!result.duplicate};
  sessionStorage.setItem(RECEIPT,JSON.stringify(saved));
  receipt(saved);
 }catch(err){msg(err.message||'Problema de conexión. Reintenta sin salir de esta página.');}
 finally{btn.disabled=false;btn.textContent='➤ Enviar solicitud ahora';}
});
try{
 const saved=JSON.parse(sessionStorage.getItem(RECEIPT)||'null');
 if(saved?.code&&/^[0-9a-f-]{36}$/i.test(saved.code))receipt(saved);
 else requestKey();
}catch{requestKey();}
