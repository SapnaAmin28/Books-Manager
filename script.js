// app.js - vanilla JS Books Manager UI
const API_BASE = 'http://localhost:3000'; // change if needed

// App state
let books = []; // loaded from API
let filtered = [];
let page = 1;
let perPage = 8;
let sortBy = 'id-desc';
let query = '';
let editing = null; // {id,title,author}

// Demo fallback data if API unreachable
const demoBooks = [
  { id: 1, title: 'The Pragmatic Programmer', author: 'Andrew Hunt' },
  { id: 2, title: 'Clean Code', author: 'Robert C. Martin' },
  { id: 3, title: 'You Don’t Know JS', author: 'Kyle Simpson' },
  { id: 4, title: 'Eloquent JavaScript', author: 'Marijn Haverbeke' },
  { id: 5, title: 'Design Patterns', author: 'Erich Gamma' },
  { id: 6, title: 'Refactoring', author: 'Martin Fowler' },
  { id: 7, title: 'The Hobbit', author: 'J.R.R. Tolkien' },
  { id: 8, title: '1984', author: 'George Orwell' },
  { id: 9, title: 'The Clean Coder', author: 'Robert C. Martin' },
  { id: 10, title: 'Cracking the Coding Interview', author: 'Gayle Laakmann McDowell' }
];

// DOM elements
const statusEl = document.getElementById('status');
const gridEl = document.getElementById('grid');
const paginationEl = document.getElementById('pagination');
const searchInput = document.getElementById('search');
const clearSearchBtn = document.getElementById('clearSearch');
const addBtn = document.getElementById('addBtn');
const formOverlay = document.getElementById('formOverlay');
const deleteOverlay = document.getElementById('deleteOverlay');
const closeModal = document.getElementById('closeModal');
const cancelForm = document.getElementById('cancelForm');
const bookForm = document.getElementById('bookForm');
const titleInput = document.getElementById('titleInput');
const authorInput = document.getElementById('authorInput');
const errTitle = document.getElementById('errTitle');
const errAuthor = document.getElementById('errAuthor');
const modalTitle = document.getElementById('modalTitle');
const saveBtn = document.getElementById('saveBtn');
const cancelDelete = document.getElementById('cancelDelete');
const confirmDelete = document.getElementById('confirmDelete');
const deleteMsg = document.getElementById('deleteMsg');
const toastEl = document.getElementById('toast');
const sortSelect = document.getElementById('sortSelect');
const perPageSelect = document.getElementById('perPage');
const resetBtn = document.getElementById('resetBtn');

// Helpers
function showToast(msg, type = 'success') {
  toastEl.textContent = msg;
  toastEl.className = `toast ${type}`;
  setTimeout(() => toastEl.classList.add('visible'), 10);
  toastEl.classList.remove('hidden');
  setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 2500);
}

function showStatus(text) {
  statusEl.textContent = text;
  statusEl.style.display = text ? 'block' : 'none';
}

function openForm(edit = null) {
  editing = edit;
  if (edit) {
    modalTitle.textContent = 'Edit Book';
    titleInput.value = edit.title;
    authorInput.value = edit.author;
  } else {
    modalTitle.textContent = 'Add Book';
    titleInput.value = '';
    authorInput.value = '';
  }
  errTitle.textContent = '';
  errAuthor.textContent = '';
  formOverlay.classList.remove('hidden');
}

function closeForm() {
  formOverlay.classList.add('hidden');
  editing = null;
}

function openDelete(book) {
  deleteOverlay.classList.remove('hidden');
  deleteMsg.textContent = `Are you sure you want to delete "${book.title}" by ${book.author}?`;
  confirmDelete.dataset.id = book.id;
}

function closeDelete() {
  deleteOverlay.classList.add('hidden');
  confirmDelete.dataset.id = '';
}

// Fetch from API (with simple error handling & fallback)
async function fetchBooks() {
  showStatus('Loading books…');
  try {
    const res = await fetch(`${API_BASE}/books`);
    if (!res.ok) throw new Error('API not available');
    const data = await res.json();
    books = Array.isArray(data) ? data : [];
    showStatus('');
    render();
  } catch (e) {
    console.warn('API unreachable, using demo data', e);
    books = demoBooks.slice();
    showStatus('Using demo data (API unreachable). Start your backend at http://localhost:3000 to enable live CRUD.');
    render();
  }
}

// CRUD helpers
async function createBook(payload) {
  try {
    const res = await fetch(`${API_BASE}/books`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create');
    const created = await res.json();
    books.push(created);
    showToast('Book added', 'success');
    render();
  } catch (e) {
    // fallback: simulate create locally
    const local = { id: Date.now(), ...payload };
    books.push(local);
    showToast('Book added locally (API unreachable)', 'error');
    render();
  }
}

async function updateBook(payload) {
  try {
    const res = await fetch(`${API_BASE}/books/${payload.id}`, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to update');
    const updated = await res.json();
    books = books.map(b => b.id === updated.id ? updated : b);
    showToast('Book updated', 'success');
    render();
  } catch (e) {
    books = books.map(b => b.id === payload.id ? payload : b);
    showToast('Book updated locally (API unreachable)', 'error');
    render();
  }
}

async function deleteBook(id) {
  try {
    const res = await fetch(`${API_BASE}/books/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    books = books.filter(b => b.id !== id);
    showToast('Book deleted', 'success');
    render();
  } catch (e) {
    books = books.filter(b => b.id !== Number(id));
    showToast('Book deleted locally (API unreachable)', 'error');
    render();
  } finally {
    closeDelete();
  }
}

// Filtering, sorting, pagination
function applyFilters() {
  const q = query.trim().toLowerCase();
  filtered = books.filter(b => {
    return (
      !q ||
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q)
    );
  });

  const [fld, dir] = sortBy.split('-');
  filtered.sort((a,b) => {
    if (fld === 'title') return dir === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title);
    if (fld === 'author') return dir === 'asc' ? a.author.localeCompare(b.author) : b.author.localeCompare(a.author);
    return dir === 'asc' ? a.id - b.id : b.id - a.id;
  });
}

function render() {
  applyFilters();
  const total = filtered.length;
  perPage = Number(perPageSelect.value) || perPage;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (page > totalPages) page = totalPages;
  const start = (page - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);

  // grid
  gridEl.innerHTML = pageItems.map(b => bookCardHtml(b)).join('') || '<div class="status">No books found — add one.</div>';

  // add listeners to dynamic elements
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      const book = books.find(x => x.id === id);
      openForm(book);
    });
  });
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      const book = books.find(x => x.id === id);
      openDelete(book);
    });
  });

  // pagination
  paginationEl.innerHTML = '';
  if (totalPages > 1) {
    for (let i=1;i<=totalPages;i++){
      const btn = document.createElement('button');
      btn.className = 'page-btn' + (i===page?' active':'');
      btn.textContent = i;
      btn.addEventListener('click',()=>{ page=i; render(); window.scrollTo({top:0,behavior:'smooth'})});
      paginationEl.appendChild(btn);
    }
  }
}

// card template
function bookCardHtml(b){
  // small animated SVG cover
  return `
    <article class="card" role="article" aria-label="${escapeHtml(b.title)}">
      <div class="ribbon">Book</div>
      <div class="meta"><div class="id">#${b.id}</div></div>
      <div style="height:10px"></div>
      <div class="title-card">${escapeHtml(b.title)}</div>
      <div class="author">by ${escapeHtml(b.author)}</div>
      <div class="card-actions">
        <button class="small-btn edit-btn" data-id="${b.id}">Edit</button>
        <button class="small-btn delete-btn" data-id="${b.id}">Delete</button>
      </div>
    </article>
  `;
}

function escapeHtml(str){
  if (!str) return '';
  return str.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

// event wiring
searchInput.addEventListener('input', e => {
  query = e.target.value;
  page = 1;
  render();
});
clearSearchBtn.addEventListener('click', () => { searchInput.value=''; query=''; render(); });
addBtn.addEventListener('click', ()=>openForm(null));
closeModal.addEventListener('click', closeForm);
cancelForm.addEventListener('click', closeForm);
bookForm.addEventListener('submit', async (evt) => {
  evt.preventDefault();
  // validate
  const title = titleInput.value.trim();
  const author = authorInput.value.trim();
  let ok = true; errTitle.textContent=''; errAuthor.textContent='';
  if (title.length < 2){ errTitle.textContent = 'Title must be at least 2 characters'; ok=false; }
  if (author.length < 3){ errAuthor.textContent = 'Author must be at least 3 characters'; ok=false; }
  if (!ok) return;

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';
  const payload = editing ? { id: editing.id, title, author } : { title, author };
  try {
    if (editing) await updateBook(payload);
    else await createBook(payload);
    closeForm();
  } catch (e) {
    console.error(e);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
  }
});

cancelDelete.addEventListener('click', closeDelete);
confirmDelete.addEventListener('click', ()=> {
  const id = confirmDelete.dataset.id;
  if (id) deleteBook(Number(id));
});

sortSelect.addEventListener('change', e => { sortBy = e.target.value; render(); });
perPageSelect.addEventListener('change', e => { perPage = Number(e.target.value); page = 1; render(); });
resetBtn.addEventListener('click', ()=> {
  query=''; searchInput.value=''; sortBy='id-desc'; sortSelect.value='id-desc'; perPageSelect.value='8'; page=1; render();
});

// initial load
fetchBooks();