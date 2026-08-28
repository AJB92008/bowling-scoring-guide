(() => {
  "use strict";

  const NUM_FRAMES = 10;
  let frames = makeFreshFrames();

  // Bowl/guess/score state machine:
  //   "ready"    — waiting for the player to bowl
  //   "guessing" — pins fell, waiting for the player to count them
  //   "scoring"  — a frame's score is now computable, waiting for the player to work it out
  let phase = "ready";
  let pendingActual = null;       // the true number of pins knocked down this roll
  let pendingFallenIdx = new Set(); // which standing-pin slots (0-based, among the ones standing pre-roll) fell
  let feedback = null;            // { type: "correct" | "wrong", guess: number } | null

  let frameConfirmed = new Array(NUM_FRAMES).fill(false); // has the player correctly scored this frame?
  let scoringFrameIndex = -1;     // which frame the player is currently being asked to score
  let scoreFeedback = null;       // { type: "correct" | "wrong", guess: number } | null

  function makeFreshFrames() {
    return Array.from({ length: NUM_FRAMES }, () => ({ rolls: [] }));
  }

  function flatRolls() {
    return frames.flatMap(f => f.rolls);
  }

  function frameStart(i) {
    let s = 0;
    for (let k = 0; k < i; k++) s += frames[k].rolls.length;
    return s;
  }

  function isFrameComplete(i) {
    const rolls = frames[i].rolls;
    if (i < NUM_FRAMES - 1) {
      return rolls.length === 2 || (rolls.length === 1 && rolls[0] === 10);
    }
    if (rolls.length < 2) return false;
    if (rolls.length === 2) return rolls[0] < 10 && rolls[0] + rolls[1] < 10;
    return rolls.length === 3;
  }

  function currentFrameIndex() {
    for (let i = 0; i < NUM_FRAMES; i++) {
      if (!isFrameComplete(i)) return i;
    }
    return -1;
  }

  function pinsRemaining(i) {
    const rolls = frames[i].rolls;
    if (i < NUM_FRAMES - 1) {
      if (rolls.length === 0) return 10;
      return 10 - rolls[0];
    }
    if (rolls.length === 0) return 10;
    if (rolls.length === 1) return rolls[0] === 10 ? 10 : 10 - rolls[0];
    if (rolls.length === 2) {
      if (rolls[0] === 10) return rolls[1] === 10 ? 10 : 10 - rolls[1];
      if (rolls[0] + rolls[1] === 10) return 10;
      return null;
    }
    return null;
  }

  function computeFrameScore(i) {
    const flat = flatRolls();
    const start = frameStart(i);
    const rolls = frames[i].rolls;

    if (i < NUM_FRAMES - 1) {
      if (rolls.length === 0) return null;
      if (rolls[0] === 10) {
        if (flat.length >= start + 3) return 10 + flat[start + 1] + flat[start + 2];
        return null;
      }
      if (rolls.length === 1) return null;
      if (rolls[0] + rolls[1] === 10) {
        if (flat.length >= start + 3) return 10 + flat[start + 2];
        return null;
      }
      return rolls[0] + rolls[1];
    }

    if (!isFrameComplete(i)) return null;
    return rolls.reduce((a, b) => a + b, 0);
  }

  // Cumulative running total through frame i, as a real scoresheet displays it
  // (each frame's box shows the running score-so-far, not just that frame's own points).
  // Only meaningful once frame i is confirmed — confirmation always happens in order,
  // so frames 0..i-1 are guaranteed confirmed too whenever frame i is.
  function cumulativeThrough(i) {
    let total = 0;
    for (let k = 0; k <= i; k++) total += computeFrameScore(k);
    return total;
  }

  // Earliest frame whose score is now computable but the player hasn't confirmed yet.
  function findNextFrameNeedingScore() {
    for (let i = 0; i < NUM_FRAMES; i++) {
      if (!frameConfirmed[i] && computeFrameScore(i) !== null) return i;
    }
    return -1;
  }

  function isGameFullyDone() {
    return currentFrameIndex() === -1 && findNextFrameNeedingScore() === -1;
  }

  function symbolFrame19(rolls, k) {
    if (k === 0) {
      if (rolls.length < 1) return "";
      return rolls[0] === 10 ? "X" : rolls[0] === 0 ? "-" : String(rolls[0]);
    }
    if (rolls.length < 2) return "";
    if (rolls[0] + rolls[1] === 10) return "/";
    return rolls[1] === 0 ? "-" : String(rolls[1]);
  }

  function symbolFrame10(rolls, k) {
    const disp = v => (v === 10 ? "X" : v === 0 ? "-" : String(v));
    if (k === 0) return rolls.length < 1 ? "" : disp(rolls[0]);
    if (k === 1) {
      if (rolls.length < 2) return "";
      if (rolls[0] === 10) return disp(rolls[1]);
      if (rolls[0] + rolls[1] === 10) return "/";
      return disp(rolls[1]);
    }
    if (rolls.length < 3) return "";
    if (rolls[0] === 10 && rolls[1] === 10) return disp(rolls[2]);
    if (rolls[0] === 10 && rolls[1] < 10) {
      return rolls[1] + rolls[2] === 10 ? "/" : disp(rolls[2]);
    }
    if (rolls[0] < 10 && rolls[0] + rolls[1] === 10) return disp(rolls[2]);
    return "";
  }

  function colorClassFor(symbol) {
    if (symbol === "X") return "strike-color";
    if (symbol === "/") return "spare-color";
    if (symbol !== "") return "open-color";
    return "";
  }

  // ---------- Pin rack DOM (built once, updated in place so CSS transitions animate) ----------

  const ROW_SIZES = [4, 3, 2, 1]; // back row to front pin
  let pinEls = []; // 10 refs, in slot order

  function buildPinRack() {
    const rack = document.getElementById("pinRack");
    rack.innerHTML = "";
    pinEls = [];
    let idx = 0;
    for (const size of ROW_SIZES) {
      const row = document.createElement("div");
      row.className = "pin-rack-row";
      for (let j = 0; j < size; j++) {
        const pin = document.createElement("div");
        pin.className = "pin";
        const head = document.createElement("div");
        head.className = "pin-head";
        const body = document.createElement("div");
        body.className = "pin-body";
        pin.appendChild(head);
        pin.appendChild(body);
        row.appendChild(pin);
        pinEls.push(pin);
        idx++;
      }
      rack.appendChild(row);
    }
  }

  function renderPinRack() {
    const active = currentFrameIndex();
    const remaining = active === -1 ? 0 : pinsRemaining(active);
    for (let i = 0; i < 10; i++) {
      const el = pinEls[i];
      if (active === -1 || i >= remaining) {
        el.className = "pin fallen";
      } else if (phase === "guessing" && pendingFallenIdx.has(i)) {
        el.className = "pin just-fell";
      } else {
        el.className = "pin";
      }
    }
  }

  // ---------- Rendering ----------

  function render() {
    renderScoresheet();
    renderGameTotal();
    renderStatus();
    renderPinRack();
    renderActionPanel();
    renderResultBanner();
    updateUndoLabel();
  }

  function renderScoresheet() {
    const el = document.getElementById("scoresheet");
    el.innerHTML = "";
    const active = currentFrameIndex();

    for (let i = 0; i < NUM_FRAMES; i++) {
      const isLast = i === NUM_FRAMES - 1;
      const frameDiv = document.createElement("div");
      frameDiv.className = "frame" + (isLast ? " frame10" : "");
      frameDiv.dataset.index = String(i);

      const idxDiv = document.createElement("div");
      idxDiv.className = "frame-index";
      idxDiv.textContent = String(i + 1);
      frameDiv.appendChild(idxDiv);

      const rollsRow = document.createElement("div");
      rollsRow.className = "rolls-row";
      const boxCount = isLast ? 3 : 2;
      const rolls = frames[i].rolls;

      for (let k = 0; k < boxCount; k++) {
        const box = document.createElement("div");
        const sym = isLast ? symbolFrame10(rolls, k) : symbolFrame19(rolls, k);
        box.className = "roll-box " + colorClassFor(sym);
        box.textContent = sym;
        const nextEmptyIndex = rolls.length;
        if (i === active && k === nextEmptyIndex) box.classList.add("active");
        rollsRow.appendChild(box);
      }
      frameDiv.appendChild(rollsRow);

      const totalDiv = document.createElement("div");
      if (frameConfirmed[i]) {
        totalDiv.className = "frame-total";
        totalDiv.textContent = String(cumulativeThrough(i)); // running total, like a real scoresheet
      } else if (phase === "scoring" && scoringFrameIndex === i) {
        totalDiv.className = "frame-total pending awaiting";
        totalDiv.textContent = "?";
      } else {
        totalDiv.className = "frame-total pending";
        totalDiv.textContent = "";
      }
      frameDiv.appendChild(totalDiv);

      el.appendChild(frameDiv);
    }
  }

  function renderActionPanel() {
    const panel = document.getElementById("actionPanel");
    panel.innerHTML = "";
    const active = currentFrameIndex();

    if (phase === "scoring") {
      renderScoringPanel(panel);
      return;
    }

    if (active === -1) {
      const p = document.createElement("p");
      p.className = "bowl-hint";
      p.textContent = "Game complete — reset to bowl again.";
      panel.appendChild(p);
      return;
    }

    if (phase === "ready") {
      const btn = document.createElement("button");
      btn.className = "bowl-btn-main";
      btn.textContent = "Bowl!";
      btn.addEventListener("click", startBowl);
      panel.appendChild(btn);

      const hint = document.createElement("p");
      hint.className = "bowl-hint";
      const remaining = pinsRemaining(active);
      hint.textContent = `${remaining} pin${remaining === 1 ? "" : "s"} standing.`;
      panel.appendChild(hint);
      return;
    }

    // phase === "guessing"
    const remaining = pinsRemaining(active);

    const prompt = document.createElement("p");
    prompt.className = "guess-prompt";
    prompt.textContent = "How many pins fell?";
    panel.appendChild(prompt);

    const pad = document.createElement("div");
    pad.className = "guess-pad";
    for (let v = 0; v <= remaining; v++) {
      const b = document.createElement("button");
      b.className = "guess-btn";
      b.textContent = v === 10 ? "X" : String(v);
      b.setAttribute("aria-label", v === 10 ? "Guess: strike, 10 pins" : `Guess: ${v} pins`);
      b.addEventListener("click", () => submitGuess(v, b));
      pad.appendChild(b);
    }
    panel.appendChild(pad);

    const fb = document.createElement("p");
    fb.className = "guess-feedback" + (feedback ? " " + feedback.type : "");
    fb.textContent = feedback && feedback.type === "wrong"
      ? `Not quite — ${feedback.guess} isn't right. Recount and try again.`
      : "Count the pins that just fell, then tap the number.";
    panel.appendChild(fb);
  }

  function renderScoringPanel(panel) {
    const i = scoringFrameIndex;

    const prompt = document.createElement("p");
    prompt.className = "guess-prompt";
    prompt.textContent = `Frame ${i + 1} is ready to score — what's the new running total?`;
    panel.appendChild(prompt);

    const entry = document.createElement("div");
    entry.className = "score-entry";

    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "numeric";
    input.className = "score-input";
    input.id = "scoreInput";
    input.min = "0";
    input.max = "300";
    input.placeholder = "0";
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") submitFrameScore();
    });
    entry.appendChild(input);

    const submitBtn = document.createElement("button");
    submitBtn.className = "score-submit-btn";
    submitBtn.textContent = "Submit";
    submitBtn.addEventListener("click", submitFrameScore);
    entry.appendChild(submitBtn);

    panel.appendChild(entry);

    const fb = document.createElement("p");
    fb.className = "guess-feedback" + (scoreFeedback ? " " + scoreFeedback.type : "");
    fb.textContent = scoreFeedback && scoreFeedback.type === "wrong"
      ? `Not quite — ${scoreFeedback.guess} isn't right. Check frame ${i + 1}'s rolls (and any bonus rolls), work out its points, and add that to the previous running total.`
      : "Work out this frame's points — remember strikes and spares borrow from what comes next — then add it to the running total so far.";
    panel.appendChild(fb);

    input.focus();
  }

  function renderStatus() {
    const el = document.getElementById("statusLine");
    const active = currentFrameIndex();
    if (active === -1) {
      el.innerHTML = "";
      return;
    }
    const rollNum = frames[active].rolls.length + 1;
    el.innerHTML = `Frame <strong>${active + 1}</strong>, roll <strong>${rollNum}</strong>`;
  }

  function renderGameTotal() {
    const el = document.getElementById("gameTotal");
    let total = 0;
    let any = false;
    for (let i = 0; i < NUM_FRAMES; i++) {
      if (frameConfirmed[i]) {
        total += computeFrameScore(i);
        any = true;
      }
    }
    el.textContent = any ? String(total) : "0";
  }

  function renderResultBanner() {
    const el = document.getElementById("resultBanner");
    if (!isGameFullyDone()) {
      el.hidden = true;
      el.className = "result-banner";
      return;
    }
    let total = 0;
    for (let i = 0; i < NUM_FRAMES; i++) total += computeFrameScore(i) ?? 0;
    el.hidden = false;
    if (total === 300) {
      el.className = "result-banner perfect";
      el.textContent = "🎉 PERFECT GAME — 300! 🎉";
    } else {
      el.className = "result-banner";
      el.textContent = `Game complete — final score: ${total}`;
    }
  }

  // ---------- Actions ----------

  // Chance that an eligible roll clears every standing pin (a strike on a fresh
  // rack, or a spare on a completing roll). The other pin counts split the rest.
  const STRIKE_OR_SPARE_RATE = 0.35;

  function startBowl() {
    const active = currentFrameIndex();
    if (active === -1 || phase !== "ready") return;
    const remaining = pinsRemaining(active);

    const actual = Math.random() < STRIKE_OR_SPARE_RATE
      ? remaining                                  // strike (remaining===10) or spare
      : Math.floor(Math.random() * remaining);      // uniform 0..remaining-1
    const pool = Array.from({ length: remaining }, (_, i) => i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    pendingFallenIdx = new Set(pool.slice(0, actual));
    pendingActual = actual;
    feedback = null;
    phase = "guessing";
    render();
  }

  function submitGuess(v, btnEl) {
    if (phase !== "guessing") return;
    if (v === pendingActual) {
      const active = currentFrameIndex();
      const rollPositionInFrame = frames[active].rolls.length;
      frames[active].rolls.push(pendingActual);
      const committedValue = pendingActual;
      pendingActual = null;
      pendingFallenIdx = new Set();
      feedback = null;
      advancePhaseAfterRoll();
      render();
      celebrate(active, rollPositionInFrame, committedValue);
    } else {
      feedback = { type: "wrong", guess: v };
      render();
      const freshBtn = [...document.querySelectorAll(".guess-btn")].find(b => b.textContent === (v === 10 ? "X" : String(v)));
      if (freshBtn) {
        freshBtn.classList.add("wrong-flash");
        setTimeout(() => freshBtn.classList.remove("wrong-flash"), 400);
      }
    }
  }

  // After a roll is committed, route into scoring mode for any frame that just
  // became computable, otherwise back to ready-to-bowl.
  function advancePhaseAfterRoll() {
    const needsScoring = findNextFrameNeedingScore();
    if (needsScoring !== -1) {
      scoringFrameIndex = needsScoring;
      scoreFeedback = null;
      phase = "scoring";
    } else {
      phase = "ready";
    }
  }

  function submitFrameScore() {
    if (phase !== "scoring") return;
    const input = document.getElementById("scoreInput");
    const raw = input.value.trim();
    if (raw === "") return;
    const guess = Number(raw);
    const actual = cumulativeThrough(scoringFrameIndex);

    if (guess === actual) {
      frameConfirmed[scoringFrameIndex] = true;
      const solvedIndex = scoringFrameIndex;
      scoreFeedback = null;
      const nextNeeded = findNextFrameNeedingScore();
      if (nextNeeded !== -1) {
        scoringFrameIndex = nextNeeded;
      } else {
        scoringFrameIndex = -1;
        phase = "ready";
      }
      render();
      flashFrameTotal(solvedIndex);
    } else {
      scoreFeedback = { type: "wrong", guess };
      render();
      const freshInput = document.getElementById("scoreInput");
      if (freshInput) {
        freshInput.value = "";
        freshInput.classList.add("wrong-flash");
        setTimeout(() => freshInput.classList.remove("wrong-flash"), 400);
        freshInput.focus();
      }
    }
  }

  function flashFrameTotal(frameIdx) {
    const totalEl = document.querySelector(`.frame[data-index="${frameIdx}"] .frame-total`);
    if (!totalEl) return;
    totalEl.classList.remove("celebrate");
    void totalEl.offsetWidth;
    totalEl.classList.add("celebrate");
  }

  function celebrate(frameIdx, rollIdx, committedValue) {
    const rolls = frames[frameIdx].rolls;
    const isLast = frameIdx === NUM_FRAMES - 1;
    const sym = isLast ? symbolFrame10(rolls, rollIdx) : symbolFrame19(rolls, rollIdx);
    if (sym !== "X" && sym !== "/") return;
    const totalEl = document.querySelector(`.frame[data-index="${frameIdx}"] .frame-total`);
    if (!totalEl) return;
    totalEl.classList.remove("celebrate");
    void totalEl.offsetWidth;
    totalEl.classList.add("celebrate");
  }

  // Undoing a roll can make an already-confirmed frame's score unknowable again
  // (its bonus rolls just disappeared) — un-confirm anything that's no longer computable.
  function unconfirmInvalidatedFrames() {
    for (let i = 0; i < NUM_FRAMES; i++) {
      if (frameConfirmed[i] && computeFrameScore(i) === null) frameConfirmed[i] = false;
    }
  }

  function undo() {
    if (phase === "scoring") return; // must solve the pending frame first
    if (phase === "guessing") {
      phase = "ready";
      pendingActual = null;
      pendingFallenIdx = new Set();
      feedback = null;
      render();
      return;
    }
    for (let i = NUM_FRAMES - 1; i >= 0; i--) {
      if (frames[i].rolls.length > 0) {
        frames[i].rolls.pop();
        unconfirmInvalidatedFrames();
        render();
        return;
      }
    }
  }

  function resetGame() {
    frames = makeFreshFrames();
    phase = "ready";
    pendingActual = null;
    pendingFallenIdx = new Set();
    feedback = null;
    frameConfirmed = new Array(NUM_FRAMES).fill(false);
    scoringFrameIndex = -1;
    scoreFeedback = null;
    render();
  }

  function updateUndoLabel() {
    const btn = document.getElementById("undoBtn");
    if (phase === "scoring") {
      btn.textContent = "↺ Solve the frame to continue";
      btn.disabled = true;
    } else {
      btn.textContent = phase === "guessing" ? "↺ Cancel this roll" : "↺ Undo last roll";
      btn.disabled = false;
    }
  }

  document.getElementById("undoBtn").addEventListener("click", undo);
  document.getElementById("resetBtn").addEventListener("click", resetGame);

  buildPinRack();
  render();
})();
