import {createClient} from "npm:@supabase/supabase-js@2.57.0";
const allowed=new Set(["https://tato-soluciones.pages.dev","https://tatosoluciones.cl","https://www.tatosoluciones.cl","http://localhost:8080","http://127.0.0.1:8080"]);
const u=Deno.env.get("SUPABASE_URL")??"",k=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const mlToken=Deno.env.get("MERCADOLIBRE_ACCESS_TOKEN")??"";
const db=createClient(u,k,{auth:{persistSession:false,autoRefreshToken:false}});
function out(obj:unknown,status:number,origin:string){return new Response(JSON.stringify(obj),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"content-type,authorization,apikey,x-client-info","Vary":"Origin"}})}
Deno.serve(async req=>{
 const origin=req.headers.get("origin")??"";
 if(!allowed.has(origin))return out({ok:false,error:"Origen no autorizado"},403,"null");
 if(req.method==="OPTIONS")return out({ok:true},200,origin);
 if(req.method!=="POST")return out({ok:false,error:"Método no permitido"},405,origin);
 const jwt=req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!jwt||jwt===k)return out({ok:false,error:"Acceso exclusivo del taller"},401,origin);
 const {data:{user},error:authError}=await db.auth.getUser(jwt);
 if(authError||!user)return out({ok:false,error:"Sesión caducada"},401,origin);
 const {data:staff}=await db.from("staff_profiles").select("role,active").eq("user_id",user.id).maybeSingle();
 if(!staff?.active||!["admin","manager","reception"].includes(staff.role))return out({ok:false,error:"No autorizado"},403,origin);
 let q="";
 try{const body=await req.json();q=String(body?.q||"").trim().replace(/\s+/g," ").slice(0,180)}catch{return out({ok:false,error:"Consulta inválida"},400,origin)}
 if(q.length<3)return out({ok:false,error:"Ingresa al menos tres letras"},400,origin);
 const fallbackUrl="https://listado.mercadolibre.cl/"+q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g,"").trim().replace(/\s+/g,"-");
 if(!mlToken)return out({ok:true,mode:"assisted",url:fallbackUrl,results:[],notice:"Búsqueda asistida. Para consultar precios en la app debe conectarse una cuenta autorizada de Mercado Libre."},200,origin);
 try{
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
  const response=await fetch("https://api.mercadolibre.com/sites/MLC/search?q="+encodeURIComponent(q)+"&limit=12",{headers:{Authorization:"Bearer "+mlToken,Accept:"application/json"},signal:controller.signal});
  clearTimeout(timeout);
  if(!response.ok){console.warn("ML service status",response.status);return out({ok:true,mode:"assisted",url:fallbackUrl,results:[],notice:"La búsqueda automática no está disponible temporalmente. Puedes revisar las publicaciones en Mercado Libre Chile."},200,origin)}
  const body=await response.json();
  const results=Array.isArray(body.results)?body.results.slice(0,12).map((x:any)=>({
   id:String(x.id||"").slice(0,50),title:String(x.title||"").slice(0,220),
   price:Number.isFinite(x.price)?Math.round(x.price):null,currency:String(x.currency_id||""),
   url:typeof x.permalink==="string"&&/^https:\/\/([a-z0-9-]+\.)*mercadolibre\.cl\//.test(x.permalink)?x.permalink:null,
   condition:String(x.condition||""),available_quantity:Number.isInteger(x.available_quantity)?x.available_quantity:null
  })).filter((x:any)=>x.title&&x.url&&x.currency==="CLP"):[];
  return out({ok:true,mode:"api",url:fallbackUrl,results,notice:"Precios referenciales sujetos a compatibilidad, disponibilidad, impuestos y envío."},200,origin);
 }catch(e){console.warn("ML search unavailable",String(e).slice(0,120));return out({ok:true,mode:"assisted",url:fallbackUrl,results:[],notice:"El buscador automático no respondió. Abre Mercado Libre y registra una publicación."},200,origin)}
});