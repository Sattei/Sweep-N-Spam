let currentEmails = [];

/* ================= DARK MODE ================= */
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("themeToggle");

  toggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    toggle.innerText = document.body.classList.contains("dark")
      ? "☀ Light"
      : "🌙 Dark";
  });
});

/* ================= BUTTONS ================= */

// Restart
document.getElementById("btn-restart-50").onclick = () =>
  startScan({ resume: false, limit: 50 });
document.getElementById("btn-restart-500").onclick = () =>
  startScan({ resume: false, limit: 500 });

// Resume
document.getElementById("btn-resume-50").onclick = () =>
  startScan({ resume: true, limit: 50 });
document.getElementById("btn-resume-500").onclick = () =>
  startScan({ resume: true, limit: 500 });

document.getElementById("btn-delete").onclick = deleteSelected;

/* ================= PROGRESS ================= */

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "UPDATE_PROGRESS") {
    updateProgress(msg.processed, msg.total);
  }
});

function updateProgress(processed, total) {
  document.getElementById("progress-container").style.display = "block";
  document.getElementById("progress-bar").style.width =
    Math.round((processed / total) * 100) + "%";
  document.getElementById("status-text").innerText = `Scanning... ${processed}`;
}

/* ================= SCAN ================= */

function startScan({ resume, limit }) {
  document.getElementById("deleteWrapper").style.display = "none";

  updateProgress(0, limit);

  document.querySelectorAll(".btn").forEach((b) => (b.disabled = true));

  chrome.runtime.sendMessage({ type: "FETCH_EMAILS", resume, limit }, (res) => {
    document.querySelectorAll(".btn").forEach((b) => (b.disabled = false));
    document.getElementById("progress-container").style.display = "none";
    document.getElementById("status-text").innerText = "Scan complete.";

    if (!res || res.error) return;

    currentEmails = resume ? [...currentEmails, ...res.emails] : res.emails;

    renderList();
  });
}

/* ================= RENDER ================= */

function renderList() {
  const results = document.getElementById("results");
  results.innerHTML = "";

  if (!currentEmails.length) return;

  currentEmails.sort((a, b) =>
    a.prediction.label === "not_important" ? -1 : 1
  );

  currentEmails.forEach((email) => {
    const isJunk = email.prediction.label === "not_important";
    const confidence = Math.round((email.prediction.confidence || 0.85) * 100);

    const item = document.createElement("div");
    item.className = "email-item";

    item.innerHTML = `
      ${
        isJunk
          ? `<input type="checkbox" class="chk" data-id="${email.id}" checked>`
          : `<div style="width:16px"></div>`
      }
      <div class="email-content">
        <div class="subject">${email.subject}</div>
        <div class="snippet">${email.body}</div>
        <span class="badge">${isJunk ? "UNIMPORTANT" : "IMPORTANT"}</span>
        <div class="confidence">
          <div class="confidence-label">Confidence: ${confidence}%</div>
          <div class="confidence-bar">
            <div class="confidence-fill" style="width:${confidence}%"></div>
          </div>
        </div>
      </div>
    `;

    results.appendChild(item);
  });

  // Attach listener to every checkbox to update the count instantly
  document.querySelectorAll(".chk").forEach((checkbox) => {
    checkbox.addEventListener("change", updateDeleteCount);
  });

  updateDeleteCount();
}

/* ================= DELETE UI LOGIC ================= */

function updateDeleteCount() {
  const checkedCount = document.querySelectorAll(".chk:checked").length;
  const wrapper = document.getElementById("deleteWrapper");
  const btn = document.getElementById("btn-delete");

  if (checkedCount > 0) {
    wrapper.style.display = "block";
    // Only update text if we are not currently in the "Deleted!" state
    if (!btn.disabled) {
      btn.innerText = `Move ${checkedCount} Items to Trash`;
    }
  } else {
    wrapper.style.display = "none";
  }
}

function deleteSelected() {
  const ids = Array.from(document.querySelectorAll(".chk:checked")).map(
    (c) => c.dataset.id
  );
  if (!ids.length) return;

  const btn = document.getElementById("btn-delete");

  // 1. Loading State
  btn.innerText = "Deleting...";
  btn.disabled = true;

  chrome.runtime.sendMessage({ type: "DELETE_EMAILS", ids }, () => {
    // 2. Success State
    btn.innerText = "Done!";
    btn.style.background = "var(--success)"; // Uses the green variable

    // 3. Wait 1.5s, then refresh UI
    setTimeout(() => {
      // Reset button for next time
      btn.disabled = false;
      btn.style.background = ""; // Revert to default red

      // Remove emails from local list
      currentEmails = currentEmails.filter((e) => !ids.includes(e.id));

      // Render will automatically hide the button because checked items are gone
      renderList();
    }, 1500);
  });
}
