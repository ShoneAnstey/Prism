/**
 * viewer.js
 * Logic for the full-screen XML viewer.
 * Transforms raw XML into a Smart Content Browser.
 * Transforms raw XML into a Smart Content Browser.
 */

// --- SECURITY HELPERS ---

// Global HTML Escaper (prevents XSS in titles/attributes)
const escapeHtml = (unsafe) => {
    return (unsafe || "").replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

// Basic HTML Sanitizer for Article Content (removes scripts/handlers)
const sanitizeHtml = (html) => {
    if (!html) return "";
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Remove dangerous tags
    const badTags = ["script", "iframe", "object", "embed", "form", "base", "head", "meta", "link"];
    badTags.forEach(tag => {
        doc.querySelectorAll(tag).forEach(n => n.remove());
    });

    // Remove dangerous attributes (on*, javascript:)
    doc.querySelectorAll("*").forEach(el => {
        const attrs = Array.from(el.attributes);
        for (const attr of attrs) {
            if (attr.name.startsWith("on") ||
                attr.value.trim().toLowerCase().startsWith("javascript:") ||
                attr.value.trim().toLowerCase().startsWith("data:")) {
                el.removeAttribute(attr.name);
            }
        }
    });

    return doc.body.innerHTML;
};

// Per-feed color palette (curated, high-contrast, accessible)
const FEED_COLORS = [
    "#a78bfa", // purple
    "#38bdf8", // sky blue
    "#f472b6", // pink
    "#34d399", // emerald
    "#fb923c", // orange
    "#facc15", // yellow
    "#f87171", // red
    "#2dd4bf", // teal
    "#818cf8", // indigo
    "#a3e635"  // lime
];

// Get color for a feed by URL (deterministic hash fallback)
function getFeedColor(feedUrl, subscriptions) {
    if (subscriptions) {
        const sub = subscriptions.find(s => s.url === feedUrl);
        if (sub && sub.color) return sub.color;
        const idx = subscriptions.findIndex(s => s.url === feedUrl);
        if (idx >= 0) return FEED_COLORS[idx % FEED_COLORS.length];
    }
    // Fallback: hash-based
    let hash = 0;
    for (let i = 0; i < feedUrl.length; i++) hash = (hash * 31 + feedUrl.charCodeAt(i)) | 0;
    return FEED_COLORS[Math.abs(hash) % FEED_COLORS.length];
}

function formatLabel(tagName) {
    return tagName
        .replace(/[-_]/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatValue(text) {
    // Regex to detect URLs, but we must escape the text FIRST to prevent injection
    // Then wrap URLs. A simple approach is safer:
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return (text || "").replace(urlRegex, (url) => {
        // Double-encode quotes to be safe in href, though escapeHtml handles it
        const cleanUrl = escapeHtml(url);
        return `<a href="${cleanUrl}" target="_blank">${cleanUrl}</a>`;
    });
}

// Extract image from HTML string (found in description/content)
function extractImage(htmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    const img = doc.querySelector("img");
    return img ? img.src : null;
}

// Relative time (e.g. "2 hours ago")
function timeAgo(dateString) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Return original if invalid

    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return "Just now";
}

// Toast notification
function showToast(message, duration = 3000) {
    // Remove existing toast
    const existing = document.querySelector(".prism-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "prism-toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add("show"));

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// --- INLINE ARTICLE READER ---
let _articleList = []; // { title, link, content, date, feedTitle, feedUrl }
let _currentArticleIndex = -1;

function openArticleReader(article, articleList, index) {
    // Store for keyboard nav
    if (articleList) _articleList = articleList;
    if (typeof index === "number") _currentArticleIndex = index;

    // Remove existing reader
    document.querySelector(".article-reader-backdrop")?.remove();
    document.querySelector(".article-reader-panel")?.remove();

    // Backdrop
    const backdrop = document.createElement("div");
    backdrop.className = "article-reader-backdrop";
    backdrop.addEventListener("click", closeArticleReader);

    // Panel
    const panel = document.createElement("div");
    panel.className = "article-reader-panel";

    // Header
    panel.innerHTML = `
        <div class="article-reader-header">
            <div class="reader-nav">
                <button id="reader-prev" title="Previous (←)">←</button>
                <button id="reader-next" title="Next (→)">→</button>
            </div>
            <div style="display:flex; gap:6px;">
                <button id="reader-open" title="Open in new tab">↗ Open</button>
                <button id="reader-close" title="Close (Esc)">✕</button>
            </div>
        </div>
        <div class="article-reader-body">
            <div class="reader-meta">
                ${article.feedTitle ? `<span>${escapeHtml(article.feedTitle)}</span>` : ""}
                ${article.date ? `<span>• ${escapeHtml(article.date)}</span>` : ""}
            </div>
            <h1 class="reader-title">${escapeHtml(article.title || "Untitled")}</h1>
            <div class="reader-content">${sanitizeHtml(article.content) || "<p>No content available for this article. Click 'Open' to view the full article.</p>"}</div>
        </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    // Animate in
    requestAnimationFrame(() => {
        backdrop.classList.add("open");
        panel.classList.add("open");
    });

    // Wire buttons
    const prevBtn = panel.querySelector("#reader-prev");
    const nextBtn = panel.querySelector("#reader-next");

    panel.querySelector("#reader-close").addEventListener("click", closeArticleReader);
    panel.querySelector("#reader-open").addEventListener("click", () => {
        if (article.link) window.open(article.link, "_blank");
    });

    // Use arrow functions to capture current state at click time
    prevBtn.addEventListener("click", () => navigateArticle(-1));
    nextBtn.addEventListener("click", () => navigateArticle(1));

    // Update nav button states
    if (_currentArticleIndex <= 0) {
        prevBtn.style.opacity = "0.3";
        prevBtn.disabled = true;
    }
    if (_currentArticleIndex >= _articleList.length - 1) {
        nextBtn.style.opacity = "0.3";
        nextBtn.disabled = true;
    }

    // Keyboard listener
    // Remove old one first to prevent duplicates if cleanup failed
    if (document._readerKeyHandler) document.removeEventListener("keydown", document._readerKeyHandler);

    document._readerKeyHandler = (e) => {
        if (e.key === "Escape") closeArticleReader();
        else if (e.key === "ArrowLeft") navigateArticle(-1);
        else if (e.key === "ArrowRight") navigateArticle(1);
    };
    document.addEventListener("keydown", document._readerKeyHandler);

    // Track read
    if (article.feedTitle) trackArticleRead(article.feedTitle);

    // Scroll to top of body
    const bodyEl = panel.querySelector(".article-reader-body");
    if (bodyEl) bodyEl.scrollTop = 0;
}

function closeArticleReader() {
    const backdrop = document.querySelector(".article-reader-backdrop");
    const panel = document.querySelector(".article-reader-panel");
    if (backdrop) { backdrop.classList.remove("open"); setTimeout(() => backdrop.remove(), 300); }
    if (panel) { panel.classList.remove("open"); setTimeout(() => panel.remove(), 350); }
    if (document._readerKeyHandler) {
        document.removeEventListener("keydown", document._readerKeyHandler);
        document._readerKeyHandler = null;
    }
}

function navigateArticle(direction) {
    const newIndex = _currentArticleIndex + direction;
    if (newIndex >= 0 && newIndex < _articleList.length) {
        // Update index global BEFORE opening (though open sets it too)
        _currentArticleIndex = newIndex;
        openArticleReader(_articleList[newIndex], null, newIndex);
    }
}

// --- 2. SMART DETECTOR ---

function detectType(root) {
    const nodeName = root.nodeName.toLowerCase();
    if (nodeName === "rss" || nodeName === "rdf:rdf") return "rss";
    if (nodeName === "feed") return "atom";
    if (nodeName === "urlset") return "sitemap";
    return "generic";
}

// --- 3. RENDERERS ---

function renderHero(title, description, feedUrl) {
    const hero = document.createElement("div");
    hero.className = "hero";
    hero.id = "feed-hero";

    // --- Row 1: Logo + Title + Toolbar ---
    const row1 = document.createElement("div");
    row1.className = "hero-row1";
    row1.style.cssText = "display:flex; align-items:center; gap:12px; position:relative; z-index:2;";

    // Prism Brand Icon
    const brandIcon = document.createElement("img");
    brandIcon.src = "images/icon128.png";
    brandIcon.className = "brand-icon";
    // Clickable brand link → home
    const brandLink = document.createElement("div");
    brandLink.style.cssText = "display:flex; align-items:center; gap:12px; cursor:pointer; user-select:none; transition:opacity 0.2s;";
    brandLink.title = "Go to Dashboard";
    brandLink.addEventListener("click", () => { window.location.href = "home.html"; });
    brandLink.addEventListener("mouseenter", () => { brandLink.style.opacity = "0.8"; });
    brandLink.addEventListener("mouseleave", () => { brandLink.style.opacity = "1"; });

    brandLink.appendChild(brandIcon);

    // Prism Reader brand label (matches dashboard h1)
    const brandLabel = document.createElement("h1");
    brandLabel.innerHTML = `<span class="prism-text">Prism</span> Reader`;
    brandLabel.style.cssText = "margin:0; font-size:1.3rem; color:inherit; white-space:nowrap;";
    brandLink.appendChild(brandLabel);

    row1.appendChild(brandLink);

    // Toolbar container (search, stats, buttons will be injected here)
    const toolbar = document.createElement("div");
    toolbar.className = "hero-toolbar";
    toolbar.style.cssText = "display:flex; align-items:center; gap:16px; margin-left:auto;";
    row1.appendChild(toolbar);

    hero.appendChild(row1);

    // --- Row 2: Feed Logo + Description + Subscribe slot ---
    const row2 = document.createElement("div");
    row2.className = "hero-row2";
    row2.style.cssText = "display:flex; align-items:center; gap:8px; position:relative; z-index:2;";

    // Feed Logo (small, inline with description)
    if (feedUrl) {
        try {
            const domain = new URL(feedUrl).hostname;
            const logo = document.createElement("img");
            const feedColor = getFeedColor(feedUrl);
            logo.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
            logo.style.cssText = `width:20px; height:20px; border-radius:4px; background:#fff; padding:1px; box-shadow:0 0 0 2px ${feedColor}; flex-shrink:0;`;
            logo.onerror = () => { logo.style.display = "none"; };
            row2.appendChild(logo);
        } catch (e) {
            console.warn("Could not parse domain for logo", e);
        }
    }

    // Feed Title (inline with logo)
    const titleEl = document.createElement("span");
    titleEl.className = "hero-title";
    titleEl.textContent = title || "Untitled Feed";
    titleEl.style.cssText = "font-size:0.9rem; font-weight:700; white-space:nowrap; color:#f0f0f0;";
    row2.appendChild(titleEl);

    if (description) {
        const descEl = document.createElement("div");
        descEl.className = "hero-desc";
        descEl.textContent = description;
        row2.appendChild(descEl);
    }

    // Subscribe button slot will be appended here by init code
    hero.appendChild(row2);

    return hero;
}

// Generic Recursive Renderer (Fallback)
function renderGeneric(node, level = 0) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.trim() || null;
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const children = Array.from(node.childNodes);
    const elementChildren = children.filter(n => n.nodeType === Node.ELEMENT_NODE);
    const textChildren = children.filter(n => n.nodeType === Node.TEXT_NODE && n.nodeValue.trim());

    // Leaf
    if (elementChildren.length === 0) {
        const text = textChildren.map(n => n.nodeValue.trim()).join(" ");
        if (!text) return null;

        const row = document.createElement("div");
        row.className = "kv-row";
        row.innerHTML = `<div class="kv-label">${formatLabel(node.nodeName)}</div><div class="kv-value">${formatValue(text)}</div>`;
        return row;
    }

    // Container
    const container = document.createElement("div");
    if (level === 0) container.className = "generic-container"; // Root wrapper

    const wrapper = document.createElement("div");
    if (level > 0) {
        wrapper.className = "generic-card";
        const header = document.createElement("div");
        header.className = "generic-header";
        header.textContent = formatLabel(node.nodeName);
        wrapper.appendChild(header);
    }

    for (const child of elementChildren) {
        const renderedChild = renderGeneric(child, level + 1);
        if (renderedChild) {
            // If child returned a row string/element
            if (typeof renderedChild === 'string') {
                // Shouldn't happen based on logic above, but safety check
            } else {
                wrapper.appendChild(renderedChild);
            }
        }
    }

    container.appendChild(wrapper);
    return container;
}


// Full Grid Renderer for RSS/Atom
function renderSmartFeed(root, type, feedUrl) {
    const container = document.createElement("div");

    // A. Extract Channel Metadata
    let channel = type === "rss" ? root.querySelector("channel") : root;
    let title = channel.querySelector("title")?.textContent;
    let feedTitle = title; // Alias for use in card button handlers
    let desc = channel.querySelector("description")?.textContent || channel.querySelector("subtitle")?.textContent;

    container.appendChild(renderHero(title, desc, feedUrl));

    // B. Grid Container
    const grid = document.createElement("div");
    grid.className = "grid-container";
    grid.id = "feed-grid";

    // C. Process Items
    const items = type === "rss" ? root.querySelectorAll("item") : root.querySelectorAll("entry");

    // Pre-process all items to build the article list for navigation
    const allArticles = [];

    // First pass: Extract data
    items.forEach((item) => {
        const itemTitle = item.querySelector("title")?.textContent || "No Title";
        const itemLink = item.querySelector("link")?.textContent || item.querySelector("link")?.getAttribute("href");
        const itemDate = item.querySelector("pubDate")?.textContent || item.querySelector("updated")?.textContent || item.querySelector("date")?.textContent;

        let fullContent = "";
        const contentEncoded = item.getElementsByTagNameNS("*", "encoded");
        if (contentEncoded.length > 0) fullContent = contentEncoded[0].textContent || "";
        if (!fullContent) fullContent = item.querySelector("content")?.textContent || "";

        let itemDesc = item.querySelector("description")?.textContent || item.querySelector("summary")?.textContent || fullContent || "";
        let itemImage = extractImage(itemDesc);

        // Try <enclosure> for image
        if (!itemImage) {
            const enclosure = item.querySelector("enclosure");
            if (enclosure && enclosure.getAttribute("type")?.startsWith("image")) {
                itemImage = enclosure.getAttribute("url");
            }
            const mediaContent = item.getElementsByTagNameNS("*", "content");
            for (let i = 0; i < mediaContent.length; i++) {
                if (mediaContent[i].getAttribute("medium") === "image") {
                    itemImage = mediaContent[i].getAttribute("url");
                    break;
                }
            }
            const mediaThumbnail = item.getElementsByTagNameNS("*", "thumbnail");
            if (!itemImage && mediaThumbnail.length > 0) {
                itemImage = mediaThumbnail[0].getAttribute("url");
            }
        }

        // Clean text summary (Safe DOM Parsing)
        const tempDoc = new DOMParser().parseFromString(itemDesc, "text/html");
        const rawText = tempDoc.body.textContent || "";
        const textSummary = rawText.substring(0, 150) + (rawText.length > 150 ? "..." : "");

        allArticles.push({
            title: itemTitle,
            link: itemLink,
            content: fullContent || itemDesc, // Prefer full content
            date: itemDate ? timeAgo(itemDate) : "",
            originalDate: itemDate, // Store original for sorting if needed
            feedTitle: feedTitle,
            feedUrl: feedUrl,
            image: itemImage,
            description: itemDesc,
            textSummary: textSummary
        });
    });

    // Second pass: Render cards using the pre-processed data
    allArticles.forEach((article, index) => {
        const card = document.createElement("article");
        card.className = "news-card";
        card.style.borderLeft = `3px solid ${getFeedColor(feedUrl)}`;

        // Body
        const body = document.createElement("div");
        body.className = "card-body";

        // Read Time
        const wordCount = (article.title + " " + article.description).split(/\s+/).length;
        const readTime = Math.ceil(wordCount / 200);
        const timeString = readTime < 1 ? "1 min read" : `${readTime} min read`;

        // Meta
        const meta = document.createElement("div");
        meta.className = "card-meta";
        meta.innerHTML = `<span>${article.date}</span><span>${timeString}</span>`;
        body.appendChild(meta);

        // Title
        const h2 = document.createElement("h3");
        h2.className = "card-title";
        h2.textContent = article.title;
        body.appendChild(h2);

        // Summary
        const p = document.createElement("p");
        p.className = "card-desc card-limit-lines";
        p.textContent = article.textSummary;
        body.appendChild(p);

        // Footer
        if (article.link) {
            const footer = document.createElement("div");
            footer.className = "card-footer";
            footer.style.cssText = "display:flex; align-items:center; gap:8px; flex-wrap:wrap;";

            const btn = document.createElement("button");
            btn.className = "read-btn";
            btn.textContent = "Read Article →";
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                // PASS FULL LIST HERE!
                openArticleReader(article, allArticles, index);
            });
            footer.appendChild(btn);

            // Save for Later
            const saveBtn = document.createElement("button");
            saveBtn.className = "read-btn";
            saveBtn.textContent = "🔖";
            saveBtn.title = "Save for Later";
            saveBtn.style.cssText = "padding:4px 10px; font-size:1rem; min-width:auto;";
            saveBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const added = await addToReadLater({
                    title: article.title,
                    link: article.link,
                    desc: article.textSummary,
                    image: article.image,
                    feedTitle: article.feedTitle,
                    date: article.originalDate
                });
                if (added) {
                    saveBtn.textContent = "✅";
                    showToast("📌 Saved! Find it on your Dashboard.");
                } else {
                    saveBtn.textContent = "📌";
                    showToast("Already saved!");
                }
                setTimeout(() => { saveBtn.textContent = "🔖"; }, 2000);
            });
            footer.appendChild(saveBtn);

            // TTS
            const ttsBtn = document.createElement("button");
            ttsBtn.className = "read-btn";
            ttsBtn.textContent = "🔊";
            ttsBtn.title = "Listen to article";
            ttsBtn.style.cssText = "padding:4px 10px; font-size:1rem; min-width:auto;";
            ttsBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (window.speechSynthesis.speaking) {
                    window.speechSynthesis.cancel();
                    ttsBtn.textContent = "🔊";
                    return;
                }
                const utterance = new SpeechSynthesisUtterance(article.title + ". " + article.textSummary);
                utterance.rate = 1.0;
                utterance.onend = () => { ttsBtn.textContent = "🔊"; };
                utterance.onstart = () => { ttsBtn.textContent = "⏸️"; };
                window.speechSynthesis.speak(utterance);
            });
            footer.appendChild(ttsBtn);

            // Translate
            const translateBtn = document.createElement("button");
            translateBtn.className = "read-btn";
            translateBtn.textContent = "🌐";
            translateBtn.title = "Translate to English";
            translateBtn.style.cssText = "padding:4px 10px; font-size:1rem; min-width:auto;";
            translateBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const titleEl = card.querySelector(".card-title");
                const descEl = card.querySelector(".card-desc");
                translateBtn.textContent = "⏳";
                try {
                    const textToTranslate = (titleEl?.textContent || "") + " ||| " + (descEl?.textContent || "");
                    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate.substring(0, 500))}&langpair=autodetect|en`);
                    const data = await res.json();
                    if (data.responseData?.translatedText) {
                        const parts = data.responseData.translatedText.split(" ||| ");
                        if (titleEl && parts[0]) titleEl.textContent = parts[0];
                        if (descEl && parts[1]) descEl.textContent = parts[1];
                    }
                    translateBtn.textContent = "✅";
                } catch (err) {
                    console.error("Translation failed:", err);
                    translateBtn.textContent = "❌";
                }
                setTimeout(() => { translateBtn.textContent = "🌐"; }, 2000);
            });
            footer.appendChild(translateBtn);
            body.appendChild(footer);

            card.classList.add("clickable-card");
            card.addEventListener("click", (e) => {
                if (e.target.closest(".read-btn") || e.target.closest("button")) return;
                // PASS FULL LIST HERE TOO!
                openArticleReader(article, allArticles, index);
            });
        }

        // Hidden data for search
        card.dataset.search = (article.title + " " + article.textSummary).toLowerCase();

        card.appendChild(body);

        // Staggered Animation
        card.style.animationDelay = `${index * 0.05}s`;
        card.classList.add("animate-enter");

        // 3D Tilt Effect
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * -5;
            const rotateY = ((x - centerX) / centerX) * 5;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = `perspective(1000px) rotateX(0) rotateY(0) scale(1)`;
        });

        grid.appendChild(card);
    });

    container.appendChild(grid);

    // Deferred keyword highlighting
    getKeywords().then(keywords => {
        if (!keywords.length) return;
        grid.querySelectorAll(".news-card").forEach(card => {
            const searchText = card.dataset.search || "";
            const matches = matchesKeywords(searchText, keywords);
            if (matches.length > 0) {
                const titleEl = card.querySelector(".card-title");
                if (titleEl) {
                    matches.forEach(kw => {
                        const tag = document.createElement("span");
                        tag.className = "keyword-tag";
                        tag.textContent = kw;
                        titleEl.appendChild(tag);
                    });
                }
                card.style.borderColor = "var(--accent-color)";
                card.style.boxShadow = "0 0 12px rgba(168, 85, 247, 0.2)";
            }
        });
    });
    // Keyboard shortcuts: j/k to navigate cards, Enter/o to open
    let focusedIdx = -1;
    const updateFocus = (newIdx) => {
        const cards = grid.querySelectorAll(".news-card");
        if (!cards.length) return;
        if (newIdx < 0) newIdx = 0;
        if (newIdx >= cards.length) newIdx = cards.length - 1;
        cards.forEach(c => c.classList.remove("keyboard-focus"));
        focusedIdx = newIdx;
        cards[focusedIdx].classList.add("keyboard-focus");
        cards[focusedIdx].scrollIntoView({ behavior: "smooth", block: "center" });
    };
    document._gridKeyHandler = (e) => {
        if (document.querySelector(".article-reader-panel")) return; // reader open
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
        const cards = grid.querySelectorAll(".news-card");
        if (!cards.length) return;
        if (e.key === "j") { e.preventDefault(); updateFocus(focusedIdx + 1); }
        else if (e.key === "k") { e.preventDefault(); updateFocus(focusedIdx - 1); }
        else if ((e.key === "Enter" || e.key === "o") && focusedIdx >= 0) {
            e.preventDefault();
            cards[focusedIdx].querySelector(".card-title")?.click();
        }
    };
    document.addEventListener("keydown", document._gridKeyHandler);

    return container;
}


// --- 4. MAIN INIT ---

// --- 5. SUBSCRIPTION MANAGER ---

async function getSubscriptions() {
    const data = await chrome.storage.local.get("subscriptions");
    return data.subscriptions || [];
}

async function addSubscription(url, title, category = "Uncategorized") {
    const subs = await getSubscriptions();
    if (!subs.find(s => s.url === url)) {
        const color = FEED_COLORS[subs.length % FEED_COLORS.length];
        subs.push({ url, title, addedAt: Date.now(), color, category });
        await chrome.storage.local.set({ subscriptions: subs });
        return true;
    }
    return false;
}

async function removeSubscription(url) {
    const subs = await getSubscriptions();
    const filtered = subs.filter(s => s.url !== url);
    await chrome.storage.local.set({ subscriptions: filtered });
}

// Update a subscription's properties (category, color, etc.)
async function updateSubscription(url, updates) {
    const subs = await getSubscriptions();
    const sub = subs.find(s => s.url === url);
    if (sub) {
        Object.assign(sub, updates);
        await chrome.storage.local.set({ subscriptions: subs });
    }
}

// Get unique categories from subscriptions
async function getCategories() {
    const subs = await getSubscriptions();
    const cats = [...new Set(subs.map(s => s.category || "Uncategorized"))];
    return cats.sort((a, b) => a === "Uncategorized" ? 1 : b === "Uncategorized" ? -1 : a.localeCompare(b));
}

// --- OPML IMPORT / EXPORT ---

function exportOPML(subscriptions) {
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<opml version="2.0">',
        '  <head><title>Prism Reader Subscriptions</title></head>',
        '  <body>'
    ];
    subscriptions.forEach(sub => {
        const title = (sub.title || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        const url = (sub.url || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        const category = sub.category ? ` category="${sub.category.replace(/"/g, "&quot;")}"` : "";
        lines.push(`    <outline text="${title}" title="${title}" type="rss" xmlUrl="${url}"${category} />`);
    });
    lines.push('  </body>', '</opml>');

    const blob = new Blob([lines.join('\n')], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prism-feeds.opml';
    a.click();
    URL.revokeObjectURL(url);
}

async function importOPML(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(e.target.result, "text/xml");
                const outlines = doc.querySelectorAll('outline[xmlUrl]');
                const imported = [];

                for (const outline of outlines) {
                    const url = outline.getAttribute('xmlUrl');
                    const title = outline.getAttribute('title') || outline.getAttribute('text') || url;
                    const category = outline.getAttribute('category') ||
                        outline.parentElement?.getAttribute('text') || "";
                    if (url) {
                        const added = await addSubscription(url, title);
                        if (added) imported.push({ url, title, category });
                    }
                }
                resolve(imported);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

// --- READ LATER QUEUE ---

async function getReadLater() {
    const data = await chrome.storage.local.get("readLater");
    return data.readLater || [];
}

async function addToReadLater(article) {
    const items = await getReadLater();
    if (!items.find(i => i.link === article.link)) {
        items.unshift({
            ...article,
            savedAt: Date.now()
        });
        await chrome.storage.local.set({ readLater: items });
        return true;
    }
    return false;
}

async function removeFromReadLater(link) {
    let items = await getReadLater();
    items = items.filter(i => i.link !== link);
    await chrome.storage.local.set({ readLater: items });
}

// --- KEYWORD WATCHLIST ---

async function getKeywords() {
    const data = await chrome.storage.local.get("keywords");
    return data.keywords || [];
}

async function addKeyword(keyword) {
    const keywords = await getKeywords();
    const normalized = keyword.trim().toLowerCase();
    if (normalized && !keywords.includes(normalized)) {
        keywords.push(normalized);
        await chrome.storage.local.set({ keywords });
        return true;
    }
    return false;
}

async function removeKeyword(keyword) {
    let keywords = await getKeywords();
    keywords = keywords.filter(k => k !== keyword);
    await chrome.storage.local.set({ keywords });
}

function matchesKeywords(text, keywords) {
    if (!text || !keywords.length) return [];
    const lower = text.toLowerCase();
    return keywords.filter(k => lower.includes(k));
}

// --- READING STATS ---

async function getReadingStats() {
    const data = await chrome.storage.local.get("readingStats");
    return data.readingStats || { totalArticles: 0, totalTime: 0, streak: 0, lastReadDate: null, history: [] };
}

async function trackArticleRead(feedTitle) {
    const stats = await getReadingStats();
    const today = new Date().toDateString();

    stats.totalArticles++;

    // Streak logic
    if (stats.lastReadDate) {
        const lastDate = new Date(stats.lastReadDate);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (lastDate.toDateString() === yesterday.toDateString()) {
            stats.streak++;
        } else if (lastDate.toDateString() !== today) {
            stats.streak = 1;
        }
    } else {
        stats.streak = 1;
    }
    stats.lastReadDate = today;

    // History (last 30 days)
    const histEntry = stats.history.find(h => h.date === today);
    if (histEntry) {
        histEntry.count++;
    } else {
        stats.history.push({ date: today, count: 1 });
        if (stats.history.length > 30) stats.history.shift();
    }

    await chrome.storage.local.set({ readingStats: stats });
    return stats;
}

// --- 6. RENDERERS (EXTENDED) ---

function renderDashboard(subscriptions) {
    const container = document.createElement("div");

    // Hide the default navbar — hero replaces it on dashboard
    const defaultHeader = document.querySelector(".header");
    if (defaultHeader) defaultHeader.style.display = "none";

    // Remove .content padding — hero and layout manage their own
    const contentEl = document.querySelector(".content");
    if (contentEl) contentEl.style.padding = "0 16px";

    // Clear new-article badge when dashboard opens
    chrome.runtime.sendMessage({ action: "clearBadge" });

    // Combined Hero Bar (replaces both navbar and old hero)
    const hero = document.createElement("div");
    hero.className = "hero";
    hero.style.cssText = "padding:16px 24px; position:relative; border-radius:0; border:none; border-bottom:1px solid var(--border-color); margin-bottom:0;";
    hero.innerHTML = `
        <button class="close-btn" id="hero-close-btn" aria-label="Close" title="Close Tab" style="position:absolute; top:12px; right:16px; z-index:3;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:20px; position:relative; z-index:2;">
            <div style="display:flex; flex-direction:column; gap:10px; flex-shrink:0;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="images/icon128.png" class="brand-icon">
                    <h1 style="margin:0; font-size:1.3rem; color:var(--text-primary);"><span class="prism-text">Prism</span> Reader</h1>
                    <span style="opacity:0.6; font-size:0.8rem; color:var(--text-secondary);">${subscriptions.length} feed${subscriptions.length !== 1 ? 's' : ''}</span>
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                    <button class="action-btn" id="btn-import-opml">📥 Import</button>
                    <button class="action-btn" id="btn-export-opml">📤 Export</button>
                    <button class="action-btn" id="btn-manage-keywords">🏷️ Watchlist</button>
                    <button class="close-btn" id="hero-theme-btn" title="Toggle Theme" style="font-size:1.1rem;">☀</button>
                    <button class="close-btn" id="hero-dashboard-btn" title="Toggle Grid/List View" style="font-size:1.1rem;">⊞</button>
                    <button class="close-btn" id="hero-lightning-btn" title="Support via Lightning ⚡" style="font-size:1.1rem;">⚡</button>
                </div>
            </div>
            <div id="hero-chart-row" style="display:flex; align-items:center; gap:14px; margin-right:30px;">
                <div id="stats-widget" style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;"></div>
            </div>
        </div>
    `;
    container.appendChild(hero);

    // Wire up hero bar controls
    setTimeout(() => {
        const heroTheme = document.getElementById("hero-theme-btn");
        const heroClose = document.getElementById("hero-close-btn");
        const heroDash = document.getElementById("hero-dashboard-btn");

        // Theme toggle
        chrome.storage.local.get("theme", (data) => {
            if (data.theme === "light") {
                document.body.classList.add("light-mode");
                if (heroTheme) heroTheme.textContent = "🌙";
            }
        });
        if (heroTheme) heroTheme.addEventListener("click", () => {
            document.body.classList.toggle("light-mode");
            const isLight = document.body.classList.contains("light-mode");
            heroTheme.textContent = isLight ? "🌙" : "☀";
            chrome.storage.local.set({ theme: isLight ? "light" : "dark" });
        });

        // Close
        if (heroClose) heroClose.addEventListener("click", () => window.close());

        // Grid/List toggle for Your Feeds
        if (heroDash) {
            chrome.storage.local.get("feedViewMode", (data) => {
                if (data.feedViewMode === "list") {
                    heroDash.textContent = "☰";
                }
            });
            heroDash.addEventListener("click", () => {
                const grids = document.querySelectorAll(".main-content .grid-container");
                const isGrid = !grids[0]?.classList.contains("list-view");
                grids.forEach(g => g.classList.toggle("list-view", isGrid));
                heroDash.textContent = isGrid ? "☰" : "⊞";
                heroDash.title = isGrid ? "Switch to Grid View" : "Switch to List View";
                chrome.storage.local.set({ feedViewMode: isGrid ? "list" : "grid" });
            });
        }

        // Lightning ⚡ donation modal
        const heroLightning = document.getElementById("hero-lightning-btn");
        if (heroLightning) heroLightning.addEventListener("click", () => {
            // Remove existing modal if any
            document.querySelector(".lightning-modal-backdrop")?.remove();
            const backdrop = document.createElement("div");
            backdrop.className = "lightning-modal-backdrop";
            backdrop.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);";
            backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });

            const modal = document.createElement("div");
            modal.style.cssText = "background:var(--card-bg);border:1px solid var(--border-color);border-radius:16px;padding:32px;max-width:340px;text-align:center;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.5);";
            const lnurl = "LNURL1DP68GURN8GHJ7AMPD3KX2AR0VEEKZAR0WD5XJTNRDAKJ7TNHV4KXCTTTDEHHWM30D3H82UNVWQHK2MN8V9NK2ERRDAHKKWF33KZVVM";
            modal.innerHTML = `
                <button class="lightning-modal-close" style="position:absolute;top:10px;right:14px;background:none;border:none;color:var(--text-secondary);font-size:1.3rem;cursor:pointer;">✕</button>
                <div style="font-size:1.8rem;margin-bottom:8px;">⚡</div>
                <h3 style="margin:0 0 4px;color:var(--text-primary);font-size:1.1rem;">Support Prism Reader</h3>
                <p style="margin:0 0 16px;color:var(--text-secondary);font-size:0.85rem;">Scan with any Lightning wallet</p>
                <img src="images/lightning-qr.png" style="width:220px;height:220px;border-radius:12px;background:#fff;padding:8px;margin-bottom:16px;" alt="Lightning QR Code">
                <div style="display:flex;align-items:center;gap:6px;background:var(--bg-color);border:1px solid var(--border-color);border-radius:8px;padding:8px 12px;margin-top:4px;">
                    <input readonly value="${lnurl}" style="flex:1;background:none;border:none;color:var(--text-secondary);font-size:0.65rem;font-family:monospace;outline:none;width:0;" id="lnurl-copy-field">
                    <button id="lnurl-copy-btn" style="background:var(--accent-color);color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:0.75rem;cursor:pointer;white-space:nowrap;">Copy</button>
                </div>
            `;
            backdrop.appendChild(modal);
            document.body.appendChild(backdrop);

            modal.querySelector(".lightning-modal-close").addEventListener("click", () => backdrop.remove());

            document.getElementById("lnurl-copy-btn").addEventListener("click", () => {
                navigator.clipboard.writeText(lnurl).then(() => {
                    const btn = document.getElementById("lnurl-copy-btn");
                    btn.textContent = "Copied!";
                    setTimeout(() => btn.textContent = "Copy", 2000);
                });
            });
        });

        // Update Export tooltip with last auto-backup time
        const exportBtn = document.getElementById("btn-export-opml");
        if (exportBtn) {
            chrome.storage.local.get("opmlBackupDate", (data) => {
                if (data.opmlBackupDate) {
                    const ago = Math.round((Date.now() - data.opmlBackupDate) / 60000);
                    exportBtn.title = `Last auto-backup: ${ago < 1 ? "just now" : ago + " min ago"}`;
                }
            });
        }
    }, 0);

    // Hidden file input for OPML import
    const opmlInput = document.createElement("input");
    opmlInput.type = "file";
    opmlInput.accept = ".opml,.xml";
    opmlInput.style.display = "none";
    opmlInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const imported = await importOPML(file);
            alert(`Imported ${imported.length} new feed(s)!`);
            window.location.reload();
        } catch (err) {
            alert("Import failed: " + err.message);
        }
    });
    container.appendChild(opmlInput);

    // Wire up action buttons (after appending to DOM, use setTimeout)
    setTimeout(() => {
        const importBtn = document.getElementById("btn-import-opml");
        const exportBtn = document.getElementById("btn-export-opml");
        const keywordBtn = document.getElementById("btn-manage-keywords");
        const statsWidget = document.getElementById("stats-widget");

        if (importBtn) importBtn.addEventListener("click", () => opmlInput.click());
        if (exportBtn) exportBtn.addEventListener("click", () => exportOPML(subscriptions));

        // Keywords modal
        if (keywordBtn) keywordBtn.addEventListener("click", () => showKeywordModal());

        // Stats widget with mini sparkline
        Promise.all([getReadingStats(), getReadLater()]).then(([stats, savedItems]) => {
            if (statsWidget) {
                statsWidget.innerHTML = `
                    <span class="stat-item">📖 ${stats.totalArticles} read</span>
                    <span class="stat-item">🔥 ${stats.streak} day streak</span>
                    <span class="stat-item stat-item-link" id="stat-saved" style="cursor:pointer;">📌 ${savedItems.length} saved</span>
                `;

                // Build 30-day data
                const days = [];
                const today = new Date();
                for (let i = 29; i >= 0; i--) {
                    const d = new Date(today);
                    d.setDate(d.getDate() - i);
                    const dateStr = d.toDateString();
                    const entry = (stats.history || []).find(h => h.date === dateStr);
                    days.push(entry ? entry.count : 0);
                }
                const maxCount = Math.max(...days, 1);

                // 30-day chart in hero bar (right side)
                const chartRow = document.getElementById("hero-chart-row");
                if (chartRow) {
                    // Left: summary stats
                    const total30 = days.reduce((s, c) => s + c, 0);
                    const summaryDiv = document.createElement("div");
                    summaryDiv.style.cssText = "flex:0 0 auto; min-width:140px;";
                    summaryDiv.innerHTML = `
                        <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:4px;">📊 30-day activity</div>
                        <div style="font-size:1.8rem; font-weight:700; color:var(--text-primary); line-height:1;">${total30}</div>
                        <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:2px;">articles · ~${(total30 / 30).toFixed(1)}/day</div>
                    `;
                    chartRow.appendChild(summaryDiv);

                    // Right: chart
                    const chartWrap = document.createElement("div");
                    chartWrap.style.cssText = "flex:1; max-width:500px; background:rgba(255,255,255,0.04); border-radius:10px; padding:8px 10px; border:1px solid rgba(255,255,255,0.06);";

                    const chartCanvas = document.createElement("canvas");
                    const cw = 800, ch = 220;
                    chartCanvas.width = cw;
                    chartCanvas.height = ch;
                    chartCanvas.style.cssText = "width:100%; height:110px; display:block; border-radius:6px;";
                    chartWrap.appendChild(chartCanvas);

                    requestAnimationFrame(() => {
                        const cCtx = chartCanvas.getContext("2d");
                        const barW = cw / 30;
                        cCtx.clearRect(0, 0, cw, ch);

                        days.forEach((count, i) => {
                            const barH = count > 0 ? Math.max(6, (count / maxCount) * (ch - 28)) : 0;
                            const x = i * barW;
                            const y = ch - 20 - barH;

                            const grad = cCtx.createLinearGradient(x, y, x, ch - 20);
                            grad.addColorStop(0, "#a78bfa");
                            grad.addColorStop(1, "#6d28d9");
                            cCtx.fillStyle = count > 0 ? grad : "rgba(255,255,255,0.04)";
                            cCtx.beginPath();
                            cCtx.roundRect(x + 2, y, barW - 4, barH || 3, 3);
                            cCtx.fill();
                        });

                        // X-axis labels
                        cCtx.fillStyle = "rgba(255,255,255,0.45)";
                        cCtx.font = "16px sans-serif";
                        cCtx.textAlign = "center";
                        [0, 7, 14, 21, 29].forEach(i => {
                            if (i < days.length) {
                                const d = new Date();
                                d.setDate(d.getDate() - (29 - i));
                                cCtx.fillText(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), i * barW + barW / 2, ch - 3);
                            }
                        });
                    });

                    chartRow.appendChild(chartWrap);
                }

                const savedStat = document.getElementById("stat-saved");
                if (savedStat) {
                    savedStat.addEventListener("click", () => {
                        const target = document.getElementById("sidebar-saved-section");
                        if (target) {
                            target.scrollIntoView({ behavior: "smooth", block: "start" });
                            target.style.transition = "outline 0.3s";
                            target.style.outline = "2px solid var(--accent-color)";
                            target.style.outlineOffset = "8px";
                            target.style.borderRadius = "12px";
                            setTimeout(() => { target.style.outline = "none"; }, 2000);
                        } else {
                            showToast("No saved articles yet! Use 🔖 on any article.");
                        }
                    });
                }
            }
        });
    }, 0);

    // --- KEYWORD MODAL ---
    function showKeywordModal() {
        // Remove existing modal if any
        const existing = document.getElementById("keyword-modal");
        if (existing) existing.remove();

        const modal = document.createElement("div");
        modal.id = "keyword-modal";
        modal.className = "prism-modal-overlay";
        modal.innerHTML = `
            <div class="prism-modal">
                <div class="prism-modal-header">
                    <h3>🏷️ Keyword Watchlist</h3>
                    <button class="prism-modal-close">&times;</button>
                </div>
                <div class="prism-modal-body">
                    <p style="font-size:0.85rem; opacity:0.7; margin-bottom:12px;">
                        Articles matching these keywords will be highlighted and tagged.
                    </p>
                    <div style="display:flex; gap:8px; margin-bottom:16px;">
                        <input type="text" id="keyword-input" placeholder="Add keyword..." 
                               style="flex:1; padding:8px 12px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-color); color:var(--text-color); font-size:14px;">
                        <button id="keyword-add-btn" class="action-btn" style="white-space:nowrap;">+ Add</button>
                    </div>
                    <div id="keyword-list" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Load existing keywords
        getKeywords().then(keywords => {
            const list = document.getElementById("keyword-list");
            keywords.forEach(kw => addKeywordChip(list, kw));
        });

        // Add keyword
        const addBtn = document.getElementById("keyword-add-btn");
        const input = document.getElementById("keyword-input");

        addBtn.addEventListener("click", async () => {
            const val = input.value.trim();
            if (val) {
                await addKeyword(val);
                addKeywordChip(document.getElementById("keyword-list"), val.toLowerCase());
                input.value = "";
            }
        });
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") addBtn.click();
        });

        // Close
        modal.querySelector(".prism-modal-close").addEventListener("click", () => modal.remove());
        modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    }

    function addKeywordChip(container, keyword) {
        const chip = document.createElement("span");
        chip.className = "keyword-chip";
        chip.innerHTML = `${escapeHtml(keyword)} <span class="keyword-remove">&times;</span>`;
        chip.querySelector(".keyword-remove").addEventListener("click", async () => {
            await removeKeyword(keyword);
            chip.remove();
        });
        container.appendChild(chip);
    }


    // Grid
    const grid = document.createElement("div");
    grid.className = "grid-container";

    const parser = new DOMParser();

    // Data collection for Daily Mix
    let mixItems = [];

    // Promisify the card creation to fetch data in parallel
    const cardPromises = subscriptions.map(async (sub) => {
        const card = document.createElement("article");
        card.className = "news-card sub-card clickable-card";
        card.style.borderLeft = `3px solid ${sub.color || getFeedColor(sub.url)}`;

        // Skeleton / Loading State
        card.innerHTML = `
            <div class="card-body" style="opacity: 0.5;">
                <div class="card-meta">LOADING...</div>
                <h3 class="card-title">${sub.title}</h3>
                <div class="card-footer"></div>
            </div>
        `;

        try {
            // Live Fetch!
            const response = await fetch(sub.url);
            const text = await response.text();
            const doc = parser.parseFromString(text, "text/xml");

            // Get items for Daily Mix (Top 3 from each feed)
            const entries = Array.from(doc.querySelectorAll("item, entry")).slice(0, 3);
            entries.forEach(entry => {
                mixItems.push({
                    feedTitle: sub.title,
                    feedUrl: sub.url,
                    title: entry.querySelector("title")?.textContent || "No Title",
                    link: entry.querySelector("link")?.textContent || entry.querySelector("link")?.getAttribute("href"),
                    desc: entry.querySelector("description, summary")?.textContent || "",
                    date: entry.querySelector("pubDate")?.textContent || entry.querySelector("updated")?.textContent,
                    // Try to extract image same way
                    image: extractImageFromItem(entry)
                });
            });

            // Get first item
            const item = entries[0];
            if (item) {
                const title = item.querySelector("title")?.textContent || sub.title;
                const desc = item.querySelector("description, summary")?.textContent || "";

                // Date Extraction
                const dateStr = item.querySelector("pubDate")?.textContent || item.querySelector("updated")?.textContent;
                let dateDisplay = "Latest Update";
                let healthBadge = "🟢"; // Default: active
                if (dateStr) {
                    try {
                        const d = new Date(dateStr);
                        if (!isNaN(d.getTime())) {
                            dateDisplay = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                            // Feed Health
                            const ageMs = Date.now() - d.getTime();
                            const ageDays = ageMs / (1000 * 60 * 60 * 24);
                            if (ageDays > 30) healthBadge = "🔴";
                            else if (ageDays > 7) healthBadge = "🟡";
                            else healthBadge = "🟢";
                        }
                    } catch (e) { }
                } else {
                    healthBadge = "⚪";
                }

                // Try to find an image
                let imgUrl = extractImageFromItem(item);

                // Helpers are now global, removed local definition

                // Render Live Card
                card.innerHTML = `
                    <div class="card-body">
                        <div class="card-meta">
                            <img src="https://www.google.com/s2/favicons?domain=${new URL(sub.url).hostname}&sz=64" 
                                 style="width:20px; height:20px; margin-right:8px; vertical-align:text-bottom; border-radius:4px;">
                            ${escapeHtml(sub.title)}
                        </div>
                        <h3 class="card-title card-limit-lines">${escapeHtml(title)}</h3>
                        <div class="card-footer" style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:0.8rem; opacity:0.7;">${healthBadge} ${escapeHtml(dateDisplay)}</span>
                            <button class="read-btn remove-btn" data-url="${escapeHtml(sub.url)}">Unsubscribe</button>
                        </div>
                    </div>
                `;

            } else {
                // Fallback if no items
                throw new Error("No items");
            }

        } catch (e) {
            // Helpers are now global, removed local definition

            // Fallback to simple card
            card.innerHTML = `
                <div class="card-body">
                    <div class="card-meta">FEED</div>
                    <h3 class="card-title">
                      <img src="https://www.google.com/s2/favicons?domain=${new URL(sub.url).hostname}&sz=64" 
                           style="width:20px; height:20px; margin-right:8px; vertical-align:middle; border-radius:4px;">
                      ${escapeHtml(sub.title)}
                    </h3>
                    <p class="card-desc" style="flex:1; overflow:hidden;">${escapeHtml(sub.url)}</p>
                    <div class="card-footer">
                        <button class="read-btn remove-btn" data-url="${escapeHtml(sub.url)}">Unsubscribe</button>
                    </div>
                </div>
            `;
        }

        // Card Click -> Open Feed
        card.addEventListener("click", async (e) => {
            if (e.target.classList.contains("remove-btn")) return;

            // Fetch and open
            document.getElementById("loading").classList.remove("hidden");
            document.getElementById("app").classList.add("hidden");

            try {
                // Fetch the feed dynamically
                const response = await fetch(sub.url);
                const xmlText = await response.text();

                // Save as current xmlData (so refresh works)
                await chrome.storage.local.set({ xmlData: xmlText, currentFeedUrl: sub.url });

                // Reload page to trigger standard render flow
                window.location.href = "reader.html";
            } catch (err) {
                alert("Failed to load feed: " + err.message);
                window.location.reload();
            }
        });

        // Remove Logic
        const removeBtn = card.querySelector(".remove-btn");
        if (removeBtn) {
            removeBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (confirm(`Unsubscribe from ${sub.title}?`)) {
                    await removeSubscription(sub.url);
                    window.location.reload();
                }
            });
        }

        return card;
    });

    // Helper to reuse image extraction logic
    function extractImageFromItem(item) {
        let imgUrl = null;
        const enclosure = item.querySelector("enclosure[type^='image']");
        if (enclosure) imgUrl = enclosure.getAttribute("url");
        if (!imgUrl) {
            const mediaContent = item.getElementsByTagNameNS("*", "content")[0];
            if (mediaContent) imgUrl = mediaContent.getAttribute("url");
        }
        if (!imgUrl) {
            const desc = item.querySelector("description, summary")?.textContent || "";
            const imgMatch = desc.match(/<img[^>]+src="([^">]+)"/);
            if (imgMatch) {
                imgUrl = imgMatch[1];
                // basic filter for tracking pixels or tiny icons if we could detect size, 
                // but checking extension is a weak proxy.
            }
        }
        return imgUrl;
    }

    // Append all cards
    Promise.all(cardPromises).then(cards => {

        // --- LAYOUT STRUCTURE ---
        const layout = document.createElement("div");
        layout.className = "dashboard-layout";
        layout.style.cssText = "margin-top: 20px; padding: 0 24px;";

        const mainCol = document.createElement("div");
        mainCol.className = "main-content";

        const sidebarCol = document.createElement("div");
        sidebarCol.className = "sidebar-content";

        // 1. Subscriptions (Main Column) — grouped by category
        const subTitle = document.createElement("h2");
        subTitle.className = "section-title";
        subTitle.innerHTML = `📚 Your Feeds`;
        mainCol.appendChild(subTitle);

        // Category filter chips
        const categories = [...new Set(subscriptions.map(s => s.category || "Uncategorized"))].sort(
            (a, b) => a === "Uncategorized" ? 1 : b === "Uncategorized" ? -1 : a.localeCompare(b)
        );

        if (categories.length > 1) {
            const filterBar = document.createElement("div");
            filterBar.style.cssText = "display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;";

            const allChip = document.createElement("button");
            allChip.className = "action-btn";
            allChip.textContent = "All";
            allChip.style.cssText = "font-size:0.75rem; padding:4px 12px; border-radius:20px; background:var(--accent-color); color:#fff;";
            allChip.addEventListener("click", () => {
                document.querySelectorAll(".category-section").forEach(s => s.style.display = "");
                filterBar.querySelectorAll("button").forEach(b => b.style.background = "var(--card-bg)");
                allChip.style.background = "var(--accent-color)";
            });
            filterBar.appendChild(allChip);

            categories.forEach(cat => {
                const chip = document.createElement("button");
                chip.className = "action-btn";
                chip.textContent = cat;
                chip.style.cssText = "font-size:0.75rem; padding:4px 12px; border-radius:20px;";
                chip.addEventListener("click", () => {
                    document.querySelectorAll(".category-section").forEach(s => {
                        s.style.display = s.dataset.category === cat ? "" : "none";
                    });
                    filterBar.querySelectorAll("button").forEach(b => b.style.background = "var(--card-bg)");
                    chip.style.background = "var(--accent-color)";
                });
                filterBar.appendChild(chip);
            });

            mainCol.appendChild(filterBar);
        }

        // Group cards by category
        const cardsByCategory = {};
        cards.forEach((card, i) => {
            const cat = subscriptions[i]?.category || "Uncategorized";
            if (!cardsByCategory[cat]) cardsByCategory[cat] = [];
            cardsByCategory[cat].push(card);
        });

        categories.forEach(cat => {
            const section = document.createElement("div");
            section.className = "category-section";
            section.dataset.category = cat;

            if (categories.length > 1) {
                const catHeader = document.createElement("h3");
                catHeader.className = "category-header";
                catHeader.innerHTML = `<span style="cursor:pointer;">📂 ${cat}</span> <span style="opacity:0.5; font-size:0.8rem;">${cardsByCategory[cat]?.length || 0} feeds</span>`;
                catHeader.style.cssText = "margin:16px 0 8px; font-size:1rem; color:var(--text-primary); display:flex; align-items:center; gap:8px;";
                catHeader.addEventListener("click", () => {
                    const catGrid = section.querySelector(".grid-container");
                    if (catGrid) catGrid.style.display = catGrid.style.display === "none" ? "" : "none";
                });
                section.appendChild(catHeader);
            }

            const catGrid = document.createElement("div");
            catGrid.className = "grid-container";
            (cardsByCategory[cat] || []).forEach(c => catGrid.appendChild(c));
            section.appendChild(catGrid);

            mainCol.appendChild(section);
        });

        // Apply saved view mode to feed grids
        chrome.storage.local.get("feedViewMode", (data) => {
            if (data.feedViewMode === "list") {
                mainCol.querySelectorAll(".grid-container").forEach(g => g.classList.add("list-view"));
            }
        });

        // 2. Daily Mix (Sidebar Column)
        if (mixItems.length > 0) {
            // Shuffle
            mixItems.sort(() => Math.random() - 0.5);
            // Take 8 for sidebar
            const picked = mixItems.slice(0, 8);

            const mixTitle = document.createElement("h2");
            mixTitle.className = "section-title";
            mixTitle.innerHTML = `✨ Daily Mix`;
            sidebarCol.appendChild(mixTitle);

            const mixList = document.createElement("div");
            mixList.className = "daily-mix-list";

            picked.forEach(p => {
                const card = document.createElement("article");
                card.className = "daily-mix-card"; // New class
                card.style.borderLeft = `3px solid ${getFeedColor(p.feedUrl)}`;

                card.innerHTML = `
                    <div class="card-body">
                        <div class="card-meta" style="margin-bottom:8px; display:flex; align-items:center; font-size:0.8rem; color:var(--accent-color);">
                           <img src="https://www.google.com/s2/favicons?domain=${new URL(p.feedUrl).hostname}&sz=64" 
                                style="width:20px; height:20px; margin-right:6px; border-radius:4px;">
                           ${escapeHtml(p.feedTitle)}
                        </div>
                        <h3 class="card-title">${escapeHtml(p.title)}</h3>
                        <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                            <p class="card-desc" style="margin-bottom:0;">${escapeHtml(p.desc.replace(/<[^>]*>/g, '').substring(0, 60))}...</p>
                            <span style="font-size:0.75rem; color:var(--text-secondary); white-space:nowrap; margin-left:8px;">
                                ${p.date ? new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                            </span>
                        </div>
                    </div>
                `;


                // Action footer
                const footer = document.createElement("div");
                footer.className = "card-footer";
                footer.style.cssText = "display:flex; align-items:center; gap:4px;";

                const readBtn = document.createElement("a");
                readBtn.className = "read-btn";
                readBtn.href = p.link;
                readBtn.textContent = "Read →";
                readBtn.target = "_blank";
                readBtn.style.fontSize = "0.8rem";
                readBtn.addEventListener("click", () => trackArticleRead(p.feedTitle));
                footer.appendChild(readBtn);

                const btnStyle = "padding:3px 8px; font-size:0.9rem; min-width:auto;";

                // Save
                const saveBtn = document.createElement("button");
                saveBtn.className = "read-btn";
                saveBtn.textContent = "🔖";
                saveBtn.title = "Save for Later";
                saveBtn.style.cssText = btnStyle;
                saveBtn.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    const added = await addToReadLater({
                        title: p.title, link: p.link, desc: p.desc,
                        image: p.image, feedTitle: p.feedTitle, date: p.date
                    });
                    saveBtn.textContent = added ? "✅" : "📌";
                    showToast(added ? "📌 Saved! Find it on your Dashboard." : "Already saved!");
                    setTimeout(() => { saveBtn.textContent = "🔖"; }, 2000);
                });
                footer.appendChild(saveBtn);

                // TTS
                const ttsBtn = document.createElement("button");
                ttsBtn.className = "read-btn";
                ttsBtn.textContent = "🔊";
                ttsBtn.title = "Listen";
                ttsBtn.style.cssText = btnStyle;
                ttsBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (window.speechSynthesis.speaking) {
                        window.speechSynthesis.cancel();
                        ttsBtn.textContent = "🔊";
                        return;
                    }
                    const plainDesc = p.desc.replace(/<[^>]*>/g, '');
                    const utterance = new SpeechSynthesisUtterance(p.title + ". " + plainDesc);
                    utterance.rate = 1.0;
                    utterance.onend = () => { ttsBtn.textContent = "🔊"; };
                    utterance.onstart = () => { ttsBtn.textContent = "⏸️"; };
                    window.speechSynthesis.speak(utterance);
                });
                footer.appendChild(ttsBtn);

                // Translate
                const translateBtn = document.createElement("button");
                translateBtn.className = "read-btn";
                translateBtn.textContent = "🌐";
                translateBtn.title = "Translate";
                translateBtn.style.cssText = btnStyle;
                translateBtn.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    const titleEl = card.querySelector(".card-title");
                    const descEl = card.querySelector(".card-desc");
                    translateBtn.textContent = "⏳";
                    try {
                        const text = (titleEl?.textContent || "") + " ||| " + (descEl?.textContent || "");
                        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.substring(0, 500))}&langpair=autodetect|en`);
                        const data = await res.json();
                        if (data.responseData?.translatedText) {
                            const parts = data.responseData.translatedText.split(" ||| ");
                            if (titleEl && parts[0]) titleEl.textContent = parts[0];
                            if (descEl && parts[1]) descEl.textContent = parts[1];
                        }
                        translateBtn.textContent = "✅";
                    } catch (err) { translateBtn.textContent = "❌"; }
                    setTimeout(() => { translateBtn.textContent = "🌐"; }, 2000);
                });
                footer.appendChild(translateBtn);

                card.querySelector(".card-body").appendChild(footer);

                // Card click (not on buttons)
                card.addEventListener("click", (e) => {
                    if (e.target.closest(".read-btn") || e.target.closest("button")) return;
                    window.open(p.link, '_blank');
                    trackArticleRead(p.feedTitle);
                });
                mixList.appendChild(card);
            });

            sidebarCol.appendChild(mixList);
        } else {
            sidebarCol.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-secondary);">Add feeds to see Daily Mix!</div>`;
        }

        // --- READ LATER in SIDEBAR ---
        getReadLater().then(items => {
            if (items.length > 0) {
                const rlTitle = document.createElement("h2");
                rlTitle.className = "section-title";
                rlTitle.id = "sidebar-saved-section";
                rlTitle.style.cssText = "font-size:1.2rem; margin-top:24px;";
                rlTitle.textContent = "📌 Saved for Later";
                sidebarCol.appendChild(rlTitle);

                const rlGrid = document.createElement("div");
                rlGrid.className = "daily-mix-list";

                items.slice(0, 6).forEach(item => {
                    const card = document.createElement("article");
                    card.className = "daily-mix-card";
                    card.innerHTML = `
                        <div class="card-body">
                            <div class="card-meta" style="margin-bottom:8px; display:flex; align-items:center; justify-content:space-between;">
                                <span style="font-size:0.8rem; color:var(--accent-color);">
                                    ${item.feedTitle || "Saved"}
                                </span>
                                <button class="rl-remove" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1rem;">✕</button>
                            </div>
                            <h3 class="card-title">${item.title}</h3>
                            <p class="card-desc">${(item.desc || "").replace(/<[^>]*>/g, '').substring(0, 60)}...</p>
                        </div>
                    `;

                    card.addEventListener("click", (e) => {
                        if (e.target.classList.contains("rl-remove")) {
                            e.stopPropagation();
                            removeFromReadLater(item.link).then(() => card.remove());
                            return;
                        }
                        window.open(item.link, '_blank');
                        trackArticleRead(item.feedTitle || "Saved");
                    });

                    rlGrid.appendChild(card);
                });

                sidebarCol.appendChild(rlGrid);
            }
        });

        layout.appendChild(mainCol);
        layout.appendChild(sidebarCol);
        container.appendChild(layout);

        // --- INTERACTIVE PARTICLES ---
        try {
            const canvas = document.createElement("canvas");
            canvas.style.position = "absolute";
            canvas.style.top = "0";
            canvas.style.left = "0";
            canvas.style.width = "100%";
            canvas.style.height = "100%";
            canvas.style.pointerEvents = "none";
            canvas.style.mixBlendMode = "screen";
            hero.appendChild(canvas);

            const ctx = canvas.getContext("2d");
            let particles = [];
            let width, height;
            let mouseX = 0, mouseY = 0;

            function resize() {
                width = canvas.width = hero.offsetWidth;
                height = canvas.height = hero.offsetHeight;
            }
            window.addEventListener("resize", resize);
            resize();

            hero.addEventListener("mousemove", (e) => {
                const rect = hero.getBoundingClientRect();
                mouseX = e.clientX - rect.left;
                mouseY = e.clientY - rect.top;
            });

            class Particle {
                constructor() {
                    this.x = Math.random() * width;
                    this.y = Math.random() * height;
                    this.vx = (Math.random() - 0.5) * 0.5;
                    this.vy = (Math.random() - 0.5) * 0.5;
                    this.size = Math.random() * 2 + 1;
                    this.alpha = Math.random() * 0.5 + 0.1;
                }
                update() {
                    this.x += this.vx;
                    this.y += this.vy;

                    const dx = mouseX - this.x;
                    const dy = mouseY - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 100) {
                        this.x -= dx * 0.02;
                        this.y -= dy * 0.02;
                    }

                    if (this.x < 0) this.x = width;
                    if (this.x > width) this.x = 0;
                    if (this.y < 0) this.y = height;
                    if (this.y > height) this.y = 0;
                }
                draw() {
                    ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            for (let i = 0; i < 50; i++) particles.push(new Particle());

            function animate() {
                ctx.clearRect(0, 0, width, height);
                particles.forEach(p => {
                    p.update();
                    p.draw();
                });
                requestAnimationFrame(animate);
            }
            animate();
        } catch (e) {
            console.warn("Particles failed", e);
        }

    });

    return container;
}


// --- 7. MAIN INIT ---

(async () => {
    const loading = document.getElementById("loading");
    const app = document.getElementById("app");
    const content = document.getElementById("content");
    const closeBtn = document.getElementById("close-btn");

    // Create Search/Subscribe Area
    const header = document.querySelector(".header");
    const searchContainer = document.createElement("div");
    const h1 = document.querySelector("h1");

    searchContainer.className = "search-container hidden";
    searchContainer.innerHTML = `<input type="text" id="search-input" class="search-input" placeholder="Filter items...">`;
    // Insert search
    header.insertBefore(searchContainer, closeBtn);

    // Customize Title with Link and Gradient
    h1.style.cursor = "pointer";
    h1.innerHTML = `<img src="images/icon128.png" class="brand-icon"> <span class="prism-text">Prism</span> RSS`;
    h1.onclick = () => {
        window.location.href = "home.html";
    };

    // Theme Toggle
    const themeBtn = document.createElement("button");
    themeBtn.className = "close-btn";
    themeBtn.textContent = "☀"; // Sun icon default
    themeBtn.title = "Toggle Theme";
    themeBtn.style.fontSize = "1.2rem";
    themeBtn.style.marginRight = "10px";
    header.insertBefore(themeBtn, closeBtn);

    // Load Theme
    chrome.storage.local.get("theme", (data) => {
        if (data.theme === "light") {
            document.body.classList.add("light-mode");
            themeBtn.textContent = "🌙";
        }
    });

    themeBtn.addEventListener("click", () => {
        document.body.classList.toggle("light-mode");
        const isLight = document.body.classList.contains("light-mode");
        themeBtn.textContent = isLight ? "🌙" : "☀";
        chrome.storage.local.set({ theme: isLight ? "light" : "dark" });
    });

    // Subscribe Button (created but hidden initially)
    const subBtn = document.createElement("button");
    subBtn.className = "close-btn hidden";
    subBtn.style.marginRight = "10px";
    subBtn.style.borderRadius = "8px";
    subBtn.style.padding = "8px 16px";
    subBtn.style.fontSize = "0.9rem";
    subBtn.style.fontWeight = "600";
    subBtn.style.backgroundColor = "#3b82f6";
    subBtn.style.color = "white";
    subBtn.textContent = "Subscribe";
    header.insertBefore(subBtn, closeBtn);

    const searchInput = searchContainer.querySelector("input");

    closeBtn.addEventListener("click", () => window.close());

    // Search Logic
    searchInput.addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase();
        const cards = document.querySelectorAll(".news-card");
        cards.forEach(card => {
            const text = card.dataset.search || "";
            if (text.includes(term)) card.classList.remove("hidden");
            else card.classList.add("hidden");
        });
    });

    // Prism Scroll Bar Logic
    const progressBar = document.createElement("div");
    progressBar.className = "scroll-progress";
    document.body.appendChild(progressBar); // Append to body, stays fixed

    window.addEventListener("scroll", () => {
        const scrollTop = window.scrollY;
        const docHeight = document.body.scrollHeight - window.innerHeight;
        let scrollPercent = 0;
        if (docHeight > 0) {
            scrollPercent = (scrollTop / docHeight) * 100;
        }
        progressBar.style.width = `${Math.min(100, Math.max(0, scrollPercent))}%`;
    });

    try {
        const path = window.location.pathname;
        const isDashboard = path.endsWith("home.html") || path.endsWith("dashboard.html"); // Support both for safety

        // Update Title Link to always go to home.html
        h1.onclick = () => {
            window.location.href = "home.html";
        };

        // --- GLOBAL TOOLBAR (Layout, Color) ---
        // C. Layout Toggle
        const layoutBtn = document.createElement("button");
        layoutBtn.className = "icon-btn";
        layoutBtn.innerHTML = "⊞"; // Grid icon default
        layoutBtn.title = "Toggle Layout";
        layoutBtn.onclick = () => {
            // 1. Handle Feed Grid (Existing)
            const grid = content.querySelector(".grid-container");
            if (grid) {
                grid.classList.toggle("list-view");
            }

            // 2. Handle Dashboard Layout (New)
            const dashboard = content.querySelector(".dashboard-layout");
            if (dashboard) {
                dashboard.classList.toggle("stacked-view");
            }

            // Update Icon
            const isList = (grid && grid.classList.contains("list-view")) ||
                (dashboard && dashboard.classList.contains("stacked-view"));
            layoutBtn.innerHTML = isList ? "☰" : "⊞";
        };
        h1.parentNode.insertBefore(layoutBtn, document.getElementById("theme-toggle"));

        // D. Color Picker
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = "#a855f7"; // Default purple
        colorInput.className = "color-picker-input hidden";
        colorInput.onchange = (e) => {
            const color = e.target.value;
            document.documentElement.style.setProperty('--accent-color', color);
        };
        document.body.appendChild(colorInput);

        const colorBtn = document.createElement("button");
        colorBtn.className = "icon-btn";
        colorBtn.innerHTML = "🎨";
        colorBtn.title = "Accent Color";
        colorBtn.onclick = () => colorInput.click();
        h1.parentNode.insertBefore(colorBtn, document.getElementById("theme-toggle"));



        if (isDashboard) {
            // DASHBOARD MODE
            h1.innerHTML = `<img src="images/icon128.png" class="brand-icon"> <span class="prism-text">Prism</span> Reader`; // Keep branding
            const subs = await getSubscriptions();
            content.innerHTML = "";
            content.appendChild(renderDashboard(subs));

            loading.classList.add("hidden");
            app.classList.remove("hidden");
            header.appendChild(closeBtn); // Ensure X is far-right
            return;
        }

        // READER MODE (reader.html)
        const data = await chrome.storage.local.get(["xmlData", "currentFeedUrl"]);
        if (!data.xmlData) throw new Error("No XML data found.");

        const parser = new DOMParser();
        const doc = parser.parseFromString(data.xmlData, "application/xml");
        const root = doc.documentElement;
        const type = detectType(root);

        console.log("Detected type:", type);
        content.innerHTML = "";

        if (type === "rss" || type === "atom") {
            // 1. Render Feed (creates the hero bar)
            content.appendChild(renderSmartFeed(doc, type, data.currentFeedUrl));

            // 2. Hide the default navbar — hero replaces it on feed pages too
            const defaultHeader = document.querySelector(".header");
            if (defaultHeader) defaultHeader.style.display = "none";

            // 3. Inject toolbar elements into the hero bar
            const heroToolbar = content.querySelector(".hero-toolbar");
            const heroRow2 = content.querySelector(".hero-row2");

            if (heroToolbar) {
                // A. Search
                searchContainer.classList.remove("hidden");
                searchContainer.style.margin = "0";
                searchContainer.style.marginRight = "20px";
                searchContainer.style.flex = "0 1 200px";
                heroToolbar.appendChild(searchContainer);

                // B. Calculate Stats
                const items = doc.querySelectorAll("item, entry");
                const itemCount = items.length;
                let totalWords = 0;
                items.forEach(item => {
                    const text = item.textContent || "";
                    totalWords += text.split(/\s+/).length;
                });
                const totalReadTime = Math.ceil(totalWords / 200);

                const statsBadge = document.createElement("div");
                statsBadge.className = "stats-badge";
                statsBadge.style.flexShrink = "0";
                statsBadge.innerHTML = `<span>${itemCount} Items</span> • <span>${totalReadTime}m Read</span>`;
                heroToolbar.appendChild(statsBadge);

                // C. Layout Toggle
                heroToolbar.appendChild(layoutBtn);

                // D. Color Picker
                heroToolbar.appendChild(colorBtn);

                // E. Copy Link Button
                if (data.currentFeedUrl) {
                    const copyBtn = document.createElement("button");
                    copyBtn.className = "icon-btn";
                    copyBtn.innerHTML = "📋";
                    copyBtn.title = "Copy Feed URL";
                    copyBtn.onclick = () => {
                        navigator.clipboard.writeText(data.currentFeedUrl);
                        copyBtn.innerHTML = "✅";
                        setTimeout(() => copyBtn.innerHTML = "📋", 2000);
                    };
                    heroToolbar.appendChild(copyBtn);
                }

                // F. Theme Toggle
                heroToolbar.appendChild(themeBtn);

                // G. Close Button (always last)
                heroToolbar.appendChild(closeBtn);
            }

            // 4. Subscription Logic — place button in hero row2
            if (data.currentFeedUrl) {
                subBtn.classList.remove("hidden");

                // Place subscribe button in row2 (far right) or toolbar if no row2
                if (heroRow2) {
                    subBtn.style.marginLeft = "auto";
                    subBtn.style.flexShrink = "0";
                    heroRow2.appendChild(subBtn);
                } else if (heroToolbar) {
                    subBtn.style.flexShrink = "0";
                    heroToolbar.insertBefore(subBtn, closeBtn);
                }
                // Check if already subscribed
                const subs = await getSubscriptions();
                const isSubbed = subs.find(s => s.url === data.currentFeedUrl);

                if (isSubbed) {
                    // Already subscribed: Enable click to Unsubscribe
                    subBtn.textContent = "Subscribed";
                    subBtn.style.backgroundColor = "#16a34a"; // Green

                    subBtn.onclick = async () => {
                        if (confirm("Unsubscribe from this feed?")) {
                            await removeSubscription(data.currentFeedUrl);
                            window.location.reload();
                        }
                    };

                    // Hover effect to show "Unsubscribe"
                    subBtn.onmouseover = () => {
                        subBtn.textContent = "Unsubscribe";
                        subBtn.style.backgroundColor = "#ef4444"; // Red
                    };
                    subBtn.onmouseout = () => {
                        subBtn.textContent = "Subscribed";
                        subBtn.style.backgroundColor = "#16a34a"; // Green
                    };

                } else {
                    // Not subscribed
                    subBtn.onclick = async () => {
                        // Extract title from feed
                        let feedTitle = "Untitled Feed";
                        if (type === "rss") feedTitle = doc.querySelector("channel > title")?.textContent;
                        else feedTitle = doc.querySelector("feed > title")?.textContent;

                        await addSubscription(data.currentFeedUrl, feedTitle || "Unknown Feed");

                        // Update UI to Subscribed state immediately
                        subBtn.textContent = "Subscribed";
                        subBtn.style.backgroundColor = "#16a34a";
                        window.location.reload();
                    };
                }
            }
        } else {
            // Generic View
            h1.innerHTML = `<img src="images/icon128.png" class="brand-icon"> <span class="prism-text">Prism</span> XML`;
            content.appendChild(renderGeneric(root));
        }

        loading.classList.add("hidden");
        app.classList.remove("hidden");

    } catch (e) {
        console.error(e);
        loading.textContent = "Error: " + e.message;
    }
})();
