import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js';
const $=id=>document.getElementById(id);
const API=SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/express-quote';
const KEY='tato_quote_access_v1';
const fromUrl=new URLSearchParams(location.search).get('token');
if(fromUrl){
 sessionStorage.setItem(KEY,fromUrl);
 history.replaceState(null,'',location.pathname);
}
const token=sessionStorage.getItem(KEY)||'';
const fmt=n=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n||0);
const errorText=text=>{$('status_message').textContent=text;};
async function send(action,extra={}){
 const response=await fetch(API,{method:'POST',mode:'cors',cache:'no-store',
  headers:{'Content-Type':'application/json','apikey':SUPABASE_PUBLISHABLE_KEY},
  body:JSON.stringify({action,token,...extra})});
 let result={};try{result=await response.json()}catch{}
 if(!response.ok||!result.ok)throw Error(result.error||'No pudimos comunicarnos con el taller.');
 return result;
}
function state(status){
 $('decisions').hidden=true;
 $('decision_result').hidden=false;
 $('decision_result').textContent=status==='approved'?'✓ Presupuesto aprobado. Tu decisión quedó registrada y el taller podrá continuar coordinando contigo.':'Presupuesto rechazado. Tu decisión quedó registrada; el taller podrá consultarla.';
 if(status==='approved'){
  $('activation').hidden=false;
  $('activate').href='app-real.html?claim='+encodeURIComponent(token);
 }
}
async function load(){
 if(!token){$('loading').textContent='El enlace de presupuesto no está disponible. Solicita uno nuevo al taller.';return;}
 try{
  const data=await send('view');
  $('loading').hidden=true;$('quote').hidden=false;
  $('scope').textContent=data.description||'Trabajo de reparación propuesto por el taller';
  $('labor').textContent=fmt(data.labor_clp);
  $('parts').textContent=fmt(data.parts_clp);
  $('tax').textContent=fmt(data.tax_clp);
  $('total').textContent=fmt(data.total_clp);
  $('expiry').textContent='Enlace válido hasta: '+new Date(data.expires_at).toLocaleString('es-CL')+'.';
  if(data.status!=='offered')state(data.status);
 }catch(e){$('loading').textContent='';errorText(e.message);}
}
async function decide(approve){
 if(!$('confirm_owner').checked){errorText('Antes de continuar, confirma que revisaste el presupuesto.');return;}
 if(!confirm('¿Confirmas que deseas '+(approve?'APROBAR':'RECHAZAR')+' este presupuesto? Esta decisión quedará registrada.'))return;
 for(const b of [$('accept'),$('reject')])b.disabled=true;
 try{const result=await send('decide',{approve});state(result.status);errorText('');}
 catch(e){errorText(e.message);}
 finally{for(const b of [$('accept'),$('reject')])b.disabled=false;}
}
$('accept').addEventListener('click',()=>decide(true));
$('reject').addEventListener('click',()=>decide(false));
load();