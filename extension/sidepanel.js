let currentEmails = [];
let autoCleanRunning = false;

const statusText = document.getElementById("status-text");

const progressContainer = document.getElementById("progress-container");

const progressBar = document.getElementById("progress-bar");

const deleteWrapper = document.getElementById("deleteWrapper");

const deleteButton = document.getElementById("btn-delete");

const selectionActions = document.getElementById("selectionActions");

const autoCleanButton = document.getElementById("btn-auto-clean");

const stopAutoButton = document.getElementById("btn-stop-auto");

/* ================= DARK MODE ================= */

document.getElementById("themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");

  document.getElementById("themeToggle").innerText =
    document.body.classList.contains("dark") ? "☀ Light" : "🌙 Dark";
});

/* ================= BUTTONS ================= */

document.getElementById("btn-restart-50").onclick = () => {
  startScan({
    resume: false,
    limit: 50,
  });
};

document.getElementById("btn-restart-500").onclick = () => {
  startScan({
    resume: false,
    limit: 500,
  });
};

document.getElementById("btn-resume-50").onclick = () => {
  startScan({
    resume: true,
    limit: 50,
  });
};

document.getElementById("btn-resume-500").onclick = () => {
  startScan({
    resume: true,
    limit: 500,
  });
};

document.getElementById("btn-select-all").onclick = () => {
  document.querySelectorAll(".chk").forEach((checkbox) => {
    checkbox.checked = true;
  });

  updateDeleteCount();
};

document.getElementById("btn-clear-all").onclick = () => {
  document.querySelectorAll(".chk").forEach((checkbox) => {
    checkbox.checked = false;
  });

  updateDeleteCount();
};

deleteButton.onclick = deleteSelected;

autoCleanButton.onclick = startAutoClean;

stopAutoButton.onclick = stopAutoClean;

/* ================= MESSAGES ================= */

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "UPDATE_PROGRESS") {
    updateProgress(message.processed, message.total);
  }

  if (message.type === "AUTO_CLEAN_SCAN_PROGRESS") {
    progressContainer.style.display = "block";

    const percentage = Math.min(
      Math.round((message.scanned / message.maximum) * 100),
      100,
    );

    progressBar.style.width = `${percentage}%`;

    statusText.innerText =
      `Auto clean: scanned ${message.scanned}, ` +
      `moved ${message.deleted} to trash.`;
  }

  if (message.type === "AUTO_CLEAN_BATCH_COMPLETE") {
    statusText.innerText =
      `Auto clean: scanned ${message.scanned}, ` +
      `moved ${message.deleted} to trash.`;
  }
});

/* ================= SCANNING ================= */

function updateProgress(processed, total) {
  progressContainer.style.display = "block";

  const percentage =
    total > 0 ? Math.min(Math.round((processed / total) * 100), 100) : 0;

  progressBar.style.width = `${percentage}%`;

  statusText.innerText = `Scanning ${processed} of ${total}...`;
}

function setScanButtonsDisabled(disabled) {
  document
    .querySelectorAll(
      "#btn-restart-50, " +
        "#btn-restart-500, " +
        "#btn-resume-50, " +
        "#btn-resume-500",
    )
    .forEach((button) => {
      button.disabled = disabled;
    });
}

function startScan({ resume, limit }) {
  setScanButtonsDisabled(true);

  deleteWrapper.style.display = "none";
  selectionActions.style.display = "none";

  updateProgress(0, limit);

  chrome.runtime.sendMessage(
    {
      type: "FETCH_EMAILS",
      resume,
      limit,
    },
    (response) => {
      setScanButtonsDisabled(false);
      progressContainer.style.display = "none";

      if (chrome.runtime.lastError) {
        statusText.innerText = "Could not scan emails.";

        console.error(chrome.runtime.lastError);

        return;
      }

      if (!response || response.error) {
        statusText.innerText = response?.error || "Could not scan emails.";

        return;
      }

      currentEmails = resume
        ? [...currentEmails, ...response.emails]
        : response.emails;

      currentEmails = removeDuplicates(currentEmails);

      statusText.innerText =
        `Scan complete. ` + `${currentEmails.length} emails loaded.`;

      renderList();
    },
  );
}

/* ================= RENDER ================= */

function renderList() {
  const results = document.getElementById("results");

  results.innerHTML = "";

  if (!currentEmails.length) {
    deleteWrapper.style.display = "none";
    selectionActions.style.display = "none";

    results.innerHTML = `
      <div
        style="
          text-align:center;
          color:var(--muted);
          padding:24px 8px;
          font-size:12px;
        "
      >
        No emails to display.
      </div>
    `;

    return;
  }

  currentEmails.sort((a, b) => {
    return (
      labelPriority(a.prediction?.label) - labelPriority(b.prediction?.label)
    );
  });

  currentEmails.forEach((email) => {
    const label = email.prediction?.label || "review";

    const confidence = Math.round(
      Number(email.prediction?.confidence || 0) * 100,
    );

    const checked = label === "not_important" ? "checked" : "";

    let badgeHtml = "";

    // Do not show an "UNIMPORTANT" badge.
    if (label === "review") {
      badgeHtml = `
        <span class="badge badge-review">
          REVIEW
        </span>
      `;
    }

    if (label === "important") {
      badgeHtml = `
        <span class="badge badge-important">
          IMPORTANT
        </span>
      `;
    }

    const item = document.createElement("div");

    item.className = "email-item";

    item.innerHTML = `
      <input
        type="checkbox"
        class="chk"
        data-id="${escapeHtml(email.id)}"
        ${checked}
      />

      <div class="email-content">
        <div class="subject">
          ${escapeHtml(email.subject || "(no subject)")}
        </div>

        <div class="snippet">
          ${escapeHtml(email.body || "")}
        </div>

        ${badgeHtml}

        <div class="confidence">
          <div class="confidence-label">
            Confidence: ${confidence}%
          </div>

          <div class="confidence-bar">
            <div
              class="confidence-fill"
              style="
                width:${Math.min(confidence, 100)}%
              "
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

  selectionActions.style.display = "grid";

  updateDeleteCount();
}

function labelPriority(label) {
  if (label === "not_important") {
    return 0;
  }

  if (label === "review") {
    return 1;
  }

  return 2;
}

function removeDuplicates(emails) {
  const seen = new Set();

  return emails.filter((email) => {
    if (seen.has(email.id)) {
      return false;
    }

    seen.add(email.id);
    return true;
  });
}

/* ================= DELETE ================= */

function updateDeleteCount() {
  const checkedCount = document.querySelectorAll(".chk:checked").length;

  deleteWrapper.style.display = currentEmails.length > 0 ? "block" : "none";

  deleteButton.style.background = "";

  if (checkedCount > 0) {
    deleteButton.disabled = false;

    deleteButton.innerText =
      `Move ${checkedCount} ` +
      `${checkedCount === 1 ? "Email" : "Emails"} to Trash`;
  } else {
    deleteButton.disabled = true;

    deleteButton.innerText = "Select emails to move to trash";
  }
}

function deleteSelected() {
  const selectedIds = Array.from(document.querySelectorAll(".chk:checked")).map(
    (checkbox) => {
      return checkbox.dataset.id;
    },
  );

  if (!selectedIds.length) {
    return;
  }

  const confirmed = confirm(
    `Move ${selectedIds.length} selected ` + `emails to Gmail Trash?`,
  );

  if (!confirmed) {
    return;
  }

  deleteButton.disabled = true;
  deleteButton.innerText = "Moving emails to trash...";

  chrome.runtime.sendMessage(
    {
      type: "DELETE_EMAILS",
      ids: selectedIds,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        statusText.innerText = "Could not move emails to trash.";

        deleteButton.disabled = false;
        updateDeleteCount();
        return;
      }

      if (!response || response.error) {
        statusText.innerText =
          response?.error || "Could not move emails to trash.";

        deleteButton.disabled = false;
        updateDeleteCount();
        return;
      }

      const deletedIds = response.deletedIds || selectedIds;

      // Remove them immediately from the UI.
      currentEmails = currentEmails.filter((email) => {
        return !deletedIds.includes(email.id);
      });

      statusText.innerText = `${deletedIds.length} emails ` + `moved to trash.`;

      deleteButton.innerText = "Moved to Trash!";

      deleteButton.style.background = "var(--success)";

      renderList();
    },
  );
}

/* ================= AUTO CLEAN ================= */

function startAutoClean() {
  if (autoCleanRunning) {
    return;
  }

  const confirmed = confirm(
    "Auto Clean will scan up to 5,000 emails " +
      "and automatically move only emails " +
      "classified as not important with at " +
      "least 80% confidence to Gmail Trash.\n\n" +
      "Continue?",
  );

  if (!confirmed) {
    return;
  }

  autoCleanRunning = true;

  autoCleanButton.disabled = true;
  autoCleanButton.style.display = "none";
  stopAutoButton.style.display = "block";

  progressContainer.style.display = "block";
  progressBar.style.width = "0%";

  statusText.innerText = "Starting automatic cleanup...";

  chrome.runtime.sendMessage(
    {
      type: "START_AUTO_CLEAN",
    },
    (response) => {
      autoCleanRunning = false;

      autoCleanButton.disabled = false;
      autoCleanButton.style.display = "block";

      stopAutoButton.style.display = "none";

      progressContainer.style.display = "none";

      if (chrome.runtime.lastError) {
        statusText.innerText = "Auto clean was interrupted.";

        console.error(chrome.runtime.lastError);

        return;
      }

      if (!response || response.error) {
        statusText.innerText = response?.error || "Auto clean failed.";

        return;
      }

      statusText.innerText = response.cancelled
        ? `Auto clean stopped. Scanned ` +
          `${response.scanned}, moved ` +
          `${response.deleted} to trash.`
        : `Auto clean finished. Scanned ` +
          `${response.scanned}, moved ` +
          `${response.deleted} to trash.`;

      // Existing results may contain emails
      // that Auto Clean just deleted, so clear
      // the stale list.
      currentEmails = [];
      renderList();
    },
  );
}

function stopAutoClean() {
  stopAutoButton.disabled = true;
  stopAutoButton.innerText = "Stopping...";

  chrome.runtime.sendMessage(
    {
      type: "STOP_AUTO_CLEAN",
    },
    () => {
      statusText.innerText = "Stopping after the current batch...";

      stopAutoButton.disabled = false;
      stopAutoButton.innerText = "Stop Auto Clean";
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
