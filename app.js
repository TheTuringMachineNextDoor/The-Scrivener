// ── State ──────────────────────────────────────────────────────────
let currentPage   = 'home';
let previousPage  = 'home';
let currentUser   = null;
let editingPostId = null;
let allPosts      = [];
let carouselIndex = 0;
let carouselTotal = 0;
let carouselTimer = null;
let thumbFileB64  = null;
let coverFileB64  = null;
let currentPostId = null;

// ── Boot ───────────────────────────────────────────────────────────
window.addEventListener('supabase-ready', async () => {
  await checkSession();
  await loadAllPosts();
  runIntro();
});

// ── Intro animation ─────────────────────────────────────────────────
function runIntro() {
  setTimeout(() => {
    document.getElementById('intro-screen').classList.add('hidden');
  }, 1800);
}

// ── Markdown ────────────────────────────────────────────────────────
function md(text) {
  if (!text) return '';
  let t = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1"/>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>');
  const blocks = t.split(/\n\n+/);
  let out = '';
  for (let block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (/^### /.test(trimmed))       { out += '<h3>' + trimmed.replace(/^### /,'') + '</h3>'; }
    else if (/^## /.test(trimmed))   { out += '<h2>' + trimmed.replace(/^## /,'') + '</h2>'; }
    else if (/^# /.test(trimmed))    { out += '<h2>' + trimmed.replace(/^# /,'') + '</h2>'; }
    else if (/^> /.test(trimmed))    { out += '<blockquote>' + trimmed.replace(/^> /,'') + '</blockquote>'; }
    else if (/^---$/.test(trimmed))  { out += '<hr>'; }
    else if (/^<img /.test(trimmed)) { out += trimmed; }
    else { out += '<p>' + trimmed.replace(/\n/g,'<br>') + '</p>'; }
  }
  return out;
}

// ── Auth ────────────────────────────────────────────────────────────
async function checkSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) setUser(session.user);
}

function setUser(user) {
  currentUser = user;
  document.getElementById('admin-btn').style.display = user ? 'block' : 'none';
}

async function login() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.textContent = '';
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { errEl.textContent = error.message; return; }
  setUser(data.user);
  closeOverlay('login-overlay');
}

async function logout() {
  await sb.auth.signOut();
  setUser(null);
  closeOverlay('admin-overlay');
}

// ── Navigation ──────────────────────────────────────────────────────
function navigate(page) {
  previousPage = currentPage;
  currentPage  = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('#main-nav a').forEach(a =>
    a.classList.toggle('active', a.dataset.page === page)
  );
  // reading progress only on post page
  updateProgressBar(page === 'post');
  window.scrollTo(0,0);
}

function goBack() {
  const dest = (previousPage === 'post' || previousPage === 'home') ? 'home' : previousPage;
  navigate(dest);
}

// ── Reading progress bar ────────────────────────────────────────────
function updateProgressBar(enable) {
  const bar = document.getElementById('reading-progress');
  if (!enable) { bar.style.width = '0%'; window.onscroll = null; return; }
  window.onscroll = () => {
    const scrollTop = window.scrollY;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = docH > 0 ? (scrollTop / docH * 100) + '%' : '0%';
  };
}

// ── Load posts ──────────────────────────────────────────────────────
async function loadAllPosts() {
  const { data, error } = await sb
    .from('posts').select('*')
    .order('published_at', { ascending: false, nullsFirst: false });
  if (error) { console.error(error); return; }
  allPosts = data || [];
  renderCarousel();
  renderGrid('home-recent', allPosts.slice(0, 8), true);
  renderGrid('list-stories', allPosts.filter(p => p.category === 'stories'));
  renderGrid('list-essays',  allPosts.filter(p => p.category === 'essays'));
  renderGrid('list-music',   allPosts.filter(p => p.category === 'music'));
}

// ── Thumbnail grid ──────────────────────────────────────────────────
function renderGrid(elId, posts, showCat) {
  const el = document.getElementById(elId);
  if (!posts.length) {
    el.innerHTML = '<div class="empty-state">Nothing here yet.</div>';
    return;
  }
  el.innerHTML = posts.map(p => {
    const imgSrc = p.thumbnail || p.cover_image;
    const imgEl  = imgSrc
      ? `<img class="thumb-card-img" src="${imgSrc}" alt="${p.title}" loading="lazy"/>`
      : `<div class="thumb-card-img-placeholder">✦</div>`;
    return `
      <div class="thumb-card" onclick="openPost('${p.id}')">
        ${imgEl}
        <div class="thumb-card-body">
          ${showCat ? `<span class="thumb-card-cat">${p.category}</span>` : ''}
          <div class="thumb-card-title">${p.title}</div>
          <div class="thumb-card-meta">${formatDate(p.published_at || p.created_at)} · ${readTime(p.body)}</div>
        </div>
      </div>`;
  }).join('');
}

// ── Carousel ────────────────────────────────────────────────────────
function renderCarousel() {
  const featured = allPosts.slice(0, 5);
  carouselTotal  = featured.length;
  const track    = document.getElementById('carousel-track');
  const dots     = document.getElementById('carousel-dots');

  if (!featured.length) {
    document.getElementById('carousel-wrap').style.display = 'none';
    return;
  }

  track.innerHTML = featured.map(p => {
    const img = p.cover_image || p.thumbnail;
    return `
      <div class="carousel-slide" onclick="openPost('${p.id}')">
        ${img
          ? `<img class="carousel-slide-img" src="${img}" alt="${p.title}"/>`
          : `<div class="carousel-slide-bg"></div>`}
        <div class="carousel-caption">
          <span class="carousel-caption-cat">${p.category}</span>
          <div class="carousel-caption-title">${p.title}</div>
          ${p.subtitle ? `<div class="carousel-caption-sub">${p.subtitle}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  dots.innerHTML = featured.map((_,i) =>
    `<button class="carousel-dot${i===0?' active':''}" onclick="carouselGoTo(${i})"></button>`
  ).join('');

  carouselGoTo(0);
  startCarouselAuto();
}

function carouselGoTo(i) {
  carouselIndex = (i + carouselTotal) % carouselTotal;
  document.getElementById('carousel-track').style.transform =
    `translateX(-${carouselIndex * 100}%)`;
  document.querySelectorAll('.carousel-dot').forEach((d,j) =>
    d.classList.toggle('active', j === carouselIndex)
  );
}

function carouselMove(dir) {
  carouselGoTo(carouselIndex + dir);
  resetCarouselAuto();
}

function startCarouselAuto() {
  carouselTimer = setInterval(() => carouselGoTo(carouselIndex + 1), 5000);
}
function resetCarouselAuto() {
  clearInterval(carouselTimer);
  startCarouselAuto();
}

// ── Open post ────────────────────────────────────────────────────────
function openPost(id) {
  const post = allPosts.find(p => p.id === id);
  if (!post) return;
  currentPostId = id;

  // Banner
  const banner    = document.getElementById('post-banner');
  const bannerSrc = post.cover_image || post.thumbnail;
  if (bannerSrc) {
    banner.innerHTML = `<img src="${bannerSrc}" alt="${post.title}"/>`;
    banner.style.display = 'block';
  } else {
    banner.innerHTML = '';
    banner.style.display = 'none';
  }

  document.getElementById('single-post-content').innerHTML = `
    <div class="single-post-label">${post.category}</div>
    <h1 class="single-post-title">${post.title}</h1>
    ${post.subtitle ? `<div class="single-post-subtitle">${post.subtitle}</div>` : ''}
    <div class="single-post-meta">${formatDate(post.published_at || post.created_at)} &nbsp;·&nbsp; ${readTime(post.body)}</div>
    <div class="single-post-body">${md(post.body)}</div>
  `;

  navigate('post');
  loadComments(id);
}

// ── Comments ─────────────────────────────────────────────────────────
async function loadComments(postId) {
  const el = document.getElementById('comments-section');
  const { data, error } = await sb
    .from('comments').select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  const comments = data || [];
  const deleteBtn = (id) => currentUser
    ? `<button class="admin-delete-comment" onclick="deleteComment('${id}')">delete</button>`
    : '';

  el.innerHTML = `
    <h3 class="comments-title">Comments (${comments.length})</h3>
    <div class="comment-list">
      ${comments.length ? comments.map(c => `
        <div class="comment-item" id="comment-${c.id}">
          <div class="comment-name">${escHtml(c.name)}</div>
          <div class="comment-date">${formatDate(c.created_at)}</div>
          <div class="comment-body">${escHtml(c.body)}</div>
          ${deleteBtn(c.id)}
        </div>`).join('') : '<p style="color:var(--dim);font-size:.85rem;font-style:italic;">No comments yet. Be the first.</p>'}
    </div>
    <div class="comment-form">
      <div class="comment-form-title">Leave a comment</div>
      <input type="text" id="comment-name" placeholder="Your name" class="field"/>
      <textarea id="comment-body" placeholder="Write a comment…" class="field" style="min-height:100px;"></textarea>
      <div id="comment-error" class="error-msg"></div>
      <button class="btn-submit" onclick="submitComment()">Post comment</button>
    </div>
  `;
}

async function submitComment() {
  const name  = document.getElementById('comment-name').value.trim();
  const body  = document.getElementById('comment-body').value.trim();
  const errEl = document.getElementById('comment-error');
  errEl.textContent = '';

  if (!name) { errEl.textContent = 'Please enter your name.'; return; }
  if (!body) { errEl.textContent = 'Please write a comment.'; return; }

  const { error } = await sb.from('comments')
    .insert([{ post_id: currentPostId, name, body }]);

  if (error) { errEl.textContent = error.message; return; }
  loadComments(currentPostId);
}

async function deleteComment(id) {
  if (!currentUser) return;
  await sb.from('comments').delete().eq('id', id);
  loadComments(currentPostId);
}

// ── About ─────────────────────────────────────────────────────────────
async function loadAbout() {
  const { data } = await sb.from('about').select('body').eq('id',1).single();
  if (data) document.getElementById('about-body').innerHTML = md(data.body);
}

async function openEditAbout() {
  const { data } = await sb.from('about').select('body').eq('id',1).single();
  document.getElementById('about-edit-body').value = data?.body || '';
  closeOverlay('admin-overlay');
  showOverlay('about-overlay');
}

async function saveAbout() {
  if (!currentUser) return;
  const body = document.getElementById('about-edit-body').value.trim();
  await sb.from('about').upsert([{ id:1, body }], { onConflict:'id' });
  document.getElementById('about-body').innerHTML = md(body);
  closeOverlay('about-overlay');
}

// ── Admin panel ───────────────────────────────────────────────────────
function toggleAdminPanel() {
  if (!currentUser) { showOverlay('login-overlay'); return; }
  const el = document.getElementById('admin-posts-list');
  el.innerHTML = allPosts.length
    ? allPosts.map(p => `
        <div class="admin-post-row">
          <span>${p.title}</span>
          <em>${p.category}</em>
          <button onclick="openEditPost('${p.id}')">Edit</button>
        </div>`).join('')
    : '<p style="color:var(--dim);font-size:.82rem;">No posts yet.</p>';
  showOverlay('admin-overlay');
}

// ── New/Edit post ─────────────────────────────────────────────────────
function openNewPost() {
  editingPostId = null; thumbFileB64 = null; coverFileB64 = null;
  document.getElementById('post-overlay-title').textContent = 'New Post';
  document.getElementById('post-title').value          = '';
  document.getElementById('post-subtitle').value       = '';
  document.getElementById('post-body').value           = '';
  document.getElementById('post-category').value       = 'stories';
  document.getElementById('post-thumbnail-url').value  = '';
  document.getElementById('post-cover-url').value      = '';
  // Default date to today
  document.getElementById('post-published-at').value   = new Date().toISOString().split('T')[0];
  document.getElementById('post-thumbnail-file').value = '';
  document.getElementById('post-cover-file').value     = '';
  document.getElementById('thumb-preview').className   = 'img-preview';
  document.getElementById('cover-preview').className   = 'img-preview';
  document.getElementById('post-error').textContent    = '';
  document.getElementById('delete-post-btn').classList.add('hidden');
  closeOverlay('admin-overlay');
  showOverlay('post-overlay');
}

function openEditPost(id) {
  const post = allPosts.find(p => p.id === id);
  if (!post) return;
  editingPostId = id; thumbFileB64 = null; coverFileB64 = null;
  document.getElementById('post-overlay-title').textContent = 'Edit Post';
  document.getElementById('post-title').value         = post.title    || '';
  document.getElementById('post-subtitle').value      = post.subtitle || '';
  document.getElementById('post-body').value          = post.body     || '';
  document.getElementById('post-category').value      = post.category || 'stories';
  document.getElementById('post-published-at').value  = (post.published_at || post.created_at || '').split('T')[0];
  document.getElementById('post-thumbnail-url').value = post.thumbnail   || '';
  document.getElementById('post-cover-url').value     = post.cover_image || '';
  document.getElementById('post-thumbnail-file').value = '';
  document.getElementById('post-cover-file').value    = '';

  const tp = document.getElementById('thumb-preview');
  const cp = document.getElementById('cover-preview');
  if (post.thumbnail)   { tp.innerHTML = `<img src="${post.thumbnail}"/>`;   tp.className = 'img-preview show'; }
  else                  { tp.className = 'img-preview'; }
  if (post.cover_image) { cp.innerHTML = `<img src="${post.cover_image}"/>`; cp.className = 'img-preview show'; }
  else                  { cp.className = 'img-preview'; }

  document.getElementById('post-error').textContent = '';
  document.getElementById('delete-post-btn').classList.remove('hidden');
  closeOverlay('admin-overlay');
  showOverlay('post-overlay');
}

// ── Image file → base64 ───────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function previewThumb(input) {
  const file = input.files[0]; if (!file) return;
  thumbFileB64 = await fileToBase64(file);
  const p = document.getElementById('thumb-preview');
  p.innerHTML = `<img src="${thumbFileB64}"/>`;
  p.className = 'img-preview show';
}

async function previewCover(input) {
  const file = input.files[0]; if (!file) return;
  coverFileB64 = await fileToBase64(file);
  const p = document.getElementById('cover-preview');
  p.innerHTML = `<img src="${coverFileB64}"/>`;
  p.className = 'img-preview show';
}

// ── Upload image to Supabase Storage ─────────────────────────────────
async function uploadImage(base64DataUrl, bucket) {
  // Convert base64 to blob
  const res  = await fetch(base64DataUrl);
  const blob = await res.blob();
  const ext  = blob.type.split('/')[1] || 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { data, error } = await sb.storage.from(bucket).upload(path, blob, {
    contentType: blob.type, upsert: false
  });
  if (error) throw error;

  const { data: { publicUrl } } = sb.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
}

// ── Save post ─────────────────────────────────────────────────────────
async function savePost() {
  if (!currentUser) return;
  const title    = document.getElementById('post-title').value.trim();
  const subtitle = document.getElementById('post-subtitle').value.trim();
  const body     = document.getElementById('post-body').value.trim();
  const category = document.getElementById('post-category').value;
  const errEl    = document.getElementById('post-error');
  errEl.textContent = '';

  if (!title) { errEl.textContent = 'Title is required.'; return; }
  if (!body)  { errEl.textContent = 'Body is required.';  return; }

  // Resolve thumbnail
  let thumbnail = document.getElementById('post-thumbnail-url').value.trim();
  if (thumbFileB64) {
    try { thumbnail = await uploadImage(thumbFileB64, 'images'); }
    catch(e) { errEl.textContent = 'Thumbnail upload failed: ' + e.message; return; }
  }

  // Resolve cover
  let cover_image = document.getElementById('post-cover-url').value.trim();
  if (coverFileB64) {
    try { cover_image = await uploadImage(coverFileB64, 'images'); }
    catch(e) { errEl.textContent = 'Cover upload failed: ' + e.message; return; }
  }

  const pubDate = document.getElementById('post-published-at').value;
  const published_at = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
  const payload = { title, subtitle, body, category, thumbnail, cover_image, published_at };
  let error;

  if (editingPostId) {
    ({ error } = await sb.from('posts').update(payload).eq('id', editingPostId));
  } else {
    ({ error } = await sb.from('posts').insert([payload]));
  }

  if (error) { errEl.textContent = error.message; return; }
  closeOverlay('post-overlay');
  await loadAllPosts();
}

// ── Delete post ───────────────────────────────────────────────────────
async function deletePost() {
  if (!editingPostId || !currentUser) return;
  if (!confirm('Delete this post? Cannot be undone.')) return;
  const { error } = await sb.from('posts').delete().eq('id', editingPostId);
  if (error) { document.getElementById('post-error').textContent = error.message; return; }
  closeOverlay('post-overlay');
  await loadAllPosts();
  navigate('home');
}

// ── Overlay helpers ───────────────────────────────────────────────────
function showOverlay(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeOverlay(id) { document.getElementById(id).classList.add('hidden'); }

document.querySelectorAll('.overlay').forEach(ov =>
  ov.addEventListener('click', e => { if (e.target === ov) ov.classList.add('hidden'); })
);

// ── File input listeners ──────────────────────────────────────────────
window.addEventListener('supabase-ready', () => {
  document.getElementById('post-thumbnail-file').addEventListener('change', function() { previewThumb(this); });
  document.getElementById('post-cover-file').addEventListener('change',     function() { previewCover(this); });
});

// ── About tab ─────────────────────────────────────────────────────────
document.querySelector('[data-page="about"]').addEventListener('click', loadAbout);

// ── Utils ─────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}

function readTime(body) {
  if (!body) return '1 min read';
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200)) + ' min read';
}

function escHtml(str) {
  return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Custom cursor ─────────────────────────────────────────────────
(function() {
  const el = document.createElement('div');
  el.className = 'cursor';
  document.body.appendChild(el);

  document.addEventListener('mousemove', e => {
    el.style.left = e.clientX + 'px';
    el.style.top  = e.clientY + 'px';
  });

  document.addEventListener('mousedown', () => el.classList.add('click'));
  document.addEventListener('mouseup',   () => el.classList.remove('click'));

  document.addEventListener('mouseover', e => {
    if (e.target.closest('a, button, .thumb-card, .song-card, .carousel-slide')) {
      el.classList.add('hover');
    } else {
      el.classList.remove('hover');
    }
  });
})();

// ── Music tabs ────────────────────────────────────────────────────
function switchMusicTab(tab, btn) {
  document.querySelectorAll('.music-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.music-tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('music-tab-' + tab).classList.add('active');
}

// ── Song sheets ───────────────────────────────────────────────────
async function loadSongs() {
  const { data } = await sb.from('songs').select('*').order('created_at', { ascending: false });
  const el = document.getElementById('list-songs');
  if (!data || !data.length) {
    el.innerHTML = '<div class="empty-state">No songs yet. Add them from the admin panel.</div>';
    return;
  }
  el.innerHTML = data.map(s => `
    <div class="song-card" onclick="toggleSong(this)">
      <div class="song-card-header">
        <div class="song-card-title">${s.title}</div>
        <div class="song-card-meta">${s.key ? 'Key of ' + s.key : ''} ${s.capo ? '· Capo ' + s.capo : ''}</div>
      </div>
      <div class="song-card-body">
        <div class="song-sheet">${renderSongSheet(s.sheet)}</div>
      </div>
    </div>
  `).join('');
}

function toggleSong(card) {
  const body = card.querySelector('.song-card-body');
  body.classList.toggle('open');
}

function renderSongSheet(raw) {
  if (!raw) return '';
  // Format:
  // [Verse] = section label
  // chord: D Bm G A = chord line (prefixed with "chords:")
  // > stage direction
  // plain text = lyric line
  // blank line = gap
  const lines = raw.split('\n');
  let out = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { out += '<div class="song-gap"></div>'; continue; }
    if (/^\[.+\]$/.test(line.trim())) {
      out += `<div class="song-section-label">${line.replace(/[\[\]]/g,'')}</div>`;
    } else if (/^chords:/.test(line)) {
      const chords = line.replace(/^chords:/,'').trim();
      // peek at next line for lyric
      const nextLine = lines[i+1] && !lines[i+1].startsWith('chords:') && !lines[i+1].startsWith('>') && !lines[i+1].startsWith('[') ? lines[i+1] : '';
      if (nextLine) {
        out += `<div class="song-line"><div class="song-chords">${escHtml(chords)}</div><div class="song-lyric">${escHtml(nextLine)}</div></div>`;
        i++; // skip next line since we consumed it
      } else {
        out += `<div class="song-line"><div class="song-chords">${escHtml(chords)}</div><div class="song-lyric">&nbsp;</div></div>`;
      }
    } else if (/^>/.test(line)) {
      out += `<div class="song-dir">${escHtml(line.replace(/^>\s*/,''))}</div>`;
    } else {
      out += `<div class="song-line" style="padding-top:0"><div class="song-lyric">${escHtml(line)}</div></div>`;
    }
  }
  return out;
}

// Load songs when music tab is visited
document.querySelector('[data-page="music"]').addEventListener('click', loadSongs);
