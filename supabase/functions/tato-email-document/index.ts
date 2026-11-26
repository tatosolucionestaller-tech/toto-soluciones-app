
import {createClient} from "npm:@supabase/supabase-js@2.57.0";
const SUPA=Deno.env.get("SUPABASE_URL")??"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const RESEND=Deno.env.get("RESEND_API_KEY")??"";
const FROM=Deno.env.get("TATO_DOCUMENT_FROM")??"";
const allowed=new Set(["https://tato-soluciones.pages.dev","https://tatosoluciones.cl","https://www.tatosoluciones.cl","http://localhost:8080","http://127.0.0.1:8080"]);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const names:{[key:string]:string}={prediagnostico:"Ficha de atención",presupuesto:"Presupuesto",recepcion:"Acta de recepción",entrega:"Acta de entrega"};
const db=createClient(SUPA,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
function reply(data:Record<string,unknown>,status:number,origin:string){
 return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer","Vary":"Origin","Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,content-type,apikey,x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"}});
}
function safe(s:unknown){return String(s??"").replace(/[<>&"']/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"}[c]||c));}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin")??"";
 if(!allowed.has(origin))return reply({ok:false,error:"Origen no autorizado"},403,"null");
 if(req.method==="OPTIONS")return reply({ok:true},200,origin);
 if(req.method!=="POST")return reply({ok:false,error:"Método no permitido"},405,origin);
 const jwt=req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!jwt||jwt===SERVICE)return reply({ok:false,error:"Inicia sesión en el taller"},401,origin);
 if(!SUPA||!SERVICE)return reply({ok:false,error:"Servicio temporalmente no disponible"},503,origin);
 const {data:{user},error:authError}=await db.auth.getUser(jwt);
 if(authError||!user)return reply({ok:false,error:"Sesión inválida"},401,origin);
 const {data:staff}=await db.from("staff_profiles").select("role,active").eq("user_id",user.id).maybeSingle();
 if(!staff?.active||!["admin","manager","reception"].includes(staff.role))
  return reply({ok:false,error:"No autorizado para enviar documentos"},403,origin);
 if(!RESEND||!FROM)return reply({ok:false,needs_setup:true,error:"El envío automático por correo todavía necesita configurar y verificar el remitente del taller."},503,origin);
 if(Number(req.headers.get("content-length")||0)>1300000)
  return reply({ok:false,error:"El PDF supera el tamaño permitido"},413,origin);
 try{
  const raw=await req.text();
  if(raw.length>1300000)return reply({ok:false,error:"El PDF supera el tamaño permitido"},413,origin);
  const body=JSON.parse(raw);
  if(!body||typeof body!=="object"||Array.isArray(body))return reply({ok:false,error:"Formato inválido"},400,origin);
  const {request_id,doc_type,idempotency_key,attachment}=body;
  if(typeof request_id!=="string"||!uuid.test(request_id)||
     typeof idempotency_key!=="string"||!uuid.test(idempotency_key)||
     !Object.hasOwn(names,doc_type))
   return reply({ok:false,error:"Datos del documento inválidos"},400,origin);
  const filename="TATO_"+doc_type.toUpperCase()+"_"+request_id.slice(0,8).toUpperCase()+".pdf";
  if(typeof attachment!=="string"||!/^JVBERi0[A-Za-z0-9+/=]+$/.test(attachment)||attachment.length>1100000)
   return reply({ok:false,error:"PDF inválido o demasiado grande"},400,origin);
  const {data:request,error:requestError}=await db.from("service_requests")
    .select("customer_email,customer_name,plate").eq("id",request_id).maybeSingle();
  if(requestError||!request)return reply({ok:false,error:"Solicitud no encontrada"},404,origin);
  const email=String(request.customer_email??"").trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)
   return reply({ok:false,error:"Esta solicitud no tiene correo válido. Usa WhatsApp."},400,origin);
  if(doc_type==="presupuesto"){
    const {data:work,error}=await db.from("intake_workflow").select("quote_status").eq("request_id",request_id).maybeSingle();
    if(error||!work||work.quote_status==="draft")
      return reply({ok:false,error:"Primero debes ofrecer el presupuesto al cliente"},409,origin);
  }
  if(doc_type==="entrega"){
   const {data:approved}=await db.from("intake_workflow").select("quote_status").eq("request_id",request_id).maybeSingle();
   if(approved?.quote_status!=="approved")
     return reply({ok:false,error:"El trabajo aún no está aprobado"},409,origin);
  }
  const {data:existing}=await db.schema("private").from("tato_document_emails")
    .select("state").eq("idempotency_key",idempotency_key).maybeSingle();
  if(existing?.state==="submitted")return reply({ok:true,already_sent:true,message:"Documento enviado previamente"},200,origin);
  if(existing?.state==="pending")return reply({ok:false,error:"Este envío está en curso. Evita reenviarlo."},409,origin);
  const {data:recent,error:rateError}=await db.schema("private").from("tato_document_emails")
    .select("created_at").eq("request_id",request_id).gte("created_at",new Date(Date.now()-86400000).toISOString()).limit(10);
  if(rateError)return reply({ok:false,error:"No se pudo validar el límite de envíos"},503,origin);
  if((recent||[]).length>=6)return reply({ok:false,error:"Límite diario de correos alcanzado para esta solicitud"},429,origin);
  if((recent||[]).length&&Date.now()-Math.max(...recent.map(x=>new Date(x.created_at).getTime()))<120000)
   return reply({ok:false,error:"Espera dos minutos antes de reenviar otro documento"},429,origin);
  const {error:insError}=await db.schema("private").from("tato_document_emails").insert({
    request_id,doc_type,staff_user_id:user.id,to_email:email,idempotency_key,state:"pending"
  });
  if(insError)return reply({ok:false,error:"No se pudo registrar el envío; vuelve a consultar el estado antes de reintentar"},409,origin);
  const subject="Tato Soluciones | "+names[doc_type]+" · "+String(request.plate??"").slice(0,15);
  const html='<div style="background:#f5f7f9;padding:30px 10px;font-family:Arial,sans-serif;color:#142432">'+
   '<div style="max-width:600px;margin:auto;background:#fff;border-radius:14px;overflow:hidden">'+
   '<div style="background:#162333;border-top:6px solid #cb1c2d;color:#fff;padding:25px 30px">'+
   '<h2 style="margin:0">TATO SOLUCIONES</h2><p style="margin:5px 0 0;color:#d6e4ea">Taller automotriz · Arica</p></div>'+
   '<div style="padding:28px 30px"><h2 style="margin:0 0 12px">'+safe(names[doc_type])+' de tu vehículo</h2>'+
   '<p>Hola '+safe(request.customer_name||"")+',</p>'+
   '<p>Adjuntamos el documento correspondiente a tu atención en Tato Soluciones.</p>'+
   '<p><b>Vehículo:</b> '+safe(request.plate||"Sin patente")+'</p>'+
   '<p>Podrás revisar y guardar el archivo PDF desde tu correo. Si el documento es un presupuesto, su recepción no representa aceptación: la aprobación debe realizarse mediante el enlace seguro entregado por el taller.</p>'+
   '<p>Si tienes dudas, comunícate con nuestro equipo antes de autorizar cualquier reparación.</p></div>'+
   '<div style="background:#f0f4f6;padding:20px 30px;font-size:12px;color:#64748b">Tato Soluciones · Arica, Chile · Documento enviado por personal autorizado.</div></div></div>';
  const response=await fetch("https://api.resend.com/emails",{
   method:"POST",headers:{"Authorization":"Bearer "+RESEND,"Content-Type":"application/json","Idempotency-Key":idempotency_key},
   body:JSON.stringify({from:FROM,to:[email],subject,html,
      attachments:[{filename,content:attachment}]})
  });
  const info=await response.json().catch(()=>({}));
  if(!response.ok||!info?.id){
    await db.schema("private").from("tato_document_emails")
       .update({state:"failed",error_code:String(info?.name||"provider_error").slice(0,70),updated_at:new Date().toISOString()})
       .eq("idempotency_key",idempotency_key);
    return reply({ok:false,error:"El proveedor de correo rechazó el envío. Revisa el remitente y su verificación."},502,origin);
  }
  await db.schema("private").from("tato_document_emails")
    .update({state:"submitted",provider_id:String(info.id).slice(0,120),updated_at:new Date().toISOString()})
    .eq("idempotency_key",idempotency_key);
  return reply({ok:true,message:"Correo aceptado por el proveedor",sent_to:email},200,origin);
 }catch(e){
  return reply({ok:false,error:"No se pudo procesar el envío"},500,origin);
 }
});
