const { timetable, clubs, attendance, customClubs, events, notes, saveAttendance, saveCustomClubs, normalizeClubName, toDateKey, getLectures, getMonthlyAttendanceCounts, escapeHtml } = window.Daybook;
const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const today = new Date();
let selectedDate = new Date(today);
let dayLectures = getLectures(selectedDate);
const dateFormatter = new Intl.DateTimeFormat('en', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});

function entryFor(lecture, date = selectedDate) {
  const key = `${lecture.time}|${lecture.subject}`;
  return attendance[toDateKey(date)]?.[key] || {};
}

// Show reminders for today and tomorrow.
function renderTodayReminders() {
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayKey = toDateKey(today);
  const tomorrowKey = toDateKey(tomorrow);
  const reminders = [
    ...events.filter((item) => item.date === todayKey || item.date === tomorrowKey).map((item) => ({
      date: item.date,
      time: item.time || '',
      title: item.title,
      label: item.date === todayKey ? 'Today' : 'Tomorrow',
      href: 'calendar.html',
      type: 'event'
    })),
    ...notes.filter((item) => !item.done && item.reminderDate && item.reminderDate <= todayKey).map((item) => ({
      date: item.reminderDate,
      time: item.reminderTime || '',
      title: item.title,
      label: item.reminderDate === todayKey ? 'Due today' : 'Overdue',
      href: 'notes.html',
      type: 'note'
    }))
  ].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const area = document.getElementById('today-reminders');
  area.hidden = reminders.length === 0;
  area.innerHTML = reminders.map((item) => `
    <a class="today-reminder reminder-${item.type}" href="${item.href}">
      <span class="reminder-day">${item.label}</span>
      <span class="reminder-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.time)}</span></span>
    </a>`).join('');
}

function renderHeader() {
  document.getElementById('today-date').textContent = dateFormatter.format(today);
  const dayLabel = `${weekdayNames[selectedDate.getDay()].toUpperCase()}’S PAGE`;
  const selectedKey = toDateKey(selectedDate);
  if (selectedKey !== toDateKey(today)) {
    const shortDate = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long' }).format(selectedDate);
    document.getElementById('day-label').textContent = `${dayLabel} · ${shortDate}`;
    document.getElementById('past-day-tools').hidden = false;
  } else {
    document.getElementById('day-label').textContent = dayLabel;
    document.getElementById('past-day-tools').hidden = true;
  }
  document.getElementById('lecture-count').textContent = dayLectures.length
    ? `${dayLectures.length} lecture${dayLectures.length === 1 ? '' : 's'} to log`
    : 'A little space in your day';
}

function renderMonthlySummary() {
  const counts = getMonthlyAttendanceCounts(today);
  const total = counts.present + counts.club + counts.absent;
  const attended = counts.present;
  const percent = total ? Math.round((counts.present / total) * 100) : 0;
  document.getElementById('monthly-summary').textContent = `${percent}% · ${attended} / ${total}`;
  document.getElementById('progress-present').style.width = total ? `${counts.present / total * 100}%` : '0%';
  document.getElementById('progress-club').style.width = total ? `${counts.club / total * 100}%` : '0%';
  document.getElementById('progress-absent').style.width = total ? `${counts.absent / total * 100}%` : '0%';
}

// Find weekdays in the previous seven days that have lectures and no logs.
function getCatchupDates() {
  const dates = [];
  for (let daysAgo = 1; daysAgo <= 7; daysAgo += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);
    const lectures = getLectures(date);
    if (date.getDay() === 0 || date.getDay() === 6 || !lectures.length) continue;
    const hasAnySavedStatus = lectures.some((lecture) => Boolean(entryFor(lecture, date).status));
    if (!hasAnySavedStatus) dates.push(date);
  }
  return dates;
}

function renderCatchupDays() {
  const dates = getCatchupDates();
  const note = document.getElementById('catchup-note');
  const list = document.getElementById('catchup-days');
  note.hidden = dates.length === 0;
  document.getElementById('catchup-message').textContent = `${dates.length} ${dates.length === 1 ? 'day needs' : 'days need'} a little catching up.`;
  list.hidden = true;
  list.innerHTML = dates.map((date) => {
    const dayLecturesForDate = getLectures(date);
    const label = new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
    return `<button class="catchup-day" type="button" data-date="${toDateKey(date)}"><span>${escapeHtml(label)}</span><span>${dayLecturesForDate.length} ${dayLecturesForDate.length === 1 ? 'lecture' : 'lectures'} · Log →</span></button>`;
  }).join('');
}

function renderLectures() {
  const list = document.getElementById('lecture-list');
  if (!dayLectures.length) {
    list.innerHTML = '<div class="empty-state"><img src="assets/cat/cat-sitting.png" alt=""><p>No lectures scheduled today. Take a little time for yourself.</p></div>';
    return;
  }
  const seenClubs = new Set();
  const clubOptions = [...clubs, ...customClubs].filter((club) => {
    const normalized = normalizeClubName(club);
    if (seenClubs.has(normalized)) return false;
    seenClubs.add(normalized);
    return true;
  });
  list.innerHTML = dayLectures.map((lecture, index) => {
    const key = `${lecture.time}|${lecture.subject}`;
    const entry = entryFor(lecture);
    const statusButtons = [
      ['present', '✓', 'Present'], ['club', '•', 'Club'], ['absent', '−', 'Absent']
    ].map(([status, mark, label]) => `<button type="button" class="attendance-button ${entry.status === status ? 'active' : ''}" data-status="${status}" data-index="${index}" aria-pressed="${entry.status === status}"><span class="mark">${mark}</span>${label}</button>`).join('');
    const tagButtons = clubOptions.map((club) => {
      const isMainClub = clubs.some((mainClub) => normalizeClubName(mainClub) === normalizeClubName(club));
      const isCustom = !isMainClub && customClubs.some((customClub) => normalizeClubName(customClub) === normalizeClubName(club));
      const tagButton = `<button type="button" class="club-tag ${isCustom ? 'custom-tag' : ''} ${entry.club === club ? 'selected' : ''}" data-club="${escapeHtml(club)}" aria-pressed="${entry.club === club}">${escapeHtml(club)}</button>`;
      return isCustom
        ? `<span class="custom-club-tag">${tagButton}<button type="button" class="remove-custom-club" data-club="${escapeHtml(club)}" aria-label="Remove ${escapeHtml(club)}" title="Remove ${escapeHtml(club)}">&#x2715;</button></span>`
        : tagButton;
    }).join('');
    const customText = entry.customClub || '';
    const savedClub = entry.customClub || entry.club;
    const clubSummary = entry.status === 'club' && savedClub
      ? `<div class="club-summary"><span>Club: ${escapeHtml(savedClub)}${entry.event ? ` &middot; ${escapeHtml(entry.event)}` : ''}</span><button type="button" class="edit-club" data-index="${index}">Edit</button></div>`
      : '';
    return `<article class="lecture-card">
      <div class="lecture-meta"><span>${escapeHtml(lecture.time)}</span>${lecture.room ? `<span class="lecture-room">${escapeHtml(lecture.room)}</span>` : ''}</div>
      <h3 class="subject">${escapeHtml(lecture.subject)}</h3>
      <div class="attendance-actions">${statusButtons}</div>
      ${clubSummary}
      <form class="club-panel" data-index="${index}" ${entry.status === 'club' ? '' : 'hidden'}>
        <div class="club-title"><span>Which club took you away?</span><button type="button" class="collapse-club" aria-label="Close club details">⌃</button></div>
        <div class="club-tags">${tagButtons}<button type="button" class="club-tag other-tag ${customText && !entry.club ? 'selected' : ''}" aria-pressed="${Boolean(customText && !entry.club)}">+ Other club</button></div>
        <label class="club-field custom-club-field" ${customText ? '' : 'hidden'}>Club name<input class="custom-club-input" type="text" maxlength="60" placeholder="Type a club name" value="${escapeHtml(customText)}"></label>
        <label class="club-field">Event / a little context<input class="event-input" type="text" maxlength="120" placeholder="What was the event?" value="${escapeHtml(entry.event || '')}"></label>
        <button class="save-club" type="submit">Save club attendance</button>
      </form>
    </article>`;
  }).join('');
}

// Select a status, club, or catch-up day without losing typed form text.
document.getElementById('lecture-list').addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const card = button.closest('.lecture-card');
  if (button.matches('.remove-custom-club')) {
    const clubName = button.dataset.club;
    if (!window.confirm(`Remove ${clubName} from your club tags? Your past attendance stays as it is.`)) return;
    const clubKey = normalizeClubName(clubName);
    const remainingClubs = customClubs.filter((name) => normalizeClubName(name) !== clubKey);
    customClubs.splice(0, customClubs.length, ...remainingClubs);
    saveCustomClubs();
    renderLectures();
    return;
  }
  const index = Number(button.dataset.index || card?.querySelector('.club-panel')?.dataset.index);
  const lecture = dayLectures[index];
  if (!lecture) return;
  const key = `${lecture.time}|${lecture.subject}`;
  const dateKey = toDateKey(selectedDate);
  attendance[dateKey] ||= {};

  if (button.matches('.attendance-button')) {
    const previous = entryFor(lecture);
    const newStatus = previous.status === button.dataset.status ? '' : button.dataset.status;
    attendance[dateKey][key] = { ...previous, status: newStatus };
    saveAttendance();
    renderMonthlySummary();
    renderCatchupDays();
    renderLectures();
  } else if (button.matches('.club-tag:not(.other-tag)')) {
    attendance[dateKey][key] = {
      ...entryFor(lecture),
      status: 'club',
      club: button.dataset.club,
      customClub: '',
      event: card.querySelector('.event-input').value
    };
    saveAttendance();
    renderMonthlySummary();
    renderCatchupDays();
    renderLectures();
  } else if (button.matches('.other-tag')) {
    card.querySelectorAll('.club-tag:not(.other-tag)').forEach((tag) => {
      tag.classList.remove('selected');
      tag.setAttribute('aria-pressed', 'false');
    });
    button.classList.add('selected');
    button.setAttribute('aria-pressed', 'true');
    const field = card.querySelector('.custom-club-field');
    field.hidden = false;
    card.querySelector('.custom-club-input').focus();
  } else if (button.matches('.edit-club')) {
    card.querySelector('.club-panel').hidden = false;
  } else if (button.matches('.collapse-club')) {
    card.querySelector('.club-panel').hidden = true;
  }
});

document.getElementById('lecture-list').addEventListener('submit', (event) => {
  if (!event.target.matches('.club-panel')) return;
  event.preventDefault();
  const index = Number(event.target.dataset.index);
  const lecture = dayLectures[index];
  if (!lecture) return;
  const key = `${lecture.time}|${lecture.subject}`;
  const dateKey = toDateKey(selectedDate);
  const selectedTag = event.target.querySelector('.club-tag.selected:not(.other-tag)');
  const isOtherClub = event.target.querySelector('.other-tag').classList.contains('selected');
  const typedClub = event.target.querySelector('.custom-club-input').value.trim().replace(/\s+/g, ' ');
  const matchingClub = isOtherClub
    ? [...clubs, ...customClubs].find((name) => normalizeClubName(name) === normalizeClubName(typedClub))
    : '';
  const customClub = isOtherClub && typedClub && !matchingClub ? typedClub : '';
  if (customClub) {
    customClubs.push(customClub);
    saveCustomClubs();
  }
  const savedClub = isOtherClub ? (matchingClub || customClub) : (selectedTag?.dataset.club || '');
  attendance[dateKey] ||= {};
  attendance[dateKey][key] = {
    ...entryFor(lecture),
    status: 'club',
    club: savedClub,
    customClub: '',
    event: event.target.querySelector('.event-input').value
  };
  saveAttendance();
  renderMonthlySummary();
  renderCatchupDays();
  renderLectures();
});

document.getElementById('catchup-note').addEventListener('click', () => {
  const list = document.getElementById('catchup-days');
  list.hidden = !list.hidden;
});

document.getElementById('catchup-days').addEventListener('click', (event) => {
  const button = event.target.closest('.catchup-day');
  if (!button) return;
  const [year, month, day] = button.dataset.date.split('-').map(Number);
  selectedDate = new Date(year, month - 1, day);
  dayLectures = getLectures(selectedDate);
  document.getElementById('catchup-days').hidden = true;
  renderHeader();
  renderLectures();
});

document.getElementById('back-today').addEventListener('click', () => {
  selectedDate = new Date(today);
  dayLectures = getLectures(selectedDate);
  renderHeader();
  renderLectures();
});

renderHeader();
renderTodayReminders();
renderLectures();
renderMonthlySummary();
renderCatchupDays();
