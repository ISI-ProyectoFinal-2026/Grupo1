// balanceador round-robin mínimo en Node: node proxy.mjs <puertoEscucha> <puerto1,puerto2,...>
import http from 'node:http'

const [listen, upstream] = [Number(process.argv[2]), process.argv[3].split(',').map(Number)]
const agent = new http.Agent({ keepAlive: true, maxSockets: Infinity })
let next = 0

http
  .createServer((req, res) => {
    const port = upstream[next++ % upstream.length]
    const out = http.request({ host: '127.0.0.1', port, path: req.url, method: req.method, headers: req.headers, agent }, (r) => {
      res.writeHead(r.statusCode, r.headers)
      r.pipe(res)
    })
    out.on('error', () => {
      if (!res.headersSent) res.writeHead(502)
      res.end()
    })
    req.pipe(out)
  })
  .listen(listen, '127.0.0.1', () => console.log(`proxy ${listen} -> ${upstream.join(',')}`))
