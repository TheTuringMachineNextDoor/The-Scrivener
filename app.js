// ── State ─────────────────────────────────────────────────────────
let currentPage  = 'home';
let previousPage = 'home';
let currentUser  = null;
let editingPostId = null;
let allPosts     = [];

// ── Wait for Supabase ─────────────────────────────────────────────
window.addEventListener('supabase-ready', async () => {
  await checkSession();
  await loadAllPosts();
  renderHome();
});

// ── Simple Markdown renderer ──────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h|b|e|h])/m, '<p>')
    + '</p>';
}

// ── Auth ──────────────────────────────────────────────────────────
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
  currentUser = null;
  document.getElementById('admin-btn').style.display = 'none';
  closeOverlay('admin-overlay');
}

// ── Navigation ────────────────────────────────────────────────────
function navigate(page) {
  previousPage = currentPage;
  currentPage  = page;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');

  document.querySelectorAll('#main-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });

  window.scrollTo(0, 0);
}

function goBack() {
  navigate(previousPage === 'post' ? 'home' : previousPage);
}

// ── Load posts ────────────────────────────────────────────────────
async function loadAllPosts() {
  const { data, error } = await sb
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }
  allPosts = data || [];

  renderList('stories');
  renderList('essays');
  renderList('music');
  renderHome();
}

// ── Render lists ──────────────────────────────────────────────────
function renderList(category) {
  const el    = document.getElementById('list-' + category);
  const posts = allPosts.filter(p => p.category === category);

  if (!posts.length) {
    el.innerHTML = '<div class="empty-state">Nothing here yet.</div>';
    return;
  }

  el.innerHTML = posts.map((p, i) => `
    <div class="post-card" onclick="openPost('${p.id}')">
      <div class="post-card-num">${String(posts.length - i).padStart(2,'0')}</div>
      <div class="post-card-body">
        <div class="post-card-title">${p.title}</div>
        ${p.subtitle ? `<div class="post-card-subtitle">${p.subtitle}</div>` : ''}
        <div class="post-card-excerpt">${(p.body || '').replace(/[#*>]/g,'').substring(0, 160)}…</div>
      </div>
      <div class="post-card-meta">${formatDate(p.created_at)}</div>
    </div>
  `).join('');
}

function renderHome() {
  const el      = document.getElementById('home-recent');
  const recent  = allPosts.slice(0, 6);

  if (!recent.length) {
    el.innerHTML = '<div class="empty-state">No posts yet.</div>';
    return;
  }

  el.innerHTML = recent.map(p => `
    <div class="home-card" data-cat="${p.category}" onclick="openPost('${p.id}')">
      <div class="home-card-title">${p.title}</div>
      <div class="home-card-excerpt">${(p.body || '').replace(/[#*>]/g,'').substring(0, 120)}…</div>
    </div>
  `).join('');
}

// ── Open single post ──────────────────────────────────────────────
function openPost(id) {
  const post = allPosts.find(p => p.id === id);
  if (!post) return;

  document.getElementById('single-post-content').innerHTML = `
    <div class="single-post-label">${post.category}</div>
    <h1 class="single-post-title">${post.title}</h1>
    ${post.subtitle ? `<div class="single-post-subtitle">${post.subtitle}</div>` : ''}
    <div class="single-post-meta">${formatDate(post.created_at)}</div>
    <div class="single-post-body">${renderMarkdown(post.body)}</div>
  `;

  navigate('post');
}

// ── About page ────────────────────────────────────────────────────
async function loadAbout() {
  const { data } = await sb.from('about').select('body').eq('id', 1).single();
  if (data) {
    document.getElementById('about-body').innerHTML = renderMarkdown(data.body);
  }
}

// ── Admin panel ───────────────────────────────────────────────────
function toggleAdminPanel() {
  if (!currentUser) { showOverlay('login-overlay'); return; }
  renderAdminList();
  showOverlay('admin-overlay');
}

function renderAdminList() {
  const el = document.getElementById('admin-posts-list');
  if (!allPosts.length) { el.innerHTML = '<p style="color:var(--dim);font-size:.82rem;">No posts yet.</p>'; return; }

  el.innerHTML = allPosts.map(p => `
    <div class="admin-post-row">
      <span>${p.title}</span>
      <em>${p.category}</em>
      <button onclick="openEditPost('${p.id}')">Edit</button>
    </div>
  `).join('');
}

// ── New post ──────────────────────────────────────────────────────
function openNewPost() {
  editingPostId = null;
  document.getElementById('post-overlay-title').textContent = 'New Post';
  document.getElementById('post-title').value    = '';
  document.getElementById('post-subtitle').value = '';
  document.getElementById('post-body').value     = '';
  document.getElementById('post-category').value = 'stories';
  document.getElementById('post-error').textContent = '';
  document.getElementById('delete-post-btn').classList.add('hidden');
  closeOverlay('admin-overlay');
  showOverlay('post-overlay');
}

// ── Edit post ─────────────────────────────────────────────────────
function openEditPost(id) {
  const post = allPosts.find(p => p.id === id);
  if (!post) return;

  editingPostId = id;
  document.getElementById('post-overlay-title').textContent = 'Edit Post';
  document.getElementById('post-title').value    = post.title    || '';
  document.getElementById('post-subtitle').value = post.subtitle || '';
  document.getElementById('post-body').value     = post.body     || '';
  document.getElementById('post-category').value = post.category || 'stories';
  document.getElementById('post-error').textContent = '';
  document.getElementById('delete-post-btn').classList.remove('hidden');
  closeOverlay('admin-overlay');
  showOverlay('post-overlay');
}

// ── Save post ─────────────────────────────────────────────────────
async function savePost() {
  if (!currentUser) return;

  const title    = document.getElementById('post-title').value.trim();
  const subtitle = document.getElementById('post-subtitle').value.trim();
  const body     = document.getElementById('post-body').value.trim();
  const category = document.getElementById('post-category').value;
  const errEl    = document.getElementById('post-error');

  if (!title) { errEl.textContent = 'Title is required.'; return; }
  if (!body)  { errEl.textContent = 'Body is required.';  return; }
  errEl.textContent = '';

  let error;

  if (editingPostId) {
    ({ error } = await sb.from('posts')
      .update({ title, subtitle, body, category })
      .eq('id', editingPostId));
  } else {
    ({ error } = await sb.from('posts')
      .insert([{ title, subtitle, body, category }]));
  }

  if (error) { errEl.textContent = error.message; return; }

  closeOverlay('post-overlay');
  await loadAllPosts();
}

// ── Delete post ───────────────────────────────────────────────────
async function deletePost() {
  if (!editingPostId || !currentUser) return;
  if (!confirm('Delete this post? This cannot be undone.')) return;

  const { error } = await sb.from('posts').delete().eq('id', editingPostId);
  if (error) { document.getElementById('post-error').textContent = error.message; return; }

  closeOverlay('post-overlay');
  await loadAllPosts();
  navigate('home');
}

// ── Edit about ────────────────────────────────────────────────────
async function openEditAbout() {
  const { data } = await sb.from('about').select('body').eq('id', 1).single();
  document.getElementById('about-edit-body').value = data?.body || '';
  closeOverlay('admin-overlay');
  showOverlay('about-overlay');
}

async function saveAbout() {
  if (!currentUser) return;
  const body = document.getElementById('about-edit-body').value.trim();

  const { error } = await sb.from('about')
    .upsert([{ id: 1, body }], { onConflict: 'id' });

  if (error) { console.error(error); return; }

  document.getElementById('about-body').innerHTML = renderMarkdown(body);
  closeOverlay('about-overlay');
}

// ── Overlay helpers ───────────────────────────────────────────────
function showOverlay(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeOverlay(id) { document.getElementById(id).classList.add('hidden'); }

// Close overlay on background click
document.querySelectorAll('.overlay').forEach(ov => {
  ov.addEventListener('click', e => {
    if (e.target === ov) ov.classList.add('hidden');
  });
});

// ── Utils ─────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

// ── Load about on tab click ───────────────────────────────────────
document.querySelector('[data-page="about"]').addEventListener('click', loadAbout);
