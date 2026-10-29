export function safeProfilePicture(value){
 if(typeof value!=='string'||value.length>2048)return '';
 try{const u=new URL(value);const allowed=['googleusercontent.com','line-scdn.net'].some(host=>u.hostname===host||u.hostname.endsWith('.'+host));return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&allowed?u.href:'';}catch{return '';}
}
export function safeLinePicture(value){
 const picture=safeProfilePicture(value);if(!picture)return '';
 const host=new URL(picture).hostname;return host==='line-scdn.net'||host.endsWith('.line-scdn.net')?picture:'';
}
