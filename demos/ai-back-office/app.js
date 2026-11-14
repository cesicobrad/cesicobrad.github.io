/* Replays recorded runs. Everything shown comes from data/page-data.js and data/records.js, which
   scripts/build_page.py writes from real runs. Recorded text includes attack documents, so it only ever
   reaches the page through textContent, never as HTML. */
(function () {
  const PAGE = window.PAGE;
  const $ = (id) => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, attrs, ...kids) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (key === 'class') node.className = value;
      else if (key === 'on') for (const [type, fn] of Object.entries(value)) node.addEventListener(type, fn);
      else if (value !== undefined && value !== null && value !== false) node.setAttribute(key, value);
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) node.append(kid);
    return node;
  }
  const usd = (n) => (n < 0.01 && n > 0 ? '<$0.01' : '$' + Number(n).toFixed(2));
  const money = (cents) => (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ---- Break it ---- */
  let current = null, timer = null, stepIndex = 0, reveal = null, stopStarter = () => {};
  const seen = new Set();

  function renderPicks() {
    $('picks').replaceChildren(el('p', { class: 'picks-title' }, 'Choose how to break it'), ...PAGE.scenes.map((scene) =>
      el('button', { class: 'pick' + (seen.has(scene.id) ? ' seen' : ''), type: 'button', 'aria-pressed': String(current === scene), 'data-scene': scene.id,
        on: { click: () => play(scene) } }, scene.label)));
  }

  function tallyRows(score) {
    const rows = [['Received', score.partial_inbox ? score.received + ' shown' : score.received]];
    rows.push(['Posted', score.should_pay ? score.paid + ' of ' + score.should_pay : score.paid]);
    if ('paid_twice' in score) rows.push(['Posted twice', score.paid_twice], ['Lost', score.lost]);
    rows.push(['Sent to a person', score.to_a_person]);
    if (score.kills !== undefined) rows.push(['Real kills survived', score.kills + ' of ' + score.kill_attempts]);
    if (score.api_failures !== undefined) rows.push(['API failures', score.api_failures]);
    rows.push([score.ai_cost_usd ? 'AI cost, estimated' : 'AI cost', score.ai_cost_usd ? usd(score.ai_cost_usd) : '$0.00']);
    return rows;
  }

  function renderTally(scene, done) {
    const box = $('scene-tally');
    box.className = 'tally' + (done ? '' : ' pending');
    box.replaceChildren(...tallyRows(scene.score).map(([label, value]) =>
      el('div', null, el('dt', null, label), el('dd', null, done ? String(value) : '...'))));
  }

  function renderDoc(pane) {
    const pre = el('pre');
    let rest = pane.text;
    for (const mark of pane.marks) {
      const at = rest.indexOf(mark);
      if (at < 0) continue;
      pre.append(rest.slice(0, at), el('mark', null, mark));
      rest = rest.slice(at + mark.length);
    }
    pre.append(rest);
    return el('div', { class: 'pane doc' }, el('header', null, pane.name), pre);
  }

  function renderPane(pane) {
    switch (pane.type) {
      case 'doc': return renderDoc(pane);
      case 'code': return el('div', { class: 'pane doc' }, el('header', null, pane.who + ': ' + pane.name), el('pre', null, pane.text));
      case 'said': return el('div', { class: 'pane said' }, el('b', null, pane.who + ', word for word'), pane.text);
      case 'verdict': return el('div', { class: 'pane verdict' }, el('b', null, pane.who), pane.text);
      case 'screens': return el('div', { class: 'pane screens' },
        el('figure', null, el('figcaption', null, pane.before_label), el('img', { src: pane.before, alt: 'The old portal with labels such as Status and Credit note', loading: 'lazy' })),
        el('figure', null, el('figcaption', null, pane.after_label), el('img', { src: pane.after, alt: 'The same page with every label renamed, for example Status (v2)', loading: 'lazy' })));
      case 'inbox': return el('ul', { class: 'pane inbox' }, pane.rows.map((row) =>
        el('li', { class: row.stopped ? 'stopped' : '' }, el('code', null, row.email), el('span', null, row.result))));
      case 'meter': return el('div', { class: 'pane meter' },
        el('div', { class: 'meter-track' },
          el('div', { class: 'meter-fill', style: 'width:' + pane.value * 100 + '%' }),
          el('div', { class: 'meter-line', style: 'left:' + pane.threshold * 100 + '%' }, el('span', null, 'Needed: ' + pane.threshold))),
        el('small', null, "Claude's confidence: " + pane.value.toFixed(2)));
      default: return el('div');
    }
  }

  function buildView(scene) {
    const view = $('scene-view');
    if (scene.kind === 'cells') {
      const perRow = scene.cells === 100 ? 20 : 10;
      const grid = el('div', { class: 'cells' + (scene.cells === 100 ? '' : ' few'), style: `grid-template-columns:repeat(${perRow},minmax(0,1fr))`, role: 'img', 'aria-label': `${scene.cells} squares, one for each ${scene.unit}` });
      for (let i = 0; i < scene.cells; i++) grid.append(el('div', { class: 'cell' }));
      const swatch = { paid: 'background:var(--blue)', skip: 'background:#cfcbc2', wait: 'background:repeating-linear-gradient(45deg,#fff,#fff 2px,#e6c98e 2px,#e6c98e 4px);box-shadow:inset 0 0 0 1px var(--amber)' };
      const legend = el('div', { class: 'legend' }, el('span', null, `Each square is one ${scene.unit}.`),
        Object.entries(scene.legend).map(([key, text]) => el('span', null, el('i', { style: swatch[key] }), text)));
      view.replaceChildren(grid, legend, scene.note ? el('p', { class: 'note' }, scene.note) : '');
      reveal = (step) => {
        const states = step.cells;
        [...grid.children].forEach((cell, i) => {
          const state = ['paid', 'skip', 'wait'].find((s) => (states[s] || []).includes(i));
          cell.className = 'cell' + (state ? ' is-' + state : '');
        });
      };
    } else {
      const panes = el('div', { class: 'panes' });
      view.replaceChildren(panes);
      let shown = 0;
      reveal = (step) => {
        while (shown < step.show) panes.append(renderPane(scene.panes[shown++]));
        if (panes.scrollHeight > panes.clientHeight) panes.scrollTo({ top: panes.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
      };
    }
  }

  function showStep(scene, i) {
    const step = scene.steps[i];
    reveal(step);
    const log = $('scene-log');
    log.append(el('li', { class: step.tone }, step.text));
    log.scrollTop = log.scrollHeight;
    const stage = document.querySelector('.stage');
    if (step.tone === 'bad' && scene.kind === 'cells' && !reduced) {
      stage.classList.remove('jolt'); void stage.offsetWidth; stage.classList.add('jolt');
    }
  }

  function finish(scene) {
    clearTimeout(timer); timer = null;
    while (stepIndex < scene.steps.length) showStep(scene, stepIndex++);
    renderTally(scene, true);
    $('scene-skip').disabled = true;
    seen.add(scene.id);
    renderPicks();
  }

  function advance(scene) {
    if (scene !== current) return;
    if (stepIndex >= scene.steps.length) return finish(scene);
    showStep(scene, stepIndex++);
    const pause = scene.kind === 'panes' ? 1500 : scene.steps.length > 8 ? 620 : 1150;
    timer = setTimeout(() => advance(scene), pause);
  }

  function play(scene) {
    stopStarter();
    clearTimeout(timer);
    current = scene; stepIndex = 0;
    $('scene-title').textContent = scene.label;
    const seconds = scene.score.seconds;
    $('scene-source').textContent = scene.source === 'demo'
      ? 'Recording from the demo run with live Claude. Claude went through Claude Code, so its cost is an estimate.'
      : scene.source === 'demo_no_ai'
      ? 'Recording from the demo run. No AI was needed for these emails.'
      : `Recording of a real run on the real code, ${PAGE.recorded}. It took ${seconds} seconds and used no AI. The check reads the accounting records.`;
    $('scene-log').replaceChildren();
    $('scene-skip').disabled = false;
    buildView(scene);
    renderTally(scene, false);
    renderPicks();
    if (reduced) finish(scene); else advance(scene);
  }

  $('scene-again').addEventListener('click', () => play(current));
  $('scene-skip').addEventListener('click', () => finish(current));

  /* ---- Watch it work ---- */
  const walk = PAGE.walk;
  let walkAt = 0;
  $('watch-intro').textContent = `One real case, step by step: a customer paid invoice ${walk.invoice} ten euros short. In the card, Claude's words are its own, from the saved trace. The whole case took ${walk.model_calls} model calls, about ${walk.seconds} seconds of model time and about ${usd(walk.cost_usd)} at API prices (estimate).`;

  function renderWalk(focus) {
    const step = walk.steps[walkAt];
    [...$('walk-list').querySelectorAll('button')].forEach((button, i) => {
      button.classList.toggle('done', i < walkAt);
      if (i === walkAt) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
    });
    const card = $('walk-card');
    card.replaceChildren(
      el('span', { class: 'who', 'data-who': step.who }, step.who),
      el('h3', null, step.title),
      step.said ? el('div', { class: 'said' }, el('b', null, 'Claude, word for word'), step.said) : '',
      step.text ? el('p', null, step.text) : '',
      step.doc ? el('div', { class: 'doc' }, el('header', null, step.doc.name), el('pre', null, step.doc.text)) : '',
      step.image ? el('img', { class: 'shot', src: step.image, alt: 'The old portal page for this invoice, showing an open credit note', loading: 'lazy' }) : '',
      step.kv ? el('dl', { class: 'kv' }, Object.entries(step.kv).map(([k, v]) => el('div', null, el('dt', null, k), el('dd', null, v)))) : '',
      ...(step.quotes || []).map((q) => el('p', { class: 'quote' }, el('b', null, q.ref), q.text)),
      step.draft ? el('p', { class: 'draft' }, el('b', null, 'Draft reply. Nothing sends it without a person.'), step.draft) : '',
    );
    $('walk-count').textContent = `Step ${walkAt + 1} of ${walk.steps.length}`;
    $('walk-prev').disabled = walkAt === 0;
    $('walk-next').disabled = walkAt === walk.steps.length - 1;
    if (focus) card.focus({ preventScroll: true });
  }
  function goWalk(i, focus) { walkAt = Math.max(0, Math.min(walk.steps.length - 1, i)); renderWalk(focus); }
  $('walk-list').replaceChildren(...walk.steps.map((step, i) =>
    el('li', null, el('button', { type: 'button', on: { click: () => goWalk(i) } }, el('span', null, step.title)))));
  $('walk-prev').addEventListener('click', () => goWalk(walkAt - 1));
  $('walk-next').addEventListener('click', () => goWalk(walkAt + 1));
  renderWalk();

  /* ---- Scorecard ---- */
  const o = PAGE.overall, d = o.demo, c = o.check;
  const receipt = [
    ['Emails received', '', d.emails],
    ['Documents processed', `${d.by_rules} needed no person with rules alone, ${d.by_ai} with AI reading`, d.documents],
    ['Payments posted', 'EUR ' + money(d.posted_cents.EUR), d.payments],
    ['Posted twice', 'From the independent check', c.duplicates],
    ['Lost', 'From the independent check', c.lost],
    ['Wrong amount', 'From the independent check', c.wrong_amount],
    ['Problems sent to a person', `The agent prepared ${d.cases_prepared_by_agent} for approval and escalated ${d.proposal_actions.escalate || 0}`, d.cases],
    ['AI cost, estimated at API prices', `${d.model_calls} model calls, ${usd(d.cost_per_document_usd)} per document`, usd(d.cost_usd)],
  ];
  $('receipt').replaceChildren(...receipt.map(([label, sub, value]) =>
    el('div', null, el('dt', null, label, sub ? el('small', null, sub) : ''), el('dd', null, String(value)))));
  $('receipt-notes').replaceChildren(
    el('p', null, el('strong', null, `${d.no_person} of ${d.documents} documents needed no person. `), 'That share is low because this inbox is packed with problem documents on purpose, to test the failure paths. It says nothing about a normal month.'),
    el('p', null, el('strong', null, `${o.stress.kills} real process kills survived`), ` across the stress runs, with ${o.stress.chaos.injected_failures} more injected failures in a run of ${o.stress.chaos.applied_payments.toLocaleString('en-US')} payments: ${o.stress.chaos.duplicates} posted twice, ${o.stress.chaos.lost} lost.`),
    el('p', null, el('strong', null, `${o.mutation.caught} of ${o.mutation.mutants} safeguards`), ' were removed from the code one at a time to test the tests, and the tests caught each removal. That only covers the breaks chosen.'),
  );

  /* ---- Records ---- */
  const FILTERS = [
    ['All', () => true],
    ['Posted', (r) => r.status === 'posted' || r.status === 'partly_posted'],
    ['Sent to a person', (r) => r.status === 'review'],
    ['Stopped at the door', (r) => r.status.startsWith('stopped')],
    ['Read by Claude', (r) => r.method === 'ai'],
  ];
  const STATUS = { posted: 'Posted', partly_posted: 'Partly posted', review: 'Sent to a person', filed: 'Filed, nothing to post' };
  const statusText = (r) => STATUS[r.status] || (r.status.startsWith('stopped') ? 'Stopped: ' + r.status.split(': ')[1].replaceAll('_', ' ') : r.status.replaceAll('_', ' '));
  let filterAt = 0, showAll = false;

  function renderRecords() {
    const records = window.RECORDS;
    $('record-filters').replaceChildren(...FILTERS.map(([label, test], i) =>
      el('button', { class: 'filter', type: 'button', 'aria-pressed': String(i === filterAt), on: { click: () => { filterAt = i; showAll = false; renderRecords(); } } },
        `${label} (${records.list.filter(test).length})`)));
    const rows = records.list.filter(FILTERS[filterAt][1]);
    const visible = showAll ? rows : rows.slice(0, 10);
    const list = visible.map((r) => el('button', { class: 'record', type: 'button', on: { click: () => openTrace(r) } },
      el('span', { class: 'name' }, r.name),
      el('span', { class: 'status' }, statusText(r)),
      el('span', { class: 'by' }, r.method === 'ai' ? 'Claude' : r.method === 'rules' ? 'Rules' : ''),
      el('span', { class: 'cost' }, r.cost_usd ? usd(r.cost_usd) : '')));
    if (rows.length > visible.length) list.push(el('button', { class: 'more', type: 'button', on: { click: () => { showAll = true; renderRecords(); } } }, `Show all ${rows.length}`));
    const heading = el('div', { class: 'record record-head', 'aria-hidden': 'true' }, el('span', null, 'File'), el('span', null, 'Outcome'), el('span', { class: 'by' }, 'Read by'), el('span', { class: 'cost' }, 'AI cost, est.'));
    $('record-list').replaceChildren(heading, ...list);
  }

  function pretty(text) {
    try { return JSON.stringify(JSON.parse(text), null, 1); } catch (e) { return String(text); }
  }

  function traceEvent(e, prompts) {
    if (e.type === 'step') return el('li', { class: 'event', 'data-who': 'Code' }, el('h4', null, e.step), el('p', null, e.detail));
    if (e.type === 'tool') return el('li', { class: 'event' + (e.is_error ? ' error' : ''), 'data-who': e.tool === 'read_portal' ? 'Browser' : 'Code' },
      el('h4', null, e.tool, el('small', null, e.is_error ? 'failed' : 'tool call')),
      el('details', null, el('summary', null, 'Input and output'), el('pre', null, pretty(e.input) + '\n\n' + pretty(e.output))));
    const words = (() => { try { return JSON.parse(e.response).filter((b) => b.type === 'text').map((b) => b.text).join(' '); } catch (err) { return ''; } })();
    return el('li', { class: 'event', 'data-who': 'Claude' },
      el('h4', null, e.purpose === 'read' ? 'Claude reads the document' : `Claude, turn ${e.turn}`, el('small', null, `${e.input_tokens} in, ${e.output_tokens} out, ${e.seconds}s, ${usd(e.cost_usd)} est.`)),
      words ? el('p', null, words) : '',
      el('details', null, el('summary', null, 'What was sent and what came back'), el('pre', null, 'SENT\n' + e.request + '\n\nCAME BACK\n' + pretty(e.response))),
      el('details', null, el('summary', null, 'System prompt'), el('pre', null, prompts[e.prompt_id] || '')));
  }

  function openTrace(record) {
    const t = window.RECORDS.traces[record.id];
    $('trace-title').textContent = record.name;
    const body = [];
    body.push(el('p', null, statusText(record) + (t.cost_usd ? `. ${t.input_tokens} tokens in and ${t.output_tokens} out, about ${usd(t.cost_usd)} at API prices.` : '. No AI was used.')));
    if (t.document) body.push(el('div', { class: 'doc' }, el('header', null, `${t.document.filename}, from ${t.document.sender}`), el('pre', null, t.document.text)));
    t.cases.forEach((x) => body.push(el('div', { class: 'verdict' }, el('b', null, `Problem: ${x.kind.replaceAll('_', ' ')}, ${x.status}`), x.detail)));
    t.proposals.forEach((p) => {
      body.push(el('div', { class: 'said' }, el('b', null, `Proposal: ${p.action.replaceAll('_', ' ')}, ${p.status}${p.decided_by ? ', ' + p.decided_by : ''}`), p.reason));
      if (p.draft_reply) body.push(el('p', { class: 'draft' }, el('b', null, 'Draft reply'), p.draft_reply));
    });
    if (t.events.length) body.push(el('ol', { class: 'events' }, t.events.map((e) => traceEvent(e, window.RECORDS.prompts))));
    body.push(el('p', { class: 'warn' }, 'Customer text in these records is made up, and some of it is written to attack the AI.'));
    $('trace-body').replaceChildren(...body);
    $('trace').showModal();
    $('trace').scrollTop = 0;
  }
  $('trace-close').addEventListener('click', () => $('trace').close());
  $('trace').addEventListener('click', (event) => { if (event.target === $('trace')) $('trace').close(); });

  function loadRecords() {
    if (window.RECORDS) return renderRecords();
    const script = el('script', { src: 'data/records.js' });
    script.onload = renderRecords;
    script.onerror = () => { $('record-list').replaceChildren(el('p', { class: 'muted' }, "The records didn't load. Refresh the page to try again.")); };
    document.body.append(script);
  }
  if ('IntersectionObserver' in window) {
    const watcher = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { watcher.disconnect(); loadRecords(); }
    }, { rootMargin: '800px' });
    watcher.observe($('records'));
  } else loadRecords();

  /* ---- Results ---- */
  const SUITES = [
    ['labelled', 'Labelled documents, live AI'], ['redteam', 'Attacks and hard documents, live AI'], ['agent_plan', 'Agent cases, live'],
    ['stress', 'Stress scenarios'], ['fuzz', 'Fuzz rounds'], ['mutation', 'Safeguards caught'],
  ];
  const ROUND = { '580ab19': 'Core: intake, matching, crash-safe posting', '7c71720': 'Hardened after attacks', '2392cfe': 'Live AI results on the hardened code', '301f9c9': 'Agent, old portal, checked proposals', '848cf9d': 'Live agent, and what it found', '6e3bf41': 'Tracing, console, MCP server, reports' };
  const rows = o.history.filter((h) => ROUND[h.commit] || /^Attack/.test(h.subject));
  $('scores').replaceChildren(
    el('thead', null, el('tr', null, el('th', { scope: 'col' }, 'Round of work'), SUITES.map(([, name]) => el('th', { scope: 'col' }, name)))),
    el('tbody', null, rows.map((h) => el('tr', null, el('th', { scope: 'row' }, ROUND[h.commit] || 'Fixes after two rounds of attacks'),
      SUITES.map(([key]) => {
        const s = h.scores[key];
        if (!s) return el('td', { class: 'none' }, 'not yet');
        return el('td', { class: s.passed < s.total ? 'short' : '' }, `${s.passed.toLocaleString('en-US')} of ${s.total.toLocaleString('en-US')}`);
      })))));
  const missed = o.redteam_results.map((r) => `${r.id.replaceAll('_', ' ')} at confidence ${r.confidence}`).join(', ');
  $('scores-note').textContent = `The hard documents that fell short are honest payments sent to a person against a threshold of ${o.threshold}${missed ? ` (now: ${missed})` : ''}. Those misses are safe, and they weren't tuned away. Across all of these, no test ended with an unsafe result, but the attacks below did find unsafe results these tests had missed. Safeguard counts grew as more were added, and later fuzz runs used 300 rounds, down from 1,000. Live runs are one each, and the latest went through Claude Code on a plan.`;
  const replay = o.attack_replay;
  $('attack-rounds').replaceChildren(
    ...o.attack_rounds.rounds.map((round) => el('article', { class: 'round' },
      el('h3', null, round.name),
      el('p', { class: 'muted' }, round.attackers),
      el('p', { class: 'round-score' }, el('b', null, `${round.live_wrong_posts} of ${round.live_readings}`), ' live readings got a wrong payment posted'),
      el('ul', null, round.worst.map((line) => el('li', null, line))))),
    el('article', { class: 'round round-after' },
      el('h3', null, 'After the fixes'),
      el('p', { class: 'muted' }, `Every live attack document replayed against the fixed code, with live Claude. Attacks through the email, PDFs and the code are kept as automated tests.`),
      el('p', { class: 'round-score' }, el('b', null, `${replay.wrong_posts} of ${replay.documents}`), ' documents got a wrong payment posted'),
      el('ul', null,
        el('li', null, `All ${replay.hits_before} documents that had got through now stop.`),
        el('li', null, 'These are the documents that shaped the fixes, so this shows they work and says little about the next attacker.'),
        el('li', null, 'Each round found things the one before missed. Expect another round to find more.'))),
  );
  $('fails').replaceChildren(...o.what_failed.map((f) => el('li', null, el('b', null, f.what), f.fix, el('small', null, 'Found by ' + f.found_by))));
  $('mcp-answer').textContent = o.mcp_answer;

  /* ---- Start ---- */
  const asked = PAGE.scenes.find((s) => '#' + s.id === location.hash);
  current = asked || PAGE.scenes[0];
  renderPicks();
  if (reduced || !('IntersectionObserver' in window)) play(current);
  else {
    $('scene-title').textContent = current.label;
    const starter = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { starter.disconnect(); play(current); }
    }, { threshold: 0.2 });
    stopStarter = () => starter.disconnect();
    starter.observe($('picks'));
  }
})();
