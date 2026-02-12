// Content script: Detects RSS/Atom feed links on any webpage
(function () {
    const feedLinks = [];
    const seen = new Set();

    // Keep detection predictable on very large pages
    const MAX_FEEDS = 25;
    const MAX_ANCHORS_SCAN = 1500;

    // 1. Check <link> tags for alternate feeds
    const links = document.querySelectorAll(
        'link[type="application/rss+xml"], ' +
        'link[type="application/atom+xml"], ' +
        'link[type="application/xml"], ' +
        'link[type="text/xml"]'
    );

    for (const link of links) {
        if (feedLinks.length >= MAX_FEEDS) break;

        const href = link.href || link.getAttribute("href");
        const title = link.title || link.getAttribute("title") || "Untitled Feed";
        if (!href) continue;

        let url = null;
        try {
            url = href.startsWith("http") ? href : new URL(href, window.location.origin).href;
        } catch {
            continue;
        }

        if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) continue;
        if (seen.has(url)) continue;
        seen.add(url);

        feedLinks.push({
            url,
            title,
            type: link.type
        });
    }

    // 2. Check for common RSS URL patterns in <a> tags
    const anchorPatterns = [/\.rss$/i, /\.xml$/i, /\/feed\/?$/i, /\/rss\/?$/i, /\/atom\/?$/i, /feeds\.feedburner\.com/i];
    const anchors = document.querySelectorAll("a[href]");

    let scanned = 0;
    for (const a of anchors) {
        if (feedLinks.length >= MAX_FEEDS) break;
        if (scanned++ >= MAX_ANCHORS_SCAN) break;

        const href = a.href;
        if (!href || (!href.startsWith("http://") && !href.startsWith("https://"))) continue;
        if (seen.has(href)) continue;

        if (anchorPatterns.some(p => p.test(href))) {
            seen.add(href);
            feedLinks.push({
                url: href,
                title: a.textContent.trim().substring(0, 60) || "RSS Feed",
                type: "discovered"
            });
        }
    }

    // 3. Send results to background service worker
    if (feedLinks.length > 0) {
        chrome.runtime.sendMessage({
            action: "feedsDetected",
            feeds: feedLinks
        });
    }
})();
