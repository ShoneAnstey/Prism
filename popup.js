async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function resolveSafeHttpUrl(maybeUrl) {
  if (!maybeUrl) return null;
  try {
    const url = new URL(maybeUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function getXmlContent(url) {
  const safeUrl = resolveSafeHttpUrl(url);
  if (!safeUrl) {
    throw new Error("Unsupported URL scheme (http/https only)");
  }
  const response = await fetch(safeUrl);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.text();
}

(async () => {
  const status = document.getElementById("status");

  try {
    const tab = await getCurrentTab();

    if (!tab.url) {
      throw new Error("Cannot access tab URL.");
    }

    status.textContent = "Scanning for feeds...";

    // 1. Ask background for detected feeds on this tab
    let detected = null;
    try {
      detected = await chrome.runtime.sendMessage({
        action: "getDetectedFeedsForTab",
        tabId: tab.id
      });
    } catch (e) {
      console.log("No background response:", e);
    }

    if (detected && detected.feeds && detected.feeds.length > 0) {
      const feeds = detected.feeds;

      if (feeds.length === 1) {
        // Single feed — open it directly
        status.textContent = "Opening feed...";
        const safeFeedUrl = resolveSafeHttpUrl(feeds[0].url);
        if (!safeFeedUrl) throw new Error("Unsupported URL scheme (http/https only)");
        const xmlString = await getXmlContent(safeFeedUrl);
        await chrome.storage.local.set({
          xmlData: xmlString,
          currentFeedUrl: safeFeedUrl
        });
        await chrome.tabs.create({ url: "reader.html" });
        window.close();
        return;
      }

      // Multiple feeds — show picker
      status.textContent = `${feeds.length} feeds found!`;

      const list = document.createElement("div");
      list.style.cssText = "margin-top:10px; max-height:250px; overflow-y:auto;";

      feeds.forEach(feed => {
        const btn = document.createElement("button");
        btn.style.cssText = "display:block; width:100%; padding:8px 12px; margin:4px 0; background:#2a2a3e; color:#fff; border:1px solid #444; border-radius:8px; cursor:pointer; text-align:left; font-size:13px;";
        btn.textContent = feed.title || feed.url;
        btn.title = feed.url;
        btn.addEventListener("click", async () => {
          status.textContent = "Loading feed...";
          list.style.display = "none";
          try {
            const safeFeedUrl = resolveSafeHttpUrl(feed.url);
            if (!safeFeedUrl) throw new Error("Unsupported URL scheme (http/https only)");
            const xmlString = await getXmlContent(safeFeedUrl);
            await chrome.storage.local.set({ xmlData: xmlString, currentFeedUrl: safeFeedUrl });
            await chrome.tabs.create({ url: "reader.html" });
            window.close();
          } catch (err) {
            status.textContent = "Failed: " + err.message;
            list.style.display = "block";
          }
        });
        list.appendChild(btn);
      });

      // Add "Open Dashboard" option
      const dashBtn = document.createElement("button");
      dashBtn.style.cssText = "display:block; width:100%; padding:8px 12px; margin:8px 0 4px; background:#a855f7; color:#fff; border:none; border-radius:8px; cursor:pointer; text-align:center; font-size:13px; font-weight:bold;";
      dashBtn.textContent = "📚 Open Dashboard";
      dashBtn.addEventListener("click", async () => {
        await chrome.tabs.create({ url: "home.html" });
        window.close();
      });
      list.appendChild(dashBtn);

      status.parentNode.appendChild(list);
      return; // Keep popup open for selection
    }

    // 2. Fallback: Try direct XML fetch (original behavior)
    status.textContent = "Checking content...";
    try {
      const safeTabUrl = resolveSafeHttpUrl(tab.url);
      if (!safeTabUrl) throw new Error("Not an http(s) page");

      const response = await fetch(safeTabUrl, { method: 'HEAD' });
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("xml") || tab.url.endsWith(".xml") || tab.url.endsWith(".rss")) {
        status.textContent = "Fetching XML...";
        const xmlString = await getXmlContent(safeTabUrl);
        await chrome.storage.local.set({
          xmlData: xmlString,
          currentFeedUrl: safeTabUrl
        });
        await chrome.tabs.create({ url: "reader.html" });
      } else {
        throw new Error("Not an XML file");
      }
    } catch (e) {
      console.log("Not an XML page, opening Dashboard.", e);
      await chrome.tabs.create({ url: "home.html" });
    }

    window.close();

  } catch (e) {
    console.error(e);
    status.textContent = "Failed: " + e.message;
  }
})();
