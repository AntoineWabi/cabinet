"use client";
import { useState } from "react";
const id = "608cbce6-9ac1-459c-a5e3-497288c4f863";
const image_url = "https://m.media-amazon.com/images/M/MV5BMWM2Mzg3OWQtNWYyYi00ZmU2LWE0OWMtOTQ1ZTc1MGM3ZjA2XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg";
export default function Page() {
  const [status, setStatus] = useState("Ready");
  async function run() {
    setStatus("Applying…");
    const response = await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image_url }),
    });
    setStatus(response.ok ? "Complete" : `Failed ${response.status}`);
  }
  return <main><h1>DJ Mehdi art fix</h1><p>{status}</p><button onClick={run}>Apply portrait art</button></main>;
}
