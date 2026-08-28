(() => {
  "use strict";

  const NUM_FRAMES = 10;
  let frames = makeFreshFrames();
  let selection = new Set();

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

  // ---------- Rendering ----------

  function render() {
    renderScoresheet();
    renderGameTotal();
    renderStatus();
    renderPinRack();
    renderQuickActions();
    renderBowlRow();
    renderResultBanner();
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
      const score = computeFrameScore(i);
      if (score === null) {
        totalDiv.className = "frame-total pending";
        totalDiv.textContent = frames[i].rolls.length > 0 ? "…" : "";
      } else {
        totalDiv.className = "frame-total";
        totalDiv.textContent = String(score);
      }
      frameDiv.appendChild(totalDiv);

      el.appendChild(frameDiv);
    }
  }

  function renderPinRack() {
    const rack = document.getElementById("pinRack");
    rack.innerHTML = "";
    const active = currentFrameIndex();
    const remaining = active === -1 ? 0 : pinsRemaining(active);
    const rowSizes = [4, 3, 2, 1]; // back row to front pin
    let i = 0;

    for (const size of rowSizes) {
      const row = document.createElement("div");
      row.className = "pin-rack-row";
      for (let j = 0; j < size; j++) {
        const idx = i++;
        const isFallen = active === -1 || idx >= remaining;
        const isSelected = !isFallen && selection.has(idx);

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pin" + (isFallen ? " fallen" : "") + (isSelected ? " selected" : "");
        btn.disabled = isFallen;
        btn.setAttribute("aria-label", isFallen ? "Pin already down" : isSelected ? "Pin selected, click to deselect" : "Standing pin, click to knock down");

        const head = document.createElement("div");
        head.className = "pin-head";
        const body = document.createElement("div");
        body.className = "pin-body";
        btn.appendChild(head);
        btn.appendChild(body);

        if (!isFallen) {
          btn.addEventListener("click", () => togglePin(idx));
        }
        row.appendChild(btn);
      }
      rack.appendChild(row);
    }
  }

  function renderQuickActions() {
    const active = currentFrameIndex();
    const remaining = active === -1 ? null : pinsRemaining(active);
    const strikeBtn = document.getElementById("strikeBtn");
    const spareBtn = document.getElementById("spareBtn");
    const gutterBtn = document.getElementById("gutterBtn");

    const over = active === -1;
    strikeBtn.disabled = over || remaining !== 10;
    spareBtn.disabled = over || remaining === null || remaining === 10;
    gutterBtn.disabled = over;

    strikeBtn.onclick = () => addRoll(10);
    spareBtn.onclick = () => addRoll(remaining);
    gutterBtn.onclick = () => addRoll(0);
  }

  function renderBowlRow() {
    const countEl = document.getElementById("selectedCount");
    const bowlBtn = document.getElementById("bowlBtn");
    const bowlValue = document.getElementById("bowlValue");
    const active = currentFrameIndex();

    if (active === -1) {
      countEl.textContent = "Game complete — reset to bowl again.";
      bowlBtn.disabled = true;
      bowlValue.textContent = "";
      return;
    }

    const n = selection.size;
    countEl.textContent = n === 0
      ? "Tap standing pins, or Bowl now for a gutter ball."
      : `${n} pin${n === 1 ? "" : "s"} selected.`;
    bowlValue.textContent = ` (${n})`;
    bowlBtn.disabled = false;
    bowlBtn.onclick = () => addRoll(n);
  }

  function renderStatus() {
    const el = document.getElementById("statusLine");
    const active = currentFrameIndex();
    if (active === -1) {
      el.innerHTML = "";
      return;
    }
    const rollNum = frames[active].rolls.length + 1;
    const remaining = pinsRemaining(active);
    el.innerHTML = `Frame <strong>${active + 1}</strong>, roll <strong>${rollNum}</strong> — ${remaining} pin${remaining === 1 ? "" : "s"} standing`;
  }

  function renderGameTotal() {
    const el = document.getElementById("gameTotal");
    let total = 0;
    let any = false;
    for (let i = 0; i < NUM_FRAMES; i++) {
      const s = computeFrameScore(i);
      if (s !== null) {
        total += s;
        any = true;
      }
    }
    el.textContent = any ? String(total) : "0";
  }

  function renderResultBanner() {
    const el = document.getElementById("resultBanner");
    const active = currentFrameIndex();
    if (active !== -1) {
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

  function togglePin(idx) {
    if (selection.has(idx)) selection.delete(idx);
    else selection.add(idx);
    renderPinRack();
    renderBowlRow();
  }

  function addRoll(v) {
    const active = currentFrameIndex();
    if (active === -1) return;
    const remaining = pinsRemaining(active);
    if (remaining === null || v > remaining || v < 0) return;

    const rollPositionInFrame = frames[active].rolls.length;
    frames[active].rolls.push(v);
    selection = new Set();
    render();
    celebrate(active, rollPositionInFrame);
  }

  function celebrate(frameIdx, rollIdx) {
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

  function undo() {
    for (let i = NUM_FRAMES - 1; i >= 0; i--) {
      if (frames[i].rolls.length > 0) {
        frames[i].rolls.pop();
        selection = new Set();
        render();
        return;
      }
    }
  }

  function resetGame() {
    frames = makeFreshFrames();
    selection = new Set();
    render();
  }

  document.getElementById("undoBtn").addEventListener("click", undo);
  document.getElementById("resetBtn").addEventListener("click", resetGame);

  render();
})();
