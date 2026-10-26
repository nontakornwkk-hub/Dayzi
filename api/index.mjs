// One function serves every /api/* path. vercel.json rewrites /api/<anything> here and passes the original
// path in __path, because Vercel's catch-all file routing did not match nested paths like /api/line/webhook.
import handler from '../server/api.mjs';
function run(request){
 const url=new URL(request.url),hinted=url.searchParams.get('__path');
 if(hinted!==null){
  url.searchParams.delete('__path');url.pathname='/api/'+hinted.replace(/^\/+/,'');
  const hasBody=!['GET','HEAD'].includes(request.method);
  request=new Request(url,{method:request.method,headers:request.headers,...(hasBody?{body:request.body,duplex:'half'}:{})});
 }
 return handler(request);
}
export const GET=run,POST=run,PUT=run,PATCH=run,DELETE=run,HEAD=run,OPTIONS=run;
