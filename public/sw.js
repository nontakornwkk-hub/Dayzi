const CACHE='dayzi-v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{let data={title:'Dayzi เตือนคุณ',body:'มีนัดหมายที่กำลังจะมาถึง',url:'/'};try{data={...data,...event.data.json()};}catch{}event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:'/icon.svg',badge:'/icon.svg',tag:data.tag??'dayzi',data:{url:data.url},actions:[{action:'open',title:'ดูรายละเอียด'}]}));});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});if(windows[0]){await windows[0].focus();windows[0].postMessage({type:'OPEN_EVENT'});}else await self.clients.openWindow('/');})());});
