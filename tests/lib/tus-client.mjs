// Minimal real TUS 1.0.0 client used by test scripts to drive the real resumable-upload flow the
// same way a browser would (apps/web/src/lib/upload.ts is the browser equivalent). Chunked PATCH
// with resumption via HEAD, per docs/PRD.md "resumable uploads; interruption recovery".

export async function tusUploadChunk({ gatewayBase, tusUploadPath, anonKey, accessToken, chunk, offset }) {
  const res = await fetch(`${gatewayBase}${tusUploadPath}`, {
    method: "PATCH",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Tus-Resumable": "1.0.0",
      "Upload-Offset": String(offset),
      "Content-Type": "application/offset+octet-stream",
    },
    body: chunk,
  });
  if (!res.ok) throw new Error(`TUS PATCH failed at offset ${offset}: ${res.status} ${await res.text()}`);
  return Number(res.headers.get("upload-offset"));
}

export async function tusGetOffset({ gatewayBase, tusUploadPath, anonKey, accessToken }) {
  const res = await fetch(`${gatewayBase}${tusUploadPath}`, {
    method: "HEAD",
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}`, "Tus-Resumable": "1.0.0" },
  });
  if (!res.ok) throw new Error(`TUS HEAD failed: ${res.status} ${await res.text()}`);
  return Number(res.headers.get("upload-offset"));
}

// Uploads the whole buffer in chunks, starting from `startOffset` (0 for a fresh upload, or a
// resumed offset after interruption). Returns the final offset (should equal buffer.length).
export async function tusUploadFile({ gatewayBase, tusUploadPath, anonKey, accessToken, buffer, chunkSize = 32 * 1024, startOffset = 0 }) {
  let offset = startOffset;
  while (offset < buffer.length) {
    const chunk = buffer.subarray(offset, Math.min(offset + chunkSize, buffer.length));
    offset = await tusUploadChunk({ gatewayBase, tusUploadPath, anonKey, accessToken, chunk, offset });
  }
  return offset;
}
