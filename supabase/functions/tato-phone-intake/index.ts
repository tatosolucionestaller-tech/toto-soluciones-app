import {createClient} from "npm:@supabase/supabase-js@2.57.0";
const allowed=new Set(["https://tato-soluciones.pages.dev","https://tatosoluciones.cl","https://www.tatosoluciones.cl","http://localhost:8080","http://127.0.0.1:8080"]);
const u=Deno.env.get("SUPABASE_URL")??"",k=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const db=createClient(u,k,{auth:{persistSession:false,autoRefreshToken:false}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function reply(body:unknown,status:number,origin:string){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"content-type,authorization,apikey,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"}})}
Deno.serve(async req=>{
 const origin=req.headers.get("origin")??"";
 if(!allowed.has(origin))return reply({ok:false,error:"Origen no permitido"},403,"null");
 if(req.method==="OPTIONS")return reply({ok:true},200,origin);
 if(req.method!=="POST")return reply({ok:false,error:"Método no permitido"},405,origin);
 if(Number(req.headers.get("content-length")||0)>4500)return reply({ok:false,error:"Solicitud demasiado extensa"},413,origin);
 const jwt=req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!jwt||jwt===k)return reply({ok:false,error:"Acceso exclusivo para personal del taller"},401,origin);
 const {data:{user},error:authError}=await db.auth.getUser(jwt);
 if(authError||!user)return reply({ok:false,error:"Sesión caducada, inicia sesión de nuevo"},401,origin);
 const {data:staff,error:staffError}=await db.from("staff_profiles").select("active,role").eq("user_id",user.id).maybeSingle();
 if(staffError||!staff?.active||!["admin","manager","reception"].includes(staff.role))return reply({ok:false,error:"Personal no autorizado"},403,origin);
 try{
  const text=await req.text();if(text.length>4500)return reply({ok:false,error:"Solicitud demasiado extensa"},413,origin);
  const p=JSON.parse(text);
  if(!p||typeof p!=="object"||Array.isArray(p)||!uuid.test(String(p.request_key||"")))return reply({ok:false,error:"Solicitud inválida"},400,origin);
  const str=(name,max=200)=>typeof p[name]==="string"?p[name].trim().slice(0,max):"";
  const name=str("customer_name",121),phone=str("customer_phone",31),complaint=str("complaint",2501);
  const email=str("customer_email",251),plate=str("plate",30).replace(/[^a-z0-9]/gi,"").toUpperCase();
  const make=str("make",91),model=str("model",91);
  const year=p.model_year==null||p.model_year===""?null:Number(p.model_year);
  const start=p.appointment_at??null,end=p.appointment_end??null;
  const station=p.workstation_id==null||p.workstation_id===""?null:Number(p.workstation_id);
  const priority=str("priority",20),contact=str("contact_method",20);
  if(name.length<2||phone.length<7||complaint.length<15||!["normal","urgent"].includes(priority)||!["phone","whatsapp"].includes(contact))
   return reply({ok:false,error:"Revisa nombre, teléfono, falla y forma de contacto"},400,origin);
  if(email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return reply({ok:false,error:"Correo inválido"},400,origin);
  if(plate&& !/^[A-Z0-9]{5,8}$/.test(plate))return reply({ok:false,error:"Patente inválida"},400,origin);
  if(year!==null&&(!Number.isInteger(year)||year<1950||year>2100))return reply({ok:false,error:"Año inválido"},400,origin);
  if((start||end||station)&&(!start||!end||!station))return reply({ok:false,error:"Completa inicio, fin y puesto, o deja todos vacíos"},400,origin);
  if(station!==null&&(!Number.isInteger(station)||station<1||station>5))return reply({ok:false,error:"Puesto inválido"},400,origin);
  if(start&&(!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))))return reply({ok:false,error:"Fecha inválida"},400,origin);
  const {data,error}=await db.rpc("create_phone_intake",{
    p_actor:user.id,p_request_key:p.request_key,p_customer_name:name,p_customer_phone:phone,
    p_customer_email:email||null,p_plate:plate||null,p_make:make||null,p_model:model||null,
    p_model_year:year,p_complaint:complaint,p_priority:priority,p_contact_method:contact,
    p_appointment_at:start,p_appointment_end:end,p_workstation_id:station
  });
  if(error){console.warn("phone intake rejected",error.code||error.message);
   const details=/booked|overlap|workstation|hours|future|hora|puesto/i.test(error.message||"")?"Horario o puesto no disponible. Selecciona otro.":"No se pudo crear la atención. Comprueba datos y vuelve a intentar.";
   return reply({ok:false,error:details},409,origin);
  }
  return reply({ok:true,code:data,status:start?"confirmed":"received"},200,origin);
 }catch(e){console.error("phone intake error",String(e).slice(0,120));return reply({ok:false,error:"No se pudo procesar la solicitud"},500,origin)}
});