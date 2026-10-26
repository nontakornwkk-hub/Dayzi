export const personalStorageKey='dayzi:personal-sheet';
export function storedPersonalSheet(){try{return JSON.parse(localStorage.getItem(personalStorageKey)??'null');}catch{return null;}}
export async function personalRequest(connection,action,payload={}){
 const response=await fetch('/api/personal-sheet',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({deploymentUrl:connection.deploymentUrl,secret:connection.secret,action,payload})});
 const data=await response.json().catch(()=>({error:'เชื่อม Sheet ไม่สำเร็จ'}));if(!response.ok)throw new Error(data.error??'เชื่อม Sheet ไม่สำเร็จ');return data;
}
