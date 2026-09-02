import { sql, migrate } from '../../../../lib/db';
import { routeAuthed } from '../../../../lib/session';
import { updateAlbum } from '../../../../lib/spotify';

export async function PATCH(r, { params }) {
  if (!(await routeAuthed(r))) return new Response('Unauthorized', { status: 401 });
  await migrate();
  const { state } = await r.json();
  const q = await sql`select * from items where id=${params.id}`;
  const x = q.rows[0];
  if (!x) return new Response('Not found', { status: 404 });
  // The Spotify write only makes sense for albums ingested with their full
  // track list; anything else (books, movies, hand-added albums) just moves.
  if (x.type === 'album' && ['loved', 'dropped'].includes(state) && Array.isArray(x.metadata?.track_uris) && x.metadata.track_uris.length)
    await updateAlbum(x.metadata.track_uris, state);
  return Response.json((await sql`update items set state=${state},updated_at=now() where id=${params.id} returning *`).rows[0]);
}
