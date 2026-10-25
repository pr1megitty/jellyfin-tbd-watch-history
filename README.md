# Watch History

A Jellyfin plugin that gives every user a **Watch History** page (movies and TV episodes they have
watched, newest first, grouped by day, with All / Movies / TV Episodes filters).

It needs the **File Transformation** plugin. It uses only the normal Jellyfin API, so each user
only ever sees their own history.

## Install

1. Create a GitHub repo, push this folder, then tag a release: `git tag v1.0.0.0 && git push --tags`
2. The workflow builds the plugin and publishes `manifest.json` with the release.
3. In Jellyfin: Dashboard > Plugins > Repositories > add
   `https://github.com/<you>/jellyfin-tbd-watch-history/releases/latest/download/manifest.json`
4. Install **TBD Watch History** from the catalogue and restart Jellyfin.
5. Hard-refresh the web client. A history icon appears in the header and "Watch History" in the sidebar.

## Where it works

Anything that loads the Jellyfin web UI from the server: desktop and phone browsers, installed web
apps, and TV apps that run the web client. Native apps (Android TV / Android, Swiftfin, Roku, etc.)
ignore server-injected scripts, so no plugin can add a page there.
