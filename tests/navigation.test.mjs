import test from 'node:test';import assert from 'node:assert/strict';
import {initialPage,twoButtonRichMenu,sixButtonRichMenu} from '../src/navigation.mjs';
test('rich menu URLs open only the intended app pages',()=>{
 const menu=twoButtonRichMenu('https://dayzi-personal-2026.netlify.app');
 assert.equal(menu.areas.length,2);
 assert.equal(initialPage(new URL(menu.areas[0].action.uri).search),'overview');
 assert.equal(initialPage(new URL(menu.areas[1].action.uri).search),'calendar');
 assert.equal(initialPage('?page=https://evil.example'),'overview');
 assert.equal(menu.areas[0].bounds.width+menu.areas[1].bounds.width,2500);
});
test('six tile rich menu covers the whole 2500x1686 canvas with no overlap and the right actions',()=>{
 const menu=sixButtonRichMenu('https://dayzi-personal-2026.netlify.app','@057frirm');
 assert.equal(menu.areas.length,6);assert.deepEqual(menu.size,{width:2500,height:1686});
 const area=menu.areas.reduce((n,a)=>n+a.bounds.width*a.bounds.height,0);assert.equal(area,2500*1686);
 for(const a of menu.areas){assert.ok(a.bounds.x>=0&&a.bounds.y>=0&&a.bounds.x+a.bounds.width<=2500&&a.bounds.y+a.bounds.height<=1686);assert.ok(a.action.label.length<=20);}
 assert.equal(menu.areas[0].action.uri,'https://dayzi-personal-2026.netlify.app/');
 assert.match(menu.areas[2].action.uri,/^https:\/\/line\.me\/R\/oaMessage\/%40057frirm\/\?/);
 assert.equal(menu.areas[1].action.text,'วันนี้มีนัดและงานอะไรบ้าง');
 assert.throws(()=>sixButtonRichMenu('http://insecure.example','@057frirm'));assert.throws(()=>sixButtonRichMenu('https://x.example','bad'));
});
