/* TBD Watch History - injected into jellyfin-web by the TBD Watch History plugin. */
(function () {
    'use strict';
    if (window.__tbdWatchHistory) { return; }
    window.__tbdWatchHistory = true;

    var PAGE_SIZE = 40;
    var overlay = null;
    var state = { filter: 'All', start: 0, count: 0, done: false, loading: false, lastDay: null, grid: null };

    function client() { return window.ApiClient; }
    function userId() {
        var c = client();
        try { return c && c.getCurrentUserId ? c.getCurrentUserId() : null; } catch (e) { return null; }
    }

    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) { e.className = cls; }
        if (text !== undefined && text !== null) { e.textContent = text; }
        return e;
    }

    function addStyles() {
        if (document.getElementById('tbdwh-style')) { return; }
        var css = [
            '#tbdwh-overlay{position:fixed;top:0;left:0;right:0;bottom:0;z-index:100000;overflow-y:auto;-webkit-overflow-scrolling:touch;color:#e9eaec;font-family:inherit;background:radial-gradient(1100px 480px at 50% -12%,rgba(0,164,220,.16),transparent 62%),#0e0f12}',
            '#tbdwh-head{position:sticky;top:0;z-index:5;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);background:rgba(14,15,18,.86);border-bottom:1px solid rgba(255,255,255,.08)}',
            '#tbdwh-head-in{max-width:1400px;margin:0 auto;display:flex;align-items:center;gap:1em;padding:.9em 1.6em;padding-top:calc(.9em + env(safe-area-inset-top,0px))}',
            '.tbdwh-back{flex:none;width:2.6em;height:2.6em;border-radius:50%;border:2px solid transparent;background:rgba(255,255,255,.08);color:#fff;font-size:1.1em;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;font-family:inherit}',
            '.tbdwh-back:hover{background:rgba(255,255,255,.16)}',
            '.tbdwh-titles h1{margin:0;font-size:1.55em;font-weight:650;letter-spacing:.01em;line-height:1.15}',
            '#tbdwh-sub{color:#8d9096;font-size:.85em;min-height:1.2em}',
            '.tbdwh-seg{margin-left:auto;display:flex;gap:.15em;background:rgba(255,255,255,.07);border-radius:999px;padding:.25em}',
            '.tbdwh-seg button{background:transparent;color:#c9cbd0;border:2px solid transparent;border-radius:999px;padding:.45em 1.15em;font-size:.95em;cursor:pointer;font-family:inherit;white-space:nowrap}',
            '.tbdwh-seg button:hover{color:#fff}',
            '.tbdwh-seg button.active{background:#00a4dc;color:#fff;font-weight:600}',
            '.tbdwh-back:focus,.tbdwh-seg button:focus,.tbdwh-btn:focus{outline:none;border-color:#fff;box-shadow:0 0 0 3px #00a4dc}',
            '#tbdwh-body{max-width:1400px;margin:0 auto;padding:1em 1.6em 4em}',
            '.tbdwh-group{display:grid;grid-template-columns:160px 1fr;gap:1.6em;padding:1.5em 0;border-bottom:1px solid rgba(255,255,255,.06)}',
            '.tbdwh-group:last-child{border-bottom:0}',
            '.tbdwh-date{position:sticky;top:6em;align-self:start}',
            '.tbdwh-date .big{font-size:2.3em;font-weight:700;line-height:1.05}',
            '.tbdwh-date .mid{margin-top:.3em;font-weight:500;color:#d4d6da}',
            '.tbdwh-date .small{color:#8d9096;font-size:.85em}',
            '.tbdwh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:1.4em 1.1em}',
            '.tbdwh-card{display:block;color:inherit;text-decoration:none;cursor:pointer;outline:none;min-width:0}',
            '.tbdwh-poster{position:relative;width:100%;padding-top:150%;background:#1a1c20;border-radius:.65em;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,.45);transition:transform .18s ease,box-shadow .18s ease}',
            '.tbdwh-card:hover .tbdwh-poster,.tbdwh-card:focus .tbdwh-poster{transform:translateY(-4px) scale(1.02);box-shadow:0 14px 28px rgba(0,0,0,.6)}',
            '.tbdwh-card:focus .tbdwh-poster{box-shadow:0 0 0 3px #fff,0 0 0 6px #00a4dc,0 14px 28px rgba(0,0,0,.6)}',
            '.tbdwh-poster img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}',
            '.tbdwh-ph{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:.6em;color:#8d9096;font-size:.9em}',
            '.tbdwh-badge{position:absolute;top:.5em;right:.5em;width:1.7em;height:1.7em;border-radius:50%;background:rgba(0,0,0,.7);color:#4cd98a;display:flex;align-items:center;justify-content:center;font-size:.9em;font-weight:700}',
            '.tbdwh-bar{position:absolute;left:0;right:0;bottom:0;height:.4em;background:rgba(255,255,255,.25)}',
            '.tbdwh-bar i{display:block;height:100%;background:#00a4dc}',
            '.tbdwh-t{margin-top:.65em;font-weight:600;font-size:.95em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.tbdwh-s{margin-top:.1em;font-size:.8em;color:#9a9da3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.tbdwh-m{margin-top:.25em;font-size:.78em;color:#00a4dc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.tbdwh-btn{background:rgba(255,255,255,.1);color:#eee;border:2px solid transparent;border-radius:999px;padding:.6em 1.4em;font-size:1em;cursor:pointer;font-family:inherit}',
            '#tbdwh-status{text-align:center;color:#7d8087;padding:2em 0;font-size:.9em}',
            '#tbdwh-status.empty{padding:6em 1em;font-size:1.1em;color:#9a9da3}',
            '@media (max-width:760px){',
            '.tbdwh-group{grid-template-columns:1fr;gap:.9em;padding:1.1em 0}',
            '.tbdwh-date{position:static;display:flex;align-items:baseline;gap:.6em;flex-wrap:wrap}',
            '.tbdwh-date .big{font-size:1.5em}.tbdwh-date .mid{margin:0}',
            '.tbdwh-grid{grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:1.1em .8em}',
            '#tbdwh-head-in{flex-wrap:wrap;padding:.7em 1em;padding-top:calc(.7em + env(safe-area-inset-top,0px))}',
            '.tbdwh-seg{margin-left:0;width:100%}.tbdwh-seg button{flex:1;padding:.5em .4em}',
            '#tbdwh-body{padding:.6em 1em 4em}',
            '}'
        ].join('\n');
        var s = el('style');
        s.id = 'tbdwh-style';
        s.textContent = css;
        document.head.appendChild(s);
    }

    /* ---------- data ---------- */

    function fetchPage() {
        var c = client();
        var types = state.filter === 'Movies' ? 'Movie' : state.filter === 'Episodes' ? 'Episode' : 'Movie,Episode';
        var url = c.getUrl('Items', {
            userId: userId(),
            Recursive: true,
            SortBy: 'DatePlayed',
            SortOrder: 'Descending',
            IncludeItemTypes: types,
            Fields: 'PrimaryImageAspectRatio',
            EnableImageTypes: 'Primary',
            ImageTypeLimit: 1,
            EnableTotalRecordCount: true,
            StartIndex: state.start,
            Limit: PAGE_SIZE
        });
        if (c.getJSON) { return c.getJSON(url); }
        return c.ajax({ type: 'GET', url: url, dataType: 'json' });
    }

    function dayKey(d) { return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }

    function dateParts(d) {
        var now = new Date();
        var wk = d.toLocaleDateString(undefined, { weekday: 'long' });
        if (dayKey(d) === dayKey(now)) {
            return { big: 'Today', mid: wk, small: d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) };
        }
        if (dayKey(d) === dayKey(new Date(now.getTime() - 86400000))) {
            return { big: 'Yesterday', mid: wk, small: d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }) };
        }
        return { big: String(d.getDate()), mid: wk, small: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
    }

    function openItem(item) {
        close();
        window.location.hash = '#/details?id=' + item.Id + (item.ServerId ? '&serverId=' + item.ServerId : '');
    }

    function buildCard(item) {
        var c = client();
        var isEp = item.Type === 'Episode';
        var ud = item.UserData || {};
        var inProgress = !ud.Played && ud.PlaybackPositionTicks > 0;
        var pct = inProgress && item.RunTimeTicks ? Math.max(1, Math.min(99, Math.round(ud.PlaybackPositionTicks / item.RunTimeTicks * 100))) : null;

        var card = el('a', 'tbdwh-card');
        card.tabIndex = 0;
        card.setAttribute('role', 'button');

        var poster = el('div', 'tbdwh-poster');
        var imgId = null, tag = null;
        if (isEp && item.SeriesId && item.SeriesPrimaryImageTag) {
            imgId = item.SeriesId; tag = item.SeriesPrimaryImageTag;
        } else if (item.ImageTags && item.ImageTags.Primary) {
            imgId = item.Id; tag = item.ImageTags.Primary;
        }
        if (imgId) {
            var img = el('img');
            img.loading = 'lazy';
            img.alt = '';
            img.src = c.getUrl('Items/' + imgId + '/Images/Primary', { maxWidth: 400, quality: 90, tag: tag });
            poster.appendChild(img);
        } else {
            poster.appendChild(el('span', 'tbdwh-ph', item.Name || '?'));
        }
        if (ud.Played) {
            poster.appendChild(el('span', 'tbdwh-badge', '\u2713'));
        }
        if (inProgress && pct !== null) {
            var bar = el('div', 'tbdwh-bar');
            var fill = el('i');
            fill.style.width = pct + '%';
            bar.appendChild(fill);
            poster.appendChild(bar);
        }
        card.appendChild(poster);

        var played = ud.LastPlayedDate ? new Date(ud.LastPlayedDate) : null;
        var time = played ? played.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
        var title = isEp ? (item.SeriesName || item.Name) : item.Name;
        var sub;
        if (isEp) {
            sub = 'S' + (item.ParentIndexNumber != null ? item.ParentIndexNumber : '?') + ':E' + (item.IndexNumber != null ? item.IndexNumber : '?') + ' \u00b7 ' + (item.Name || '');
        } else {
            sub = item.ProductionYear ? String(item.ProductionYear) : 'Movie';
        }
        var meta;
        if (inProgress) {
            meta = (pct !== null ? pct + '% watched' : 'In progress') + (time ? ' \u00b7 ' + time : '');
        } else {
            meta = 'Watched' + (time ? ' \u00b7 ' + time : '');
        }

        card.title = title + ' - ' + sub + ' - ' + meta;
        card.appendChild(el('div', 'tbdwh-t', title));
        card.appendChild(el('div', 'tbdwh-s', sub));
        card.appendChild(el('div', 'tbdwh-m', meta));

        card.addEventListener('click', function () { openItem(item); });
        card._tbdItem = item;
        return card;
    }

    function render(items) {
        var list = overlay.querySelector('#tbdwh-list');
        items.forEach(function (item) {
            var d = item.UserData && item.UserData.LastPlayedDate ? new Date(item.UserData.LastPlayedDate) : null;
            var key = d ? dayKey(d) : 'unknown';
            if (key !== state.lastDay || !state.grid) {
                state.lastDay = key;
                var group = el('section', 'tbdwh-group');
                var date = el('div', 'tbdwh-date');
                if (d) {
                    var parts = dateParts(d);
                    date.appendChild(el('div', 'big', parts.big));
                    date.appendChild(el('div', 'mid', parts.mid));
                    date.appendChild(el('div', 'small', parts.small));
                } else {
                    date.appendChild(el('div', 'big', 'Earlier'));
                }
                state.grid = el('div', 'tbdwh-grid');
                group.appendChild(date);
                group.appendChild(state.grid);
                list.appendChild(group);
            }
            state.grid.appendChild(buildCard(item));
        });
    }

    function updateStatus(text, empty) {
        var s = overlay && overlay.querySelector('#tbdwh-status');
        if (s) { s.textContent = text; s.className = empty ? 'empty' : ''; }
        var sub = overlay && overlay.querySelector('#tbdwh-sub');
        if (sub) {
            sub.textContent = state.count ? state.count + (state.count === 1 ? ' title' : ' titles') + (state.done ? '' : '+') : '';
        }
    }

    function load(reset) {
        if (!overlay || state.loading) { return; }
        if (reset) {
            state.start = 0; state.count = 0; state.done = false; state.lastDay = null; state.grid = null;
            overlay.querySelector('#tbdwh-list').innerHTML = '';
        }
        state.loading = true;
        updateStatus('Loading...');
        var more = overlay.querySelector('#tbdwh-more');
        if (more) { more.style.display = 'none'; }

        var req;
        try { req = fetchPage(); } catch (e) { state.loading = false; updateStatus('Could not load history.'); return; }

        Promise.resolve(req).then(function (res) {
            state.loading = false;
            if (!overlay) { return; }
            var items = (res && res.Items) || [];
            var kept = items.filter(function (i) {
                var u = i.UserData;
                return u && (u.LastPlayedDate || u.Played);
            });
            state.start += items.length;
            state.count += kept.length;
            state.done = kept.length < items.length || items.length < PAGE_SIZE;
            render(kept);
            if (state.count === 0) {
                updateStatus('Nothing watched yet. Titles you start or finish will show up here.', true);
            } else {
                updateStatus(state.done ? 'That is everything.' : '');
            }
            if (more) { more.style.display = state.done ? 'none' : ''; }
            if (reset) {
                var first = overlay.querySelector('.tbdwh-card');
                if (first) { first.focus(); }
            }
        }).catch(function () {
            state.loading = false;
            updateStatus('Could not load history.');
        });
    }

    /* ---------- overlay ---------- */

    var prevTitle = null;

    function open() {
        if (overlay || !userId()) { return; }
        addStyles();
        state.filter = 'All';
        prevTitle = document.title;
        document.title = 'Watch History';

        overlay = el('div');
        overlay.id = 'tbdwh-overlay';

        var head = el('div');
        head.id = 'tbdwh-head';
        var inner = el('div');
        inner.id = 'tbdwh-head-in';

        var back = el('button', 'tbdwh-back', '\u2190');
        back.type = 'button';
        back.setAttribute('aria-label', 'Back');
        back.addEventListener('click', closeAndReturn);
        inner.appendChild(back);

        var titles = el('div', 'tbdwh-titles');
        titles.appendChild(el('h1', null, 'Watch History'));
        var sub = el('div');
        sub.id = 'tbdwh-sub';
        titles.appendChild(sub);
        inner.appendChild(titles);

        var seg = el('div', 'tbdwh-seg');
        ['All', 'Movies', 'Episodes'].forEach(function (name) {
            var b = el('button', name === state.filter ? 'active' : '', name === 'Episodes' ? 'TV Episodes' : name);
            b.type = 'button';
            b.addEventListener('click', function () {
                state.filter = name;
                [].forEach.call(seg.querySelectorAll('button'), function (x) { x.classList.toggle('active', x === b); });
                load(true);
            });
            seg.appendChild(b);
        });
        inner.appendChild(seg);
        head.appendChild(inner);
        overlay.appendChild(head);

        var body = el('div');
        body.id = 'tbdwh-body';
        var list = el('div');
        list.id = 'tbdwh-list';
        body.appendChild(list);
        var status = el('div');
        status.id = 'tbdwh-status';
        body.appendChild(status);
        var more = el('button', 'tbdwh-btn', 'Load more');
        more.id = 'tbdwh-more';
        more.type = 'button';
        more.style.display = 'none';
        more.style.margin = '0 auto';
        more.addEventListener('click', function () { load(false); });
        var wrap = el('div');
        wrap.style.textAlign = 'center';
        wrap.appendChild(more);
        body.appendChild(wrap);
        overlay.appendChild(body);

        overlay.addEventListener('scroll', function () {
            if (overlay.scrollTop + overlay.clientHeight > overlay.scrollHeight - 400 && !state.done) { load(false); }
        });

        document.body.appendChild(overlay);
        load(true);
    }

    function close() {
        if (!overlay) { return; }
        overlay.parentNode.removeChild(overlay);
        overlay = null;
        // When we leave through browser history, Jellyfin sets the right title itself.
        if (!openedFromPage && prevTitle !== null) { document.title = prevTitle; }
        prevTitle = null;
        openedFromPage = false;
    }

    window.addEventListener('hashchange', close);

    /* ---------- remote / keyboard navigation (TV friendly) ---------- */

    document.addEventListener('keydown', function (e) {
        if (!overlay) { return; }
        var k = e.keyCode;
        var back = k === 27 || k === 461 || k === 10009 || k === 8;
        if (back) { e.preventDefault(); e.stopPropagation(); closeAndReturn(); return; }

        if (k === 13 && document.activeElement && document.activeElement._tbdItem) {
            e.preventDefault(); e.stopPropagation();
            openItem(document.activeElement._tbdItem);
            return;
        }

        var dir = { 37: 'l', 38: 'u', 39: 'r', 40: 'd' }[k];
        if (!dir) { return; }
        e.preventDefault(); e.stopPropagation();

        var list = [].slice.call(overlay.querySelectorAll('button,.tbdwh-card')).filter(function (n) { return n.offsetParent !== null; });
        var cur = document.activeElement;
        if (list.indexOf(cur) < 0) { if (list[0]) { list[0].focus(); } return; }

        var r = cur.getBoundingClientRect();
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var best = null, bestScore = Infinity;
        list.forEach(function (n) {
            if (n === cur) { return; }
            var q = n.getBoundingClientRect();
            var dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
            var main, side;
            if (dir === 'l') { if (dx >= -4) { return; } main = -dx; side = Math.abs(dy); }
            else if (dir === 'r') { if (dx <= 4) { return; } main = dx; side = Math.abs(dy); }
            else if (dir === 'u') { if (dy >= -4) { return; } main = -dy; side = Math.abs(dx); }
            else { if (dy <= 4) { return; } main = dy; side = Math.abs(dx); }
            var score = main + side * 2;
            if (score < bestScore) { bestScore = score; best = n; }
        });
        if (best) {
            best.focus();
            if (best.scrollIntoView) { best.scrollIntoView({ block: 'nearest' }); }
        }
    }, true);

    /* ---------- entry points ----------
       Main entry: the "Watch History" item in the user menu, added by the Plugin Pages plugin.
       Opening that page runs this overlay. A small floating button is shown ONLY when the
       server could not register that menu entry. Nothing is added to Jellyfin's own DOM. */

    var openedFromPage = false;

    var suppressUntil = 0;

    function closeAndReturn() {
        var fromPage = openedFromPage;
        suppressUntil = Date.now() + 2000;
        close();
        if (fromPage) { window.history.back(); }
    }

    // Plugin Pages sends the user to #/userpluginsettings?pageUrl=tbdwatchhistory.html.
    // On some servers that route does not exist and Jellyfin shows "Page not found",
    // so the overlay is opened straight from the address instead.
    function onHistoryRoute() {
        return window.location.hash.indexOf('tbdwatchhistory.html') !== -1;
    }

    function onVideoRoute() {
        return window.location.hash.indexOf('#/video') === 0 || !!document.querySelector('video');
    }

    function makeFab() {
        var b = el('button');
        b.id = 'tbdwh-fab';
        b.type = 'button';
        b.title = 'Watch History';
        b.setAttribute('aria-label', 'Watch History');
        var icon = el('span', 'material-icons', 'history');
        icon.setAttribute('aria-hidden', 'true');
        b.appendChild(icon);
        b.style.cssText = 'position:fixed;right:1em;bottom:1em;z-index:9000;width:3em;height:3em;border-radius:50%;border:0;background:rgba(40,40,40,.85);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;box-shadow:0 2px 8px rgba(0,0,0,.5)';
        b.addEventListener('click', open);
        return b;
    }

    function ensureButton() {
        var fab = document.getElementById('tbdwh-fab');
        var show = !window.__tbdwhPage && !!userId() && !overlay && !onVideoRoute();
        if (show && !fab) {
            document.body.appendChild(makeFab());
        } else if (!show && fab && fab.parentNode) {
            fab.parentNode.removeChild(fab);
        }
    }

    function autoOpenFromPage() {
        var p = document.getElementById('tbdwh-plugin-page');
        var viaPage = !!p && !p.getAttribute('data-opened');
        var viaRoute = onHistoryRoute() && Date.now() > suppressUntil;
        if ((viaPage || viaRoute) && !overlay && userId()) {
            if (p) { p.setAttribute('data-opened', '1'); }
            open();
            openedFromPage = true;
        }
    }

    function start() {
        setInterval(function () {
            try {
                autoOpenFromPage();
                ensureButton();
                if (overlay && document.title !== 'Watch History') { document.title = 'Watch History'; }
            } catch (e) { /* ignore */ }
        }, 500);
    }

    window.TBDWatchHistory = { open: open, close: close };

    if (document.body) { start(); } else { document.addEventListener('DOMContentLoaded', start); }
})();
