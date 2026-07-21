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

document.getElementById("btn-restart-50").onclick = () => {
  startScan({ resume: false, limit: 50 });
};

document.getElementById("btn-restart-500").onclick = () => {
  startScan({ resume: false, limit: 500 });
};

document.getElementById("btn-resume-50").onclick = () => {
  startScan({ resume: true, limit: 50 });
};

document.getElementById("btn-resume-500").onclick = () => {
  startScan({ resume: true, limit: 500 });
};

document.getElementById("btn-delete").onclick = deleteSelected;

/* ================= PROGRESS ================= */

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "UPDATE_PROGRESS") {
    updateProgress(msg.processed, msg.total);
  }
});

function updateProgress(processed, total) {
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");
  const statusText = document.getElementById("status-text");

  progressContainer.style.display = "block";

  const percentage =
    total > 0 ? Math.min(Math.round((processed / total) * 100), 100) : 0;

  progressBar.style.width = `${percentage}%`;
  statusText.innerText = `Scanning... ${processed} of ${total}`;
}

/* ================= SCAN ================= */

function startScan({ resume, limit }) {
  const deleteWrapper = document.getElementById("deleteWrapper");
  const statusText = document.getElementById("status-text");

  deleteWrapper.style.display = "none";

  updateProgress(0, limit);

  document.querySelectorAll(".btn").forEach((button) => {
    button.disabled = true;
  });

  chrome.runtime.sendMessage(
    {
      type: "FETCH_EMAILS",
      resume,
      limit,
    },
    (res) => {
      document.querySelectorAll(".btn").forEach((button) => {
        button.disabled = false;
      });

      document.getElementById("progress-container").style.display = "none";

      if (chrome.runtime.lastError) {
        statusText.innerText = "Could not scan emails.";
        console.error(chrome.runtime.lastError);
        return;
      }

      if (!res || res.error) {
        statusText.innerText = res?.error || "Could not scan emails.";
        return;
      }

      currentEmails = resume ? [...currentEmails, ...res.emails] : res.emails;

      statusText.innerText = `Scan complete. ${currentEmails.length} emails loaded.`;

      renderList();
    },
  );
}

/* ================= RENDER ================= */

function renderList() {
  const results = document.getElementById("results");
  const wrapper = document.getElementById("deleteWrapper");

  results.innerHTML = "";

  if (!currentEmails.length) {
    wrapper.style.display = "none";
    return;
  }

  currentEmails.sort((a, b) => {
    const aJunk = a.prediction?.label === "not_important";
    const bJunk = b.prediction?.label === "not_important";

    if (aJunk === bJunk) return 0;

    return aJunk ? -1 : 1;
  });

  currentEmails.forEach((email) => {
    const label = email.prediction?.label || "review";
    const isJunk = label === "not_important";
    const isReview = label === "review";

    const rawConfidence = email.prediction?.confidence ?? 0;
    const confidence = Math.round(rawConfidence * 100);

    let badgeText = "IMPORTANT";

    if (isJunk) {
      badgeText = "UNIMPORTANT";
    } else if (isReview) {
      badgeText = "REVIEW";
    }

    const item = document.createElement("div");
    item.className = "email-item";

    item.innerHTML = `
      ${
        isJunk
          ? `<input
               type="checkbox"
               class="chk"
               data-id="${escapeHtml(email.id)}"
               checked
             />`
          : `<div style="width:16px"></div>`
      }

      <div class="email-content">
        <div class="subject">${escapeHtml(
          email.subject || "(no subject)",
        )}</div>

        <div class="snippet">${escapeHtml(email.body || "")}</div>

        <span class="badge">${badgeText}</span>

        <div class="confidence">
          <div class="confidence-label">
            Confidence: ${confidence}%
          </div>

          <div class="confidence-bar">
            <div
              class="confidence-fill"
              style="width:${Math.min(confidence, 100)}%"
            ></div>
          </div>
        </div>
      </div>
    `;

    results.appendChild(item);
  });

  document.querySelectorAll(".chk").forEach((checkbox) => {
    checkbox.addEventListener("change", updateDeleteCount);
  });

  updateDeleteCount();
}

/* ================= DELETE BUTTON ================= */

function updateDeleteCount() {
  const checkedCount = document.querySelectorAll(".chk:checked").length;
  const wrapper = document.getElementById("deleteWrapper");
  const button = document.getElementById("btn-delete");

  wrapper.style.display = currentEmails.length > 0 ? "block" : "none";

  button.style.background = "";

  if (checkedCount > 0) {
    button.disabled = false;
    button.innerText = `Move ${checkedCount} Items to Trash`;
  } else {
    button.disabled = true;
    button.innerText = "Select emails to move to trash";
  }
}

/* ================= DELETE EMAILS ================= */

function deleteSelected() {
  const ids = Array.from(document.querySelectorAll(".chk:checked")).map(
    (checkbox) => checkbox.dataset.id,
  );

  if (!ids.length) return;

  const button = document.getElementById("btn-delete");
  const statusText = document.getElementById("status-text");

  button.innerText = "Moving to trash...";
  button.disabled = true;

  chrome.runtime.sendMessage(
    {
      type: "DELETE_EMAILS",
      ids,
    },
    (res) => {
      if (chrome.runtime.lastError) {
        button.disabled = false;
        button.innerText = "Try again";
        statusText.innerText = "Delete request failed.";
        console.error(chrome.runtime.lastError);
        return;
      }

      if (!res || res.error) {
        button.disabled = false;
        button.innerText = "Try again";
        statusText.innerText = res?.error || "Delete request failed.";
        return;
      }

      button.innerText = "Moved to Trash!";
      button.style.background = "var(--success)";
      statusText.innerText = `${ids.length} emails moved to trash.`;

      currentEmails = currentEmails.filter((email) => !ids.includes(email.id));

      setTimeout(() => {
        button.style.background = "";
        renderList();
      }, 1200);
    },
  );
}

/* ================= HTML SAFETY ================= */

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
