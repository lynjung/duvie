const screen = document.querySelector('#screen');
const localPartners = ['Lyn', 'Edison'];
const partners = () => sync ? state.spaceMembers : localPartners;
const habits = ['Wake by 7 a.m.', 'Work out', 'Share morning schedule', 'Phone-free first 30 minutes', 'Read 30 minutes', 'Sleep at least 7 hours', 'Reflect or journal', 'Work on career goal'];
const goals = ['Our one-year plan', 'Retire by 30'];
const key = 'duvie-v1';
const sync = window.duvieSync;
const nav = document.querySelector('.tab-bar');
const syncMessage = document.createElement('p');
syncMessage.className = 'sync-message';
syncMessage.setAttribute('role', 'status');
syncMessage.hidden = true;
screen.before(syncMessage);
let member = null;
let sessionId;
let sessionEmail = '';
let authView = 'sign-in';
let authEmail = '';
let authBusy = false;
let onboardingMode = 'create-space';
let onboardingName = '';
let coupleCode = '';
let connection = sync ? 'loading' : 'local';
let connectionVersion = 0;
let saving = false;
let refreshing = false;
const state = { events: [], logs: {}, answers: {}, milestones: [[], []], spaceMembers: [], profilePhotos: {}, planStart: '2026-11-08' };
if (!sync) Object.assign(state, JSON.parse(localStorage.getItem(key) || '{}'));

const localDate = (date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()]
  .map((part) => String(part).padStart(2, '0')).join('-');
const offset = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const monday = (date) => offset(date, -((date.getDay() + 6) % 7));
const week = () => localDate(monday(new Date()));
const today = () => localDate(new Date());
const longDate = (date) => new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const save = () => {
  if (!sync) localStorage.setItem(key, JSON.stringify(state));
};
const canEdit = (partner) => !sync || member?.name === partner;

function report(message) {
  syncMessage.textContent = message;
  syncMessage.hidden = !message;
}

async function storeChange(table, action, values, id) {
  if (!sync) return true;
  if (connection !== 'ready' || saving || refreshing) return false;
  const version = connectionVersion;
  saving = true;
  nav.inert = true;
  screen.inert = true;
  report('Saving…');
  try {
    await sync.write(table, action, {...values, space_id: member.space_id}, id);
    if (connectionVersion !== version) return false;
    report('');
    return true;
  } catch {
    if (connectionVersion === version) report('Could not confirm the save. Go to Profile → Settings → Troubleshooting to refresh, then try again.');
    return false;
  } finally {
    saving = false;
    nav.inert = false;
    screen.inert = false;
  }
}
const plannerModes = ['Month', 'Week', 'Day'];
let plannerMode = 'Week';
let plannerDate = today();
let routineDate = today();
let page = 'nook';
let editing = null;
let goal = 0;
let answerAuthor = null;
let profilePartner = null;
let draftPhoto = null;
const routineLog = (day, partner) => Object.hasOwn(state.logs[day] ?? {}, partner) ? state.logs[day][partner] : {};
function countRoutines(day, partner) {
  const log = routineLog(day, partner);
  return habits.reduce((count, _, index) => count + Number(Boolean(log[index])), 0);
}
const percentage = (done, due) => Math.round(done * 100 / due);
const currentAnswers = () => Object.assign(Object.create(null), state.answers[week()]);
const hasSharedAnswers = (answers) => partners().length === 2 && partners().every((partner) => Object.hasOwn(answers, partner));
const time = (value) => new Date('2000-01-01T' + value).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
function pageHeading(title, { parent, subtitle } = {}) {
  return `<div class="page-heading">
    ${parent ? `<button class="back" data-go="${parent.toLowerCase()}"><span aria-hidden="true">←</span> ${parent}</button>` : ''}
    <h1>${title}</h1>
    ${subtitle ? `<p class="muted">${subtitle}</p>` : ''}
  </div>`;
}

function dailyCommitment(day = routineDate) {
  if (day > today()) return 'Routines open on this day.';
  const done = partners().reduce((total, partner) => total + countRoutines(day, partner), 0);
  const due = habits.length * partners().length;
  return `${done} of ${due} routines · ${percentage(done, due)}%`;
}

function routineTable() {
  const future = routineDate > today();
  return `<section class="panel">
    <h2 id="routine-title">Daily routines</h2>
    <table class="routine-table" aria-labelledby="routine-title">
      <thead><tr><th scope="col">Routine</th>${partners().map((partner) => `<th scope="col">${esc(partner)}</th>`).join('')}</tr></thead>
      <tbody>${habits.map((habit, index) => `<tr><th scope="row">${habit}</th>
        ${partners().map((partner) => `<td><label class="routine-toggle">
          <input type="checkbox" data-habit="${index}" data-partner="${esc(partner)}" aria-label="${esc(partner)}: ${habit}"
            ${routineLog(routineDate, partner)[index] ? 'checked' : ''} ${future || !canEdit(partner) ? 'disabled' : ''}>
        </label></td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    <p class="routine-total" role="status"><strong>Together</strong> <span id="daily-commitment">${dailyCommitment()}</span></p>
  </section>`;
}

function dayEvents(day) {
  return state.events.filter((event) => event.date === day)
    .sort((a, b) => a.start.localeCompare(b.start));
}

function plannerDays(start, length) {
  return Array.from({length}, (_, index) => offset(start, index));
}

function plannerPeriod(selected, days) {
  const monthDay = (day) => day.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
  if (plannerMode === 'Month') return selected.toLocaleDateString(undefined, {month: 'long', year: 'numeric'});
  if (plannerMode === 'Day') return longDate(plannerDate);
  return `${monthDay(days[0])} – ${monthDay(days[6])}`;
}

function shiftPlanner(direction) {
  const selected = new Date(plannerDate + 'T12:00:00');
  if (plannerMode === 'Month') {
    const year = selected.getFullYear();
    const month = selected.getMonth() + direction;
    const lastDay = new Date(year, month + 1, 0).getDate();
    plannerDate = localDate(new Date(year, month, Math.min(selected.getDate(), lastDay)));
  } else {
    plannerDate = localDate(offset(selected, direction * (plannerMode === 'Week' ? 7 : 1)));
  }
}

function plannerCalendar(days, currentMonth) {
  if (plannerMode === 'Day') return '';
  const fullMonth = plannerMode === 'Month';
  const now = today();
  const headers = fullMonth ? days.slice(0, 7).map((day) => {
    const name = day.toLocaleDateString(undefined, {weekday: 'short'});
    return `<span class="day-name">${name}</span>`;
  }).join('') : '';
  const cells = days.map((day) => {
    const value = localDate(day);
    const count = dayEvents(value).length;
    const current = value === now;
    const label = `${longDate(value)}, ${count} ${count === 1 ? 'event' : 'events'}`;
    return `<button data-date="${value}" aria-label="${label}" aria-pressed="${value === plannerDate}"
      ${current ? 'aria-current="date"' : ''} class="${day.getMonth() === currentMonth || !fullMonth ? '' : 'other-month'}">
      ${fullMonth ? '' : `<span class="day-name">${day.toLocaleDateString(undefined, {weekday: 'short'})}</span>`}
      <span class="day-number">${day.getDate()}</span>
      <span class="calendar-dot${count ? ' has-events' : ''}" aria-hidden="true"></span>
    </button>`;
  }).join('');
  return `<div class="week${fullMonth ? ' month' : ''}" role="group" aria-label="Select a day">${headers}${cells}</div>`;
}

function eventRows(events) {
  return `<div class="event-list">${events.map((event) => `<div class="row event">
    <time class="muted" datetime="${esc(event.start)}">${time(event.start)}</time>
    <span>${esc(event.title)}<small>${esc(event.owner)}${event.end ? ' · until ' + time(event.end) : ''}</small></span>
    <button data-edit="${esc(event.id)}" aria-label="Edit ${esc(event.title)}">Edit</button>
  </div>`).join('')}</div>`;
}

function plannerView() {
  const selected = new Date(plannerDate + 'T12:00:00');
  const year = selected.getFullYear();
  const month = selected.getMonth();
  const weekDays = plannerDays(monday(selected), 7);
  const first = new Date(year, month, 1);
  const leadingDays = (first.getDay() + 6) % 7;
  const monthLength = new Date(year, month + 1, 0).getDate();
  const calendarDays = plannerMode === 'Month'
    ? plannerDays(monday(first), Math.ceil((leadingDays + monthLength) / 7) * 7)
    : weekDays;
  const weekly = plannerMode === 'Week';
  const agenda = (weekly ? weekDays.map(localDate) : [plannerDate])
    .map((day) => ({ day, events: dayEvents(day) })).filter(({events}) => events.length);
  return `${pageHeading('Planner')}
    <div class="planner-modes" role="group" aria-label="Calendar view">
      ${plannerModes.map((mode) => `<button data-mode="${mode}" aria-pressed="${mode === plannerMode}">${mode}</button>`).join('')}
    </div>
    <div class="panel calendar">
      <div class="calendar-controls planner-controls" role="group" aria-label="Browse calendar">
        <button data-period="-1" aria-label="Previous ${plannerMode.toLowerCase()}">←</button>
        <p>${plannerPeriod(selected, weekDays)}</p>
        <button data-planner-today>Today</button>
        <button data-period="1" aria-label="Next ${plannerMode.toLowerCase()}">→</button>
      </div>
      ${plannerCalendar(calendarDays, month)}
    </div>
    <section class="panel">
      <div class="heading"><h2>${weekly ? 'Week’s events' : longDate(plannerDate)}</h2>
        <button class="action" data-go="event" aria-label="Add event for ${longDate(plannerDate)}">+ Add event</button>
      </div>
      ${agenda.length ? agenda.map(({day, events}) => `<div class="agenda-day">
        ${weekly ? `<h3>${longDate(day)}</h3>` : ''}
        ${eventRows(events)}
      </div>`).join('') : `<p class="muted">Nothing scheduled for this ${weekly ? 'week' : 'day'}.</p>`}
    </section>`;
}

function routinesView() {
  return `${pageHeading('Routines', { parent: 'Goals', subtitle: longDate(routineDate) })}
    <div class="panel calendar">
      <div class="row calendar-controls" role="group" aria-label="Choose a routine date">
        <button data-routine-shift="-1" aria-label="Previous day">←</button>
        <label class="visually-hidden" for="routine-date">Routine date</label>
        <input id="routine-date" type="date" value="${routineDate}">
        <button data-routine-shift="1" aria-label="Next day">→</button>
      </div>
    </div>
    ${routineTable()}`;
}

function eventView() {
  const event = state.events.find(({id}) => id === editing);
  return `${pageHeading(event ? 'Edit event' : 'Add event', { parent: 'Planner', subtitle: longDate(plannerDate) })}
  <div class="panel">
  <form id="event"><label>Event<input name="title" required maxlength="90" value="${esc(event?.title || '')}" placeholder="Dinner together"></label>
  <div class="times"><label>Starts<input name="start" type="time" required value="${event?.start || ''}"></label><label><span>Ends <small>optional</small></span><input name="end" type="time" value="${event?.end || ''}"></label></div>
  <label>For<select name="owner" required>
    <option value="" disabled ${event ? '' : 'selected'}>Choose who this is for</option>
    ${[...partners(), 'Together'].map((owner) => `<option ${owner === event?.owner ? 'selected' : ''}>${esc(owner)}</option>`).join('')}
  </select></label>
  <button class="primary">Save event</button><p class="error" role="alert" id="error"></p></form>
  ${event ? '<button class="danger" data-delete>Delete event</button>' : ''}
  </div>`;
}

function nookView() {
  const count = Object.values(state.answers).filter((answers) => hasSharedAnswers(answers)).length;
  const day = today();
  const events = dayEvents(day);
  return `${pageHeading('Nook', { subtitle: longDate(day) })}
  <section class="panel">
    <div class="heading"><h2>Today’s schedule</h2><button class="action" data-go="planner">Open planner</button></div>
    ${events.length ? `<div class="event-list">${events.slice(0, 2).map((event) => `<div class="row event schedule-preview">
      <time class="muted" datetime="${esc(event.start)}">${time(event.start)}</time>
      <span>${esc(event.title)}<small>${esc(event.owner)}</small></span>
    </div>`).join('')}</div>` : '<p class="muted">Nothing on the schedule today.</p>'}
    ${events.length > 2 ? `<p class="muted schedule-more">+${events.length - 2} more on the schedule</p>` : ''}
  </section>
  <section class="panel nook-pet"><button class="pet${count ? " learned" : ""}" data-pat><img src="nook-otter.png" alt="Otter floating with a stone">Tap to say hi</button>
  <p class="muted" id="pet-note" aria-live="polite">${count ? `${count} shared check-in${count === 1 ? '' : 's'} · Stone trick learned` : 'Finish a check-in together to teach your otter a stone trick.'}</p></section>
  <section class="panel"><h2>Weekly check-in</h2><div class="row"><span>What helped us this week?</span><button class="action" data-go="checkin">Open</button></div></section>`;
}

function checkinView() {
  const answers = currentAnswers();
  const shared = hasSharedAnswers(answers);
  return `${pageHeading('Weekly check-in', { parent: 'Nook' })}
    <section class="panel"><h2>What helped us this week?</h2>
    <p class="muted">${shared ? 'You’ve both answered.' : 'Answers appear here once both of you have shared.'}</p>
    ${partners().map((partner) => `<div class="checkin-person"><div class="row">
      <strong>${esc(partner)}</strong>
      ${canEdit(partner) ? `<button data-answer-for="${esc(partner)}" aria-label="${answers[partner] ? 'Edit' : 'Write'} ${esc(partner)}’s answer">${answers[partner] ? 'Edit answer' : 'Write answer'}</button>` : ''}
    </div>
    ${shared ? `<p class="checkin-answer">${esc(answers[partner])}</p>` : (answers[partner] ? '<p class="muted">Answer shared</p>' : '')}
    ${answerAuthor === partner ? `<form id="checkin" data-author="${esc(partner)}">
      <label>${esc(partner)}’s answer<textarea name="answer" required rows="5" maxlength="1500">${esc(answers[partner] || '')}</textarea></label>
      <button class="primary">${answers[partner] ? 'Update answer' : 'Share answer'}</button>
      <p class="error" role="alert" id="error"></p>
    </form>` : ''}</div>`).join('')}</section>`;
}

function planEnd() {
  const day = new Date(state.planStart + 'T12:00:00');
  const year = day.getFullYear() + 1;
  const month = day.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return localDate(new Date(year, month, Math.min(day.getDate(), lastDay)));
}

function planDate(value) {
  return new Date(value + 'T12:00:00').toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'});
}

function progressView() {
  const first = state.planStart;
  const last = planEnd();
  const end = [today(), localDate(offset(new Date(last + 'T12:00:00'), 1))].sort()[0];
  const days = Math.max(0, (Date.parse(end) - Date.parse(first)) / 86400000);
  if (!days) return '<p class="muted">Progress starts after the first day of the plan.</p>';

  const scoredDays = Object.keys(state.logs).filter((day) => day >= first && day < end);
  const due = days * habits.length;
  const scores = partners().map((partner) => scoredDays.reduce((total, day) => total + countRoutines(day, partner), 0));
  const combined = scores.reduce((total, score) => total + score, 0);
  return `<dl class="commitment-scores">
    ${partners().map((partner, index) => `<div><dt>${esc(partner)}</dt><dd>${percentage(scores[index], due)}%</dd></div>`).join('')}
    <div><dt>Together</dt><dd>${percentage(combined, due * partners().length)}%</dd></div>
  </dl>`;
}

function goalView() {
  const milestones = state.milestones[goal];
  const completeCount = milestones.filter((item) => item.done).length;
  const plant = `<span class="plant" role="img" aria-label="${completeCount} milestones complete">${completeCount ? '✿' : '♧'}</span>`;
  return `${pageHeading(goals[goal] + ' ' + plant, {
    parent: 'Goals',
    subtitle: goal === 0 ? `Through ${planDate(planEnd())} · Target over 90%` : ''
  })}
  ${goal === 0 ? `<section class="panel"><h2>Habit progress</h2><p class="muted">All routines due from ${planDate(state.planStart)} through yesterday, up to the end of the plan.</p>${progressView()}</section>` : ''}
  <section class="panel"><h2>Next milestones</h2>
    ${milestones.map((item, i) => item.done ? '' : `<div class="row milestone">
      <span>${esc(item.title)}</span><button data-complete="${i}">Mark complete</button>
    </div>`).join('')}
    <form id="milestone">
      <label>Add a milestone<input name="title" required maxlength="140" placeholder="${goal === 1 ? 'Define retirement together' : 'Choose a shared next step'}"></label>
      <button class="primary">Add milestone</button><p class="error" role="alert" id="error"></p>
    </form>
  </section>
  <section class="panel"><h2>Milestone history</h2>
    ${completeCount ? milestones.map((item, i) => item.done ? `<div class="row milestone">
      <span>${esc(item.title)} <small>· ${longDate(item.done)}</small></span>
      <button data-complete="${i}">Undo</button>
    </div>` : '').join('') : '<p class="muted">Completed milestones will appear here.</p>'}
  </section>`;
}

function goalsView() {
  return `${pageHeading('Goals')}
    <section class="panel">
      <div class="heading"><div><h2>Daily routines</h2><p class="muted">Today · ${dailyCommitment(today())}</p></div>
        <button class="action" data-go="routines">Log routines</button>
      </div>
    </section>
    <section class="panel"><h2>Our one-year plan</h2><p>Target · over 90%</p>
      <p class="muted">Commitment through yesterday</p>${progressView()}
      <button class="action" data-goal="0">Open plan</button>
    </section>
    <section class="panel"><h2>Retire by 30</h2>
      <p class="muted goal-summary">${esc(state.milestones[1].find((item) => !item.done)?.title || 'Choose your next milestone together.')}</p>
      <button class="action" data-goal="1">Open goal</button>
    </section>`;
}

const photoFormat = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;

function profileAvatar(name, photo = state.profilePhotos[name]) {
  const image = photo && photoFormat.test(photo);
  return `<div class="profile-avatar" aria-hidden="true">
    ${image ? `<img src="${esc(photo)}" alt="">` : esc(name.charAt(0))}
  </div>`;
}

function profileView() {
  const people = partners();
  return `<div class="heading profile-heading">
    ${pageHeading('Profile')}
    <button class="profile-settings" data-go="settings" aria-label="Settings">
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
        <path d="M10 3h4l.6 2.4 2 .9 2.2-1.2 2.1 3.5-1.8 1.8v2.4l1.8 1.8-2.1 3.5-2.2-1.1-2 .9L14 21h-4l-.6-2.4-2-.9-2.2 1.1L3 15.3l1.8-1.8v-2.4L3 9.3l2.2-3.5 2.2 1.2 2-.9Z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </button>
  </div>
  <section class="panel couple-profile">
    <div class="couple-portraits">
      ${people.map((name) => `<div class="couple-person">
        ${profileAvatar(name)}
        <h2>${esc(name)}</h2>
        ${member?.name === name ? '<p class="muted">You</p>' : ''}
      </div>`).join('<span class="couple-heart" aria-hidden="true">♡</span>')}
    </div>
    <div class="profile-actions">
      ${people.filter(canEdit).map((name) => `<button class="action" data-profile-for="${esc(name)}">${sync ? 'Edit your profile' : 'Edit ' + esc(name) + '’s photo'}</button>`).join('')}
    </div>
  </section>
  ${sync ? `<button class="panel profile-link" data-go="couple">
    <span><strong>Couple connection</strong><small>${people.length === 2 ? 'Connected' : 'Waiting for your partner'}</small></span>
    <span class="profile-chevron" aria-hidden="true">›</span>
  </button>` : '<p class="muted profile-local">Profiles are saved in this browser.</p>'}`;
}

function settingsView() {
  return `${pageHeading('Settings', {parent: 'Profile'})}
    <section class="panel">
      <h2>Nook</h2>
      <label class="row setting-toggle"><span>Animate the otter</span>
        <input type="checkbox" id="otter-animation" ${animationsEnabled() ? 'checked' : ''}>
      </label>
    </section>
    ${sync ? `<section class="panel settings-account">
      <h2>Account</h2>
      <p class="muted">Signed in as ${esc(member.name)}</p>
      <button class="profile-link" data-go="couple">
        <span>Couple connection</span><span class="profile-chevron" aria-hidden="true">›</span>
      </button>
      <button class="profile-link" data-go="troubleshooting">
        <span>Troubleshooting</span><span class="profile-chevron" aria-hidden="true">›</span>
      </button>
      <button class="profile-link" data-go="password">
        <span>Set or change password</span><span class="profile-chevron" aria-hidden="true">›</span>
      </button>
      <button class="profile-link" data-sign-out>Sign out</button>
    </section>` : ''}`;
}

function coupleView() {
  const partner = state.spaceMembers.find((name) => name !== member.name);
  return `${pageHeading('Couple connection', {parent: 'Profile'})}
    <section class="panel"><h2>${partner ? 'Connected' : 'Waiting for your partner'}</h2>
      <p class="muted">${partner ? `You and ${esc(partner)} share this Duvie space.` : 'Ask your partner to create an account and enter a couple code.'}</p>
      ${partner ? '' : `<button class="action" data-couple-code>${coupleCode ? 'Generate a new code' : 'Get a couple code'}</button>
        ${coupleCode ? `<label class="couple-code">Couple code<input readonly value="${esc(coupleCode)}" aria-describedby="couple-code-help"></label>
          <button data-copy-couple-code>Copy code</button><p class="muted" id="couple-code-help">Share privately with your partner. The code can be used once and expires in 24 hours.</p>` : ''}`}
    </section>`;
}

function troubleshootingView() {
  return `${pageHeading('Troubleshooting', {parent: 'Settings'})}
    <section class="panel">
      <p>Use this if a photo, routine, or event is missing.</p>
      <button class="profile-link" data-refresh>Refresh shared data</button>
    </section>`;
}

function editProfileView() {
  const photo = state.profilePhotos[profilePartner];
  return `${pageHeading('Edit profile', {parent: 'Profile'})}
    <section class="panel edit-profile">
      ${profileAvatar(profilePartner)}
      <h2>${esc(profilePartner)}</h2>
      <form id="profile-photo">
        <label class="action photo-picker">Choose photo
          <input type="file" name="photo" accept="image/*" aria-describedby="photo-help">
        </label>
        <p class="muted" id="photo-help">${sync ? 'Your partner can see this photo.' : 'This photo stays in this browser.'}</p>
        <p class="error" id="photo-error" role="alert"></p>
        <div class="profile-actions">
          <button class="primary" name="action" value="save" disabled>Save photo</button>
          ${photo ? '<button name="action" value="remove">Remove photo</button>' : ''}
        </div>
      </form>
    </section>`;
}

async function makeProfilePhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fbf7ef';
    context.fillRect(0, 0, 256, 256);
    context.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 256, 256);
    const photo = canvas.toDataURL('image/jpeg', 0.82);
    if (!photoFormat.test(photo) || photo.length > 131072) throw new Error('Photo could not be prepared.');
    return photo;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const views = {
  nook: nookView, planner: plannerView, event: eventView, checkin: checkinView,
  routines: routinesView, goals: goalsView, goal: goalView, profile: profileView,
  settings: settingsView, couple: coupleView, troubleshooting: troubleshootingView, 'edit-profile': editProfileView, password: () => passwordView(false)
};

function passwordView(fromLink) {
  return `${pageHeading(fromLink ? 'Set your password' : 'Set or change password', fromLink ? {} : {parent: 'Settings'})}
    <div class="panel">
      <form id="set-password" method="post">
        <label>Email<input type="email" name="email" autocomplete="username" value="${esc(sessionEmail)}" readonly></label>
        <label>New password<input type="password" name="password" autocomplete="new-password" minlength="12" maxlength="72" required></label>
        <label>Confirm password<input type="password" name="confirmation" autocomplete="new-password" minlength="12" maxlength="72" required></label>
        <p class="muted">Use at least 12 characters.</p>
        <button class="primary">Save password</button>
      </form>
      ${fromLink ? '<button class="auth-option" data-skip-password>Skip for now</button>' : ''}
    </div>`;
}

function onboardingView() {
  const joining = onboardingMode === 'join-space';
  return `${pageHeading(joining ? 'Join your partner' : 'Set up your space')}
    <div class="panel">
      <form id="space-setup" method="post">
        <label>Your name<input name="displayName" autocomplete="given-name" maxlength="30" value="${esc(onboardingName)}" required></label>
        ${joining ? '<label>Couple code<input name="coupleCode" autocapitalize="none" spellcheck="false" required></label>' : ''}
        <button class="primary">${joining ? 'Join space' : 'Create a space'}</button>
      </form>
      <div class="auth-options">
        <button data-onboarding-mode="${joining ? 'create-space' : 'join-space'}">${joining ? 'Create my own space' : 'I have a couple code'}</button>
        <button data-sign-out>Sign out</button>
      </div>
    </div>`;
}

function connectionView() {
  if (connection === 'loading') return '<h1>Connecting to Duvie…</h1>';
  if (connection === 'error') return '<h1>Connection unavailable</h1><p>Refresh to try again.</p>';
  if (connection === 'unlinked') return onboardingView();
  if (connection === 'password-setup') return passwordView(true);
  if (authView === 'confirm-email') {
    return `${pageHeading('Check your email')}
      <section class="panel">
        <p>Open the confirmation link sent to <strong>${esc(authEmail)}</strong>, to finish creating your account.</p>
        <button class="auth-option" data-auth-view="sign-in">Back to sign in</button>
      </section>`;
  }

  const passwordSignIn = authView === 'sign-in';
  const creating = authView === 'create-account';
  const title = passwordSignIn ? 'Sign in' : creating ? 'Create account' : 'Reset password';
  const submit = passwordSignIn || creating ? title : 'Send reset link';
  return `${pageHeading(title)}
    <div class="panel">
      <form id="${authView}" method="post">
        <label>Email address<input type="email" name="email" autocomplete="username" autocapitalize="none" value="${esc(authEmail)}" required></label>
        ${passwordSignIn ? '<label>Password<input type="password" name="password" autocomplete="current-password" required></label>' : ''}
        ${creating ? '<label>Password<input type="password" name="password" autocomplete="new-password" minlength="12" maxlength="72" aria-describedby="signup-password-help" required></label><p class="muted" id="signup-password-help">Use at least 12 characters.</p>' : ''}
        <button class="primary">${submit}</button>
      </form>
      ${passwordSignIn ? `<div class="auth-options">
        <button data-auth-view="password-link">Forgot password?</button>
        <button data-auth-view="create-account">Create account</button>
      </div>` : '<button class="auth-option" data-auth-view="sign-in">Back to sign in</button>'}
    </div>`;
}

function render() {
  nav.hidden = Boolean(sync && connection !== 'ready');
  screen.innerHTML = nav.hidden ? connectionView() : views[page]();
  const parent = {event: 'planner', checkin: 'nook', routines: 'goals', goal: 'goals',
    settings: 'profile', couple: 'profile', troubleshooting: 'profile', 'edit-profile': 'profile', password: 'profile'}[page] || page;
  document.querySelectorAll('nav button').forEach((button) => {
    if (button.dataset.page === parent) button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  });
}

function animationKey() {
  return 'duvie-animation-' + member.user_id;
}

function animationsEnabled() {
  return sync ? localStorage.getItem(animationKey()) !== 'false' : state.otterAnimations !== false;
}

async function showSession(session, {setupPassword = false, continueSetup = false} = {}) {
  const nextId = session?.user?.id || null;
  if (nextId === sessionId && !setupPassword && !continueSetup) return;
  sessionId = nextId;
  sessionEmail = session?.user?.email ?? '';
  onboardingMode = 'create-space';
  onboardingName = '';
  coupleCode = '';
  const version = ++connectionVersion;
  member = null;
  profilePartner = null;
  draftPhoto = null;
  state.profilePhotos = {};
  state.spaceMembers = [];
  connection = session ? (setupPassword ? 'password-setup' : 'loading') : 'sign-in';
  authView = 'sign-in';
  authEmail = '';
  page = 'nook';
  editing = null;
  answerAuthor = null;
  render();
  report('');
  if (!session || setupPassword) return;

  try {
    const identity = await sync.member(nextId);
    const shared = identity && await sync.load(identity.space_id);
    if (version !== connectionVersion) return;
    if (identity) {
      member = identity;
      Object.assign(state, shared);
    }
    connection = identity ? 'ready' : 'unlinked';
  } catch {
    if (version !== connectionVersion) return;
    connection = 'error';
  }
  render();
}

async function finishPasswordSetup() {
  try {
    await showSession(await sync.getSession(), {continueSetup: true});
  } catch {
    report('Could not finish signing in. Reload Duvie to try again.');
  }
}

async function submitAuth(form, data, submit) {
  if (authBusy) return;
  const id = form.id;
  const email = data.email.trim();
  const password = data.password;
  if (id === 'set-password' || id === 'create-account') {
    if (id === 'set-password' && password !== data.confirmation) return report('The passwords don’t match.');
    if (password.length < 12 || new TextEncoder().encode(password).length > 72) {
      return report('Use 12 to 72 characters. Some symbols and emoji take more space.');
    }
  }

  authBusy = true;
  screen.inert = true;
  nav.inert = true;
  const version = connectionVersion;
  const wasSetup = connection === 'password-setup';
  try {
    if (id === 'sign-in') {
      report('Signing in…');
      const session = await sync.signIn(email, password);
      // Safari can offer to save or autofill credentials from the password form.
      await showSession(session);
    } else if (id === 'create-account') {
      report('Creating your account…');
      const result = await sync.signUp(email, password);
      if (version !== connectionVersion) return;
      if (result.session) await showSession(result.session);
      else {
        authEmail = email;
        authView = result.user?.identities?.length === 0 ? 'sign-in' : 'confirm-email';
        render();
        report(authView === 'sign-in' ? 'Try signing in, or use Forgot password to recover your account.' : '');
      }
    } else if (id === 'set-password') {
      report('Saving password…');
      await sync.updatePassword(password);
      form.reset();
      if (version !== connectionVersion) return;
      if (wasSetup) await finishPasswordSetup();
      else {
        page = 'settings';
        render();
      }
      if (connection === 'ready') report('Password saved.');
    } else {
      report('Sending email…');
      await sync.sendPasswordLink(email);
      if (version === connectionVersion) {
        report('If this email can receive Duvie links, one should arrive shortly. Open it in Safari.');
      }
    }
  } catch (error) {
    if (version !== connectionVersion) return;
    const code = error?.code;
    if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
      report('Too many attempts. Wait a little, then try again.');
    } else if (code === 'email_address_not_authorized') {
      report('Duvie couldn’t send an email to this address. Please try again later.');
    } else if (id === 'sign-in') {
      report(code === 'invalid_credentials' || code === 'email_not_confirmed'
        ? 'Couldn’t sign in. Check your email and password, or use Forgot password.'
        : 'Couldn’t connect to sign in. Try again in a moment.');
    } else if (id === 'create-account') {
      if (code === 'user_already_exists' || code === 'email_exists') {
        authEmail = email;
        authView = 'sign-in';
        render();
        report('Try signing in, or use Forgot password to recover your account.');
      } else if (code === 'weak_password') {
        report('Choose a stronger password.');
      } else {
        report('Couldn’t create your account. Check your email and try again.');
      }
    } else if (id === 'set-password') {
      if (code === 'reauthentication_needed' || code === 'session_not_found') {
        report('Duvie needs a fresh sign-in. Sign out, then use Forgot password.');
      } else if (code === 'weak_password' || code === 'same_password') {
        report('Choose a stronger password you haven’t used for Duvie before.');
      } else {
        report('Couldn’t save your password. Try again in a moment.');
      }
    } else {
      report('Couldn’t send the email. Check your address and try again.');
    }
  } finally {
    authBusy = false;
    screen.inert = false;
    nav.inert = false;
    if (screen.contains(form)) submit.focus({preventScroll: true});
  }
}

async function submitSpace(form) {
  if (connection !== 'unlinked' || authBusy) return;
  const data = new FormData(form);
  const name = data.get('displayName').trim();
  const code = data.get('coupleCode')?.replace(/[\s-]/g, '').toLowerCase() ?? null;
  if (!name || name.toLowerCase() === 'together') return report('Choose a name to display in Duvie.');
  if (code !== null && !/^[a-f0-9]{32}$/.test(code)) return report('Enter the full couple code from your partner.');
  authBusy = true;
  screen.inert = true;
  const version = connectionVersion;
  try {
    report(code ? 'Joining your partner…' : 'Creating your space…');
    const session = await sync.getSession();
    if (!session || version !== connectionVersion) return;
    await sync.onboard(name, code);
    if (version === connectionVersion) await showSession(session, {continueSetup: true});
  } catch (error) {
    if (version !== connectionVersion) return;
    if (error?.code === 'P0001') report(error.message);
    else report('Couldn’t set up your space. Try again.');
  } finally {
    authBusy = false;
    screen.inert = false;
  }
}

async function refreshShared(manual = false) {
  if (connection !== 'ready' || saving || refreshing || screen.querySelector('form')) return;
  const version = connectionVersion;
  const initialScreen = screen.firstElementChild;
  refreshing = true;
  report('Refreshing…');
  try {
    const shared = await sync.load(member.space_id);
    if (version !== connectionVersion) return;
    // Avoid replacing a form if the user navigated while the refresh was running.
    if (initialScreen !== screen.firstElementChild || screen.querySelector('form')) {
      report('');
      return;
    }
    Object.assign(state, shared);
    report(manual ? 'Shared data refreshed.' : '');
    render();
    if (manual) screen.querySelector('[data-refresh]')?.focus({preventScroll: true});
  } catch {
    if (version === connectionVersion) report('Could not refresh. Try again in Profile → Settings → Troubleshooting.');
  } finally {
    refreshing = false;
  }
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button || saving || authBusy) return;
  if (button.hasAttribute('data-skip-password')) {
    await finishPasswordSetup();
    return;
  }
  if (button.dataset.authView && connection === 'sign-in') {
    authEmail = screen.querySelector('input[name="email"]')?.value ?? authEmail;
    authView = button.dataset.authView;
    report('');
    render();
    screen.querySelector('input[name="email"]')?.focus();
    return;
  }
  if (button.dataset.onboardingMode && connection === 'unlinked') {
    onboardingName = screen.querySelector('input[name="displayName"]').value;
    onboardingMode = button.dataset.onboardingMode;
    report('');
    render();
    return;
  }
  if (button.hasAttribute('data-sign-out')) {
    button.disabled = true;
    try {
      await sync.signOut();
      await showSession(null);
    } catch {
      button.disabled = false;
      report('Could not sign out. Try again.');
    }
    return;
  }
  if (button.hasAttribute('data-refresh')) {
    await refreshShared(true);
    return;
  }
  if (sync && connection !== 'ready') return;
  if (button.hasAttribute('data-copy-couple-code')) {
    const input = screen.querySelector('.couple-code input');
    try {
      await navigator.clipboard.writeText(input.value);
      report('Couple code copied.');
    } catch {
      input.focus();
      input.select();
      report('Copy the selected code to share it.');
    }
    return;
  }
  if (button.hasAttribute('data-couple-code')) {
    const version = connectionVersion;
    button.disabled = true;
    try {
      const code = await sync.createCoupleCode();
      if (version !== connectionVersion) return;
      coupleCode = code;
      if (page === 'couple') render();
    } catch {
      if (version === connectionVersion) report('Couldn’t create a code. Refresh shared data and try again.');
    } finally {
      button.disabled = false;
    }
    return;
  }
  const {page:tab, go, date:day, mode, period, routineShift, edit, goal:target, complete} = button.dataset;
  if (button.hasAttribute('data-pat')) {
    if (animationsEnabled()) {
      button.classList.remove('pat');
      void button.offsetWidth;
      button.classList.add('pat');
    }
    document.querySelector('#pet-note').textContent = Object.values(state.answers).some((a) => hasSharedAnswers(a))
      ? 'Your otter balances the stone and catches it.' : 'Your otter gives a little wiggle.';
    return;
  }
  const previousPage = page;
  if (button.dataset.profileFor) {
    const name = button.dataset.profileFor;
    if (!partners().includes(name) || !canEdit(name)) return;
    profilePartner = name;
    draftPhoto = null;
    page = 'edit-profile';
  } else if (tab || go) {
    if (page === 'nook' && go === 'planner') {
      plannerDate = today();
      plannerMode = 'Day';
    }
    if (page === 'goals' && go === 'routines') routineDate = today();
    page = tab || go;
    if (previousPage === 'edit-profile') {
      profilePartner = null;
      draftPhoto = null;
    }
    editing = null;
    answerAuthor = null;
  }
  else if (button.dataset.answerFor) answerAuthor = button.dataset.answerFor;
  else if (day) plannerDate = day;
  else if (mode) plannerMode = mode;
  else if (period) shiftPlanner(Number(period));
  else if (button.hasAttribute('data-planner-today')) plannerDate = today();
  else if (routineShift) routineDate = localDate(offset(new Date(routineDate + 'T12:00:00'), Number(routineShift)));
  else if (edit) {
    editing = edit;
    plannerDate = state.events.find(({id}) => id === edit).date;
    page = 'event';
  }
  else if (target !== undefined) { goal = Number(target); page = 'goal'; }
  else if (complete !== undefined) {
    const item = state.milestones[goal][Number(complete)];
    const done = item.done ? null : today();
    if (!await storeChange('milestones', 'update', {done}, item.id)) return;
    item.done = done;
    save();
  } else if (button.hasAttribute('data-delete')) {
    if (!confirm('Delete this event?')) return;
    if (!await storeChange('events', 'delete', {}, editing)) return;
    state.events = state.events.filter(({id}) => id !== editing);
    editing = null;
    page = 'planner';
    save();
  } else return;
  render();
  if (page !== previousPage) window.scrollTo(0, 0);
  else if (day) screen.querySelector(`[data-date="${day}"]`)?.focus({preventScroll: true});
  else if (mode) screen.querySelector(`[data-mode="${mode}"]`)?.focus({preventScroll: true});
  else if (period) screen.querySelector(`[data-period="${period}"]`)?.focus({preventScroll: true});
  else if (routineShift) screen.querySelector(`[data-routine-shift="${routineShift}"]`)?.focus({preventScroll: true});
  else if (button.hasAttribute('data-planner-today')) screen.querySelector('[data-planner-today]')?.focus({preventScroll: true});
});

screen.addEventListener('change', async ({target}) => {
  if (target.form?.id === 'profile-photo') {
    if (target.name !== 'photo') return;
    const file = target.files[0];
    if (!file) return;
    const form = target.form;
    const saveButton = form.querySelector('[value="save"]');
    const error = form.querySelector('#photo-error');
    draftPhoto = null;
    saveButton.disabled = true;
    error.textContent = '';
    try {
      const photo = await makeProfilePhoto(file);
      if (!screen.contains(form) || target.files[0] !== file) return;
      draftPhoto = photo;
      form.parentElement.querySelector('.profile-avatar').outerHTML = profileAvatar(profilePartner, photo);
      saveButton.disabled = false;
    } catch {
      if (!screen.contains(form) || target.files[0] !== file) return;
      target.value = '';
      form.parentElement.querySelector('.profile-avatar').outerHTML = profileAvatar(profilePartner);
      error.textContent = 'Could not open that image. Try a JPEG or PNG.';
    }
    return;
  }
  if (target.id === 'routine-date') {
    if (target.value && target.validity.valid) routineDate = target.value;
    render();
    screen.querySelector('#routine-date').focus();
    return;
  }
  if (target.id === 'otter-animation') {
    if (sync) localStorage.setItem(animationKey(), String(target.checked));
    else {
      state.otterAnimations = target.checked;
      save();
    }
    return;
  }
  const {habit, partner} = target.dataset;
  const day = routineDate;
  if (habit === undefined || !partners().includes(partner) || day > today() || !canEdit(partner)) return;
  if (!await storeChange('routines', 'upsert', {day, member_id: member?.user_id, habit: Number(habit), done: target.checked})) {
    target.checked = Boolean(routineLog(day, partner)[habit]);
    return;
  }
  state.logs[day] = {...state.logs[day], [partner]: {...routineLog(day, partner), [habit]: target.checked}};
  save();
  screen.querySelector('#daily-commitment').textContent = dailyCommitment();
});

screen.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  if (sync && event.target.id === 'space-setup') {
    await submitSpace(event.target);
    return;
  }
  if (sync && ['sign-in', 'password-link', 'create-account', 'set-password'].includes(event.target.id)) {
    await submitAuth(event.target, data, event.submitter || event.target.querySelector('[type="submit"], button.primary'));
    return;
  }
  if (saving || (sync && connection !== 'ready')) return;
  const error = (message) => { document.querySelector('#error').textContent = message; };
  switch (event.target.id) {
    case 'profile-photo': {
      const name = profilePartner;
      const removing = event.submitter?.value === 'remove';
      const photo = removing ? null : draftPhoto;
      if (!name || !canEdit(name) || (!removing && !photo)) return;
      if (refreshing) return report('Duvie is refreshing. Try saving again in a moment.');
      if (sync && !await storeChange('profilePhotos', 'upsert', {member_id: member.user_id, photo})) return;
      state.profilePhotos = {...state.profilePhotos, [name]: photo};
      profilePartner = null;
      draftPhoto = null;
      page = 'profile';
      report(photo ? 'Profile photo saved.' : 'Profile photo removed.');
      break;
    }
    case 'event': {
      if (!data.title.trim()) return error('Enter an event name.');
      if (![...partners(), 'Together'].includes(data.owner)) return error('Choose who the event is for.');
      if (data.end && data.end <= data.start) return error('End time must be after start time.');
      const item = { ...data,title:data.title.trim(),date:plannerDate,id:editing || crypto.randomUUID() };
      const values = {day: item.date, title: item.title, starts: item.start, ends: item.end || null, owner: item.owner};
      if (!await storeChange('events', editing ? 'update' : 'insert', editing ? values : {...values, id: item.id}, item.id)) return;
      if (editing) state.events = state.events.map((old) => old.id === editing ? item : old);
      else state.events.push(item);
      editing = null;
      page = 'planner';
      break;
    }
    case 'checkin': {
      const {author} = event.target.dataset;
      if (!partners().includes(author) || !canEdit(author)) return;
      const answer = data.answer.trim();
      if (!answer) return error('Write an answer before sharing.');
      const weekStart = week();
      if (!await storeChange('answers', 'upsert', {week_start: weekStart, author_id: member?.user_id, answer})) return;
      state.answers[weekStart] = {...state.answers[weekStart], [author]: answer};
      answerAuthor = null;
      break;
    }
    case 'milestone': {
      if (!data.title.trim()) return error('Enter a milestone.');
      const item = {id: crypto.randomUUID(), title: data.title.trim(), done: null};
      if (!await storeChange('milestones', 'insert', {...item, goal})) return;
      state.milestones[goal].push(item);
      break;
    }
  }
  save();
  render();
  if (sync && event.target.id === 'checkin') void refreshShared();
});

render();

if (sync) {
  sync.connect().then(async ({session, setupPassword, linkFailed}) => {
    sync.onSessionChange(showSession);
    await showSession(session, {setupPassword});
    if (linkFailed && !session) report('This email link is expired or already used. Request a new one below.');
  }).catch(() => {
    connection = 'error';
    render();
    report('Check the Supabase project URL and publishable key, then refresh.');
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !screen.querySelector('form')) void refreshShared();
  });
}
