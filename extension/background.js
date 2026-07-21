console.log("Sweep-N-Spam service worker loaded");

const API_BASE_URL = "http://localhost:8001";

const AUTO_CLEAN_MAX_EMAILS = 5000;
const GMAIL_PAGE_SIZE = 100;
const DELETE_BATCH_SIZE = 500;
const FETCH_CONCURRENCY = 8;
const MIN_DELETE_CONFIDENCE = 0.8;

let autoCleanCancelled = false;

chrome.sidePanel
  .setPanelBehavior({
    openPanelOnActionClick: true,
  })
  .catch((error) => {
    console.error("Could not configure side panel:", error);
  });

function extractSubject(headers = []) {
  const subjectHeader = headers.find(
    (header) => header.name.toLowerCase() === "subject",
  );

  return subjectHeader?.value || "(no subject)";
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function getAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken(
      {
        interactive,
      },
      (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!token) {
          reject(new Error("Google authentication failed."));
          return;
        }

        resolve(token);
      },
    );
  });
}

async function getStoredCursor() {
  const data = await chrome.storage.local.get("lastCursor");
  return data.lastCursor || null;
}

async function setStoredCursor(cursor) {
  await chrome.storage.local.set({
    lastCursor: cursor,
  });
}

async function fetchWithRetry(url, options = {}, maximumAttempts = 5) {
  let delay = 1000;

  for (let attempt = 1; attempt <= maximumAttempts; attempt++) {
    const response = await fetch(url, options);

    if (response.ok) {
      return response;
    }

    const retryable =
      response.status === 429 ||
      response.status === 500 ||
      response.status === 502 ||
      response.status === 503 ||
      response.status === 504;

    if (!retryable || attempt === maximumAttempts) {
      const errorText = await response.text();

      throw new Error(`Request failed with ${response.status}: ${errorText}`);
    }

    await sleep(delay);
    delay *= 2;
  }

  throw new Error("Request failed after retries.");
}

async function classifyEmail(subject, body) {
  const response = await fetchWithRetry(
    `${API_BASE_URL}/predict`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: subject || "",
        body: body || "",
      }),
    },
    3,
  );

  return response.json();
}

async function fetchMessageDetails(token, messageId) {
  const response = await fetchWithRetry(
    `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json();

  if (!data.payload?.headers) {
    return null;
  }

  const subject = extractSubject(data.payload.headers);
  const body = data.snippet || "";

  let prediction;

  try {
    prediction = await classifyEmail(subject, body);
  } catch (error) {
    console.error(`Classification failed for ${messageId}:`, error);

    prediction = {
      label: "review",
      confidence: 0,
    };
  }

  return {
    id: messageId,
    subject,
    body,
    prediction,
    internalDate: Number(data.internalDate || 0),
  };
}

async function processWithConcurrency(items, concurrency, worker) {
  const results = [];
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      try {
        const result = await worker(items[currentIndex], currentIndex);

        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.error("Email processing failed:", error);
      }
    }
  }

  const workers = Array.from(
    {
      length: Math.min(concurrency, items.length),
    },
    () => runWorker(),
  );

  await Promise.all(workers);

  return results;
}

async function fetchEmailPage(token, pageToken = null, cursor = null) {
  const params = new URLSearchParams({
    maxResults: String(GMAIL_PAGE_SIZE),
  });

  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  if (cursor) {
    const beforeSeconds = Math.floor(cursor / 1000);
    params.set("q", `before:${beforeSeconds}`);
  }

  const response = await fetchWithRetry(
    `https://www.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return response.json();
}

async function fetchEmails({ token, limit, resume }) {
  const collected = [];
  let processed = 0;

  const cursor = resume ? await getStoredCursor() : null;

  let pageToken = null;

  do {
    const listData = await fetchEmailPage(token, pageToken, cursor);

    const messages = listData.messages || [];

    if (!messages.length) {
      break;
    }

    const remaining = limit - collected.length;
    const selectedMessages = messages.slice(0, remaining);

    const batch = await processWithConcurrency(
      selectedMessages,
      FETCH_CONCURRENCY,
      async (message) => {
        const email = await fetchMessageDetails(token, message.id);

        processed += 1;

        chrome.runtime
          .sendMessage({
            type: "UPDATE_PROGRESS",
            processed,
            total: limit,
          })
          .catch(() => {});

        return email;
      },
    );

    collected.push(...batch);

    pageToken = listData.nextPageToken || null;
  } while (pageToken && collected.length < limit);

  if (collected.length > 0) {
    const oldestDate = Math.min(
      ...collected.map((email) => email.internalDate).filter(Boolean),
    );

    if (Number.isFinite(oldestDate)) {
      await setStoredCursor(oldestDate);
    }
  }

  return collected.slice(0, limit).map(({ internalDate, ...email }) => email);
}

async function trashMessages(token, ids) {
  if (!ids.length) {
    return;
  }

  for (let start = 0; start < ids.length; start += DELETE_BATCH_SIZE) {
    const batch = ids.slice(start, start + DELETE_BATCH_SIZE);

    await fetchWithRetry(
      "https://www.googleapis.com/gmail/v1/users/me/messages/batchModify",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: batch,
          addLabelIds: ["TRASH"],
        }),
      },
    );

    chrome.runtime
      .sendMessage({
        type: "AUTO_CLEAN_DELETE_PROGRESS",
        deleted: Math.min(start + batch.length, ids.length),
        totalToDelete: ids.length,
      })
      .catch(() => {});

    await sleep(750);
  }
}

async function runAutoClean(token) {
  autoCleanCancelled = false;

  let pageToken = null;
  let scanned = 0;
  let deleted = 0;

  while (!autoCleanCancelled && scanned < AUTO_CLEAN_MAX_EMAILS) {
    const listData = await fetchEmailPage(token, pageToken, null);

    const messages = listData.messages || [];

    if (!messages.length) {
      break;
    }

    const remaining = AUTO_CLEAN_MAX_EMAILS - scanned;

    const selectedMessages = messages.slice(0, remaining);

    const emails = await processWithConcurrency(
      selectedMessages,
      FETCH_CONCURRENCY,
      async (message) => {
        const email = await fetchMessageDetails(token, message.id);

        scanned += 1;

        chrome.runtime
          .sendMessage({
            type: "AUTO_CLEAN_SCAN_PROGRESS",
            scanned,
            deleted,
            maximum: AUTO_CLEAN_MAX_EMAILS,
          })
          .catch(() => {});

        return email;
      },
    );

    const junkIds = emails
      .filter((email) => {
        const prediction = email.prediction;

        return (
          prediction?.label === "not_important" &&
          Number(prediction.confidence) >= MIN_DELETE_CONFIDENCE
        );
      })
      .map((email) => email.id);

    if (junkIds.length > 0) {
      await trashMessages(token, junkIds);
      deleted += junkIds.length;
    }

    chrome.runtime
      .sendMessage({
        type: "AUTO_CLEAN_BATCH_COMPLETE",
        scanned,
        deleted,
      })
      .catch(() => {});

    pageToken = listData.nextPageToken || null;

    if (!pageToken) {
      break;
    }

    await sleep(1000);
  }

  return {
    scanned,
    deleted,
    cancelled: autoCleanCancelled,
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FETCH_EMAILS") {
    (async () => {
      try {
        const token = await getAuthToken(true);

        const emails = await fetchEmails({
          token,
          limit: message.limit || 50,
          resume: message.resume === true,
        });

        sendResponse({
          emails,
        });
      } catch (error) {
        console.error("FETCH_EMAILS failed:", error);

        sendResponse({
          error: error.message,
        });
      }
    })();

    return true;
  }

  if (message.type === "DELETE_EMAILS") {
    (async () => {
      try {
        const token = await getAuthToken(false);

        await trashMessages(token, message.ids || []);

        sendResponse({
          status: "success",
          deletedIds: message.ids || [],
        });
      } catch (error) {
        console.error("DELETE_EMAILS failed:", error);

        sendResponse({
          error: error.message,
        });
      }
    })();

    return true;
  }

  if (message.type === "START_AUTO_CLEAN") {
    (async () => {
      try {
        const token = await getAuthToken(true);
        const result = await runAutoClean(token);

        sendResponse({
          status: "success",
          ...result,
        });
      } catch (error) {
        console.error("AUTO_CLEAN failed:", error);

        sendResponse({
          error: error.message,
        });
      }
    })();

    return true;
  }

  if (message.type === "STOP_AUTO_CLEAN") {
    autoCleanCancelled = true;

    sendResponse({
      status: "stopping",
    });

    return false;
  }

  return false;
});
