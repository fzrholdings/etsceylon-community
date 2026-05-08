import { uploadToImgbb } from "./imgbb.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot, doc, getDoc, setDoc, deleteDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

// --- UI Elements ---
const el = (id) => document.getElementById(id);
const setupStatus = el("setupStatus");
const composerCard = el("composerCard");
const feed = el("feed");
const feedEmpty = el("feedEmpty");
const postText = el("postText");
const postImage = el("postImage");
const postBtn = el("postBtn");
const clearBtn = el("clearBtn");
const uploadHint = el("uploadHint");
const modalBackdrop = el("modalBackdrop");
const closeModalBtn = el("closeModalBtn");
const modalPost = el("modalPost");
const comments = el("comments");
const commentText = el("commentText");
const commentBtn = el("commentBtn");

// --- Firebase Init ---
const app = initializeApp(window.__FIREBASE_CONFIG__);
const auth = getAuth(app);
const db = getFirestore(app);

let uid = null;
let selectedPostId = null;

// --- Helper Functions ---
function prettyTime(ts) {
  if (!ts) return "...";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// --- Reaction Logic ---
const EMOJIS = { like: '👍', love: '❤️', haha: '😂', wow: '😮', angry: '😡' };

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
  } catch (e) { console.error("Reaction failed:", e); }
}

function renderReactionUI(docPath, reactionCounts = {}) {
  const container = document.createElement('div');
  container.className = 'reaction-container';

  const picker = document.createElement('div');
  picker.className = 'reaction-picker';
  Object.keys(EMOJIS).forEach(type => {
    const span = document.createElement('span');
    span.className = 'picker-emoji';
    span.textContent = EMOJIS[type];
    span.onclick = (e) => { e.stopPropagation(); handleReaction(docPath, type); };
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
      cSpan.textContent = `${EMOJIS[type]} ${count}`;
      countsDiv.appendChild(cSpan);
    }
  });

  container.appendChild(picker);
  container.appendChild(mainBtn);
  if(total > 0) container.appendChild(countsDiv);
  
  return container;
}

// --- Post Rendering ---
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

  // Reactions add කිරීම
  wrap.appendChild(renderReactionUI(`posts/${id}`, data.reactionCounts));

  const actions = document.createElement("div");
  actions.className = "actions";
  
  const commentOpenBtn = document.createElement("button");
  commentOpenBtn.textContent = `Comments (${data.commentCount || 0})`;
  commentOpenBtn.onclick = () => openPost(id);
  actions.appendChild(commentOpenBtn);

  if (data.uid === uid) {
    const delBtn = document.createElement("button");
    delBtn.className = "danger";
    delBtn.textContent = "Delete";
    delBtn.onclick = async () => { if(confirm("Delete post?")) await deleteDoc(doc(db, "posts", id)); };
    actions.appendChild(delBtn);
  }

  wrap.appendChild(actions);
  return wrap;
}

// --- Modal & Comments ---
async function openPost(id) {
  selectedPostId = id;
  modalPost.innerHTML = '<div class="muted">Loading...</div>';
  comments.innerHTML = "";
  modalBackdrop.style.display = "flex";

  const snap = await getDoc(doc(db, "posts", id));
  if (snap.exists()) {
    modalPost.innerHTML = "";
    modalPost.appendChild(renderPostCard(id, snap.data()));
    
    const q = query(collection(db, `posts/${id}/comments`), orderBy("createdAt", "asc"));
    onSnapshot(q, (qs) => {
      comments.innerHTML = "";
      qs.forEach((d) => {
        const c = d.data();
        const node = document.createElement("div");
        node.className = "comment";
        node.innerHTML = `<div class="meta">Anonymous • ${prettyTime(c.createdAt)}</div><div class="comment-body">${c.text}</div>`;
        node.appendChild(renderReactionUI(`posts/${id}/comments/${d.id}`, c.reactionCounts));
        comments.appendChild(node);
      });
    });
  }
}

commentBtn.onclick = async () => {
  const text = commentText.value.trim();
  if (!text || !selectedPostId) return;
  await addDoc(collection(db, `posts/${selectedPostId}/comments`), { uid, text, createdAt: serverTimestamp(), reactionCounts: {} });
  await updateDoc(doc(db, "posts", selectedPostId), { commentCount: increment(1) });
  commentText.value = "";
};

closeModalBtn.onclick = () => { modalBackdrop.style.display = "none"; selectedPostId = null; };

// --- Composer ---
postBtn.onclick = async () => {
  const text = postText.value.trim();
  const file = postImage.files[0];
  if (!text && !file) return;

  postBtn.disabled = true;
  try {
    let imageUrl = null;
    if (file) { const up = await uploadToImgbb(file); imageUrl = up.url; }
    await addDoc(collection(db, "posts"), {
      uid, text, imageUrl, commentCount: 0,
      reactionCounts: { like: 0, love: 0, haha: 0, wow: 0, angry: 0 },
      createdAt: serverTimestamp()
    });
    postText.value = ""; postImage.value = ""; uploadHint.style.display = "none";
  } catch (e) { alert("Post failed!"); }
  postBtn.disabled = false;
};

// --- App Start ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    uid = user.uid;
    setupStatus.textContent = "Live";
    composerCard.style.display = "block";
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50));
    onSnapshot(q, (qs) => {
      feed.innerHTML = "";
      qs.forEach(d => feed.appendChild(renderPostCard(d.id, d.data())));
      feedEmpty.style.display = qs.empty ? "block" : "none";
    });
  } else { signInAnonymously(auth); }
});
