import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { FIXTURE } from "../app/api/items/fixture";
export const localPreview = () =>
  process.env.NODE_ENV === "development" &&
  process.env.CABINET_OPEN === "1" &&
  !process.env.POSTGRES_URL &&
  !process.env.VERCEL;
const file = path.join(process.cwd(), ".data", "preview-collection.json");
let pending = Promise.resolve();
async function read() {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return structuredClone(FIXTURE);
  }
}
export async function readLocalCollection() {
  await pending;
  return read();
}
export async function mutateLocalCollection(update) {
  const work = pending.then(async () => {
    const items = await read();
    const result = update(items);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(`${file}.tmp`, JSON.stringify(items, null, 2));
    await rename(`${file}.tmp`, file);
    return result;
  });
  pending = work.catch(() => {});
  return work;
}
