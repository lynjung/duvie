const screen = document.querySelector('#screen');
const partners = ['Lyn', 'Edison'];
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
let connection = sync ? 'loading' : 'local';
let connectionVersion = 0;
let saving = false;
let refreshing = false;
const state = { events: [], logs: {}, answers: {}, milestones: [[], []] };
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
    if (connectionVersion === version) report('Could not confirm the save. Refresh shared data in Profile, then try again.');
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
const routineLog = (day, partner) => state.logs[day]?.[partner] || {};
function countRoutines(day, partner) {
  const log = routineLog(day, partner);
  return habits.reduce((count, _, index) => count + Number(Boolean(log[index])), 0);
}
const percentage = (done, due) => Math.round(done * 100 / due);
const currentAnswers = () => state.answers[week()] || {};
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
  const done = partners.reduce((total, partner) => total + countRoutines(day, partner), 0);
  const due = habits.length * partners.length;
  return `${done} of ${due} routines · ${percentage(done, due)}%`;
}

function routineTable() {
  const future = routineDate > today();
  return `<section class="panel">
    <h2 id="routine-title">Daily routines</h2>
    <table class="routine-table" aria-labelledby="routine-title">
      <thead><tr><th scope="col">Routine</th>${partners.map((partner) => `<th scope="col">${partner}</th>`).join('')}</tr></thead>
      <tbody>${habits.map((habit, index) => `<tr><th scope="row">${habit}</th>
        ${partners.map((partner) => `<td><label class="routine-toggle">
          <input type="checkbox" data-habit="${index}" data-partner="${partner}" aria-label="${partner}: ${habit}"
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
    ${[...partners, 'Together'].map((owner) => `<option ${owner === event?.owner ? 'selected' : ''}>${owner}</option>`).join('')}
  </select></label>
  <button class="primary">Save event</button><p class="error" role="alert" id="error"></p></form>
  ${event ? '<button class="danger" data-delete>Delete event</button>' : ''}
  </div>`;
}

function nookView() {
  const count = Object.values(state.answers).filter((answers) => answers.Lyn && answers.Edison).length;
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
  const shared = partners.every((partner) => answers[partner]);
  return `${pageHeading('Weekly check-in', { parent: 'Nook' })}
    <section class="panel"><h2>What helped us this week?</h2>
    <p class="muted">${shared ? 'You’ve both answered.' : 'Answers appear here once both of you have shared.'}</p>
    ${partners.map((partner) => `<div class="checkin-person"><div class="row">
      <strong>${partner}</strong>
      ${canEdit(partner) ? `<button data-answer-for="${partner}" aria-label="${answers[partner] ? 'Edit' : 'Write'} ${partner}’s answer">${answers[partner] ? 'Edit answer' : 'Write answer'}</button>` : ''}
    </div>
    ${shared ? `<p class="checkin-answer">${esc(answers[partner])}</p>` : (answers[partner] ? '<p class="muted">Answer shared</p>' : '')}
    ${answerAuthor === partner ? `<form id="checkin" data-author="${partner}">
      <label>${partner}’s answer<textarea name="answer" required rows="5" maxlength="1500">${esc(answers[partner] || '')}</textarea></label>
      <button class="primary">${answers[partner] ? 'Update answer' : 'Share answer'}</button>
      <p class="error" role="alert" id="error"></p>
    </form>` : ''}</div>`).join('')}</section>`;
}

function progressView() {
  const first = '2026-11-08';
  const last = '2027-11-08';
  const end = [today(), localDate(offset(new Date(last + 'T12:00:00'), 1))].sort()[0];
  const days = Math.max(0, (Date.parse(end) - Date.parse(first)) / 86400000);
  if (!days) return '<p class="muted">Progress starts after the first day of the plan.</p>';

  const scoredDays = Object.keys(state.logs).filter((day) => day >= first && day < end);
  const due = days * habits.length;
  const scores = partners.map((partner) => scoredDays.reduce((total, day) => total + countRoutines(day, partner), 0));
  const combined = scores.reduce((total, score) => total + score, 0);
  return `<dl class="commitment-scores">
    ${partners.map((partner, index) => `<div><dt>${partner}</dt><dd>${percentage(scores[index], due)}%</dd></div>`).join('')}
    <div><dt>Together</dt><dd>${percentage(combined, due * partners.length)}%</dd></div>
  </dl>`;
}

function goalView() {
  const milestones = state.milestones[goal];
  const completeCount = milestones.filter((item) => item.done).length;
  const plant = `<span class="plant" role="img" aria-label="${completeCount} milestones complete">${completeCount ? '✿' : '♧'}</span>`;
  return `${pageHeading(goals[goal] + ' ' + plant, {
    parent: 'Goals',
    subtitle: goal === 0 ? 'Through Nov 8, 2027 · Target over 90%' : ''
  })}
  ${goal === 0 ? `<section class="panel"><h2>Habit progress</h2><p class="muted">All routines due from Nov 8, 2026 through yesterday, up to the end of the plan.</p>${progressView()}</section>` : ''}
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

function profileView() {
  return `${pageHeading('Profile')}
    <section class="panel"><h2>${member ? esc(member.name) : 'Your space'}</h2>
      <p class="muted">Lyn &amp; Edison</p>
      ${sync ? '<div class="row"><button data-refresh>Refresh shared data</button><button data-sign-out>Sign out</button></div>' : '<p class="muted">Entries are saved in this browser.</p>'}
    </section>
    <section class="panel">
      <h2>Nook</h2>
      <label class="row setting-toggle"><span>Animate the otter</span>
        <input type="checkbox" id="otter-animation" ${animationsEnabled() ? 'checked' : ''}>
      </label>
    </section>`;
}

const views = {
  nook: nookView, planner: plannerView, event: eventView, checkin: checkinView,
  routines: routinesView, goals: goalsView, goal: goalView, profile: profileView
};

function connectionView() {
  if (connection === 'loading') return '<h1>Connecting to Duvie…</h1>';
  if (connection === 'error') return '<h1>Connection unavailable</h1><p>Refresh to try again.</p>';
  if (connection === 'unlinked') {
    return '<h1>Pairing pending</h1><p>Your account needs to be linked to the Duvie space.</p><button data-sign-out>Sign out</button>';
  }
  return `${pageHeading('Sign in')}
    <div class="panel"><form id="sign-in">
      <label>Invited email address<input type="email" name="email" autocomplete="email" required></label>
      <button class="primary">Send sign-in link</button>
    </form></div>`;
}

function render() {
  nav.hidden = Boolean(sync && connection !== 'ready');
  screen.innerHTML = nav.hidden ? connectionView() : views[page]();
  const parent = {event: 'planner', checkin: 'nook', routines: 'goals', goal: 'goals'}[page] || page;
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

async function showSession(session) {
  const nextId = session?.user?.id || null;
  if (nextId === sessionId) return;
  sessionId = nextId;
  const version = ++connectionVersion;
  member = null;
  connection = session ? 'loading' : 'sign-in';
  page = 'nook';
  editing = null;
  answerAuthor = null;
  render();
  report('');
  if (!session) return;

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

async function refreshShared() {
  if (connection !== 'ready' || saving || refreshing) return;
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
    report('');
    render();
  } catch {
    if (version === connectionVersion) report('Could not refresh. Try again in Profile.');
  } finally {
    refreshing = false;
  }
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button || saving) return;
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
    await refreshShared();
    return;
  }
  if (sync && connection !== 'ready') return;
  const {page:tab, go, date:day, mode, period, routineShift, edit, goal:target, complete} = button.dataset;
  if (button.hasAttribute('data-pat')) {
    if (animationsEnabled()) {
      button.classList.remove('pat');
      void button.offsetWidth;
      button.classList.add('pat');
    }
    document.querySelector('#pet-note').textContent = Object.values(state.answers).some((a) => a.Lyn && a.Edison)
      ? 'Your otter balances the stone and catches it.' : 'Your otter gives a little wiggle.';
    return;
  }
  const previousPage = page;
  if (tab || go) {
    if (page === 'nook' && go === 'planner') {
      plannerDate = today();
      plannerMode = 'Day';
    }
    if (page === 'goals' && go === 'routines') routineDate = today();
    page = tab || go;
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
  if (habit === undefined || !partners.includes(partner) || day > today() || !canEdit(partner)) return;
  if (!await storeChange('routines', 'upsert', {day, member_id: member?.user_id, habit: Number(habit), done: target.checked})) {
    target.checked = Boolean(routineLog(day, partner)[habit]);
    return;
  }
  state.logs[day] ??= {};
  state.logs[day][partner] ??= {};
  state.logs[day][partner][habit] = target.checked;
  save();
  screen.querySelector('#daily-commitment').textContent = dailyCommitment();
});

screen.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  if (event.target.id === 'sign-in') {
    const submit = event.submitter || event.target.querySelector('button');
    submit.disabled = true;
    report('Sending sign-in link…');
    try {
      await sync.sendLink(data.email.trim());
      report('Check your email for a sign-in link.');
    } catch {
      report('Could not send a link. Check the invited address and try again.');
    } finally {
      submit.disabled = false;
    }
    return;
  }
  if (saving || (sync && connection !== 'ready')) return;
  const error = (message) => { document.querySelector('#error').textContent = message; };
  switch (event.target.id) {
    case 'event': {
      if (!data.title.trim()) return error('Enter an event name.');
      if (![...partners, 'Together'].includes(data.owner)) return error('Choose who the event is for.');
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
      if (!partners.includes(author) || !canEdit(author)) return;
      const answer = data.answer.trim();
      if (!answer) return error('Write an answer before sharing.');
      const weekStart = week();
      if (!await storeChange('answers', 'upsert', {week_start: weekStart, author_id: member?.user_id, answer})) return;
      state.answers[weekStart] ??= {};
      state.answers[weekStart][author] = answer;
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
  sync.connect().then((session) => {
    sync.onSessionChange(showSession);
    return showSession(session);
  }).catch(() => {
    connection = 'error';
    render();
    report('Check the Supabase project URL and publishable key, then refresh.');
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !screen.querySelector('form')) void refreshShared();
  });
}
