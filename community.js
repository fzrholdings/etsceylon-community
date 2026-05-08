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
const commentText = el("commentText");
const commentBtn = el("commentBtn");

const app = initializeApp(window.__FIREBASE_CONFIG__);
const auth = getAuth(app);
const db = getFirestore(app);

let uid = null;
let selectedPostId = null;

function showToast(title, msg) {
  toastTitle.textContent = title;
  toastMsg.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 4000);
}

function prettyTime(ts) {
  if (!ts) return "...";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeText(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// --- REACTIONS LOGIC ---

async function handleReaction(docPath, type) {
  if (!uid) return;
  const reactionDocRef = doc(db, `${docPath}/reactions/${uid}`);
  const parentRef = doc(db, docPath);
  
  try {
    const snap = await getDoc(reactionDocRef);
    const existing = snap.exists() ? snap.data().type : null;

    if (existing === type) {
      await deleteDoc(reactionDocRef);
      await updateDoc(parentRef, { [`reactionCounts.${type}`]: increment(-1) });
    } else {
      if (existing) {
        await updateDoc(parentRef, { [`reactionCounts.${existing}`]: increment(-1) });
      }
      await setDoc(reactionDocRef, { type, createdAt: serverTimestamp() });
      await updateDoc(parentRef, { [`reactionCounts.${type}`]: increment(1) });
    }
  } catch (e) {
    console.error("Reaction failed:", e);
  }
}

function renderReactionUI(docPath, reactionCounts = {}) {
  const emojis = { like: '👍', love: '❤️', haha: '😂', wow: '😮', angry: '😡' };
  const container = document.createElement('div');
  container.className = 'reaction-container';

  const picker = document.createElement('div');
  picker.className = 'reaction-picker';
  Object.keys(emojis).forEach(type => {
    const span = document.createElement('span');
    span.className = 'picker-emoji';
    span.textContent = emojis[type];
    span.onclick = (e) => {
      e.stopPropagation();
      handleReaction(docPath, type);
    };
    picker.appendChild(span);
  });

  const mainBtn = document.createElement('button');
  mainBtn.className = 'reaction-btn';
  mainBtn.innerHTML = `<span>👍</span> React`;

  const countsDiv = document.createElement('div');
  countsDiv.className = 'reaction-counts';
  let total = 0;
  Object.entries(reactionCounts || {}).forEach(([type, count]) => {
    if(count > 0) {
      total += count;
      const cSpan = document.createElement('span');
      cSpan.textContent = `${emojis[type]} ${count}`;
      countsDiv.appendChild(cSpan);
    }
  });

  container.appendChild(picker);
  container.appendChild(mainBtn);
  if(total > 0) container.appendChild(countsDiv);
  
  return container;
}

// --- RENDERING ---

function renderPostCard(id, data) {
  const wrap = document.createElement("div");
  wrap.className = "card feed-item";

  const meta = document.createElement("div");
  meta.className = "feed-meta";
  meta.textContent = `Anonymous • ${prettyTime(data.createdAt)}`;

  const text = document.createElement("div");
  text.className = "feed-text";
  text.textContent = data.text || "";

  wrap.appendChild(meta);
  if (data.text) wrap.appendChild(text);

  if (data.imageUrl) {
    const img = document.createElement("img");
    img.className = "feed-img";
    img.src = data.imageUrl;
    wrap.appendChild(img);
  }

  // Add Reactions
  wrap.appendChild(renderReactionUI(`posts/${id}`, data.reactionCounts));

  const actions = document.createElement("div");
  actions.className = "actions";

  const commentOpenBtn = document.createElement("button");
  commentOpenBtn.textContent = `Comments (${data.commentCount || 0})`;
  commentOpenBtn.addEventListener("click", () => openPost(id));
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

// --- CORE ACTIONS ---

async function deleteMyPost(id) {
  if (!confirm("Delete this post?")) return;
  try {
    await deleteDoc(doc(db, "posts", id));
    showToast("Deleted", "Post removed.");
  } catch (e) {
    showToast("Error", "Could not delete.");
  }
}

async function openPost(id) {
  selectedPostId = id;
  modalPost.innerHTML = '<div class="muted">Loading post...</div>';
  comments.innerHTML = "";
  modalBackdrop.style.display = "flex";

  const snap = await getDoc(doc(db, "posts", id));
  if (!snap.exists()) {
    modalPost.textContent = "Post not found.";
    return;
  }
  const data = snap.data();
  modalPost.innerHTML = "";
  modalPost.appendChild(renderPostCard(id, data));

  const q = query(collection(db, `posts/${id}/comments`), orderBy("createdAt", "asc"));
  onSnapshot(q, (qs) => {
    comments.innerHTML = "";
    qs.forEach((d) => {
      const c = d.data();
      const node = document.createElement("div");
      node.className = "comment";
      node.innerHTML = `
        <div class="meta">Anonymous • ${prettyTime(c.createdAt)}</div>
        <div class="comment-body" style="white-space:pre-wrap; margin-bottom:8px;"></div>
      `;
      node.querySelector(".comment-body").textContent = c.text || "";
      node.appendChild(renderReactionUI(`posts/${id}/comments/${d.id}`, c.reactionCounts));
      comments.appendChild(node);
    });
  });
}

commentBtn.addEventListener("click", async () => {
  const text = commentText.value.trim();
  if (!text || !selectedPostId) return;
  commentBtn.disabled = true;

  try {
    await addDoc(collection(db, `posts/${selectedPostId}/comments`), {
      uid,
      text,
      createdAt: serverTimestamp(),
      reactionCounts: {}
    });
    await updateDoc(doc(db, "posts", selectedPostId), {
      commentCount: increment(1),
    });
    commentText.value = "";
  } catch (e) {
    showToast("Error", "Comment failed.");
  } finally {
    commentBtn.disabled = false;
  }
});

closeModalBtn.addEventListener("click", () => {
  modalBackdrop.style.display = "none";
  selectedPostId = null;
});

postImage.addEventListener("change", () => {
  const file = postImage.files[0];
  if (file) {
    uploadHint.style.display = "block";
    uploadHint.textContent = `Selected: ${file.name}`;
  }
});

clearBtn.addEventListener("click", () => {
  postText.value = "";
  postImage.value = "";
  uploadHint.style.display = "none";
});

postBtn.addEventListener("click", async () => {
  const text = postText.value.trim();
  const file = postImage.files[0];

  if (!text && !file) return;

  postBtn.disabled = true;
  clearBtn.disabled = true;

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
      commentCount: 0,
      reactionCounts: { like: 0, love: 0, haha: 0, wow: 0, angry: 0 },
      createdAt: serverTimestamp(),
    });

    postText.value = "";
    postImage.value = "";
    uploadHint.style.display = "none";
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
  feedHint.textContent = "Live Updates";
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
  onAuthStateChanged(auth, (user) => {
    if (user) {
      uid = user.uid;
      setupStatus.textContent = "Connected anonymously";
      composerCard.style.display = "block";
      startFeed();
    } else {
      signInAnonymously(auth).catch((e) => {
        setupStatus.textContent = "Connection error";
        showToast("Auth Error", e.message);
      });
    }
  });
})();
