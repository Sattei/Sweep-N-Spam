console.log("Service Worker Loaded");

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

function extractSubject(headers) {
  const h = headers.find((h) => h.name === "Subject");
  return h ? h.value : "(no subject)";
}

async function getStoredCursor() {
  const data = await chrome.storage.local.get("lastCursor");
  return data.lastCursor || null;
}

async function setStoredCursor(cursor) {
  await chrome.storage.local.set({ lastCursor: cursor });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "FETCH_EMAILS") {
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }

      try {
        let collected = [];
        let totalProcessed = 0;

        const limit = msg.limit || 50;
        const resume = msg.resume === true;

       
        let cursor = resume ? await getStoredCursor() : null;

        let pageToken = null;

        do {
          let url =
            "https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=50";

          if (cursor) {
            const beforeSeconds = Math.floor(cursor / 1000);
            url += `&q=before:${beforeSeconds}`;
          }

          if (pageToken) {
            url += `&pageToken=${pageToken}`;
          }

          const listRes = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });

          const listData = await listRes.json();

          if (!listData.messages || listData.messages.length === 0) {
            break;
          }

          const batch = await Promise.all(
            listData.messages.map(async (m) => {
              try {
                const res = await fetch(
                  `https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata`,
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                const data = await res.json();

                if (!data.payload || !data.payload.headers) return null;

                const subject = extractSubject(data.payload.headers);
                const body = data.snippet || "";

                const clsRes = await fetch("http://localhost:8000/predict", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ subject, body }),
                });

                const prediction = await clsRes.json();

                totalProcessed++;
                chrome.runtime
                  .sendMessage({
                    type: "UPDATE_PROGRESS",
                    processed: totalProcessed,
                    total: limit,
                  })
                  .catch(() => {});

                return {
                  id: m.id,
                  subject,
                  body,
                  prediction,
                  internalDate: Number(data.internalDate),
                };
              } catch {
                return null;
              }
            })
          );

          const valid = batch.filter(Boolean);
          collected.push(...valid);

          pageToken = listData.nextPageToken;
        } while (pageToken && collected.length < limit);

        if (resume && collected.length > 0) {
          const oldest = Math.min(...collected.map((e) => e.internalDate));
          await setStoredCursor(oldest);
        }

        collected = collected.map(({ internalDate, ...rest }) => rest);

        sendResponse({ emails: collected });
      } catch (err) {
        sendResponse({ error: err.toString() });
      }
    });

    return true;
  }

  if (msg.type === "DELETE_EMAILS") {
    chrome.identity.getAuthToken({ interactive: false }, async (token) => {
      try {
        await fetch(
          "https://www.googleapis.com/gmail/v1/users/me/messages/batchModify",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ids: msg.ids,
              addLabelIds: ["TRASH"],
            }),
          }
        );

        sendResponse({ status: "success" });
      } catch (err) {
        sendResponse({ error: err.toString() });
      }
    });

    return true;
  }
});
