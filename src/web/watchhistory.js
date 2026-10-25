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
            '#tbdwh-overlay{position:fixed;top:0;left:0;right:0;bottom:0;z-index:100000;background:#101010;color:#eee;overflow-y:auto;-webkit-overflow-scrolling:touch;font-family:inherit}',
            '#tbdwh-head{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;align-items:center;gap:.6em;padding:.8em 1.2em;padding-top:calc(.8em + env(safe-area-inset-top,0px));background:rgba(16,16,16,.96);border-bottom:1px solid #2a2a2a}',
            '#tbdwh-head h1{margin:0 auto 0 .3em;font-size:1.5em;font-weight:500}',
            '.tbdwh-btn{background:#2a2a2a;color:#eee;border:2px solid transparent;border-radius:.4em;padding:.55em 1em;font-size:1em;cursor:pointer;font-family:inherit}',
            '.tbdwh-btn.active{background:#00a4dc;color:#fff}',
            '.tbdwh-btn:focus,.tbdwh-card:focus{outline:none;border-color:#fff;box-shadow:0 0 0 3px #00a4dc}',
            '#tbdwh-body{padding:1em 1.2em 3em}',
            '.tbdwh-day{margin:1.4em 0 .6em;font-size:1.15em;font-weight:500;color:#bbb}',
            '.tbdwh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:1em}',
            '.tbdwh-card{display:block;color:inherit;text-decoration:none;cursor:pointer;border:2px solid transparent;border-radius:.5em;padding:.3em}',
            '.tbdwh-poster{position:relative;width:100%;padding-top:150%;background:#1c1c1c;border-radius:.4em;overflow:hidden}',
            '.tbdwh-poster img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}',
            '.tbdwh-ph{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:.5em;color:#888;font-size:.9em}',
            '.tbdwh-t{margin-top:.5em;font-size:.95em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.tbdwh-s{font-size:.8em;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '#tbdwh-status{text-align:center;color:#999;padding:1.5em 0}',
            '#tbdwh-fab{position:fixed;right:1em;bottom:1em;z-index:9999;border-radius:50%;width:3.2em;height:3.2em;padding:0}',
            '@media (min-width:900px){.tbdwh-grid{grid-template-columns:repeat(auto-fill,minmax(170px,1fr))}}'
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

    function dayLabel(d) {
        var now = new Date();
        if (dayKey(d) === dayKey(now)) { return 'Today'; }
        if (dayKey(d) === dayKey(new Date(now.getTime() - 86400000))) { return 'Yesterday'; }
        return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    function openItem(item) {
        close();
        window.location.hash = '#/details?id=' + item.Id + (item.ServerId ? '&serverId=' + item.ServerId : '');
    }

    function buildCard(item) {
        var c = client();
        var isEp = item.Type === 'Episode';
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
            img.src = c.getUrl('Items/' + imgId + '/Images/Primary', { maxWidth: 360, quality: 90, tag: tag });
            poster.appendChild(img);
        } else {
            poster.appendChild(el('span', 'tbdwh-ph', item.Name || '?'));
        }
        card.appendChild(poster);

        var played = item.UserData && item.UserData.LastPlayedDate ? new Date(item.UserData.LastPlayedDate) : null;
        var time = played ? played.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        var title = isEp ? (item.SeriesName || item.Name) : item.Name;
        var sub;
        if (isEp) {
            sub = 'S' + (item.ParentIndexNumber != null ? item.ParentIndexNumber : '?') + 'E' + (item.IndexNumber != null ? item.IndexNumber : '?') + ' \u00b7 ' + (item.Name || '');
        } else {
            sub = item.ProductionYear ? String(item.ProductionYear) : '';
        }
        card.title = title + (sub ? ' - ' + sub : '') + (time ? ' (' + time + ')' : '');
        card.appendChild(el('div', 'tbdwh-t', title));
        card.appendChild(el('div', 'tbdwh-s', sub));
        var ud = item.UserData || {};
        var inProgress = !ud.Played && ud.PlaybackPositionTicks > 0;
        var label = 'Watched';
        if (inProgress) {
            label = 'In progress';
            if (item.RunTimeTicks) { label += ' \u00b7 ' + Math.round(ud.PlaybackPositionTicks / item.RunTimeTicks * 100) + '%'; }
        }
        card.appendChild(el('div', 'tbdwh-s', time ? label + ' \u00b7 ' + time : label));

        card.addEventListener('click', function () { openItem(item); });
        card._tbdItem = item;
        return card;
    }

    function render(items) {
        var body = overlay.querySelector('#tbdwh-list');
        items.forEach(function (item) {
            var d = item.UserData && item.UserData.LastPlayedDate ? new Date(item.UserData.LastPlayedDate) : null;
            var key = d ? dayKey(d) : 'unknown';
            if (key !== state.lastDay || !state.grid) {
                state.lastDay = key;
                body.appendChild(el('div', 'tbdwh-day', d ? dayLabel(d) : 'Earlier'));
                state.grid = el('div', 'tbdwh-grid');
                body.appendChild(state.grid);
            }
            state.grid.appendChild(buildCard(item));
        });
    }

    function updateStatus(text) {
        var s = overlay && overlay.querySelector('#tbdwh-status');
        if (s) { s.textContent = text; }
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
                updateStatus('Nothing watched yet.');
            } else {
                updateStatus(state.count + ' watched' + (state.done ? '' : ' so far'));
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

    function open() {
        if (overlay || !userId()) { return; }
        addStyles();
        state.filter = 'All';

        overlay = el('div');
        overlay.id = 'tbdwh-overlay';

        var head = el('div');
        head.id = 'tbdwh-head';
        var back = el('button', 'tbdwh-btn', '\u2190 Back');
        back.addEventListener('click', closeAndReturn);
        head.appendChild(back);
        head.appendChild(el('h1', null, 'Watch History'));
        ['All', 'Movies', 'Episodes'].forEach(function (name) {
            var b = el('button', 'tbdwh-btn' + (name === state.filter ? ' active' : ''), name === 'Episodes' ? 'TV Episodes' : name);
            b.addEventListener('click', function () {
                state.filter = name;
                [].forEach.call(head.querySelectorAll('.tbdwh-btn[data-f]'), function (x) { x.classList.toggle('active', x === b); });
                load(true);
            });
            b.setAttribute('data-f', name);
            head.appendChild(b);
        });
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

    function closeAndReturn() {
        var fromPage = openedFromPage;
        close();
        if (fromPage) { window.history.back(); }
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
        if (p && !p.getAttribute('data-opened') && !overlay && userId()) {
            p.setAttribute('data-opened', '1');
            open();
            openedFromPage = true;
        }
    }

    function start() {
        setInterval(function () {
            try { autoOpenFromPage(); ensureButton(); } catch (e) { /* ignore */ }
        }, 500);
    }

    window.TBDWatchHistory = { open: open, close: close };

    if (document.body) { start(); } else { document.addEventListener('DOMContentLoaded', start); }
})();
