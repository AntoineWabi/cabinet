import crypto from 'node:crypto';
import {NextResponse} from 'next/server';
function same(a='',b=''){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y)}
export function proxy(req){
 const auth=req.headers.get('authorization')||'';
 if(process.env.INGEST_TOKEN&&req.nextUrl.pathname==='/api/items'&&req.method==='POST'&&same(auth,`Bearer ${process.env.INGEST_TOKEN}`))return NextResponse.next();
 if(process.env.HUB_USERNAME&&process.env.HUB_PASSWORD&&auth.startsWith('Basic ')){
  const [u,p]=Buffer.from(auth.slice(6),'base64').toString().split(':');
  if(same(u,process.env.HUB_USERNAME||'')&&same(p,process.env.HUB_PASSWORD||''))return secure(NextResponse.next());
 }
 return new NextResponse('Authentication required',{status:401,headers:{'WWW-Authenticate':'Basic realm="Cabinet", charset="UTF-8"','Cache-Control':'no-store'}})
}
function secure(r){r.headers.set('X-Content-Type-Options','nosniff');r.headers.set('X-Frame-Options','DENY');r.headers.set('Referrer-Policy','no-referrer');r.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');return r}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
