<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Community • ETS Ceylon FM</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <div class="topbar">
      <div class="brand">
        <div class="brand-badge" aria-hidden="true"></div>
        <div>
          ETS Ceylon FM
          <div class="muted" style="font-weight:500;font-size:12px;">Community</div>
        </div>
      </div>
      <div class="nav">
        <a href="./index.html">Home</a>
        <a class="active" href="./community.html">Community</a>
      </div>
    </div>

    <div class="container">
      <div class="grid">
        <div class="card" id="setupCard">
          <h2>Setup status</h2>
          <div class="muted" id="setupStatus">Loading…</div>
          <div class="divider"></div>
          <div class="muted">
            If this is your first time: fill `public/firebase-config.js` and `public/imgbb.js`.
          </div>
        </div>

        <div class="card" id="composerCard" style="display:none;">
          <div class="row-between">
            <h2 style="margin:0;">Create a post</h2>
            <span class="pill" id="meBadge">Anonymous</span>
          </div>
          <div class="divider"></div>

          <label class="muted" for="postText">Text</label>
          <textarea id="postText" placeholder="Share your ETS2 screenshot story, ask a question, convoy info, etc."></textarea>

          <div style="height:10px;"></div>
          <div class="row" style="flex-wrap:wrap;">
            <input type="file" id="postImage" accept="image/*" />
            <button class="primary" id="postBtn">Post</button>
            <button id="clearBtn">Clear</button>
          </div>
          <div class="muted" id="uploadHint" style="margin-top:10px; display:none;"></div>
        </div>

        <div class="card">
          <div class="row-between">
            <h2 style="margin:0;">Latest posts</h2>
            <span class="muted" id="feedHint"></span>
          </div>
          <div class="divider"></div>
          <div id="feed" class="grid"></div>
          <div class="muted" id="feedEmpty" style="display:none;">No posts yet. Be the first.</div>
        </div>
      </div>
    </div>

    <div class="toast" id="toast">
      <strong id="toastTitle"></strong>
      <div id="toastMsg" class="muted"></div>
    </div>

    <div class="modal-backdrop" id="modalBackdrop" aria-hidden="true">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Post details">
        <div class="row-between">
          <h2 style="margin:0;">Post</h2>
          <button id="closeModalBtn">Close</button>
        </div>
        <div class="divider"></div>
        <div id="modalPost"></div>
        <div class="divider"></div>
        <h2 style="margin:0 0 8px 0; font-size:16px;">Comments</h2>
        <div class="row" style="flex-wrap:wrap;">
          <input type="text" id="commentText" placeholder="Write a comment (anonymous)" />
          <button class="primary" id="commentBtn">Comment</button>
        </div>
        <div style="height:10px;"></div>
        <div id="comments" class="grid"></div>
        <div class="muted" id="commentsEmpty" style="display:none;">No comments yet.</div>
      </div>
    </div>

    <script src="./firebase-config.js"></script>
    <script type="module" src="./community.js"></script>
  </body>
</html>

