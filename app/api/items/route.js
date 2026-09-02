import { sql, migrate } from '../../../lib/db';
import { routeAuthed } from '../../../lib/session';
import { ITEM_TYPES } from '../../../lib/model';
import { FIXTURE } from './fixture';

export async function GET() {
  // Dev-only fixture for local visual testing; never both set on Vercel.
  if (process.env.CABINET_OPEN && !process.env.POSTGRES_URL) return Response.json(FIXTURE);
  await migrate();
  return Response.json((await sql`select * from items order by created_at desc`).rows);
}

export async function POST(r) {
  if (!(await routeAuthed(r, { ingest: true }))) return new Response('Unauthorized', { status: 401 });
  await migrate();
  const x = await r.json();
  if (!x.title || !ITEM_TYPES.includes(x.type)) return new Response('Bad request', { status: 400 });
  const q = await sql`insert into items(type,state,title,creator,external_url,external_id,image_url,metadata) values(${x.type},'queued',${x.title},${x.creator || null},${x.external_url || null},${x.external_id || null},${x.image_url || null},${JSON.stringify(x.metadata || {})}) returning *`;
  return Response.json(q.rows[0], { status: 201 });
}
