import { sql, migrate } from '../../../../lib/db';
import { routeAuthed } from '../../../../lib/session';
import { updateAlbum } from '../../../../lib/spotify';

const EDITABLE = ['title', 'creator', 'year', 'image_url'];

export async function PATCH(r, { params }) {
  if (!(await routeAuthed(r))) return new Response('Unauthorized', { status: 401 });
  await migrate();
  const { id } = await params;
  const body = await r.json();
  const { state } = body;
  const q = await sql`select * from items where id=${id}`;
  const x = q.rows[0];
  if (!x) return new Response('Not found', { status: 404 });
  // The Spotify write only makes sense for albums ingested with their full
  // track list; anything else (books, movies, hand-added albums) just moves.
  if (state && x.type === 'album' && ['loved', 'dropped'].includes(state) && Array.isArray(x.metadata?.track_uris) && x.metadata.track_uris.length)
    await updateAlbum(x.metadata.track_uris, state);
  if (state) await sql`update items set state=${state},updated_at=now() where id=${id}`;
  for (const f of EDITABLE)
    if (body[f] !== undefined)
      await sql.query(`update items set ${f}=$1,updated_at=now() where id=$2`, [body[f], id]);
  return Response.json((await sql`select * from items where id=${id}`).rows[0]);
}
