// Create a free imgbb API key, then paste it here.
// imgbb: https://api.imgbb.com/
window.__IMGBB_API_KEY__ = "2e6555f84f2cba4982c98e35ff987554";

export async function uploadToImgbb(file) {
  if (!window.__IMGBB_API_KEY__ || window.__IMGBB_API_KEY__ === "PASTE_ME") {
    throw new Error("Missing imgbb API key in public/imgbb.js");
  }
  if (!file) return { url: null, deleteUrl: null };

  const form = new FormData();
  form.append("image", file);

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(window.__IMGBB_API_KEY__)}`, {
    method: "POST",
    body: form,
  });

  const data = await res.json();
  if (!res.ok || !data?.success) {
    const msg = data?.error?.message || "Upload failed";
    throw new Error(msg);
  }

  return {
    url: data.data?.url || null,
    deleteUrl: data.data?.delete_url || null,
  };
}

