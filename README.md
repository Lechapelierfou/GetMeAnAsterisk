# GetMeAnAsterisk

GetMeAn* collects web pages in topic-based lists. For example, create a list for your apartment search, save relevant listings directly from your browser, and add a price, address, comment, and contact/completion status to each saved page. Copy an address or search it on OpenStreetMap. Export any list as a CSV with the page URL, price, address, comment, and both statuses.

## Test in Firefox

1. Open `about:debugging` in Firefox.
2. Select **This Firefox**.
3. Click **Load Temporary Add-on...** and select this project's `manifest.json` file.
4. Open a web page and click the extension icon.
5. Create a topic or click **Add page** next to an existing topic.
6. To keep the extension open while browsing, open **View > Sidebar** and select `GetMeAn*`.

Topics and saved pages are stored locally in your Firefox profile. The extension requires access to the active tab's title and URL, as well as local extension storage. Currently on each plugin update data is lost.