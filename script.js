(() => {
  "use strict";

  const NUM_FRAMES = 10;
  let frames = makeFreshFrames();

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
    // 10th frame
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

    // 10th frame — no borrowing, just sum what's been rolled once complete
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
    // k === 2
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

  function render() {
    renderScoresheet();
    renderPinRow();
    renderStatus();
    renderTotal();
  }

  function renderScoresheet() {
    const el = document.getElementById("scoresheet");
    el.innerHTML = "";
    const active = currentFrameIndex();

    for (let i = 0; i < NUM_FRAMES; i++) {
      const isLast = i === NUM_FRAMES - 1;
      const frameDiv = document.createElement("div");
      frameDiv.className = "frame" + (isLast ? " frame10" : "");

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

  function renderPinRow() {
    const row = document.getElementById("pinRow");
    row.innerHTML = "";
    const active = currentFrameIndex();

    if (active === -1) {
      for (let v = 0; v <= 10; v++) {
        row.appendChild(makePinButton(v, true));
      }
      return;
    }

    const remaining = pinsRemaining(active);
    for (let v = 0; v <= 10; v++) {
      const disabled = remaining === null || v > remaining;
      row.appendChild(makePinButton(v, disabled));
    }
  }

  function makePinButton(v, disabled) {
    const btn = document.createElement("button");
    btn.className = "pin" + (v === 10 ? " strike-btn" : "");
    btn.textContent = v === 10 ? "X" : String(v);
    btn.disabled = disabled;
    btn.setAttribute("aria-label", v === 10 ? "Strike — 10 pins" : `${v} pin${v === 1 ? "" : "s"}`);
    btn.addEventListener("click", () => addRoll(v));
    return btn;
  }

  function addRoll(v) {
    const active = currentFrameIndex();
    if (active === -1) return;
    const remaining = pinsRemaining(active);
    if (remaining === null || v > remaining) return;
    frames[active].rolls.push(v);
    render();
  }

  function undo() {
    for (let i = NUM_FRAMES - 1; i >= 0; i--) {
      if (frames[i].rolls.length > 0) {
        frames[i].rolls.pop();
        render();
        return;
      }
    }
  }

  function resetGame() {
    frames = makeFreshFrames();
    render();
  }

  function renderStatus() {
    const el = document.getElementById("statusLine");
    const active = currentFrameIndex();
    if (active === -1) {
      const total = flatRolls().length && computeFrameScore(9) !== null
        ? frames.reduce((sum, _, i) => sum + (computeFrameScore(i) ?? 0), 0)
        : null;
      el.innerHTML = total !== null
        ? `<strong>Game complete.</strong> Final score: <strong>${total}</strong>`
        : "";
      return;
    }
    const rollNum = frames[active].rolls.length + 1;
    const remaining = pinsRemaining(active);
    el.innerHTML = `Frame <strong>${active + 1}</strong>, roll <strong>${rollNum}</strong> — ${remaining} pin${remaining === 1 ? "" : "s"} standing.`;
  }

  function renderTotal() {
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

  document.getElementById("undoBtn").addEventListener("click", undo);
  document.getElementById("resetBtn").addEventListener("click", resetGame);

  render();
})();
