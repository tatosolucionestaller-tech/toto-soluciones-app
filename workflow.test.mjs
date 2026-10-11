import test from 'node:test';
import assert from 'node:assert/strict';
import {validSlot,quoteTotal,plateValid,quoteText} from './workflow-utils.mjs';
test('CLP amounts validated',()=>{assert.equal(quoteTotal(10000,20000,5700),35700);assert.throws(()=>quoteTotal(-1,0,0));assert.throws(()=>quoteTotal(1.5,0,0));});
test('Chilean plate normalization',()=>{assert.equal(plateValid('abcd12'),true);assert.equal(plateValid('xx'),false);});
test('valid Chile workshop hours',()=>{assert.equal(validSlot('2026-10-12T12:00:00Z','2026-10-12T13:00:00Z'),true);assert.equal(validSlot('2026-10-11T12:00:00Z','2026-10-11T13:00:00Z'),false);assert.equal(validSlot('2026-10-12T22:00:00Z','2026-10-12T23:00:00Z'),false);});
test('quote output excludes private costs',()=>{const t=quoteText({labor_clp:100,parts_clp:200,tax_clp:57,public_scope:'Revisión',quote_status:'offered',internal_cost_clp:999},{plate:'ABCD12',customer_name:'Cliente'});assert.match(t,/357/);assert.doesNotMatch(t,/999/);});

import {chileLocalToIso} from './workflow-utils.mjs';
test('Chilean time is device-independent and handles DST',()=>{
 assert.equal(chileLocalToIso('2026-10-09T08:30'),'2026-10-09T11:30:00.000Z');
 assert.equal(chileLocalToIso('2026-06-09T08:30'),'2026-06-09T12:30:00.000Z');
 assert.throws(()=>chileLocalToIso('2026-02-30T09:00'));
});
