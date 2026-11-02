# GetMeAnAsterisk

GetMeAn* collects web pages in topic-based lists. For example, create a list for your apartment search, save relevant listings directly from your browser, and add a price, address, comment, and contact/completion status to each saved page. Copy an address or search it on OpenStreetMap. Export any list as a CSV with the page URL, price, address, comment, and both statuses.

## Test in Firefox

1. Open `about:debugging` in Firefox.
2. Select **This Firefox**.
3. Click **Load Temporary Add-on...** and select this project's `manifest.json` file.
4. Open a web page and click the extension icon.
5. Create a topic or click **Add page** next to an existing topic.
6. To keep the extension open while browsing, open **View > Sidebar** and select `GetMeAn*`.

Topics and saved pages are stored with Firefox Sync and are available in desktop Firefox profiles signed in to the same Mozilla account. Enable **Add-ons** in Firefox Sync settings on each profile. Firefox for Android does not currently sync extension storage.

On first launch after this change, existing lists in local extension storage are copied to Firefox Sync. Each topic is stored separately so one large list does not consume the per-item quota for all lists. The extension's fixed ID in `manifest.json` is required for Sync to associate the data with the same add-on. Firefox Sync storage is limited to 8 KiB per item and 100 KiB total; if a list or the overall data exceeds those limits, the extension reports the error and keeps the existing synced data.
