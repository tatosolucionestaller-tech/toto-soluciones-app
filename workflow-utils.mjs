export const CL_TZ='America/Santiago';
export function validSlot(start,end){
 if(!start||!end)return false;
 const a=new Date(start),b=new Date(end);
 if(!Number.isFinite(+a)||!Number.isFinite(+b)||b<=a||b-a>8.5*3600000)return false;
 const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:CL_TZ,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const parts=d=>Object.fromEntries(fmt.formatToParts(d).map(x=>[x.type,x.value]));
 const p=parts(a),q=parts(b),m=x=>Number(x.hour)*60+Number(x.minute);
 return !['Sat','Sun'].includes(p.weekday)&&p.weekday===q.weekday&&m(p)>=510&&m(q)<=1020;
}
export function quoteTotal(labor,parts,tax){const vals=[labor,parts,tax].map(Number);if(vals.some(x=>!Number.isSafeInteger(x)||x<0))throw Error('Monto CLP inválido');const sum=vals.reduce((a,b)=>a+b,0);if(!Number.isSafeInteger(sum))throw Error('Monto demasiado alto');return sum;}
export function plateValid(plate){return /^[A-Z0-9]{5,8}$/.test(String(plate).trim().toUpperCase());}
export function quoteText(q,request){const total=quoteTotal(q.labor_clp,q.parts_clp,q.tax_clp);return `TATO SOLUCIONES\nPRESUPUESTO DE SERVICIO\nPatente: ${request.plate||'No indicada'}\nCliente: ${request.customer_name}\nDescripción: ${q.public_scope||''}\nMano de obra: $${q.labor_clp}\nRepuestos: $${q.parts_clp}\nImpuestos: $${q.tax_clp}\nTOTAL: $${total}\nEstado: ${q.quote_status}\nEste documento no reemplaza la aprobación digital registrada en el sistema.`;}

// Convert a Chilean wall-clock datetime-local value to UTC, independent of device timezone.
export function chileLocalToIso(value){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Fecha inválida');
 const [y,mo,d,h,mi]=value.match(/\d+/g).map(Number);
 const target=Date.UTC(y,mo-1,d,h,mi);
 if(new Date(target).getUTCFullYear()!==y||new Date(target).getUTCMonth()!==mo-1||new Date(target).getUTCDate()!==d)throw Error('Fecha inexistente');
 const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:CL_TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const localMs=t=>{const p=Object.fromEntries(fmt.formatToParts(new Date(t)).map(x=>[x.type,x.value]));return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute)};
 let t=target;for(let i=0;i<4;i++)t+=target-localMs(t);
 if(localMs(t)!==target)throw Error('Hora inexistente por cambio de horario');
 return new Date(t).toISOString();
}
