export function safeProfilePicture(value){
 if(typeof value!=='string'||value.length>2048)return '';
 try{const u=new URL(value);const allowed=['googleusercontent.com','line-scdn.net'].some(host=>u.hostname===host||u.hostname.endsWith('.'+host));return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&allowed?u.href:'';}catch{return '';}
}
