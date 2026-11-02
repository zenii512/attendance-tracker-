const { clubs, customClubs, events, saveEvents, saveCustomClubs, normalizeClubName, toDateKey, getMonthlyAttendanceCounts, escapeHtml, linkifyText } = window.Daybook;
const today = new Date();
let shownMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
let editingId = '';
const form = document.getElementById('event-form');
const dateInput = document.getElementById('event-date');

function dateFromKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function clubClass(name) {
  if (!name) return 'default';
  const mainIndex = clubs.findIndex((club) => normalizeClubName(club) === normalizeClubName(name || ''));
  return mainIndex < 0 ? 'custom' : `main-${mainIndex}`;
}

function clubTag(name) {
  if (!name) return '';
  return `<span class="calendar-club-label club-label-${clubClass(name)}">${escapeHtml(name)}</span>`;
}

function updateSelectedDate(date, changeMonth = false) {
  selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  dateInput.value = toDateKey(selectedDate);
  document.getElementById('event-form-date').textContent = new Intl.DateTimeFormat('en', {
    weekday: 'short', day: 'numeric', month: 'long'
  }).format(selectedDate);
  if (changeMonth) shownMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  renderCalendarGrid();
}

function eventsByDate() {
  const grouped = new Map();
  events.forEach((item) => {
    if (!item.date) return;
    if (!grouped.has(item.date)) grouped.set(item.date, []);
    grouped.get(item.date).push(item);
  });
  return grouped;
}

function renderCalendarGrid() {
  const year = shownMonth.getFullYear();
  const month = shownMonth.getMonth();
  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const weekCount = Math.ceil((firstOffset + days) / 7);
  const grouped = eventsByDate();
  document.getElementById('calendar-month-title').textContent = new Intl.DateTimeFormat('en', {
    month: 'long', year: 'numeric'
  }).format(shownMonth);
  let cells = '';
  for (let index = 0; index < weekCount * 7; index += 1) {
    const day = index - firstOffset + 1;
    if (day < 1 || day > days) {
      cells += '<span class="calendar-day-blank" aria-hidden="true"></span>';
      continue;
    }
    const date = new Date(year, month, day);
    const key = toDateKey(date);
    const dayEvents = grouped.get(key) || [];
    const isToday = key === toDateKey(today);
    const isSelected = key === toDateKey(selectedDate);
    const dots = dayEvents.slice(0, 4).map((item) => `<i class="calendar-event-dot dot-${clubClass(item.club)}" aria-hidden="true"></i>`).join('');
    cells += `<button type="button" class="calendar-day ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" data-date="${key}" aria-pressed="${isSelected}" aria-label="${escapeHtml(new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long' }).format(date))}${dayEvents.length ? `, ${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}` : ''}"><span>${day}</span><span class="calendar-day-dots">${dots}</span></button>`;
  }
  document.getElementById('calendar-grid').innerHTML = cells;
  const todayInMonth = today.getFullYear() === year && today.getMonth() === month;
  document.getElementById('today-legend').textContent = todayInMonth
    ? `${today.getDate()} outlined · today`
    : `Today: ${new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(today)}`;
}

function setTagSelection(selectedClub, typedOther = '') {
  document.querySelectorAll('.event-club-choice').forEach((button) => {
    const selected = normalizeClubName(button.dataset.club) === normalizeClubName(selectedClub || '');
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const otherSelected = Boolean(typedOther);
  const other = document.querySelector('.event-other-club');
  other.classList.toggle('selected', otherSelected);
  other.setAttribute('aria-pressed', String(otherSelected));
  const customField = document.getElementById('custom-club-field');
  customField.hidden = !otherSelected;
  document.getElementById('custom-club-name').value = typedOther;
}

function renderClubChoices(selectedClub = '', typedOther = '') {
  const seen = new Set();
  const options = [...clubs, ...customClubs].filter((name) => {
    const key = normalizeClubName(name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const mainClub = clubs.find((name) => normalizeClubName(name) === normalizeClubName(selectedClub || ''));
  const listedClub = options.find((name) => normalizeClubName(name) === normalizeClubName(selectedClub || ''));
  const otherValue = typedOther || (selectedClub && !mainClub && !listedClub ? selectedClub : '');
  const buttons = options.map((name) => {
    const isMain = clubs.some((club) => normalizeClubName(club) === normalizeClubName(name));
    const tag = `<button type="button" class="club-tag event-club-choice ${isMain ? '' : 'custom-tag'}" data-club="${escapeHtml(name)}" aria-pressed="false">${escapeHtml(name)}</button>`;
    if (isMain) return tag;
    return `<span class="custom-club-tag">${tag}<button type="button" class="remove-custom-club" data-remove-club="${escapeHtml(name)}" aria-label="Remove ${escapeHtml(name)}" title="Remove ${escapeHtml(name)}">&#x2715;</button></span>`;
  }).join('');
  document.getElementById('event-club-tags').innerHTML = `${buttons}<button type="button" class="club-tag other-tag event-other-club" aria-pressed="false">+ Other club</button>`;
  setTagSelection(listedClub || '', otherValue);
}

function selectedClubName() {
  const selected = document.querySelector('.event-club-choice.selected');
  if (selected) return selected.dataset.club;
  if (document.querySelector('.event-other-club.selected')) {
    return document.getElementById('custom-club-name').value.trim().replace(/\s+/g, ' ');
  }
  return '';
}

function currentEventClub() {
  return selectedClubName();
}

function renderAttendanceHeader() {
  const counts = getMonthlyAttendanceCounts(today);
  const total = counts.present + counts.club + counts.absent;
  const rate = total ? Math.round((counts.present / total) * 100) : 0;
  document.getElementById('monthly-summary').textContent = `${rate}% · ${counts.present} / ${total}`;
  document.getElementById('progress-present').style.width = total ? `${counts.present / total * 100}%` : '0%';
  document.getElementById('progress-club').style.width = total ? `${counts.club / total * 100}%` : '0%';
  document.getElementById('progress-absent').style.width = total ? `${counts.absent / total * 100}%` : '0%';
}

function resetForm() {
  form.reset();
  editingId = '';
  document.getElementById('save-event').textContent = 'Add event';
  renderClubChoices();
  updateSelectedDate(selectedDate);
}

function renderUpcoming() {
  const todayKey = toDateKey(today);
  const upcoming = events
    .filter((item) => item.date && item.date >= todayKey)
    .sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`));
  const list = document.getElementById('upcoming-events');
  document.getElementById('empty-events').hidden = upcoming.length > 0;
  list.innerHTML = upcoming.map((item) => {
    const date = dateFromKey(item.date);
    const weekday = new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date).toUpperCase();
    return `<article class="upcoming-event">
      <div class="event-date-box"><strong>${date.getDate()}</strong><span>${weekday}</span></div>
      <div class="upcoming-event-body">
        <div class="upcoming-event-heading"><h4>${escapeHtml(item.title)}</h4><div class="event-actions"><button type="button" class="edit-event" data-event-id="${escapeHtml(item.id)}">Edit</button><button type="button" class="delete-event" data-event-id="${escapeHtml(item.id)}">Delete</button></div></div>
        <p class="upcoming-event-time">${escapeHtml(item.time || '')}</p>
        ${clubTag(item.club)}
        ${item.body ? `<p class="upcoming-event-text">${linkifyText(item.body)}</p>` : ''}
      </div>
    </article>`;
  }).join('');
}

function renderPage() {
  renderAttendanceHeader();
  renderCalendarGrid();
  renderUpcoming();
}

function makeId() {
  return window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Select days and club tags without changing saved records.
document.getElementById('calendar-grid').addEventListener('click', (event) => {
  const day = event.target.closest('.calendar-day');
  if (!day) return;
  updateSelectedDate(dateFromKey(day.dataset.date));
});

document.getElementById('calendar-previous').addEventListener('click', () => {
  shownMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() - 1, 1);
  updateSelectedDate(shownMonth);
});
document.getElementById('calendar-next').addEventListener('click', () => {
  shownMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + 1, 1);
  updateSelectedDate(shownMonth);
});

dateInput.addEventListener('change', () => {
  if (!dateInput.value) return;
  updateSelectedDate(dateFromKey(dateInput.value), true);
});

document.getElementById('event-club-tags').addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.matches('.remove-custom-club')) {
    const clubName = button.dataset.removeClub;
    if (!window.confirm(`Remove ${clubName} from your club tags? Your saved attendance and events stay as they are.`)) return;
    const selectedName = currentEventClub();
    const otherWasSelected = document.querySelector('.event-other-club.selected');
    const typedOther = otherWasSelected ? (document.getElementById('custom-club-name').value || ' ') : '';
    const clubKey = normalizeClubName(clubName);
    customClubs.splice(0, customClubs.length, ...customClubs.filter((name) => normalizeClubName(name) !== clubKey));
    saveCustomClubs();
    renderClubChoices(selectedName, typedOther);
    return;
  }
  if (button.matches('.event-club-choice')) {
    setTagSelection(button.dataset.club);
  } else if (button.matches('.event-other-club')) {
    setTagSelection('', ' ');
    document.getElementById('custom-club-name').focus();
  }
});

document.getElementById('clear-event-form').addEventListener('click', resetForm);

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const typedName = document.getElementById('custom-club-name').value.trim().replace(/\s+/g, ' ');
  const otherSelected = document.querySelector('.event-other-club.selected');
  let club = selectedClubName();
  if (otherSelected) {
    const match = [...clubs, ...customClubs].find((name) => normalizeClubName(name) === normalizeClubName(typedName));
    club = match || typedName;
    if (typedName && !match) {
      customClubs.push(typedName);
      saveCustomClubs();
    }
  }
  const item = {
    id: editingId || makeId(),
    title: document.getElementById('event-title').value.trim(),
    body: document.getElementById('event-body').value,
    date: dateInput.value,
    time: document.getElementById('event-time').value,
    club
  };
  selectedDate = dateFromKey(item.date);
  shownMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  if (editingId) {
    const index = events.findIndex((saved) => String(saved.id) === editingId);
    if (index >= 0) events[index] = item;
  } else {
    events.push(item);
  }
  saveEvents();
  renderPage();
  resetForm();
});

document.getElementById('upcoming-events').addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const id = button.dataset.eventId;
  const index = events.findIndex((item) => String(item.id) === id);
  if (index < 0) return;
  if (button.matches('.delete-event')) {
    if (!window.confirm(`Delete “${events[index].title}”?`)) return;
    events.splice(index, 1);
    saveEvents();
    if (editingId === id) resetForm();
    renderPage();
  } else if (button.matches('.edit-event')) {
    const item = events[index];
    editingId = id;
    document.getElementById('event-title').value = item.title || '';
    document.getElementById('event-body').value = item.body || '';
    document.getElementById('event-time').value = item.time || '';
    renderClubChoices(item.club || '');
    updateSelectedDate(dateFromKey(item.date), true);
    document.getElementById('save-event').textContent = 'Save changes';
    document.getElementById('event-title').focus();
    window.scrollTo({ top: document.getElementById('event-form').offsetTop - 20, behavior: 'smooth' });
  }
});

// Start with today selected.
document.getElementById('today-date').textContent = new Intl.DateTimeFormat('en', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
}).format(today);
updateSelectedDate(selectedDate);
renderClubChoices();
renderPage();
