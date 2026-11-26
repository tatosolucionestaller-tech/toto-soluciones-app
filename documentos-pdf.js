/* Tato Soluciones - documentos digitales A4 (jsPDF 4.2.1, versión fija).
 * No envía datos a un servidor de PDF: los archivos se generan en el navegador.
 * La exportación por WhatsApp depende de Web Share del dispositivo; no equivale a un envío automatizado.
 */
const money=(n)=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(n)||0);
const clean=(v)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/[\u2010-\u2015]/g,'-').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/\u2026/g,'...').replace(/[^\u0000-\u00ff]/g,'?').trim();
const stamp=(date)=>new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);
const dateText=(iso)=>iso?new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso)):'Por confirmar';
const shortCode=(id)=>'TATO-'+String(id||'SIN-CODIGO').slice(0,8).toUpperCase();
const kindName={prediagnostico:'FICHA DE ATENCION',presupuesto:'PRESUPUESTO DE REPARACION',recepcion:'REGISTRO DE RECEPCION',entrega:'REGISTRO DE ENTREGA',comprobante:'COMPROBANTE INTERNO DE PAGO'};
function clip(v,n=1700){return clean(v).slice(0,n);}
export function crearDocumentoTato({tipo,solicitud={},trabajo={},urlAprobacion='',campos=[]}){
 if(!window.jspdf?.jsPDF)throw new Error('No se cargó el generador de PDF. Comprueba la conexión y actualiza la página.');
 if(!kindName[tipo])throw new Error('Tipo de documento no admitido.');
 const {jsPDF}=window.jspdf;
 const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
 const L=18,R=192,WIDTH=R-L,H=297;
 const red=[196,29,39],navy=[19,31,43],gray=[92,106,118],line=[222,228,233];
 let y=57,page=1;
 const color=(rgb)=>doc.setTextColor(...rgb);
 const newPage=()=>{
  doc.addPage();page++;y=25;
  doc.setFillColor(...navy);doc.rect(0,0,210,10,'F');
  color(navy);doc.setFont('helvetica','bold');doc.setFontSize(9);
  doc.text('TATO SOLUCIONES  /  '+clean(kindName[tipo]),L,18);
  doc.setDrawColor(...line);doc.line(L,22,R,22);
 };
 const need=(h)=>{if(y+h>269)newPage();};
 const font=(size=10,bold=false,clr=navy)=>{
  doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);color(clr);
 };
 const paragraph=(v,size=10,gap=5.3,top=0)=>{
  const value=clip(v,3000);
  if(!value)return;
  y+=top;font(size,false,navy);
  const lines=doc.splitTextToSize(value,WIDTH);
  for(const row of lines){need(gap);doc.text(row,L,y);y+=gap;}
 };
 const section=(title)=>{
  need(17);y+=6;doc.setFillColor(245,247,249);doc.roundedRect(L,y-5,WIDTH,9,1.2,1.2,'F');
  font(10,true,red);doc.text(clean(title),L+3,y+1);y+=11;
 };
 const kv=(label,value)=>{
  need(8);font(9,true,gray);doc.text(clean(label),L,y);
  font(9,false,navy);
  const x=69;
  const parts=doc.splitTextToSize(clip(value,180)||'No informado',R-x);
  for(let i=0;i<parts.length;i++){if(i)need(6);doc.text(parts[i],x,y);y+=6;}
  y+=3;
 };
 const note=(v,urgent=false)=>{
  const text=clip(v,1600),parts=doc.splitTextToSize(text,WIDTH-10);
  const height=Math.max(16,parts.length*4.5+9);
  need(height+5);doc.setFillColor(...(urgent?[255,242,235]:[241,247,243]));
  doc.setDrawColor(...(urgent?[208,111,49]:[109,158,126]));
  doc.roundedRect(L,y-4,WIDTH,height,2,2,'FD');
  font(9,false,urgent?[121,59,30]:[58,93,70]);
  let ay=y+2;for(const txt of parts){doc.text(txt,L+5,ay);ay+=4.5;}
  y+=height+6;
 };
 doc.setProperties({title:kindName[tipo]+' | '+shortCode(solicitud.id),subject:'Documento digital de atención vehicular',author:'Tato Soluciones',creator:'Tato Soluciones Control Center'});
 doc.setFillColor(...navy);doc.rect(0,0,210,46,'F');
 doc.setFillColor(...red);doc.rect(0,0,5,46,'F');
 font(14,true,[255,255,255]);doc.text('TATO SOLUCIONES',L,19);
 font(8,false,[215,227,231]);doc.text('Taller automotriz  |  Arica, Chile',L,27);
 font(14,true,[255,255,255]);doc.text(kindName[tipo],R,22,{align:'right'});
 font(9,false,[215,227,231]);doc.text('Documento digital - sin necesidad de impresora',R,30,{align:'right'});
 try{
  const img=document.querySelector('.brand-logo,.quote-top img');
  if(img?.complete&&img.naturalWidth>0){
   const cv=document.createElement('canvas');cv.width=240;cv.height=125;
   const ctx=cv.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,cv.width,cv.height);
   const scale=Math.min(cv.width/img.naturalWidth,cv.height/img.naturalHeight);
   const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
   ctx.drawImage(img,(cv.width-w)/2,(cv.height-h)/2,w,h);
   doc.setFillColor(255,255,255);doc.roundedRect(17,31,31,19,2,2,'F');
   doc.addImage(cv.toDataURL('image/jpeg',.82),'JPEG',19,33,27,15);
  }
 }catch{/* El documento sigue siendo válido sin el logo cargado. */}
 font(10,true,red);doc.text(shortCode(solicitud.id),L,y);
 font(8,false,gray);doc.text('Emisión: '+stamp(new Date()),R,y,{align:'right'});
 y+=8;doc.setDrawColor(...line);doc.line(L,y,R,y);y+=2;
 section('DATOS DE ATENCION');
 kv('Cliente',solicitud.customer_name||'No indicado');
 kv('Contacto',solicitud.customer_phone||'No indicado');
 if(solicitud.customer_email)kv('Correo',solicitud.customer_email);
 kv('Vehículo',[solicitud.make,solicitud.model,solicitud.model_year].filter(Boolean).join(' ')||'Sin datos de modelo');
 kv('Patente',solicitud.plate||'No informada');
 if(solicitud.odometer_km!=null)kv('Kilometraje',Number(solicitud.odometer_km).toLocaleString('es-CL')+' km');
 if(solicitud.priority==='urgent')note('ATENCION: caso de prioridad urgente. No circular si presenta una falla que comprometa la seguridad, especialmente frenos, dirección o sobrecalentamiento.',true);
 if(tipo==='prediagnostico'||tipo==='presupuesto'){
  section('MOTIVO DE CONSULTA');
  paragraph(solicitud.complaint||'Sin descripción de falla registrada.',10,5.3);
  if(tipo==='prediagnostico'){
   section('OBSERVACION / PREDIAGNOSTICO');
   paragraph(trabajo.diagnosis||'Pendiente de inspección presencial para determinar causa y alcance del trabajo.',10,5.4);
   if(trabajo.diagnosis_tests){section('PRUEBAS REGISTRADAS');paragraph(trabajo.diagnosis_tests,9,5);}
   if(trabajo.public_scope){section('TRABAJO SUGERIDO');paragraph(trabajo.public_scope,10,5.3);}
   note('Documento informativo y preliminar. No equivale a diagnóstico definitivo, presupuesto aceptado ni autorización para realizar reparaciones.');
  }
  if(tipo==='presupuesto'){
   section('TRABAJOS OFRECIDOS');
   paragraph(trabajo.public_scope||'Debe detallarse el trabajo antes de ofrecer el presupuesto.',10,5.3);
   section('DETALLE ECONOMICO');
   const entries=[['Mano de obra',trabajo.labor_clp],['Repuestos',trabajo.parts_clp],['Impuestos declarados',trabajo.tax_clp]];
   for(const [label,value] of entries){
    need(9);font(10,false,gray);doc.text(label,L+1,y);
    font(10,true,navy);doc.text(money(value),R-2,y,{align:'right'});y+=9;
   }
   need(16);doc.setFillColor(...navy);doc.roundedRect(L,y-3,WIDTH,14,2,2,'F');
   font(11,true,[255,255,255]);doc.text('TOTAL DEL PRESUPUESTO',L+4,y+6);
   doc.text(money((Number(trabajo.labor_clp)||0)+(Number(trabajo.parts_clp)||0)+(Number(trabajo.tax_clp)||0)),R-4,y+6,{align:'right'});y+=21;
   if(urlAprobacion){
    need(29);font(9,true,red);doc.text('REVISA Y DECIDE EN LINEA',L,y);
    doc.setFillColor(246,249,251);doc.roundedRect(L,y+3,WIDTH,14,2,2,'F');
    font(10,true,navy);doc.text('ABRIR PRESUPUESTO / APROBAR O RECHAZAR',L+5,y+12);
    doc.link(L,y+3,WIDTH,14,{url:urlAprobacion});
    y+=25;
    note('Solo se considerará aceptado cuando el cliente confirme su decisión en el enlace seguro. No se envían contraseñas por WhatsApp.');
   }
   note('Valores expresados en pesos chilenos. Trabajos adicionales y cambios de precio deben informarse y aprobarse antes de ejecutarse. La fecha de entrega se confirmará según disponibilidad de repuestos y del taller.');
  }
 }else{
  section(tipo==='recepcion'?'CONDICIONES AL INGRESO':tipo==='comprobante'?'DATOS DEL PAGO':'REGISTRO DE ENTREGA');
  for(const c of campos){kv(c.label||'Dato',c.value||'Pendiente de completar');}
  if(tipo==='recepcion')note('Registro de ingreso para revisión del cliente y del taller. No representa autorización de trabajos ni firma electrónica.');
  else if(tipo==='comprobante')note('Comprobante interno de pago. Documento informativo emitido por el taller; NO es boleta, factura ni documento tributario del SII. Los cambios quedan reflejados en el historial.');
  else note('Registro informativo de entrega. La conformidad y documentación definitiva deberán confirmarse con el cliente.');
 }
 need(21);y+=8;doc.setDrawColor(...line);doc.line(L,y,R,y);y+=7;
 font(8,false,gray);doc.text('Tato Soluciones  |  Arica, Chile  |  Contacto mediante canales oficiales del taller',L,y);
 doc.text('ID interno: '+clip(solicitud.id||'Sin solicitud',80),L,y+5);
 const total=doc.getNumberOfPages();
 for(let i=1;i<=total;i++){
  doc.setPage(i);font(8,false,gray);
  doc.setDrawColor(...line);doc.line(L,283,R,283);
  doc.text('Documento generado desde Tato Soluciones - conservar para seguimiento.',L,289);
  doc.text('Página '+i+' de '+total,R,289,{align:'right'});
 }
 const file='TATO_'+tipo.toUpperCase()+'_'+String(solicitud.id||'SIN-CODIGO').slice(0,8).toUpperCase()+'.pdf';
 return {blob:doc.output('blob'),filename:file,title:clean(kindName[tipo])};
}
export function descargarDocumento(blob,filename){
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=filename;
 a.style.display='none';document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export function compartirDocumento({blob,filename,title,message='',phone=''}) {
 const file=new File([blob],filename,{type:'application/pdf'});
 const data={files:[file],title:title||'Tato Soluciones',text:message};
 if(navigator.canShare?.({files:[file]})&&navigator.share){
  return navigator.share(data);
 }
 descargarDocumento(blob,filename);
 const number=String(phone).replace(/\D/g,'');
 if(number.length>=8){
  const u='https://wa.me/'+number+'?text='+encodeURIComponent(message+' (Adjunto el PDF descargado desde Tato Soluciones).');
  window.open(u,'_blank','noopener,noreferrer');
 }
 return Promise.resolve('downloaded');
}
