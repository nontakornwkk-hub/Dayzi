import { handleLocalApi } from './local-api.mjs';

export function localApiPlugin() {
  return {
    name: 'dayzi-local-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!/^\/api(?:\/|$)/.test(req.url ?? '')) return next();
        try {
          const chunks = []; let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 5 * 1024 * 1024) {
              res.writeHead(413, { 'Content-Type':'application/json' });
              res.end(JSON.stringify({ error:'คำขอมีขนาดใหญ่เกินกำหนด' })); return;
            }
            chunks.push(chunk);
          }
          const method = req.method ?? 'GET';
          const request = new Request(new URL(req.url, `http://${req.headers.host}`), {
            method, headers: req.headers,
            ...(!['GET','HEAD'].includes(method) ? { body: Buffer.concat(chunks) } : {}),
          });
          const response = await handleLocalApi(request);
          res.statusCode = response.status;
          for (const [key,value] of response.headers) if (key !== 'set-cookie') res.setHeader(key,value);
          const cookies = response.headers.getSetCookie();
          if (cookies.length) res.setHeader('set-cookie', cookies);
          res.flushHeaders();
          if(response.body){const reader=response.body.getReader();try{for(;;){const {done,value}=await reader.read();if(done)break;res.write(Buffer.from(value));}}finally{reader.releaseLock();}}
          res.end();
        } catch {
          res.writeHead(500, { 'Content-Type':'application/json', 'Cache-Control':'no-store' });
          res.end(JSON.stringify({ error:'ระบบ local API ยังไม่พร้อม กรุณาตรวจการตั้งค่าฝั่งเซิร์ฟเวอร์' }));
        }
      });
    },
  };
}
