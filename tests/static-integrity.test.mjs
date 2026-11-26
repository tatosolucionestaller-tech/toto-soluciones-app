import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=read('app-real.html'),logic=read('app.js');
test('Every literal DOM reference in app.js resolves in app-real.html',()=>{
 const ids=new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]));
 const refs=[...logic.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(m=>m[1]);
 assert.ok(refs.length>120);
 const missing=[...new Set(refs)].filter(x=>!ids.has(x));
 assert.deepEqual(missing,[]);
});
test('No duplicate HTML IDs',()=>{
 const ids=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size);
});
test('HTML forms are properly closed',()=>{
 for(const name of ['app-real.html','solicitud.html','presupuesto.html']){
  const c=read(name);
  assert.equal((c.match(/<form\b/gi)||[]).length,(c.match(/<\/form>/gi)||[]).length,name);
 }
});
test('Customer document archive is backed by staff metadata and storage',()=>{
 assert.match(html,/id="archiveUploadForm"/);
 assert.match(html,/id="myDocuments"/);
 assert.match(logic,/tato_register_document/);
 assert.match(logic,/storage\.from\(archiveBucket\)\.download/);
});
test('Cash functions include safeguards',()=>{
 assert.match(logic,/staff_record_order_payment/);
 assert.match(logic,/staff_adjust_payment/);
 assert.match(logic,/staff_close_cash_day/);
 assert.match(html,/name="received_confirmed"/);
});
test('No backend secrets appear in browser assets',()=>{
 for(const filename of ['app.js','solicitud.js','presupuesto.js','config.js','documentos-pdf.js']){
  assert.doesNotMatch(read(filename),/SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|MERCADOLIBRE_ACCESS_TOKEN/);
 }
});
test('Privacy notice is accessible to visitors',()=>{
 assert.match(read('solicitud.html'),/privacidad\.html/);
 assert.ok(existsSync(new URL('../privacidad.html',import.meta.url)));
});
test('All offline-cache assets exist',()=>{
 const sw=read('sw.js');
 const m=sw.match(/const ASSETS=\[([^\]]+)\]/);
 assert.ok(m);
 const paths=[...m[1].matchAll(/['"]\.\/([^'"]+)['"]/g)].map(x=>x[1]);
 for(const path of paths)assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
});
