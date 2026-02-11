// Content script: Detects RSS/Atom feed links on any webpage
(function () {
    const feedLinks = [];

    // 1. Check <link> tags for alternate feeds
    const links = document.querySelectorAll(
        'link[type="application/rss+xml"], ' +
        'link[type="application/atom+xml"], ' +
        'link[type="application/xml"], ' +
        'link[type="text/xml"]'
    );

    links.forEach(link => {
        const href = link.href || link.getAttribute("href");
        const title = link.title || link.getAttribute("title") || "Untitled Feed";
        if (href) {
            feedLinks.push({
                url: href.startsWith("http") ? href : new URL(href, window.location.origin).href,
                title: title,
                type: link.type
            });
        }
    });

    // 2. Check for common RSS URL patterns in <a> tags
    const anchorPatterns = [/\.rss$/i, /\.xml$/i, /\/feed\/?$/i, /\/rss\/?$/i, /\/atom\/?$/i, /feeds\.feedburner\.com/i];
    const anchors = document.querySelectorAll("a[href]");

    anchors.forEach(a => {
        const href = a.href;
        if (anchorPatterns.some(p => p.test(href))) {
            // Avoid duplicates
            if (!feedLinks.find(f => f.url === href)) {
                feedLinks.push({
                    url: href,
                    title: a.textContent.trim().substring(0, 60) || "RSS Feed",
                    type: "discovered"
                });
            }
        }
    });

    // 3. Send results to background service worker
    if (feedLinks.length > 0) {
        chrome.runtime.sendMessage({
            action: "feedsDetected",
            feeds: feedLinks,
            pageUrl: window.location.href,
            pageTitle: document.title
        });
    }
})();
