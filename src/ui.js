const stepIndexEl = document.getElementById("step-index");
const stepTextEl = document.getElementById("step-text");
const checklistEl = document.getElementById("checklist");
const toastEl = document.getElementById("toast");
const tooltipEl = document.getElementById("tooltip");
const endScreenEl = document.getElementById("end-screen");

let toastTimer = null;

export function setStep(idxLabel, text) {
  stepIndexEl.textContent = idxLabel;
  stepTextEl.textContent = text;
}

export function setChecklist(items) {
  checklistEl.innerHTML = items
    .map((it) => {
      const cls = it.state === "done" ? "done" : it.state === "current" ? "current" : "";
      const mark = it.state === "done" ? "✓" : it.state === "current" ? "▶" : "・";
      return `<div class="${cls}">${mark} ${it.text}</div>`;
    })
    .join("");
}

export function toast(msg, duration = 2600) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), duration);
}

export function setTooltip(text) {
  if (!text) {
    tooltipEl.style.display = "none";
    return;
  }
  tooltipEl.style.display = "block";
  tooltipEl.textContent = text;
}

export function showEndScreen() {
  endScreenEl.classList.remove("hidden");
}
