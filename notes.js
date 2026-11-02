const { timetable, notes, saveNotes, getMonthlyAttendanceCounts, escapeHtml, linkifyText } = window.Daybook;
const today = new Date();
let activeFilter = 'all';
let editingId = '';
const form = document.getElementById('note-form');

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function noteId() {
  return window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function renderHeader() {
  const counts = getMonthlyAttendanceCounts(today);
  const total = counts.present + counts.club + counts.absent;
  const rate = total ? Math.round((counts.present / total) * 100) : 0;
  document.getElementById('today-date').textContent = new Intl.DateTimeFormat('en', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(today);
  document.getElementById('monthly-summary').textContent = `${rate}% · ${counts.present} / ${total}`;
  document.getElementById('progress-present').style.width = total ? `${counts.present / total * 100}%` : '0%';
  document.getElementById('progress-club').style.width = total ? `${counts.club / total * 100}%` : '0%';
  document.getElementById('progress-absent').style.width = total ? `${counts.absent / total * 100}%` : '0%';
}

function subjectName(subject) {
  return subject || 'General';
}

function reminderDateLabel(note) {
  const [year, month, day] = note.reminderDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date);
  const monthName = new Intl.DateTimeFormat('en', { month: 'short' }).format(date);
  const formatted = `${weekday}, ${day} ${monthName}`;
  return `Due · ${formatted}${note.reminderTime ? ` · ${note.reminderTime}` : ''}`;
}

function isOverdue(note) {
  const todayKey = dateKey(today);
  if (!note.reminderDate || note.done || note.reminderDate > todayKey) return false;
  if (note.reminderDate < todayKey) return true;
  if (!note.reminderTime) return false;
  const now = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
  return note.reminderTime < now;
}

function renderNote(note) {
  const subject = subjectName(note.subject);
  const due = note.reminderDate
    ? `<p class="note-due ${isOverdue(note) ? 'is-overdue' : ''}">${escapeHtml(reminderDateLabel(note))}</p>`
    : '';
  const doneLabel = note.done ? `Mark ${subject} note as not done` : `Mark ${subject} note as done`;
  return `<article class="note-card ${note.done ? 'is-done' : ''}">
    <div class="note-topline"><span class="note-subject">${escapeHtml(subject)}</span>${note.pinned ? '<span class="note-pinned">Pinned</span>' : ''}</div>
    <h3>${escapeHtml(note.title)}</h3>
    <p class="note-copy">${linkifyText(note.body || '')}</p>
    ${due}
    <div class="note-card-actions">
      <button class="done-note" type="button" data-note-id="${escapeHtml(note.id)}" aria-label="${escapeHtml(doneLabel)}" aria-pressed="${Boolean(note.done)}">✓</button>
      <button class="edit-note" type="button" data-note-id="${escapeHtml(note.id)}">Edit</button>
      <button class="delete-note" type="button" data-note-id="${escapeHtml(note.id)}">Delete</button>
    </div>
  </article>`;
}

function renderNotes() {
  const reminderCount = notes.filter((note) => note.reminderDate).length;
  document.getElementById('reminder-count').textContent = `${reminderCount} little ${reminderCount === 1 ? 'reminder' : 'reminders'}`;
  const filtered = notes.filter((note) => activeFilter === 'all' || note.reminderDate);
  filtered.sort((a, b) => Number(Boolean(a.done)) - Number(Boolean(b.done)));
  document.getElementById('empty-notes').hidden = notes.length > 0;
  document.getElementById('notes-board').innerHTML = filtered.map(renderNote).join('');
  document.getElementById('notes-filter-empty').hidden = notes.length === 0 || filtered.length > 0;
}

function renderSubjectOptions(selected = 'General') {
  const subjects = [...new Set(timetable.map((lecture) => lecture.subject))];
  document.getElementById('note-subject').innerHTML = ['General', ...subjects].map((subject) =>
    `<option value="${escapeHtml(subject)}" ${subject === selected ? 'selected' : ''}>${escapeHtml(subject)}</option>`
  ).join('');
}

function resetForm() {
  form.reset();
  editingId = '';
  document.getElementById('note-form-title').textContent = 'Add a note';
  renderSubjectOptions();
  form.hidden = true;
}

function showForm(note = null) {
  form.hidden = false;
  if (note) {
    editingId = String(note.id);
    document.getElementById('note-form-title').textContent = 'Edit note';
    document.getElementById('note-title').value = note.title || '';
    document.getElementById('note-body').value = note.body || '';
    document.getElementById('note-reminder-date').value = note.reminderDate || '';
    document.getElementById('note-reminder-time').value = note.reminderTime || '';
    renderSubjectOptions(subjectName(note.subject));
  } else {
    editingId = '';
    form.reset();
    document.getElementById('note-form-title').textContent = 'Add a note';
    renderSubjectOptions();
  }
  document.getElementById('note-title').focus();
  window.scrollTo({ top: form.offsetTop - 20, behavior: 'smooth' });
}

// Save notes without changing attendance or events.
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const previous = notes.find((note) => String(note.id) === editingId);
  const reminderDate = document.getElementById('note-reminder-date').value;
  const note = {
    id: editingId || noteId(),
    title: document.getElementById('note-title').value.trim(),
    body: document.getElementById('note-body').value,
    subject: document.getElementById('note-subject').value,
    reminderDate,
    reminderTime: reminderDate ? document.getElementById('note-reminder-time').value : '',
    done: Boolean(previous?.done)
  };
  if (previous) Object.assign(previous, note);
  else notes.push(note);
  saveNotes();
  resetForm();
  renderNotes();
});

document.getElementById('add-note').addEventListener('click', () => showForm());
document.getElementById('close-note-form').addEventListener('click', resetForm);
document.getElementById('cancel-note').addEventListener('click', resetForm);

document.querySelector('.note-filters').addEventListener('click', (event) => {
  const button = event.target.closest('.note-filter');
  if (!button) return;
  activeFilter = button.dataset.filter;
  document.querySelectorAll('.note-filter').forEach((filter) => {
    const selected = filter === button;
    filter.classList.toggle('active', selected);
    filter.setAttribute('aria-pressed', String(selected));
  });
  renderNotes();
});

document.getElementById('notes-board').addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const index = notes.findIndex((note) => String(note.id) === button.dataset.noteId);
  if (index < 0) return;
  const note = notes[index];
  if (button.matches('.done-note')) {
    note.done = !note.done;
    saveNotes();
    renderNotes();
  } else if (button.matches('.edit-note')) {
    showForm(note);
  } else if (button.matches('.delete-note')) {
    if (!window.confirm(`Delete “${note.title}”?`)) return;
    notes.splice(index, 1);
    saveNotes();
    renderNotes();
  }
});

renderHeader();
renderSubjectOptions();
renderNotes();
