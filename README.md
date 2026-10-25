# Watch History

A Jellyfin plugin that gives every user a **Watch History** page: the movies and TV episodes they have
watched or started, newest first, grouped by day, with All / Movies / TV Episodes filters. Each user only
ever sees their own history.

## Requirements

- Jellyfin **12.x** (built and tested on 12.2, web client)
- **File Transformation** plugin (required)
- **Plugin Pages** plugin (recommended, adds the entry to the user menu)

Both plugins are in the repository `https://www.iamparadox.dev/jellyfin/plugins/manifest.json`.

## Install

1. In Jellyfin open **Dashboard > Plugins > Repositories**, click **+** and add:

   `https://github.com/pr1megitty/jellyfin-watch-history/releases/latest/download/manifest.json`

2. Open the **Catalogue**, install **TBD Watch History**, then restart Jellyfin.
3. Hard-refresh the web client (Ctrl+F5).
4. Click your avatar and choose **Watch History**.

Without Plugin Pages there is no menu entry, so a small round history button appears in the bottom-right
corner of the web client instead.

## Where it works

Anything that loads the Jellyfin web UI from the server: desktop and phone browsers, the Jellyfin iOS app,
and TV apps that run the web client. Native apps (Android TV / Android, Swiftfin, Roku, etc.) ignore
server-injected scripts, so no plugin can add a page there.

## Updating

Update the plugin from **Dashboard > Plugins**, restart Jellyfin and press Ctrl+F5.
