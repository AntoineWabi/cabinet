import { sql, migrate } from "../../../../lib/db";
import { routeAuthed } from "../../../../lib/session";
import { updateAlbum } from "../../../../lib/spotify";
import { ITEM_STATES } from "../../../../lib/model";
import {
  localPreview,
  mutateLocalCollection,
} from "../../../../lib/local-collection";
import { safeLink } from "../../../../lib/media";

export async function PATCH(request, { params }) {
  if (!localPreview() && !(await routeAuthed(request)))
    return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return new Response("Invalid item update", { status: 400 });
  if (body.state !== undefined && !ITEM_STATES.includes(body.state))
    return new Response("Invalid state", { status: 400 });
  for (const field of ["archived", "liked", "completed"])
    if (body[field] !== undefined && typeof body[field] !== "boolean")
      return new Response("Invalid collection action", { status: 400 });
  if (
    body.title !== undefined &&
    (typeof body.title !== "string" || !body.title.trim())
  )
    return new Response("Invalid title", { status: 400 });
  const edits = {};
  for (const field of ["title", "creator", "image_url"])
    if (body[field] !== undefined)
      edits[field] =
        field === "image_url"
          ? safeLink(body[field])
          : String(body[field] || "").slice(0, 500);
  const metadata = {};
  if (body.archived !== undefined) metadata.cabinet_archived = body.archived;
  if (body.liked !== undefined) metadata.cabinet_liked = body.liked;
  if (body.shelf !== undefined) metadata.cabinet_shelf = String(body.shelf).slice(0, 80);
  if (body.completed !== undefined) metadata.cabinet_completed = body.completed;
  if (body.year !== undefined) metadata.year = String(body.year).slice(0, 40);
  if (localPreview()) {
    const updated = await mutateLocalCollection((items) => {
      const item = items.find((entry) => entry.id === id);
      if (!item) return null;
      Object.assign(item, edits, {
        metadata: { ...item.metadata, ...metadata },
        updated_at: new Date().toISOString(),
      });
      if (body.state) item.state = body.state;
      return item;
    });
    return updated
      ? Response.json(updated)
      : new Response("Not found", { status: 404 });
  }
  await migrate();
  const item = (await sql`select * from items where id=${id}`).rows[0];
  if (!item) return new Response("Not found", { status: 404 });
  // Legacy queue clients retain Spotify integration. Collection archive is local
  // to Cabinet and never changes a playlist as a side effect of removing a card.
  if (
    body.state &&
    item.type === "album" &&
    ["loved", "dropped"].includes(body.state) &&
    item.metadata?.track_uris?.length
  )
    await updateAlbum(item.metadata.track_uris, body.state);
  const updated =
    await sql`update items set state=${body.state || item.state},title=${edits.title ?? item.title},creator=${edits.creator ?? item.creator},image_url=${edits.image_url === undefined ? item.image_url : edits.image_url},metadata=metadata || ${JSON.stringify(metadata)}::jsonb,updated_at=now() where id=${id} returning *`;
  return Response.json(updated.rows[0]);
}
