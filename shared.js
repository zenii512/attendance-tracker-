// Keep timetable and browser storage shared by every page.
(() => {
  const timetable = [
    { day: 1, subject: 'Automata Theory', time: '11:00 – 12:00', teacher: 'RN', room: '' },
    { day: 1, subject: 'Environmental Science', time: '12:00 – 13:00', teacher: 'SG', room: '' },
    { day: 1, subject: 'Environmental Science Practical', time: '14:00 – 16:00', teacher: 'SG', room: '' },
    { day: 1, subject: 'Open Elective', time: '16:00 – 17:00', teacher: 'RN', room: '' },
    { day: 2, subject: 'Applied Mathematics Thinking-I', time: '11:00 – 13:00', teacher: 'SA', room: '' },
    { day: 2, subject: 'Entrepreneurship Development', time: '14:00 – 15:00', teacher: 'SZS', room: '' },
    { day: 2, subject: 'Advanced Data Structures & Analysis', time: '16:00 – 17:00', teacher: 'SMG', room: '' },
    { day: 3, subject: 'ADSA Lab', time: '09:00 – 11:00', teacher: 'SMG', room: 'DB' },
    { day: 3, subject: 'Automata Theory', time: '11:00 – 12:00', teacher: 'RN', room: '' },
    { day: 3, subject: 'DBMS', time: '12:00 – 13:00', teacher: 'SS', room: '' },
    { day: 3, subject: 'Full Stack Java Project', time: '14:00 – 16:00', teacher: 'SZS', room: '' },
    { day: 3, subject: 'Open Elective', time: '16:00 – 17:00', teacher: 'RN', room: '' },
    { day: 4, subject: 'Mini Project', time: '09:00 – 11:00', teacher: 'SZS', room: 'SE' },
    { day: 4, subject: 'Automata Theory', time: '11:00 – 12:00', teacher: 'RN', room: '' },
    { day: 4, subject: 'Advanced Data Structures & Analysis', time: '12:00 – 13:00', teacher: 'SMG', room: '' },
    { day: 4, subject: 'Entrepreneurship Development Practical', time: '14:00 – 16:00', teacher: 'SZS', room: '' },
    { day: 5, subject: 'SQL Lab', time: '09:00 – 11:00', teacher: 'SS', room: 'PL' },
    { day: 5, subject: 'Advanced Data Structures & Analysis', time: '11:00 – 12:00', teacher: 'SMG', room: '' },
    { day: 5, subject: 'Environmental Science', time: '12:00 – 13:00', teacher: 'SG', room: '' },
    { day: 5, subject: 'DBMS', time: '14:00 – 16:00', teacher: 'SMG', room: '' },
    { day: 5, subject: 'Applied Mathematics Thinking-I Tutorial', time: '16:00 – 17:00', teacher: 'PN', room: '' }
  ];
  const clubs = ['AWS', 'ACM', 'Oracle'];
  const attendanceKey = 'daybook-attendance-v1';
  const customClubsKey = 'daybook-custom-clubs';
  const eventsKey = 'daybook-events-v1';
  const notesKey = 'daybook-notes-v1';

  function loadAttendance() {
    try {
      const saved = JSON.parse(localStorage.getItem(attendanceKey) || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch {
      return {};
    }
  }

  function loadCustomClubs() {
    try {
      const current = localStorage.getItem(customClubsKey);
      const legacy = localStorage.getItem('daybook-custom-clubs-v1');
      const saved = JSON.parse(current || legacy || '[]');
      const names = Array.isArray(saved) ? saved.filter((name) => typeof name === 'string') : [];
      if (!current && legacy) localStorage.setItem(customClubsKey, JSON.stringify(names));
      return names;
    } catch {
      return [];
    }
  }

  function loadEvents() {
    try {
      const saved = JSON.parse(localStorage.getItem(eventsKey) || '[]');
      return Array.isArray(saved) ? saved.filter((event) => event && typeof event === 'object') : [];
    } catch {
      return [];
    }
  }

  function loadNotes() {
    try {
      const saved = JSON.parse(localStorage.getItem(notesKey) || '[]');
      return Array.isArray(saved) ? saved.filter((note) => note && typeof note === 'object') : [];
    } catch {
      return [];
    }
  }

  const attendance = loadAttendance();
  const customClubs = loadCustomClubs();
  const events = loadEvents();
  const notes = loadNotes();

  function saveAttendance() {
    localStorage.setItem(attendanceKey, JSON.stringify(attendance));
  }

  function saveCustomClubs() {
    localStorage.setItem(customClubsKey, JSON.stringify(customClubs));
  }

  function saveEvents() {
    localStorage.setItem(eventsKey, JSON.stringify(events));
  }

  function saveNotes() {
    localStorage.setItem(notesKey, JSON.stringify(notes));
  }

  function getMonthlyAttendanceCounts(date = new Date()) {
    const prefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-`;
    const counts = { present: 0, club: 0, absent: 0 };
    Object.entries(attendance).forEach(([savedDate, entries]) => {
      if (!savedDate.startsWith(prefix)) return;
      Object.values(entries || {}).forEach((entry) => {
        if (counts[entry.status] !== undefined) counts[entry.status] += 1;
      });
    });
    return counts;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function linkifyText(text) {
    const safe = escapeHtml(text || '');
    return safe
      .replace(/(https?:\/\/[^\s<]+|www\.[^\s<]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<]*)?)/gi, (url) => {
        const ending = url.match(/[.,!?;:)\]]+$/)?.[0] || '';
        const linkText = ending ? url.slice(0, -ending.length) : url;
        const href = /^(https?:\/\/)/i.test(linkText) ? linkText : `https://${linkText}`;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${linkText}</a>${ending}`;
      })
      .replace(/\r?\n/g, '<br>');
  }

  function normalizeClubName(name) {
    return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  function toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getLectures(date) {
    return timetable.filter((lecture) => lecture.day === date.getDay());
  }

  function getMonthEntries(year, monthIndex) {
    const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
    const lectures = [];
    Object.entries(attendance).forEach(([dateKey, entries]) => {
      if (!dateKey.startsWith(prefix)) return;
      Object.entries(entries || {}).forEach(([key, entry]) => {
        if (!entry?.status) return;
        const [time, ...subjectParts] = key.split('|');
        const subject = subjectParts.join('|');
        const dateParts = dateKey.split('-').map(Number);
        lectures.push({
          dateKey,
          date: new Date(dateParts[0], dateParts[1] - 1, dateParts[2]),
          time,
          subject,
          entry
        });
      });
    });
    return lectures;
  }

  window.Daybook = {
    timetable,
    clubs,
    attendance,
    customClubs,
    events,
    notes,
    loadAttendance,
    loadCustomClubs,
    saveAttendance,
    saveCustomClubs,
    saveEvents,
    saveNotes,
    getMonthlyAttendanceCounts,
    escapeHtml,
    linkifyText,
    normalizeClubName,
    toDateKey,
    getLectures,
    getMonthEntries
  };
})();
