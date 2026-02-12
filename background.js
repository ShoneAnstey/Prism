// Background Service Worker for Prism Reader

// Store detected feeds per tab
const tabFeeds = {};

// Listen for feed detection messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "feedsDetected" && sender.tab) {
        const tabId = sender.tab.id;
        tabFeeds[tabId] = {
            feeds: message.feeds
        };

        // Set badge with feed count
        const count = message.feeds.length;
        chrome.action.setBadgeText({ tabId: tabId, text: count.toString() });
        chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#a855f7" });
        chrome.action.setTitle({ tabId: tabId, title: `Prism Reader — ${count} feed${count > 1 ? 's' : ''} found!` });
    }

    if (message.action === "getDetectedFeedsForTab") {
        sendResponse(tabFeeds[message.tabId] || null);
    }

    return true;
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    delete tabFeeds[tabId];
});

// Clean up badge when navigating away
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
        delete tabFeeds[tabId];
        chrome.action.setBadgeText({ tabId: tabId, text: "" });
    }
});

// -------- PERIODIC FEED CHECKER (UNREAD BADGE) --------

// Set up alarms for periodic tasks
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create("checkFeeds", { periodInMinutes: 30 });
    chrome.alarms.create("syncOPML", { periodInMinutes: 60 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "checkFeeds") {
        await checkForNewArticles();
    } else if (alarm.name === "syncOPML") {
        await autoBackupOPML();
    }
});

// -------- CLEAR BADGE ON DASHBOARD OPEN --------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "clearBadge") {
        chrome.action.setBadgeText({ text: "" });
        chrome.action.setTitle({ title: "Prism Reader" });
        sendResponse({ ok: true });
    }
    return true;
});

// -------- OPML AUTO-BACKUP --------
async function autoBackupOPML() {
    try {
        const data = await chrome.storage.local.get("subscriptions");
        const subs = data.subscriptions || [];
        if (subs.length === 0) return;

        let opml = `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head>\n    <title>Prism Reader Subscriptions</title>\n    <dateCreated>${new Date().toUTCString()}</dateCreated>\n  </head>\n  <body>\n`;
        for (const sub of subs) {
            const title = (sub.title || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
            const url = (sub.url || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
            const site = (sub.siteUrl || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
            opml += `    <outline type="rss" text="${title}" title="${title}" xmlUrl="${url}" htmlUrl="${site}" />\n`;
        }
        opml += `  </body>\n</opml>`;

        await chrome.storage.local.set({
            opmlBackup: opml,
            opmlBackupDate: Date.now()
        });
        console.log("OPML auto-backup complete:", subs.length, "feeds");
    } catch (e) {
        console.error("OPML auto-backup error:", e);
    }
}

// -------- NEW ARTICLE CHECKER --------
async function checkForNewArticles() {
    try {
        const data = await chrome.storage.local.get(["subscriptions", "lastCheckedArticles"]);
        const subs = data.subscriptions || [];
        const lastChecked = data.lastCheckedArticles || {};

        if (subs.length === 0) return;

        let totalNew = 0;
        const updatedChecked = { ...lastChecked };

        for (const sub of subs) {
            try {
                let safeUrl = null;
                try {
                    const u = new URL(sub.url);
                    if (u.protocol === "http:" || u.protocol === "https:") safeUrl = u.toString();
                } catch { /* ignore invalid URL */ }
                if (!safeUrl) {
                    console.log(`Skipping unsafe feed URL: ${sub.url}`);
                    continue;
                }

                const response = await fetch(safeUrl, { signal: AbortSignal.timeout(10000) });
                const text = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, "text/xml");

                const items = doc.querySelectorAll("item, entry");
                const currentTitles = Array.from(items).map(i =>
                    i.querySelector("title")?.textContent || ""
                ).filter(Boolean);

                const previousTitles = lastChecked[safeUrl] || [];
                const newArticles = currentTitles.filter(t => !previousTitles.includes(t));

                totalNew += newArticles.length;
                updatedChecked[safeUrl] = currentTitles.slice(0, 20); // Store last 20 titles
            } catch (e) {
                console.log(`Feed check failed for ${sub.url}:`, e.message);
            }
        }

        await chrome.storage.local.set({ lastCheckedArticles: updatedChecked });

        // Update global badge with new article count
        if (totalNew > 0) {
            chrome.action.setBadgeText({ text: totalNew.toString() });
            chrome.action.setBadgeBackgroundColor({ color: "#22c55e" }); // Green for new articles
            chrome.action.setTitle({ title: `Prism Reader — ${totalNew} new article${totalNew > 1 ? 's' : ''}!` });
        }
    } catch (e) {
        console.error("Feed check error:", e);
    }
}
