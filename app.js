import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import { validSlot, quoteTotal, chileLocalToIso } from './workflow-utils.mjs';
import { crearDocumentoTato, descargarDocumento, compartirDocumento } from './documentos-pdf.js';
const $ = id => document.getElementById(id);
const configured = SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('YOUR_PROJECT') && !SUPABASE_PUBLISHABLE_KEY.includes('YOUR_PUBLIC_KEY');
const db = configured ? createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY) : null;
const notice = text => { $('notice').textContent=text; };
const validTransitions = {received:['reviewing','cancelled'],reviewing:['appointment_proposed','cancelled'],appointment_proposed:['confirmed','reviewing','cancelled'],confirmed:['in_workshop','cancelled'],in_workshop:['completed'],completed:[],cancelled:[]};
const labels = {received:'Recibida',reviewing:'En revisión',appointment_proposed:'Hora propuesta',confirmed:'Confirmada',in_workshop:'En taller',completed:'Finalizada',cancelled:'Cancelada'};
let currentUser=null,isStaff=false;

const quoteApi=SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/express-quote';
const guestClaimStore='tato_claim_approved_quote_v1';
const claimFromUrl=new URLSearchParams(location.search).get('claim');
if(claimFromUrl&&/^[a-zA-Z0-9_-]{40,80}$/.test(claimFromUrl)){
 sessionStorage.setItem(guestClaimStore,claimFromUrl);
 const cleanUrl=new URL(location.href);cleanUrl.searchParams.delete('claim');
 history.replaceState(null,'',cleanUrl.pathname+cleanUrl.search+cleanUrl.hash);
}
async function expressQuoteAction(action,extra={},jwt=null){
 const headers={'Content-Type':'application/json','apikey':SUPABASE_PUBLISHABLE_KEY};
 if(jwt)headers.Authorization='Bearer '+jwt;
 const response=await fetch(quoteApi,{method:'POST',mode:'cors',cache:'no-store',headers,body:JSON.stringify({action,...extra})});
 let data={};try{data=await response.json();}catch{}
 if(!response.ok||!data.ok)throw Error(data.error||'No fue posible realizar esta operación.');
 return data;
}
let claimInProgress=false;
async function claimApprovedQuote(session){
 const token=sessionStorage.getItem(guestClaimStore);
 if(!token||claimInProgress||!session?.access_token||isStaff)return;
 claimInProgress=true;
 try {
  const result=await expressQuoteAction('claim',{token},session.access_token);
  if(result.claimed){
   sessionStorage.removeItem(guestClaimStore);
   notice('¡Tu cuenta está activa! La solicitud Express y el presupuesto ya aparecen en tu historial.');
   showTab('mine');
  }
 }catch(err){notice('Para vincular la solicitud Express: '+err.message);}
 finally{claimInProgress=false;}
}


const deliveryApi=SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/tato-email-document';
function guessType(filename){
 const kind=/^TATO_(PREDIAGNOSTICO|PRESUPUESTO|RECEPCION|ENTREGA)_/.exec(filename);
 return kind?.[1]?.toLowerCase()||null;
}
async function emailPdfFromStaff({pdf,requestId,email,idempotencyKey}){
 if(!requestId||!email)throw Error('Falta el correo del cliente o su solicitud.');
 const {data:{session}}=await db.auth.getSession();
 if(!session?.access_token)throw Error('Debes iniciar sesión como personal del taller.');
 const fileData=await new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');
  reader.onerror=()=>reject(Error('No se pudo leer el documento PDF'));
  reader.readAsDataURL(pdf.blob);
 });
 const docType=guessType(pdf.filename);
 if(!docType)throw Error('Documento no compatible para correo.');
 const response=await fetch(deliveryApi,{method:'POST',mode:'cors',cache:'no-store',
  headers:{'Content-Type':'application/json','apikey':SUPABASE_PUBLISHABLE_KEY,'Authorization':'Bearer '+session.access_token},
  body:JSON.stringify({request_id:requestId,doc_type:docType,idempotency_key:idempotencyKey,attachment:fileData})});
 let result={};try{result=await response.json();}catch{}
 if(!response.ok||!result.ok){const err=Error(result.error||'No se pudo enviar el correo');err.needs_setup=result.needs_setup===true;throw err;}
 return result;
}
function emailManual(pdf,email,message){
 const file=new File([pdf.blob],pdf.filename,{type:'application/pdf'});
 if(navigator.canShare?.({files:[file]})&&navigator.share){
   return navigator.share({files:[file],title:pdf.title,text:message+'\nDestinatario: '+email});
 }
 descargarDocumento(pdf.blob,pdf.filename);
 const subject='Tato Soluciones | '+pdf.title;
 const body=message+'\n\nAdjunta el archivo descargado: '+pdf.filename+'\n\nTato Soluciones';
 window.open('mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body),'_blank','noopener,noreferrer');
 return Promise.resolve('downloaded');
}
function montarAccionesDocumento(holder,pdf,{phone='',email='',requestId='',message=''}={}){
 const row=node('div',undefined,'pdf-actions');
 const save=node('button','Descargar PDF','secondary');save.type='button';
 save.addEventListener('click',()=>{descargarDocumento(pdf.blob,pdf.filename);notice('PDF descargado. Puedes guardarlo o adjuntarlo a WhatsApp o correo.');});
 const share=node('button','Compartir por WhatsApp','pdf-share');share.type='button';
 share.addEventListener('click',()=>{
  try{
   const result=compartirDocumento({blob:pdf.blob,filename:pdf.filename,title:pdf.title,message,phone});
   Promise.resolve(result).then((out)=>{
    notice(out==='downloaded'?'PDF descargado. Adjunta el archivo en el chat que se abrió.':'Elige WhatsApp y el destinatario para compartir el documento.');
   }).catch(error=>{if(error?.name!=='AbortError')notice('No se pudo compartir: '+(error?.message||'revisa los permisos del navegador'));});
  }catch(error){notice('No se pudo compartir: '+error.message);}
 });
 row.append(save,share);
 if(email){
  const mail=node('button','Enviar por correo','secondary');mail.type='button';
  let attemptId=crypto.randomUUID();
  mail.addEventListener('click',async()=>{
   if(!confirm('¿Enviar el documento '+pdf.filename+' al correo registrado '+email+'?'))return;
   mail.disabled=true;
   try{
    const result=await emailPdfFromStaff({pdf,requestId,email,idempotencyKey:attemptId});
    mail.textContent='Correo enviado';
    notice(result.already_sent?'Este documento ya se envió anteriormente.':'Correo aceptado por el proveedor para '+result.sent_to+'. La entrega final depende del servidor de destino.');
   }catch(error){
    if(error.needs_setup){
     notice('Correo automático aún sin configurar. Se abrirá una opción para compartir el PDF por correo. Selecciona Gmail u otra app.');
     try{const result=await emailManual(pdf,email,message);
       if(result==='downloaded')notice('Descargamos el PDF y abrimos tu correo: debes adjuntar el archivo y presionar Enviar.');
     }catch(e){if(e?.name!=='AbortError')notice('No pudimos compartir el archivo: '+e.message);}
    }else{attemptId=crypto.randomUUID();notice('No se pudo enviar el correo: '+error.message);}
   }finally{mail.disabled=false;}
  });
  row.append(mail);
 }
 holder.append(row);
 const hint=node('small','WhatsApp y correo permiten enviar el mismo PDF. En un computador, si usas el correo manual, adjunta el archivo descargado antes de enviarlo. El envío automático por correo requiere un remitente verificado.','pdf-instructions');
 holder.append(hint);
}
async function prepararFichaPdf(item,holder){
 const {data:work,error}=await db.from('intake_workflow')
   .select('diagnosis,diagnosis_tests,public_scope').eq('request_id',item.id).maybeSingle();
 if(error)throw Error('No se pudo consultar el prediagnóstico: '+error.message);
 const pdf=crearDocumentoTato({tipo:'prediagnostico',solicitud:item,trabajo:work||{}});
 const box=node('div',undefined,'pdf-packet');
 box.append(node('strong','Ficha de atención · '+pdf.filename));
 montarAccionesDocumento(box,pdf,{phone:item.customer_phone,email:item.customer_email,requestId:item.id,
  message:'Hola, somos Tato Soluciones. Te compartimos tu ficha de atención preliminar '+item.id.slice(0,8).toUpperCase()+'. No autoriza reparaciones.'});
 holder.append(box);
}

async function issueExpressQuote(item,box){
 const {data:{session}}=await db.auth.getSession();
 if(!session?.access_token)throw Error('Inicia sesión en el panel del taller.');
 const res=await expressQuoteAction('issue',{request_id:item.id},session.access_token);
 const share=document.createElement('div');
 share.className='quote-share';
 share.append(node('strong','Enlace privado de presupuesto · válido por 7 días'));
 const input=document.createElement('input');input.readOnly=true;input.value=res.url;input.setAttribute('aria-label','Enlace seguro del presupuesto');share.append(input);
 const copy=node('button','Copiar enlace','secondary');
 copy.type='button';
 copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(res.url);notice('Enlace copiado. Compártelo solo con el cliente.');}catch{input.select();notice('Selecciona el enlace y cópialo manualmente.');}});
 share.append(copy);
 const destination=(item.customer_phone||'').replace(/\D/g,'');
 if(destination.length>=8){
  const wa=node('a','Enviar presupuesto por WhatsApp','staff-whatsapp');
  wa.href='https://wa.me/'+destination+'?text='+encodeURIComponent('Hola. Tato Soluciones preparó tu presupuesto. Revísalo y aprueba o rechaza en este enlace privado: '+res.url);
  wa.target='_blank';wa.rel='noopener noreferrer';share.append(wa);
 }
 box.append(share);
 try {
  const {data:work,error}=await db.from('intake_workflow')
   .select('public_scope,labor_clp,parts_clp,tax_clp,quote_status')
   .eq('request_id',item.id).single();
  if(error)throw Error(error.message);
  if(work?.quote_status!=='offered')throw Error('El presupuesto aún no se encuentra ofrecido.');
  const pdf=crearDocumentoTato({tipo:'presupuesto',solicitud:item,trabajo:work,urlAprobacion:res.url});
  share.append(node('strong','Documento profesional listo · '+pdf.filename));
  montarAccionesDocumento(share,pdf,{phone:item.customer_phone,email:item.customer_email,requestId:item.id,
   message:'Hola, somos Tato Soluciones. Adjuntamos el presupuesto de tu vehículo. Revísalo y aprueba o rechaza en este enlace privado: '+res.url});
 }catch(error){share.append(node('p','El enlace de aprobación está listo, pero no pudimos generar el PDF: '+error.message,'pdf-error'));}
}
const money=n=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n||0);
const isoLocal=s=>s?chileLocalToIso(s):null;
const dateLocal=s=>{if(!s)return '';const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(s));const v=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}`;};
function showTab(tab){if(isStaff && (tab==='mine'||tab==='new'))tab='staff';if(!isStaff && (tab==='staff'||tab==='dashboard'))tab='mine';for(const id of ['new','mine','staff','dashboard']) $(id).hidden=id!==tab;for(const [id,name] of [['tabNew','new'],['tabMine','mine'],['tabStaff','staff'],['tabDashboard','dashboard']]) $(id).classList.toggle('selected',tab===name);if(tab==='mine'){loadMine();loadQuotes();loadProgress();loadHistory();}if(tab==='staff'){loadStaff();loadWorkstations();loadFormalizationStatus();loadRepairOrders();}if(tab==='dashboard')loadDashboard();}
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function record(item,staff=false){
 const wrap=node('article',undefined,'record'+(item.priority==='urgent'?' record-urgent':''));
 const heading=node('div',undefined,'record-heading');
 heading.append(node('strong',(item.make||'Vehículo')+' '+(item.model||'')+' · '+(item.plate||'Sin patente')));
 if(item.priority==='urgent')heading.append(node('span','PRIORIDAD URGENTE','urgent-badge'));
 if(item.intake_source==='web_express')heading.append(node('span','Solicitud Express','express-badge'));
 if(item.intake_source==='phone')heading.append(node('span','Recepción telefónica','express-badge'));
 wrap.append(heading,node('small',new Date(item.created_at).toLocaleString('es-CL')+' · '+(labels[item.status]||item.status)),node('p',item.complaint),node('small','Cliente: '+item.customer_name+' · '+item.customer_phone));
 if(item.preferred_at)wrap.append(node('p','Horario solicitado (sin confirmar): '+new Date(item.preferred_at).toLocaleString('es-CL')));
 if(staff){
  const clean=(item.customer_phone||'').replace(/\D/g,'');
  if(clean.length>=8){
   const link=node('a','Responder por WhatsApp','staff-whatsapp');
   link.href='https://wa.me/'+clean+'?text='+encodeURIComponent('Hola, somos Tato Soluciones. Recibimos tu solicitud y queremos coordinar una atención.');
   link.target='_blank';link.rel='noopener noreferrer';wrap.append(link);
  }
  if(item.customer_email)wrap.append(node('div','Correo: '+item.customer_email,'contact-email'));
  const pre=node('button','Preparar ficha de atención PDF','secondary');pre.type='button';
  pre.addEventListener('click',async()=>{
   pre.disabled=true;
   try{await prepararFichaPdf(item,wrap);pre.textContent='Preparar otra copia PDF';notice('Ficha preliminar lista para compartir.');}
   catch(error){notice('No se pudo generar la ficha: '+error.message);}
   finally{pre.disabled=false;}
  });
  wrap.append(pre);
  if(item.intake_source==='web_express'||item.intake_source==='phone'){
   if(item.quote_status==='offered'){
   const issue=node('button','Crear enlace seguro de presupuesto','secondary');
   issue.type='button';
   issue.addEventListener('click',async()=>{
    if(!confirm('¿Ya ofreciste el presupuesto de esta solicitud en el Control Center? Se creará un enlace privado válido por 7 días.'))return;
    issue.disabled=true;
    try{await issueExpressQuote(item,wrap);issue.textContent='Generar otro enlace (revoca el anterior)';notice('Enlace preparado. Envíaselo únicamente al cliente.');}
    catch(err){notice(err.message);}
    finally{issue.disabled=false;}
   });
   wrap.append(issue);
   } else if(item.quote_status==='approved'||item.quote_status==='rejected'){
    wrap.append(node('p',item.quote_status==='approved'?'Presupuesto aprobado por el cliente.':'Presupuesto rechazado por el cliente.','record-step'));
   } else {
    wrap.append(node('p','Siguiente paso: selecciona esta solicitud más abajo, prepara el diagnóstico y ofrece el presupuesto. Después podrás enviar el enlace al cliente.','record-step'));
   }
  }
 }
 if(staff && validTransitions[item.status]?.length){
  const sel=node('select');sel.append(new Option('Cambiar estado…',''));
  for(const status of validTransitions[item.status])sel.append(new Option(labels[status],status));
  sel.addEventListener('change',async()=>{
   if(!sel.value)return;sel.disabled=true;
   const {error}=await db.from('service_requests').update({status:sel.value}).eq('id',item.id);
   notice(error?'No se pudo actualizar: '+error.message:'Estado actualizado');
   await loadStaff();
  });wrap.append(sel);
 }
 return wrap;
}

/* Control Center: solo consultas RLS, sin datos personales ni credenciales en indicadores. */
let dashboardLoadNonce=0;
async function loadDashboard(){
 if(!db||!isStaff||!currentUser)return;
 const ticket=++dashboardLoadNonce,userId=currentUser.id;
 const cards=$('dashboardCards'),stations=$('dashboardStations'),alerts=$('dashboardAlerts');
 cards.replaceChildren(node('p','Cargando indicadores…'));stations.replaceChildren();alerts.replaceChildren();
 const metrics=[
  {key:'total',label:'Solicitudes totales',table:'service_requests'},
  {key:'pending',label:'Por revisar',table:'service_requests',column:'status',value:'received'},
  {key:'confirmed',label:'Confirmadas',table:'service_requests',column:'status',value:'confirmed'},
  {key:'workshop',label:'En taller',table:'service_requests',column:'status',value:'in_workshop'},
  {key:'finished',label:'Finalizadas',table:'service_requests',column:'status',value:'completed'},
  {key:'quotes',label:'Presupuestos por aprobar',table:'intake_workflow',column:'quote_status',value:'offered'},
  {key:'approved',label:'Presupuestos aprobados',table:'intake_workflow',column:'quote_status',value:'approved'},
  {key:'orders',label:'Órdenes de reparación',table:'repair_orders'}
 ];
 const [counts,stationResult]=await Promise.all([
   Promise.all(metrics.map(async m=>{
    let q=db.from(m.table).select('*',{count:'exact',head:true});
    if(m.column)q=q.eq(m.column,m.value);
    const {count,error}=await q;
    return {...m,count,error};
   })),
   db.from('workstations').select('id,name,active').order('id')
 ]);
 if(ticket!==dashboardLoadNonce||!isStaff||currentUser?.id!==userId)return;
 cards.replaceChildren();
 for(const m of counts){
  const tile=node('div',undefined,'metric');
  tile.append(node('strong',m.error?'—':String(m.count??0)),node('span',m.label));
  if(m.error)tile.append(node('small','Sin permiso o sin conexión'));
  cards.append(tile);
 }
 if(stationResult.error)stations.append(node('p','No fue posible consultar los puestos.'));
 else if(!stationResult.data?.length)stations.append(node('p','No hay puestos registrados.'));
 else for(const s of stationResult.data){
  const chip=node('span',s.name||'Puesto '+s.id,'station-chip'+(s.active?'':' inactive'));
  chip.title=s.active?'Puesto activo':'Puesto deshabilitado';stations.append(chip);
 }
 const data=Object.fromEntries(counts.filter(x=>!x.error).map(x=>[x.key,x.count??0]));
 if(counts.some(x=>x.error))alerts.append(node('p','Algunos indicadores no pudieron consultarse. Revisa permisos y conectividad.'));
 if(data.total===0)alerts.append(node('p','No hay solicitudes registradas. Realiza una prueba de recepción Express antes de usar la aplicación con clientes reales.'));
 if(data.pending>0)alerts.append(node('p',data.pending+' solicitud(es) pendiente(s) de revisión.'));
 if(data.quotes>0)alerts.append(node('p',data.quotes+' presupuesto(s) esperando la decisión de los clientes.'));
 if(!alerts.childNodes.length)alerts.append(node('p','Sin alertas operativas según los registros actuales.'));
}

async function loadMine(){const list=$('mineList');list.replaceChildren(node('p','Cargando…'));const {data,error}=await db.from('service_requests').select('id,make,model,plate,complaint,status,created_at,preferred_at,customer_name,customer_phone').eq('customer_user_id',currentUser.id).order('created_at',{ascending:false}).limit(100);list.replaceChildren();if(error)return notice(error.message);if(!data?.length)list.append(node('p','Todavía no tienes solicitudes.'));else data.forEach(item=>list.append(record(item)));}
async function loadStaff(){if(!isStaff)return;const list=$('staffList');list.replaceChildren(node('p','Cargando…'));const {data,error}=await db.from('service_requests').select('id,make,model,plate,complaint,status,created_at,preferred_at,customer_name,customer_phone,customer_email,priority,contact_method,intake_source,model_year,odometer_km').order('created_at',{ascending:false}).limit(100);list.replaceChildren();if(error){list.append(node('p','No se pudieron cargar las solicitudes: '+error.message));return notice('No se pudieron consultar las solicitudes.');}const expressIds=(data||[]).filter(x=>['web_express','phone'].includes(x.intake_source)).map(x=>x.id);
if(expressIds.length){
 const {data:budgets,error:budgetError}=await db.from('intake_workflow').select('request_id,quote_status').in('request_id',expressIds);
 if(!budgetError){
  const statusByRequest=new Map((budgets||[]).map(q=>[q.request_id,q.quote_status]));
  for(const item of data)item.quote_status=statusByRequest.get(item.id)||null;
 }
}
if(!data?.length)list.append(node('p','No hay solicitudes.'));else {data.sort((a,b)=>(a.status==='received'?0:1)-(b.status==='received'?0:1)||(a.priority==='urgent'?0:1)-(b.priority==='urgent'?0:1)||new Date(b.created_at)-new Date(a.created_at));data.forEach(item=>list.append(record(item,true)));}const picker=$('workflowRequest');const chosen=picker.value;picker.replaceChildren(new Option('Selecciona una solicitud',''));for(const item of data||[])picker.append(new Option(`${item.plate||'Sin patente'} · ${item.customer_name} · ${labels[item.status]||item.status}`,item.id));if(data?.some(x=>x.id===chosen))picker.value=chosen;}
let sessionVersion=0;async function sessionChanged(session){const version=++sessionVersion;currentUser=session?.user||null;isStaff=false;document.body.classList.remove('staff-mode');$('tabNew').hidden=false;$('tabMine').hidden=false;$('tabStaff').hidden=true;$('tabDashboard').hidden=true;$('staff').hidden=true;$('dashboard').hidden=true;$('staffList').replaceChildren();$('mineList').replaceChildren();$('myQuotes').replaceChildren();$('auth').hidden=!!currentUser;$('app').hidden=!currentUser;$('logout').hidden=!currentUser;if(!currentUser)return;const {data}=await db.from('staff_profiles').select('role,active').eq('user_id',currentUser.id).maybeSingle();if(version!==sessionVersion||!currentUser)return;isStaff=!!data?.active;
 document.body.classList.toggle('staff-mode',isStaff);
 $('tabNew').hidden=isStaff;$('tabMine').hidden=isStaff;
 $('tabStaff').hidden=!isStaff;$('tabDashboard').hidden=!isStaff;
 $('heroEyebrow').textContent=isStaff?'ADMINISTRACIÓN DEL TALLER':'ATENCIÓN DE VEHÍCULOS';
 $('heroTitle').textContent=isStaff?'Control Center · Tato Soluciones':'Mi vehículo y mis atenciones';
 $('heroDescription').textContent=isStaff?'Recibe solicitudes Express, prioriza urgencias, responde por WhatsApp y gestiona diagnósticos, presupuestos y cinco puestos.':'Consulta tus solicitudes, presupuestos y el avance de los trabajos que hayas aprobado.';
 showTab(isStaff?'staff':'mine');if(!isStaff)claimApprovedQuote(session);}
if(!configured){$('setup').hidden=false;$('auth').hidden=true;}else{db.auth.getSession().then(({data})=>sessionChanged(data.session));db.auth.onAuthStateChange((event,session)=>{sessionChanged(session);if(event==='PASSWORD_RECOVERY'){$('auth').hidden=false;$('newPasswordForm').hidden=false;notice('Escribe tu nueva contraseña.');}});}
$('authForm').addEventListener('submit',async e=>{e.preventDefault();if(!db)return;const f=new FormData(e.target);const {error}=await db.auth.signInWithPassword({email:String(f.get('email')),password:String(f.get('password'))});notice(error?`No se pudo ingresar: ${error.message}`:'Sesión iniciada');});
$('signup').addEventListener('click',async()=>{const f=new FormData($('authForm'));const email=String(f.get('email')||'');const password=String(f.get('password')||'');if(!email||password.length<8)return notice('Ingresa un correo y una contraseña de al menos 8 caracteres.');const claim=sessionStorage.getItem(guestClaimStore);const options=claim?{emailRedirectTo:location.origin+'/app-real.html?claim='+encodeURIComponent(claim)}:undefined;const {error}=await db.auth.signUp({email,password,options});notice(error?error.message:'Revisa tu correo para verificar la cuenta, si la confirmación está habilitada.');});
$('reset').addEventListener('click',async()=>{const email=String(new FormData($('authForm')).get('email')||'');if(!email)return notice('Escribe tu correo primero.');const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});notice(error?error.message:'Si existe una cuenta, recibirás un correo con instrucciones.');});
$('newPasswordForm').addEventListener('submit',async e=>{e.preventDefault();const password=String(new FormData(e.target).get('new_password')||'');if(password.length<10)return notice('La contraseña debe tener al menos 10 caracteres.');const {error}=await db.auth.updateUser({password});if(error)return notice('No se pudo actualizar: '+error.message);$('newPasswordForm').hidden=true;notice('Contraseña actualizada.');});
$('logout').addEventListener('click',()=>db.auth.signOut());$('tabNew').addEventListener('click',()=>showTab('new'));$('tabMine').addEventListener('click',()=>showTab('mine'));$('tabStaff').addEventListener('click',()=>showTab('staff'));$('tabDashboard').addEventListener('click',()=>showTab('dashboard'));$('refreshDashboard').addEventListener('click',()=>loadDashboard());$('dashboardGoStaff').addEventListener('click',()=>showTab('staff'));$('refreshQueue').addEventListener('click',()=>loadStaff());
if('serviceWorker' in navigator && location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});

// Workflow data is staff-only. Customer decisions use restricted RPCs without internal costs.

/* V24 - recepción por llamada y buscador de repuestos. Sólo accesible con personal autorizado. */
const staffFunctionsBase=SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/';
let phoneIdempotencyKey=crypto.randomUUID();
let lastPartSearchText='';
let currentParts=[];
async function callStaffFunction(slug,payload){
 if(!isStaff||!currentUser)throw Error('Necesitas una sesión activa del taller.');
 const {data:{session},error}=await db.auth.getSession();
 if(error||!session?.access_token)throw Error('Inicia sesión de nuevo.');
 const response=await fetch(staffFunctionsBase+slug,{
  method:'POST',mode:'cors',cache:'no-store',
  headers:{'Content-Type':'application/json','apikey':SUPABASE_PUBLISHABLE_KEY,'Authorization':'Bearer '+session.access_token},
  body:JSON.stringify(payload)
 });
 let result={};try{result=await response.json()}catch{}
 if(!response.ok||!result.ok)throw Error(result.error||'No se pudo completar la operación.');
 return result;
}
function resetPhoneForm(){
 $('phoneIntakeForm').reset();
 $('phoneBookNow').checked=false;$('phoneBooking').hidden=true;
 phoneIdempotencyKey=crypto.randomUUID();
}
$('phoneBookNow').addEventListener('change',e=>{
 const enabled=e.target.checked;
 $('phoneBooking').hidden=!enabled;
 for(const n of ['appointment_at','appointment_end','workstation_id'])$('phoneIntakeForm').elements[n].required=enabled;
});
async function refreshPhoneStations(){
 const sel=$('phoneWorkstation');
 sel.replaceChildren(new Option('Selecciona puesto',''));
 const {data,error}=await db.from('workstations').select('id,name').eq('active',true).order('id');
 if(error)throw Error('No se pudieron consultar puestos: '+error.message);
 for(const row of data||[])sel.add(new Option(row.name,row.id));
}
$('phoneIntakeForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!isStaff)return notice('Acceso exclusivo al taller.');
 const form=e.target,f=form.elements,btn=$('phoneCreate');
 if(btn.disabled)return;
 const book=$('phoneBookNow').checked;
 const name=f.customer_name.value.trim(),phone=f.customer_phone.value.trim();
 const complaint=f.complaint.value.trim();
 if(name.length<2||phone.length<7||complaint.length<15)return notice('Completa nombre, teléfono y motivo de al menos 15 caracteres.');
 let start=null,end=null,station=null;
 if(book){
  if(!f.appointment_at.value||!f.appointment_end.value||!f.workstation_id.value)return notice('Completa inicio, fin y puesto para reservar.');
  try{
   start=isoLocal(f.appointment_at.value);end=isoLocal(f.appointment_end.value);
   if(!validSlot(start,end)||new Date(start)<=new Date())throw Error('La hora debe ser futura, de lunes a viernes entre 08:30 y 17:00.');
  }catch(err){return notice('Horario inválido: '+err.message);}
  station=Number(f.workstation_id.value);
 }
 const payload={request_key:phoneIdempotencyKey,customer_name:name,customer_phone:phone,
  customer_email:f.customer_email.value.trim().toLowerCase()||null,plate:f.plate.value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'')||null,
  make:f.make.value.trim()||null,model:f.model.value.trim()||null,model_year:f.model_year.value?Number(f.model_year.value):null,
  complaint,priority:f.priority.value,contact_method:f.contact_method.value,
  appointment_at:start,appointment_end:end,workstation_id:station};
 btn.disabled=true;btn.textContent='Guardando…';
 try{
  const result=await callStaffFunction('tato-phone-intake',payload);
  $('phoneIntakeResult').replaceChildren();
  const label=node('strong','Atención telefónica registrada: TATO-'+result.code.slice(0,8).toUpperCase(),'phone-success');
  const detail=node('p',book?'Hora y puesto confirmados en agenda.':'Solicitud recibida; queda pendiente de confirmar hora.');
  const hint=node('p','El cliente no necesita cuenta para solicitar atención. Para activar seguimiento posteriormente deberá verificar un correo propio.');
  $('phoneIntakeResult').append(label,detail,hint);
  resetPhoneForm();notice('Atención telefónica guardada en Supabase.');
  await loadStaff();await loadDashboard();
  $('workflowRequest').value=result.code;
  $('workflowRequest').dispatchEvent(new Event('change'));
 }catch(err){notice('No fue posible registrar la atención: '+err.message);}
 finally{btn.disabled=false;btn.textContent='Guardar atención telefónica';}
});
function mlSearchUrl(q){
 return 'https://listado.mercadolibre.cl/'+String(q||'repuestos').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9 ]/g,'').trim().replace(/\s+/g,'-');
}
function setMLLink(url){
 const a=$('partsMLLink');
 a.href=/^https:\/\/listado\.mercadolibre\.cl\/[a-z0-9-]+$/i.test(url)?url:'https://listado.mercadolibre.cl/repuestos';
}
$('partsSearchQuery').addEventListener('input',e=>setMLLink(mlSearchUrl(e.target.value)));
$('partsSearch').addEventListener('click',async()=>{
 const query=$('partsSearchQuery').value.trim();
 if(query.length<3)return notice('Indica el repuesto, código OEM o modelo a buscar.');
 lastPartSearchText=query;
 const btn=$('partsSearch'),list=$('partsSearchResults');
 btn.disabled=true;list.replaceChildren(node('p','Buscando repuestos en Mercado Libre Chile…'));
 setMLLink(mlSearchUrl(query));
 try{
  const result=await callStaffFunction('tato-parts-search',{q:query});
  setMLLink(result.url);
  list.replaceChildren();
  if(result.notice)list.append(node('p',result.notice,'part-hint'));
  if(!result.results?.length){
   list.append(node('p','Usa “Abrir Mercado Libre Chile”, verifica el repuesto compatible y vuelve para registrar el precio y el enlace de la publicación.'));
   return;
  }
  for(const product of result.results){
   const row=node('div',undefined,'ml-result');
   row.append(node('strong',product.title));
   if(Number.isFinite(product.price))row.append(node('p',money(product.price)+' · precio referencial, sin despacho'));
   const link=node('a','Ver publicación','secondary');link.href=product.url;link.target='_blank';link.rel='noopener noreferrer';
   const use=node('button','Usar esta referencia','secondary');use.type='button';
   use.addEventListener('click',()=>{
    const f=$('partsEstimateForm').elements;
    f.part_name.value=product.title.slice(0,150);
    f.listing_title.value=product.title;
    f.listing_url.value=product.url;
    f.unit_cost_clp.value=Number(product.price)||0;
    f.supplier.value='Mercado Libre Chile';
    updatePartPreview();
    $('partsEstimateForm').scrollIntoView({behavior:'smooth',block:'center'});
   });
   row.append(link,use);list.append(row);
  }
 }catch(err){
  list.replaceChildren(node('p','La búsqueda automática no está disponible: '+err.message));
  list.append(node('p','Abre Mercado Libre Chile y registra el costo desde la publicación.'));
 }finally{btn.disabled=false;}
});
function priceNumbers(f){
 const numbers=['quantity','unit_cost_clp','shipping_clp','markup_pct'].map(n=>Number(f[n].value||0));
 const [qty,cost,shipping,markup]=numbers;
 if(!Number.isInteger(qty)||qty<1||qty>100||!Number.isSafeInteger(cost)||cost<0||
    !Number.isSafeInteger(shipping)||shipping<0||!Number.isFinite(markup)||markup<0||markup>500)
   throw Error('Cantidad, costos o margen inválidos.');
 const base=qty*cost+shipping;
 const sale=Math.round(base*(1+markup/100));
 if(!Number.isSafeInteger(sale)||sale>1000000000)throw Error('Costo fuera de rango.');
 return {quantity:qty,unit_cost_clp:cost,shipping_clp:shipping,markup_pct:markup,base,sale};
}
function updatePartPreview(){
 const f=$('partsEstimateForm').elements;
 try{const v=priceNumbers(f);$('partsEstimatePreview').textContent='Costo de compra y despacho: '+money(v.base)+' · estimación de venta sin impuestos adicionales: '+money(v.sale);}
 catch{$('partsEstimatePreview').textContent='Introduce cantidad y costos válidos.';}
}
for(const key of ['quantity','unit_cost_clp','shipping_clp','markup_pct'])$('partsEstimateForm').elements[key].addEventListener('input',updatePartPreview);
updatePartPreview();
async function loadPartEstimates(){
 const el=$('partsEstimateList');el.replaceChildren();
 const id=$('workflowRequest').value;
 currentParts=[];
 if(!isStaff||!id){el.append(node('p','Selecciona primero una solicitud de la agenda.'));return;}
 const {data,error}=await db.from('part_cost_estimates')
  .select('id,part_name,listing_title,listing_url,supplier,quantity,unit_cost_clp,shipping_clp,markup_pct,stock_status,created_at')
  .eq('request_id',id).order('created_at',{ascending:false}).limit(100);
 if(error){el.append(node('p','No se pudieron cargar los repuestos: '+error.message));return;}
 currentParts=data||[];
 if(!currentParts.length){el.append(node('p','Aún no hay repuestos presupuestados.'));return;}
 let total=0,baseTotal=0;
 for(const x of currentParts){
  const base=x.unit_cost_clp*x.quantity+x.shipping_clp;
  const sale=Math.round(base*(1+Number(x.markup_pct)/100));
  total+=sale;baseTotal+=base;
  const row=node('div',undefined,'part-row');
  row.append(node('strong',x.part_name),node('small','Cantidad: '+x.quantity+' · Costo: '+money(base)+' · Estimado venta: '+money(sale)+' · '+x.stock_status));
  if(x.listing_url){
   const link=node('a','Abrir publicación','part-link');link.href=x.listing_url;link.rel='noopener noreferrer';link.target='_blank';row.append(link);
  }
  const remove=node('button','Eliminar registro','secondary');remove.type='button';
  remove.addEventListener('click',async()=>{
   if(!confirm('¿Eliminar este repuesto de la estimación?'))return;
   const {error}=await db.from('part_cost_estimates').delete().eq('id',x.id);
   notice(error?'No se pudo eliminar: '+error.message:'Repuesto retirado.');
   if(!error)loadPartEstimates();
  });row.append(remove);el.append(row);
 }
 el.append(node('p','Total de compra estimado: '+money(baseTotal)+' · Venta estimada sin impuestos adicionales: '+money(total),'parts-preview'));
 const apply=node('button','Aplicar total de repuestos al borrador','secondary');apply.type='button';
 apply.addEventListener('click',async()=>{
  const {data,error}=await db.from('intake_workflow').select('quote_status').eq('request_id',id).maybeSingle();
  if(error)return notice(error.message);
  if(data?.quote_status&&data.quote_status!=='draft')return notice('El presupuesto ya fue ofrecido o decidido y no puede modificarse.');
  if(total>1000000000)return notice('El monto es demasiado alto para esta cotización.');
  $('workflowForm').elements.parts_clp.value=String(total);
  $('workflowForm').elements.internal_cost_clp.value=String(baseTotal);
  updateTotal();
  notice('Montos cargados al borrador. Revisa impuestos y mano de obra antes de guardar. Esto no guarda ni envía el presupuesto.');
 });
 el.append(apply);
}
$('partsEstimateForm').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!isStaff)return notice('Acceso exclusivo del taller.');
 const req=$('workflowRequest').value;
 if(!req)return notice('Primero selecciona una solicitud de la agenda.');
 const form=event.target,f=form.elements,btn=$('partsEstimateSave');
 let data;
 try{
  const costs=priceNumbers(f);
  const part_name=f.part_name.value.trim();
  if(part_name.length<3)return notice('Indica el repuesto.');
  let url=f.listing_url.value.trim();
  if(url&&!/^https:\/\/([a-z0-9-]+\.)*mercadolibre\.cl(\/|$)/i.test(url))
   return notice('Por seguridad, utiliza una publicación de Mercado Libre Chile o deja el enlace vacío.');
  if(url.length>=1500)return notice('El enlace es demasiado largo.');
  data={request_id:req,part_name,search_text:lastPartSearchText||part_name,
   listing_url:url||null,listing_title:f.listing_title.value.trim()||null,
   supplier:f.supplier.value.trim()||'Mercado Libre Chile',quantity:costs.quantity,unit_cost_clp:costs.unit_cost_clp,
   shipping_clp:costs.shipping_clp,markup_pct:costs.markup_pct,stock_status:f.stock_status.value,
   quote_note:f.quote_note.value.trim()||null,entered_by:currentUser.id};
 }catch(err){return notice(err.message);}
 btn.disabled=true;
 try{
  const {error}=await db.from('part_cost_estimates').insert(data);
  if(error)throw error;
  notice('Repuesto registrado en el costo de la solicitud. Aún no se incluye en el presupuesto hasta que pulses Aplicar total.');
  form.reset();form.elements.markup_pct.value='30';updatePartPreview();
  await loadPartEstimates();
 }catch(err){notice('No se pudo guardar el repuesto: '+err.message);}
 finally{btn.disabled=false;}
});

async function loadWorkstations(){if(!isStaff)return;const {data,error}=await db.from('workstations').select('id,name,active').eq('active',true).order('id');if(error)return notice(error.message);const sel=$('workstation');sel.replaceChildren(new Option('Sin asignar',''));for(const x of data||[])sel.append(new Option(x.name,x.id));try{await refreshPhoneStations();}catch(e){notice(e.message);}}
$('workflowRequest').addEventListener('change',async()=>{const id=$('workflowRequest').value;loadPartEstimates();loadFormalizationStatus();const form=$('workflowForm');form.reset();if(!id)return;const {data,error}=await db.from('intake_workflow').select('*').eq('request_id',id).maybeSingle();if(error)return notice(error.message);if(!data)return;for(const key of ['diagnosis','diagnosis_tests','public_scope','labor_clp','parts_clp','tax_clp','internal_cost_clp','workstation_id'])if(form.elements[key])form.elements[key].value=data[key]??'';form.elements.appointment_at.value=dateLocal(data.appointment_at);form.elements.appointment_end.value=dateLocal(data.appointment_end);$('offerQuote').disabled=data.quote_status!=='draft';updateTotal();});

/* Fase 1 / V25: vínculo seguro del presupuesto aprobado con orden de reparación. */
let formalizationNonce=0;
async function loadFormalizationStatus(){
 const ticket=++formalizationNonce, id=$('workflowRequest').value;
 const status=$('formalizationStatus'),btn=$('createRepairOrder'),form=$('formalizationForm');
 const emailBtn=$('saveGuestEmail');
 $('formalizationResult').replaceChildren();
 form.reset();
 btn.disabled=true;emailBtn.disabled=!id;
 status.textContent=id?'Revisando aprobación y recepción del vehículo…':'Selecciona una solicitud en la agenda para activar la reparación.';
 if(!isStaff||!id)return;
 const [{data:req,error:reqError},{data:w,error:flowError}]=await Promise.all([
  db.from('service_requests').select('plate,odometer_km,customer_email,intake_source,status').eq('id',id).maybeSingle(),
  db.from('intake_workflow').select('quote_status,repair_order_id,inspection_id').eq('request_id',id).maybeSingle()
 ]);
 if(ticket!==formalizationNonce||$('workflowRequest').value!==id)return;
 if(reqError||flowError){status.textContent='No pudimos verificar la solicitud. Actualiza e inténtalo nuevamente.';return;}
 if(!req){status.textContent='No se encontró la solicitud.';return;}
 form.elements.plate.value=req.plate||'';
 form.elements.odometer_km.value=req.odometer_km??'';
 $('guestEmailForm').elements.email.value=req.customer_email||'';
 emailBtn.disabled=!['phone','web_express'].includes(req.intake_source);
 if(w?.repair_order_id){
  btn.disabled=true;
  status.textContent='La orden de reparación ya fue creada. No es necesario repetir la recepción.';
  const a=node('p','Orden registrada. La operación evita duplicar una orden existente.','phone-success');
  $('formalizationResult').append(a);
  return;
 }
 if(w?.quote_status==='approved'){
  btn.disabled=false;
  status.textContent='Presupuesto aprobado: registra la inspección física y confirma el ingreso para crear la orden.';
 }else{
  btn.disabled=true;
  status.textContent='Todavía no se puede generar la orden: '+(w?.quote_status==='offered'?'esperando decisión del cliente.':w?.quote_status==='rejected'?'presupuesto rechazado.':'primero prepara, ofrece y consigue la aprobación del presupuesto.');
 }
}
$('formalizationForm').addEventListener('submit',async e=>{
 e.preventDefault();
 if(!isStaff)return notice('Solo personal autorizado del taller.');
 const id=$('workflowRequest').value,btn=$('createRepairOrder'),f=e.target.elements;
 if(!id||btn.disabled)return notice('Selecciona una solicitud con presupuesto aprobado.');
 if(!$('confirmPhysical').checked)return notice('Confirma que revisaste físicamente el vehículo.');
 if(!confirm('¿Confirmas que el vehículo ya está en el taller, inspeccionaste su estado y el cliente aprobó el presupuesto? Esta acción abrirá la orden de reparación.'))return;
 btn.disabled=true;btn.textContent='Creando orden…';
 try{
  const plate=f.plate.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
  const km=Number(f.odometer_km.value);
  const notes=f.mechanical_notes.value.trim();
  const fuel=f.fuel_level.value===''?null:Number(f.fuel_level.value);
  if(!/^[A-Z0-9]{5,8}$/.test(plate)||!Number.isSafeInteger(km)||km<0||km>3000000||notes.length<15||notes.length>2000||fuel!==null&&(!Number.isInteger(fuel)||fuel<0||fuel>100))throw Error('Revisa patente, kilometraje, combustible e inspección.');
  const {data,error}=await db.rpc('finalize_approved_intake',{
   p_request_id:id,p_plate:plate,p_odometer_km:km,p_mechanical_notes:notes,
   p_exterior_notes:f.exterior_notes.value.trim(),p_interior_notes:f.interior_notes.value.trim(),
   p_fuel_level:fuel,p_confirmed:true
  });
  if(error)throw error;
  const order=Array.isArray(data)?data[0]:data;
  if(!order?.order_id)throw Error('La base de datos no confirmó una orden.');
  notice('Orden de reparación '+String(order.order_number)+' registrada correctamente.');
  await loadStaff();
  $('workflowRequest').value=id;
  await loadFormalizationStatus();
  await loadRepairOrders();
  $('formalizationResult').append(node('strong','Orden de reparación Nº '+order.order_number+' · '+(order.already_exists?'Ya existía':'Creada correctamente'),'phone-success'));
  loadDashboard();
 }catch(error){notice('No se pudo crear la orden: '+error.message);}
 finally{btn.textContent='Crear orden de reparación';if($('workflowRequest').value===id)loadFormalizationStatus();}
});
$('guestEmailForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!isStaff)return;
 const id=$('workflowRequest').value,btn=$('saveGuestEmail'),f=e.target.elements;
 if(!id)return notice('Selecciona la solicitud que recibirá el correo.');
 if(!f.confirmed.checked)return notice('Confirma que recibiste autorización del cliente.');
 const email=f.email.value.trim().toLowerCase();
 if(!email)return notice('Ingresa el correo.');
 btn.disabled=true;
 try{
  const {data,error}=await db.rpc('set_guest_intake_email',{p_request_id:id,p_email:email,p_confirmed:true});
  if(error)throw error;
  if(!data)throw Error('No se guardó el correo.');
  notice('Correo registrado. Para activar la cuenta, el cliente debe verificar esa dirección personalmente.');
  await loadStaff();$('workflowRequest').value=id;await loadFormalizationStatus();
 }catch(error){notice('No se pudo guardar: '+error.message);}
 finally{btn.disabled=false;}
});

function updateTotal(){const f=$('workflowForm').elements;$('quoteTotal').textContent='Total al cliente: '+money(['labor_clp','parts_clp','tax_clp'].reduce((n,k)=>n+Number(f[k].value||0),0));}
for(const x of ['labor_clp','parts_clp','tax_clp'])$('workflowForm').elements[x].addEventListener('input',updateTotal);updateTotal();
function workflowPayload(){const f=$('workflowForm').elements;const id=f.request_id.value;if(!id)throw Error('Selecciona una solicitud');const start=f.appointment_at.value,end=f.appointment_end.value,station=f.workstation_id.value;if((start||end||station)&&!(start&&end&&station))throw Error('Completa inicio, fin y puesto, o deja los tres vacíos');if(start&&!validSlot(isoLocal(start),isoLocal(end)))throw Error('Reserva fuera de horario (lunes a viernes 08:30–17:00 Chile) o intervalo inválido');const data={request_id:id,appointment_at:isoLocal(start),appointment_end:isoLocal(end),workstation_id:station?Number(station):null};for(const key of ['diagnosis','diagnosis_tests','public_scope'])data[key]=f[key].value.trim()||null;for(const key of ['labor_clp','parts_clp','tax_clp','internal_cost_clp']){data[key]=Number(f[key].value||0);if(!Number.isSafeInteger(data[key])||data[key]<0)throw Error('Monto inválido');}quoteTotal(data.labor_clp,data.parts_clp,data.tax_clp);return data;}
async function saveWorkflow(offer=false){try{const data=workflowPayload();const {data:existing,error:lookupError}=await db.from('intake_workflow').select('quote_status').eq('request_id',data.request_id).maybeSingle();if(lookupError)throw lookupError;if(existing?.quote_status!=='draft'&&existing)throw Error('Presupuesto ya ofrecido o decidido. No puede modificarse desde este formulario.');if(offer){if(!data.public_scope||data.public_scope.length<10)throw Error('Describe claramente los trabajos ofrecidos');data.quote_status='offered';}const {error}=await db.from('intake_workflow').upsert(data,{onConflict:'request_id'});if(error)throw error;notice(offer?'Presupuesto ofrecido. Ahora puedes crear el enlace seguro y enviarlo al cliente por WhatsApp.':'Borrador guardado.');$('offerQuote').disabled=offer;if(offer)await loadStaff();}catch(e){notice('No se pudo guardar: '+e.message);}}
$('workflowForm').addEventListener('submit',e=>{e.preventDefault();saveWorkflow(false)});$('offerQuote').addEventListener('click',()=>saveWorkflow(true));
async function loadQuotes(){if(!currentUser)return;const el=$('myQuotes');el.replaceChildren(node('p','Cargando presupuestos…'));const {data,error}=await db.rpc('my_intake_quotes');el.replaceChildren();if(error)return notice('No se pudieron consultar los presupuestos: '+error.message);if(!data?.length)return el.append(node('p','Aún no hay presupuestos para decidir.'));for(const q of data){const item=node('article',undefined,'record');item.append(node('strong',q.public_scope||'Presupuesto'),node('p','Total: '+money(q.total_clp)),node('small','Estado: '+({offered:'Pendiente de aprobación',approved:'Aprobado',rejected:'Rechazado'}[q.quote_status]||q.quote_status)));const download=node('button','Descargar presupuesto PDF','secondary');
download.addEventListener('click',()=>{
 try{
  const pdf=crearDocumentoTato({tipo:'presupuesto',solicitud:{id:q.request_id,customer_name:currentUser.email},trabajo:q});
  descargarDocumento(pdf.blob,pdf.filename);
 }catch(error){notice('No se pudo descargar PDF: '+error.message);}
});item.append(download);if(q.quote_status==='offered'){const actions=node('div',undefined,'actions');for(const [approve,title] of [[true,'Aprobar'],[false,'Rechazar']]){const b=node('button',title,approve?'':'secondary');b.addEventListener('click',async()=>{if(!confirm(`¿Confirmas que deseas ${approve?'aprobar':'rechazar'} el presupuesto de ${money(q.total_clp)}?`))return;b.disabled=true;const {error}=await db.rpc('decide_intake_quote',{p_request:q.request_id,p_approve:approve});notice(error?'No se pudo registrar tu decisión: '+error.message:'Tu decisión quedó registrada.');await loadQuotes();});actions.append(b);}item.append(actions);}el.append(item);}}


/* V26: bandeja de órdenes activa y estado compartido entre taller y cliente. */
const repairStages={parts_pending:'Esperando repuestos',repairing:'En reparación',quality_check:'Control de calidad',ready_for_pickup:'Listo para retiro',delivered:'Entregado'};
let orderListLoadNonce=0;
async function loadRepairOrders(){
 const el=$('repairOrdersList');
 if(!isStaff||!currentUser){el.replaceChildren();return;}
 const ticket=++orderListLoadNonce;
 el.replaceChildren(node('p','Consultando órdenes de reparación…'));
 const {data:rows,error}=await db.from('repair_orders')
   .select('id,order_number,client_id,vehicle_id,status,customer_complaint,diagnosis,opened_at,closed_at')
   .order('opened_at',{ascending:false}).limit(100);
 if(ticket!==orderListLoadNonce)return;
 if(error){el.replaceChildren(node('p','No se pudieron consultar las órdenes: '+error.message));return;}
 if(!rows?.length){el.replaceChildren(node('p','Todavía no hay órdenes de reparación. Se crearán después de la aprobación y recepción física.'));return;}
 const ids=rows.map(x=>x.id);
 const [flows,clients,vehicles,progress]=await Promise.all([
  db.from('intake_workflow').select('request_id,repair_order_id').in('repair_order_id',ids),
  db.from('clients').select('id,full_name,phone').in('id',[...new Set(rows.map(x=>x.client_id))]),
  db.from('vehicles').select('id,plate,make,model').in('id',[...new Set(rows.map(x=>x.vehicle_id))]),
  db.from('intake_repair_progress').select('request_id,stage,parts_summary,parts_eta_at,estimated_delivery_at').in('request_id',(await db.from('intake_workflow').select('request_id').in('repair_order_id',ids)).data?.map(x=>x.request_id)||[])
 ]);
 if(ticket!==orderListLoadNonce)return;
 const flowMap=new Map((flows.data||[]).map(x=>[x.repair_order_id,x.request_id]));
 const customerMap=new Map((clients.data||[]).map(x=>[x.id,x]));
 const vehicleMap=new Map((vehicles.data||[]).map(x=>[x.id,x]));
 const progressMap=new Map((progress.data||[]).map(x=>[x.request_id,x]));
 el.replaceChildren();
 if(flows.error||clients.error||vehicles.error||progress.error)
  el.append(node('p','Algunos datos complementarios no pudieron consultarse. Las órdenes siguen disponibles.','repair-warning'));
 const orderPriority={waiting_parts:0,in_progress:1,approved:2,ready:3,open:4,diagnosis:5,awaiting_approval:6,delivered:9,cancelled:10};
 rows.sort((a,b)=>(orderPriority[a.status]??7)-(orderPriority[b.status]??7)||new Date(b.opened_at)-new Date(a.opened_at));
 for(const row of rows){
  const req=flowMap.get(row.id),client=customerMap.get(row.client_id),vehicle=vehicleMap.get(row.vehicle_id);
  const update=req?progressMap.get(req):null;
  const card=node('article',undefined,'repair-order-card'+(row.status==='delivered'?' repair-order-complete':''));
  const heading=node('div',undefined,'repair-order-header');
  heading.append(node('strong','Orden Nº '+row.order_number));
  heading.append(node('span',({approved:'Aprobada',in_progress:'En reparación',waiting_parts:'Esperando repuestos',ready:'Lista para retiro',delivered:'Entregada',open:'Abierta',cancelled:'Cancelada'})[row.status]||row.status,'repair-order-status'));
  card.append(heading,node('p',[vehicle?.plate||'Patente no visible',vehicle?.make,vehicle?.model].filter(Boolean).join(' · ')));
  if(client)card.append(node('small','Cliente: '+client.full_name));
  if(update?.stage)card.append(node('p','Avance: '+(repairStages[update.stage]||update.stage)));
  if(update?.parts_summary)card.append(node('p','Repuestos: '+update.parts_summary));
  if(update?.parts_eta_at)card.append(node('small','Llegada estimada de repuestos: '+update.parts_eta_at));
  if(update?.estimated_delivery_at)card.append(node('small','Entrega estimada: '+new Date(update.estimated_delivery_at).toLocaleString('es-CL')));
  if(req){
   const select=node('button','Administrar esta orden','secondary');select.type='button';
   select.addEventListener('click',()=>{
    $('workflowRequest').value=req;
    $('workflowRequest').dispatchEvent(new Event('change'));
    $('progressForm').scrollIntoView({behavior:'smooth',block:'start'});
    notice('Orden seleccionada. Revisa los repuestos y actualiza su avance al final del Control Center.');
   });
   card.append(select);
  }
  el.append(card);
 }
}
$('refreshOrders').addEventListener('click',loadRepairOrders);

const stageLabels={parts_pending:'Esperando repuestos',repairing:'En reparación',quality_check:'Control de calidad',ready_for_pickup:'Listo para entrega',delivered:'Entregado'};
async function loadProgress(){if(!currentUser)return;const el=$('myProgress');el.replaceChildren(node('p','Cargando seguimiento…'));const {data,error}=await db.rpc('my_repair_progress_v2');el.replaceChildren();if(error){notice('Seguimiento no disponible: '+error.message);return;}if(!data?.length){el.append(node('p','No tienes reparaciones en curso.'));return;}for(const x of data){const item=node('article',undefined,'record');item.append(node('strong',stageLabels[x.stage]||x.stage));if(x.customer_message)item.append(node('p',x.customer_message));if(x.parts_summary)item.append(node('p','Repuestos: '+x.parts_summary));if(x.parts_eta_at)item.append(node('small','Llegada estimada de repuestos: '+new Date(x.parts_eta_at+'T12:00:00').toLocaleDateString('es-CL')));if(x.estimated_delivery_at)item.append(node('small','Entrega estimada: '+new Date(x.estimated_delivery_at).toLocaleString('es-CL')));if(x.warranty_until)item.append(node('small','Garantía hasta: '+x.warranty_until));if(x.delivered_at)item.append(node('small','Entregado: '+new Date(x.delivered_at).toLocaleDateString('es-CL')));el.append(item);}}
$('workflowRequest').addEventListener('change',async()=>{const id=$('workflowRequest').value;const f=$('progressForm');f.reset();$('confirmHandover').checked=false;$('progressOrderStatus').textContent='Comprobando orden de reparación…';if(!id){$('progressOrderStatus').textContent='Selecciona una solicitud con orden activa.';return;}const {data:workflow}=await db.from('intake_workflow').select('repair_order_id,quote_status').eq('request_id',id).maybeSingle();if(workflow?.repair_order_id){const {data:order}=await db.from('repair_orders').select('order_number,status').eq('id',workflow.repair_order_id).maybeSingle();$('progressOrderStatus').textContent=order?'Orden Nº '+order.order_number+' · estado: '+order.status:'Orden activa, consulta sus datos.';}else $('progressOrderStatus').textContent='Esta solicitud todavía no tiene orden. Necesita presupuesto aprobado y recepción física.';const {data,error}=await db.from('intake_repair_progress').select('*').eq('request_id',id).maybeSingle();if(error){notice(error.message);return;}if(data)for(const k of ['stage','customer_message','internal_notes','parts_summary','parts_eta_at','warranty_until'])f.elements[k].value=data[k]??'';if(data?.estimated_delivery_at)f.elements.estimated_delivery_at.value=dateLocal(data.estimated_delivery_at);});
$('progressForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const id=$('workflowRequest').value,btn=$('saveRepairStage');
 if(!isStaff||!id)return notice('Selecciona una orden de reparación.');
 const f=e.target.elements;
 if(f.stage.value==='delivered'&&!$('confirmHandover').checked)return notice('Debes confirmar la entrega física antes de marcar Entregado.');
 if(f.stage.value==='delivered'&&!confirm('¿Confirmas que el vehículo fue entregado al cliente? Esto cerrará la orden de reparación.'))return;
 if(btn.disabled)return;
 btn.disabled=true;btn.textContent='Guardando avance…';
 try{
  const {data,error}=await db.rpc('staff_set_repair_stage',{
   p_request_id:id,p_stage:f.stage.value,p_customer_message:f.customer_message.value.trim()||null,
   p_parts_summary:f.parts_summary.value.trim()||null,p_parts_eta_at:f.parts_eta_at.value||null,
   p_estimated_delivery_at:f.estimated_delivery_at.value?isoLocal(f.estimated_delivery_at.value):null,
   p_internal_notes:f.internal_notes.value.trim()||null,p_warranty_until:f.warranty_until.value||null,
   p_confirm_handover:!!$('confirmHandover').checked
  });
  if(error)throw error;
  const row=Array.isArray(data)?data[0]:data;
  if(!row?.order_id)throw Error('No se recibió confirmación de la orden.');
  $('confirmHandover').checked=false;
  $('progressOrderStatus').textContent='Orden Nº '+row.order_number+' · '+(repairStages[row.stage]||row.stage)+' · sincronizada.';
  notice('Orden y seguimiento del cliente actualizados correctamente.');
  await loadRepairOrders();
  loadDashboard();
 }catch(error){notice('No se pudo guardar el avance: '+error.message);}
 finally{btn.disabled=false;btn.textContent='Guardar etapa y sincronizar orden';}
});

// Customer-scoped history: no global plate lookup. Every record comes from the authenticated user's own request query.
async function loadHistory(){
 if(!currentUser)return;
 const el=$('myHistory');el.replaceChildren(node('p','Cargando historial…'));
 const {data,error}=await db.from('service_requests').select('id,created_at,plate,make,model,complaint,status').eq('customer_user_id',currentUser.id).order('created_at',{ascending:false}).limit(100);
 el.replaceChildren();if(error)return notice('Historial: '+error.message);
 if(!data?.length)return el.append(node('p','Aún no hay atenciones registradas.'));
 for(const x of data){const article=node('article',undefined,'record');article.append(node('strong',`${x.plate||'Sin patente'} · ${x.make||''} ${x.model||''}`),node('small',new Date(x.created_at).toLocaleDateString('es-CL')),node('p',x.complaint),node('small',labels[x.status]||x.status));el.append(article);}
}
async function prepararActaDigital(type){
 const id=$('workflowRequest').value;
 if(!id)throw Error('Selecciona una solicitud para generar su documento.');
 const {data:req,error}=await db.from('service_requests')
  .select('id,customer_name,customer_phone,customer_email,plate,make,model,model_year,odometer_km,complaint,priority')
  .eq('id',id).single();
 if(error)throw Error('No se pudo leer la solicitud: '+error.message);
 const campos=[
  {label:'Kilometraje al ingreso',value:$('docOdometer').value||'No informado'},
  {label:'Combustible al ingreso',value:$('docFuel').value||'No informado'},
  {label:'Estado visual / daños',value:$('docDamage').value||'No informado'},
  {label:'Llaves y accesorios',value:$('docItems').value||'No informado'}
 ];
 return {pdf:crearDocumentoTato({tipo:type,solicitud:req,campos}),req};
}
for(const [buttonId,type] of [['printReception','recepcion'],['printDelivery','entrega']]){
 $(buttonId).addEventListener('click',async()=>{
  const button=$(buttonId);button.disabled=true;
  try{
   const {pdf,req}=await prepararActaDigital(type);
   const container=$('docFiles');container.replaceChildren();
   container.append(node('strong','Documento listo: '+pdf.filename));
   montarAccionesDocumento(container,pdf,{phone:req.customer_phone,email:req.customer_email,requestId:req.id,message:'Tato Soluciones: adjuntamos el registro digital de '+(type==='recepcion'?'recepción':'entrega')+' del vehículo.'});
   notice('Archivo digital preparado. No necesitas impresora.');
  }catch(error){notice('No se pudo generar el documento: '+error.message);}
  finally{button.disabled=false;}
 });
}

/* V18: Actualiza la bandeja cuando se detecten nuevas solicitudes, con el panel abierto. */
let expressPollLastCount=null;
async function pollNewExpress(){
 if(!isStaff||!currentUser||document.visibilityState!=='visible'||!db)return;
 const {count,error}=await db.from('service_requests').select('*',{count:'exact',head:true}).eq('status','received');
 if(error||typeof count!=='number')return;
 if(expressPollLastCount!==null&&count>expressPollLastCount){
  document.title='('+count+') Nuevas solicitudes · Tato Soluciones';
  if(!$('dashboard').hidden)loadDashboard();
  if(!$('staff').hidden)loadStaff();
  notice('Hay solicitudes pendientes de revisión en el taller.');
 }
 expressPollLastCount=count;
}
setInterval(pollNewExpress,45000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollNewExpress()});
