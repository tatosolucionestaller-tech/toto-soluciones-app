import {createClient} from "npm:@supabase/supabase-js@2.57.0";
const SUPA=Deno.env.get("SUPABASE_URL")??"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const db=createClient(SUPA,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const allowed=new Set(["https://tato-soluciones.pages.dev","https://tatosoluciones.cl","https://www.tatosoluciones.cl","http://localhost:8080","http://127.0.0.1:8080"]);
function reply(obj:unknown,status:number,origin:string){return new Response(JSON.stringify(obj),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"}})}
Deno.serve(async(req)=>{
 const origin=req.headers.get("origin")??"";
 if(!allowed.has(origin))return reply({ok:false,error:"Origen no autorizado"},403,"null");
 if(req.method==="OPTIONS")return reply({ok:true},200,origin);
 if(req.method!=="POST")return reply({ok:false,error:"Método no permitido"},405,origin);
 const jwt=req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!jwt||jwt===SERVICE)return reply({ok:false,error:"Autenticación requerida"},401,origin);
 const {data:{user},error}=await db.auth.getUser(jwt);
 if(error||!user)return reply({ok:false,error:"Sesión inválida"},401,origin);
 const {data:staff}=await db.from("staff_profiles").select("active,role").eq("user_id",user.id).maybeSingle();
 if(!staff?.active||!["admin","manager"].includes(staff.role))
   return reply({ok:false,error:"Solo administración puede consultar integraciones"},403,origin);
 const emailConfigured=Boolean(Deno.env.get("RESEND_API_KEY")&&Deno.env.get("TATO_DOCUMENT_FROM"));
 const mlConfigured=Boolean(Deno.env.get("MERCADOLIBRE_ACCESS_TOKEN"));
 const {data:bucketReady,error:bucketError}=await db.rpc("tato_archive_ready");
 return reply({ok:true,emailConfigured,mercadolibreConfigured:mlConfigured,
  archiveConfigured:!bucketError&&bucketReady===true,
  cloudflareVerified:false,
  note:"Esta comprobación confirma configuración, no entrega real de correos, respuesta de API ni despliegue de Cloudflare."},200,origin);
});