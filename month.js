const { timetable, clubs, attendance, normalizeClubName, getLectures, toDateKey, getMonthEntries } = window.Daybook;
const today = new Date();
let shownMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const monthTitle = document.getElementById('month-title');
const dateFormatter = new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function percent(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

function formatClubDate(date) {
  const month = new Intl.DateTimeFormat('en', { month: 'short' }).format(date).toUpperCase();
  return `${String(date.getDate()).padStart(2, '0')} ${month}`;
}

function renderHeader(counts) {
  const total = counts.present + counts.club + counts.absent;
  document.getElementById('today-date').textContent = dateFormatter.format(today);
  document.getElementById('monthly-summary').textContent = `${percent(counts.present, total)}% · ${counts.present} / ${total}`;
  document.getElementById('progress-present').style.width = total ? `${counts.present / total * 100}%` : '0%';
  document.getElementById('progress-club').style.width = total ? `${counts.club / total * 100}%` : '0%';
  document.getElementById('progress-absent').style.width = total ? `${counts.absent / total * 100}%` : '0%';
}

function getScheduledCounts(year, monthIndex) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const isCurrentMonth = year === today.getFullYear() && monthIndex === today.getMonth();
  const isFutureMonth = new Date(year, monthIndex, 1) > new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = isFutureMonth ? 0 : (isCurrentMonth ? today.getDate() : daysInMonth);
  let scheduled = 0;
  let unlogged = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, monthIndex, day);
    getLectures(date).forEach((lecture) => {
      scheduled += 1;
      const key = `${lecture.time}|${lecture.subject}`;
      if (!attendance[toDateKey(date)]?.[key]?.status) unlogged += 1;
    });
  }
  return { scheduled, unlogged };
}

function renderSubjectTable(entries) {
  const subjects = [...new Set(timetable.map((lecture) => lecture.subject))];
  const counts = Object.fromEntries(subjects.map((subject) => [subject, { present: 0, club: 0, absent: 0 }]));
  const totals = { present: 0, club: 0, absent: 0 };
  entries.forEach(({ subject, entry }) => {
    if (!counts[subject] || totals[entry.status] === undefined) return;
    counts[subject][entry.status] += 1;
    totals[entry.status] += 1;
  });
  document.getElementById('subject-rows').innerHTML = subjects.map((subject) => {
    const row = counts[subject];
    return `<tr><th scope="row">${escapeHtml(subject)}</th><td>${row.present}</td><td>${row.club}</td><td>${row.absent}</td></tr>`;
  }).join('');
  const total = totals.present + totals.club + totals.absent;
  document.getElementById('subject-total').innerHTML = `<tr><th scope="row">Total · ${total} ${total === 1 ? 'lecture' : 'lectures'}</th><td>${totals.present}</td><td>${totals.club}</td><td>${totals.absent}</td></tr>`;
  return totals;
}

function renderClubList(entries) {
  const clubEntries = entries.filter(({ entry }) => entry.status === 'club');
  const list = document.getElementById('club-missed-list');
  if (!clubEntries.length) {
    list.innerHTML = '<li class="club-missed-empty">No club lectures recorded this month.</li>';
    return clubEntries;
  }
  list.innerHTML = clubEntries.map(({ date, subject, entry }) => {
    const clubName = entry.customClub || entry.club || 'Club';
    const mainIndex = clubs.findIndex((club) => normalizeClubName(club) === normalizeClubName(clubName));
    const tagClass = mainIndex < 0 ? 'club-name-custom' : `club-name-main club-name-main-${mainIndex}`;
    const dateLabel = formatClubDate(date);
    return `<li class="club-missed-row"><time datetime="${toDateKey(date)}">${escapeHtml(dateLabel)}</time><span class="club-missed-subject">${escapeHtml(subject)}</span><span class="club-name-tag ${tagClass}">${escapeHtml(clubName)}</span></li>`;
  }).join('');
  return clubEntries;
}

function makeSummary(title, totals, clubEntries) {
  const total = totals.present + totals.club + totals.absent;
  const rows = [...new Set(timetable.map((lecture) => lecture.subject))].map((subject) => {
    const counts = totals.bySubject[subject];
    return `${subject}: P ${counts.present}, C ${counts.club}, A ${counts.absent}`;
  });
  const clubsText = clubEntries.length
    ? clubEntries.map(({ date, subject, entry }) => `${new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short' }).format(date).toUpperCase()} — ${subject} — ${entry.customClub || entry.club || 'Club'}`)
    : ['None'];
  const withClubs = percent(totals.present + totals.club, total);
  return [
    title,
    `Present: ${percent(totals.present, total)}% (${totals.present} / ${total})`,
    `Including club work: ${withClubs}% (${totals.present + totals.club} / ${total})`,
    'Subject counts:', ...rows,
    'Lectures missed for clubs:', ...clubsText
  ].join('\n');
}

async function copySummary(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const field = document.createElement('textarea');
    field.value = text;
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    document.execCommand('copy');
    field.remove();
  }
  const button = document.getElementById('copy-summary');
  button.textContent = 'Copied';
  window.setTimeout(() => { button.textContent = 'Copy summary'; }, 1600);
}

// Render saved attendance for the selected month.
function renderMonth() {
  const year = shownMonth.getFullYear();
  const monthIndex = shownMonth.getMonth();
  const title = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(shownMonth);
  monthTitle.textContent = title;
  const entries = getMonthEntries(year, monthIndex).sort((a, b) => a.date - b.date);
  const counts = { present: 0, club: 0, absent: 0 };
  entries.forEach(({ entry }) => {
    if (counts[entry.status] !== undefined) counts[entry.status] += 1;
  });
  renderHeader(counts);
  const total = counts.present + counts.club + counts.absent;
  const data = document.getElementById('month-data');
  const empty = document.getElementById('empty-month');
  data.hidden = total === 0;
  empty.hidden = total !== 0;
  if (!total) return;

  document.getElementById('present-percent').textContent = `${percent(counts.present, total)}%`;
  document.getElementById('logged-count').textContent = `${counts.present} of ${total}`;
  document.getElementById('including-club-percent').textContent = `${percent(counts.present + counts.club, total)}%`;
  document.getElementById('club-included-count').textContent = `${counts.present + counts.club} / ${total}`;
  const totals = renderSubjectTable(entries);
  const bySubject = Object.fromEntries([...new Set(timetable.map((lecture) => lecture.subject))].map((subject) => [subject, { present: 0, club: 0, absent: 0 }]));
  entries.forEach(({ subject, entry }) => {
    if (bySubject[subject] && bySubject[subject][entry.status] !== undefined) bySubject[subject][entry.status] += 1;
  });
  totals.bySubject = bySubject;
  const scheduled = getScheduledCounts(year, monthIndex);
  document.getElementById('unlogged-note').textContent = scheduled.unlogged
    ? `${scheduled.unlogged} ${scheduled.unlogged === 1 ? 'lecture is' : 'lectures are'} still unlogged and not included.`
    : '';
  const clubEntries = renderClubList(entries);
  document.getElementById('copy-summary').onclick = () => copySummary(makeSummary(title, totals, clubEntries));
}

document.getElementById('previous-month').addEventListener('click', () => {
  shownMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() - 1, 1);
  renderMonth();
});
document.getElementById('next-month').addEventListener('click', () => {
  shownMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + 1, 1);
  renderMonth();
});

renderMonth();
