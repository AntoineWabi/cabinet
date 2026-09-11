import { sql, migrate } from "../../../lib/db";
import { routeAuthed } from "../../../lib/session";
import { ITEM_TYPES } from "../../../lib/model";
import {
  localPreview,
  readLocalCollection,
  mutateLocalCollection,
} from "../../../lib/local-collection";
import { safeLink, sameItem } from "../../../lib/media";

export async function GET() {
  if (localPreview())
    return Response.json(await readLocalCollection(), {
      headers: { "X-Cabinet-Preview": "true" },
    });
  await migrate();
  return Response.json(
    (await sql`select * from items order by created_at desc`).rows,
  );
}
export async function POST(request) {
  if (!localPreview() && !(await routeAuthed(request, { ingest: true })))
    return new Response("Unauthorized", { status: 401 });
  let item;
  try {
    item = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (
    !item ||
    typeof item !== "object" ||
    Array.isArray(item) ||
    typeof item.title !== "string" ||
    !item.title.trim() ||
    !ITEM_TYPES.includes(item.type)
  )
    return new Response("A title and media type are required.", {
      status: 400,
    });
  if (
    item.metadata &&
    (typeof item.metadata !== "object" || Array.isArray(item.metadata))
  )
    return new Response("Invalid metadata", { status: 400 });
  const x = {
    type: item.type,
    title: item.title.trim().slice(0, 500),
    creator:
      typeof item.creator === "string"
        ? item.creator.trim().slice(0, 500)
        : null,
    image_url: safeLink(item.image_url),
    external_url: safeLink(item.external_url),
    external_id:
      typeof item.external_id === "string"
        ? item.external_id.slice(0, 500)
        : null,
    metadata: { ...item.metadata, cabinet_archived: false },
  };
  if (localPreview()) {
    const saved = await mutateLocalCollection((items) => {
      const existing = items.find((entry) => sameItem(entry, x));
      if (existing) {
        existing.state = "queued";
        existing.metadata = { ...existing.metadata, cabinet_archived: false };
        return existing;
      }
      const created = {
        ...x,
        id: crypto.randomUUID(),
        state: "queued",
        created_at: new Date().toISOString(),
      };
      items.unshift(created);
      return created;
    });
    return Response.json(saved, { status: 201 });
  }
  await migrate();
  // Restore an existing saved reference instead of inserting a duplicate.
  const existing = (
    await sql`select * from items where type=${x.type} and ((external_id is not null and external_id=${x.external_id}) or (lower(title)=lower(${x.title}) and lower(coalesce(creator,''))=lower(coalesce(${x.creator},'')))) limit 1`
  ).rows[0];
  if (existing) {
    return Response.json(
      (
        await sql`update items set state=case when state='dropped' then 'queued' else state end,metadata=metadata || '{"cabinet_archived":false}'::jsonb,updated_at=now() where id=${existing.id} returning *`
      ).rows[0],
    );
  }
  const result =
    await sql`insert into items(type,state,title,creator,external_url,external_id,image_url,metadata) values(${x.type},'queued',${x.title},${x.creator},${x.external_url},${x.external_id},${x.image_url},${JSON.stringify(x.metadata)}) on conflict(type,external_id) where external_id is not null do update set metadata=items.metadata || '{"cabinet_archived":false}'::jsonb,state=case when items.state='dropped' then 'queued' else items.state end returning *`;
  return Response.json(result.rows[0], { status: 201 });
}
