import { uploadToImgbb } from "./imgbb.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const el = (id) => document.getElementById(id);

const setupStatus = el("setupStatus");
const composerCard = el("composerCard");
const meBadge = el("meBadge");
const feed = el("feed");
const feedEmpty = el("feedEmpty");
const feedHint = el("feedHint");

const postText = el("postText");
const postImage = el("postImage");
const postBtn = el("postBtn");
const clearBtn = el("clearBtn");
const uploadHint = el("uploadHint");

const toast = el("toast");
const toastTitle = el("toastTitle");
const toastMsg = el("toastMsg");

const modalBackdrop = el("modalBackdrop");
const closeModalBtn = el("closeModalBtn");
const modalPost = el("modalPost");
const comments = el("comments");
const commentsEmpty = el("commentsEmpty");
const commentText = el("commentText");
const commentBtn = el("commentBtn");

let auth = null;
let db = null;
let uid = null;
let selectedPostId = null;
let stopCommentsUnsub = null;

function showToast(title, msg) {
  toastTitle.textContent = title;
  toastMsg.textContent = msg || "";
  toast.classList.add("show");
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => toast.classList.remove("show"), 3800);
}

function prettyTime(ts) {
  if (!ts) return "just now";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

function canStart() {
  const cfg = window.__FIREBASE_CONFIG__;
  if (!cfg || typeof cfg !== "object")
    return { ok: false, why: "Missing Firebase config in firebase-config.js" };
  const required = ["apiKey", "authDomain", "projectId", "appId"];
  for (const k of required) {
    if (!cfg[k] || cfg[k] === "PASTE_ME")
      return { ok: false, why: `Firebase config missing: ${k}` };
  }
  return { ok: true };
}

function safeText(s) {
  return (s || "").toString().slice(0, 4000);
}

function openModal() {
  modalBackdrop.classList.add("show");
  modalBackdrop.setAttribute("aria-hidden", "false");
}
function closeModal() {
  modalBackdrop.classList.remove("show");
  modalBackdrop.setAttribute("aria-hidden", "true");
  modalPost.innerHTML = "";
  comments.innerHTML = "";
  commentsEmpty.style.display = "none";
  commentText.value = "";
  selectedPostId = null;
  if (stopCommentsUnsub) {
    stopCommentsUnsub();
    stopCommentsUnsub = null;
  }
}

closeModalBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});

async function ensureAuth() {
  const cfg = window.__FIREBASE_CONFIG__;
  const app = initializeApp(cfg);
  auth = getAuth(app);
  db = getFirestore(app);

  await new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          uid = user.uid;
          meBadge.textContent = `Anonymous • ${uid.slice(0, 6)}`;
          composerCard.style.display = "";
          setupStatus.textContent = "Connected.";
          unsub();
          resolve();
          return;
        }
        await signInAnonymously(auth);
      } catch (err) {
        unsub();
        reject(err);
      }
    });
  });
}

function renderPostCard(id, data) {
  const wrap = document.createElement("div");
  wrap.className = "card feed-item";

  const meta = document.createElement("div");
  meta.className = "feed-meta";
  meta.textContent = `Anonymous • ${prettyTime(data.createdAt)} • likes ${data.likeCount || 0} • comments ${data.commentCount || 0}`;

  const text = document.createElement("div");
  text.className = "feed-text";
  text.textContent = data.text || "";

  wrap.appendChild(meta);
  if (data.text) wrap.appendChild(text);

  if (data.imageUrl) {
    const img = document.createElement("img");
    img.className = "feed-img";
    img.loading = "lazy";
    img.alt = "ETS2 community post image";
    img.src = data.imageUrl;
    wrap.appendChild(img);
  }

  const actions = document.createElement("div");
  actions.className = "actions";

  const likeBtn = document.createElement("button");
  likeBtn.textContent = "Like";
  likeBtn.addEventListener("click", () => toggleLike(id));

  const commentOpenBtn = document.createElement("button");
  commentOpenBtn.textContent = "Open";
  commentOpenBtn.addEventListener("click", () => openPost(id));

  actions.appendChild(likeBtn);
  actions.appendChild(commentOpenBtn);

  if (data.uid === uid) {
    const delBtn = document.createElement("button");
    delBtn.className = "danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => deleteMyPost(id));
    actions.appendChild(delBtn);
  }

  wrap.appendChild(actions);
  return wrap;
}

async function toggleLike(postId) {
  try {
    const likeRef = doc(db, "posts", postId, "likes", uid);
    const postRef = doc(db, "posts", postId);
    const snap = await getDoc(likeRef);
    if (snap.exists()) {
      await deleteDoc(likeRef);
      await updateDoc(postRef, { likeCount: increment(-1) });
      showToast("Updated", "Like removed.");
    } else {
      await setDoc(likeRef, { createdAt: serverTimestamp() });
      await updateDoc(postRef, { likeCount: increment(1) });
      showToast("Updated", "Liked.");
    }
  } catch (e) {
    showToast("Error", e?.message || "Like failed.");
  }
}

async function deleteMyPost(postId) {
  try {
    const postRef = doc(db, "posts", postId);
    const snap = await getDoc(postRef);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.uid !== uid) {
      showToast("Not allowed", "You can delete only your own posts.");
      return;
    }
    await deleteDoc(postRef);
    showToast("Deleted", "Post deleted.");
  } catch (e) {
    showToast("Error", e?.message || "Delete failed.");
  }
}

async function openPost(postId) {
  selectedPostId = postId;
  openModal();
  modalPost.innerHTML = "";
  comments.innerHTML = "";

  const postRef = doc(db, "posts", postId);
  const snap = await getDoc(postRef);
  if (!snap.exists()) {
    modalPost.innerHTML = `<div class="muted">Post not found.</div>`;
    return;
  }
  const data = snap.data();
  modalPost.appendChild(renderPostCard(postId, data));

  const q = query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "desc"), limit(60));
  stopCommentsUnsub = onSnapshot(q, (qs) => {
    comments.innerHTML = "";
    let n = 0;
    qs.forEach((d) => {
      n++;
      const c = d.data();
      const node = document.createElement("div");
      node.className = "comment";
      node.innerHTML = `
        <div class="meta">Anonymous • ${prettyTime(c.createdAt)}</div>
        <div style="white-space:pre-wrap; line-height:1.45;"></div>
      `;
      node.querySelector("div:last-child").textContent = c.text || "";
      comments.appendChild(node);
    });
    commentsEmpty.style.display = n ? "none" : "";
  });
}

commentBtn.addEventListener("click", async () => {
  const text = safeText(commentText.value).trim();
  if (!selectedPostId) return;
  if (!text) {
    showToast("Missing", "Write a comment first.");
    return;
  }
  commentBtn.disabled = true;
  try {
    await addDoc(collection(db, "posts", selectedPostId, "comments"), {
      text,
      uid,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "posts", selectedPostId), { commentCount: increment(1) });
    commentText.value = "";
  } catch (e) {
    showToast("Error", e?.message || "Comment failed.");
  } finally {
    commentBtn.disabled = false;
  }
});

clearBtn.addEventListener("click", () => {
  postText.value = "";
  postImage.value = "";
  uploadHint.style.display = "none";
  uploadHint.textContent = "";
});

postBtn.addEventListener("click", async () => {
  const text = safeText(postText.value).trim();
  const file = postImage.files?.[0] || null;

  if (!text && !file) {
    showToast("Missing", "Write text or select an image.");
    return;
  }

  postBtn.disabled = true;
  clearBtn.disabled = true;
  uploadHint.style.display = "";
  uploadHint.textContent = file ? "Uploading image…" : "Posting…";

  try {
    let imageUrl = null;
    let imageDeleteUrl = null;
    if (file) {
      const up = await uploadToImgbb(file);
      imageUrl = up.url;
      imageDeleteUrl = up.deleteUrl;
    }

    await addDoc(collection(db, "posts"), {
      uid,
      text,
      imageUrl,
      imageDeleteUrl,
      likeCount: 0,
      commentCount: 0,
      createdAt: serverTimestamp(),
    });

    postText.value = "";
    postImage.value = "";
    uploadHint.style.display = "none";
    uploadHint.textContent = "";
    showToast("Posted", "Your post is live.");
  } catch (e) {
    showToast("Error", e?.message || "Post failed.");
  } finally {
    postBtn.disabled = false;
    clearBtn.disabled = false;
  }
});

function startFeed() {
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50));
  feedHint.textContent = "Auto-updating";
  onSnapshot(q, (qs) => {
    feed.innerHTML = "";
    let n = 0;
    qs.forEach((d) => {
      n++;
      feed.appendChild(renderPostCard(d.id, d.data()));
    });
    feedEmpty.style.display = n ? "none" : "";
  });
}

(async function main() {
  const ready = canStart();
  if (!ready.ok) {
    setupStatus.textContent = ready.why;
    showToast("Setup needed", ready.why);
    return;
  }

  try {
    setupStatus.textContent = "Connecting to Firebase…";
    await ensureAuth();
    startFeed();
  } catch (e) {
    setupStatus.textContent = e?.message || "Failed to connect.";
    showToast("Error", e?.message || "Failed to connect.");
  }
})();
