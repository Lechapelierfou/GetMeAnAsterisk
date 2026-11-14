import {
  listenForTopicChanges,
  loadStoredTopics,
  persistTopics,
} from "./topic-storage.js";

function message(key, substitutions) {
  return browser.i18n.getMessage(key, substitutions);
}

function localizeDocument() {
  const language = browser.i18n.getUILanguage().toLowerCase().split("-")[0];
  document.documentElement.lang = ["de", "en", "es", "fr", "it", "pl", "pt", "tr"]
    .includes(language)
    ? language
    : "en";

  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = message(element.dataset.i18n);
  }
  for (const [selector, attribute, dataAttribute] of [
    ["[data-i18n-placeholder]", "placeholder", "i18nPlaceholder"],
    ["[data-i18n-title]", "title", "i18nTitle"],
    ["[data-i18n-aria-label]", "aria-label", "i18nAriaLabel"],
  ]) {
    for (const element of document.querySelectorAll(selector)) {
      element.setAttribute(attribute, message(element.dataset[dataAttribute]));
    }
  }
}

localizeDocument();

const topicList = document.querySelector("#topic-list");
const topicForm = document.querySelector("#topic-form");
const topicNameInput = document.querySelector("#topic-name");
const emptyState = document.querySelector("#empty-state");
const listCount = document.querySelector("#list-count");
const statusMessage = document.querySelector("#status");

let currentTab;
let topics = [];

async function loadPanel() {
  const [, stored] = await Promise.all([
    refreshActiveTab(),
    loadStoredTopics(message("incompleteSyncedLists")),
  ]);

  topics = stored.topics;
  if (stored.migrated) {
    statusMessage.textContent = message("migrationComplete");
  }
  renderTopics();
}

function syncErrorMessage(error) {
  const details = error instanceof Error ? ` ${error.message}` : "";
  return message("syncSaveFailed", details);
}

async function refreshActiveTab() {
  try {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    currentTab = activeTab;
  } catch {
    currentTab = undefined;
  }

  for (const button of topicList.querySelectorAll(".add-button")) {
    button.disabled = !currentTab?.url;
  }
}

function renderTopics() {
  topicList.replaceChildren();
  listCount.textContent = String(topics.length);
  emptyState.hidden = topics.length > 0;

  for (const topic of topics) {
    const section = document.createElement("section");
    section.className = "topic";

    const heading = document.createElement("div");
    heading.className = "topic-heading";

    const title = document.createElement("div");
    title.className = "topic-title";

    const content = document.createElement("div");
    content.id = `topic-content-${topic.id}`;

    const toggleButton = document.createElement("button");
    toggleButton.className = "topic-toggle";
    toggleButton.type = "button";
    toggleButton.textContent = "▾";
    toggleButton.title = message("collapseList");
    toggleButton.setAttribute("aria-label", message("collapseListAria", topic.name));
    toggleButton.setAttribute("aria-expanded", "true");
    toggleButton.setAttribute("aria-controls", content.id);
    toggleButton.addEventListener("click", () => {
      content.hidden = !content.hidden;
      const expanded = !content.hidden;
      toggleButton.textContent = expanded ? "▾" : "▸";
      toggleButton.title = message(expanded ? "collapseList" : "expandList");
      toggleButton.setAttribute(
        "aria-label",
        message(expanded ? "collapseListAria" : "expandListAria", topic.name),
      );
      toggleButton.setAttribute("aria-expanded", String(expanded));
    });

    const name = document.createElement("span");
    name.className = "topic-name";
    name.textContent = topic.name;
    name.title = message("renameHint");
    name.addEventListener("dblclick", () => {
      const input = document.createElement("input");
      input.className = "topic-name-input";
      input.type = "text";
      input.maxLength = 60;
      input.value = topic.name;

      name.replaceWith(input);
      input.focus();
      input.select();

      let finished = false;
      const finishEditing = async (save) => {
        if (finished) return;
        finished = true;

        const newName = input.value.trim();
        if (!save || !newName || newName === topic.name) {
          input.replaceWith(name);
          return;
        }

        const previousName = topic.name;
        topic.name = newName;
        try {
          await persistTopics(topics);
          statusMessage.textContent = message("topicRenamed", newName);
          renderTopics();
        } catch (error) {
          topic.name = previousName;
          statusMessage.textContent = syncErrorMessage(error);
          renderTopics();
        }
      };

      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          finishEditing(true);
        } else if (event.key === "Escape") {
          finishEditing(false);
        }
      });
      input.addEventListener("blur", () => finishEditing(true));
    });

    const actions = document.createElement("div");
    actions.className = "topic-actions";

    const size = document.createElement("span");
    size.className = "topic-size";
    size.textContent = String(topic.links.length);

    const exportButton = document.createElement("button");
    exportButton.className = "export-button";
    exportButton.type = "button";
    exportButton.textContent = "CSV";
    exportButton.title = message("exportCsv");
    exportButton.setAttribute("aria-label", message("exportCsvAria", topic.name));
    exportButton.addEventListener("click", () => exportTopic(topic.id));

    const addButton = document.createElement("button");
    addButton.className = "add-button";
    addButton.type = "button";
    addButton.textContent = message("addPage");
    addButton.disabled = !currentTab?.url;
    addButton.addEventListener("click", () => addCurrentPage(topic.id));

    actions.append(size, exportButton, addButton);
    title.append(toggleButton, name);
    heading.append(title, actions);
    section.append(heading);
    section.append(content);

    if (topic.links.length > 0) {
      const savedLinks = document.createElement("div");
      savedLinks.className = "saved-links";

      for (const link of topic.links) {
        const entry = document.createElement("div");
        entry.className = "saved-entry";

        const row = document.createElement("div");
        row.className = "saved-link";

        const anchor = document.createElement("a");
        anchor.href = link.url;
        anchor.target = "_blank";
        anchor.rel = "noreferrer";
        anchor.textContent = link.title || link.url;
        anchor.title = link.url;

        const removeButton = document.createElement("button");
        removeButton.className = "remove-link";
        removeButton.type = "button";
        removeButton.textContent = message("remove");
        removeButton.setAttribute(
          "aria-label",
          message("removeLinkAria", [anchor.textContent, topic.name]),
        );
        removeButton.addEventListener("click", () => removeLink(topic.id, link.url));

        row.append(anchor, removeButton);

        const priceInput = document.createElement("input");
        priceInput.className = "link-price";
        priceInput.type = "text";
        priceInput.maxLength = 60;
        priceInput.placeholder = message("pricePlaceholder");
        priceInput.value = link.price || "";
        priceInput.setAttribute("aria-label", message("priceFor", link.title || link.url));

        const addressRow = document.createElement("div");
        addressRow.className = "address-row";

        const addressInput = document.createElement("input");
        addressInput.className = "link-address";
        addressInput.type = "text";
        addressInput.maxLength = 500;
        addressInput.placeholder = message("addressPlaceholder");
        addressInput.value = link.address || "";
        addressInput.setAttribute("aria-label", message("addressFor", link.title || link.url));

        const copyAddressButton = document.createElement("button");
        copyAddressButton.className = "address-action";
        copyAddressButton.type = "button";
        copyAddressButton.textContent = "⧉";
        copyAddressButton.title = message("copyAddress");
        copyAddressButton.setAttribute("aria-label", message("copyAddressFor", link.title || link.url));
        copyAddressButton.addEventListener("click", () => copyAddress(addressInput.value));

        const searchAddressButton = document.createElement("button");
        searchAddressButton.className = "address-action";
        searchAddressButton.type = "button";
        searchAddressButton.textContent = "↗";
        searchAddressButton.title = message("searchAddress");
        searchAddressButton.setAttribute("aria-label", message("searchAddressFor", link.title || link.url));
        searchAddressButton.addEventListener("click", () => searchAddress(addressInput.value));

        addressRow.append(addressInput, copyAddressButton, searchAddressButton);

        const commentInput = document.createElement("textarea");
        commentInput.className = "link-comment";
        commentInput.rows = 2;
        commentInput.maxLength = 1000;
        commentInput.placeholder = message("commentPlaceholder");
        commentInput.value = link.note || "";
        commentInput.setAttribute("aria-label", message("commentFor", link.title || link.url));

        const bindAutoSave = (input, field, label) => {
          let saveTimer;
          const save = () => {
            clearTimeout(saveTimer);
            saveLinkField(topic.id, link.url, field, input.value, label);
          };
          input.addEventListener("input", () => {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(save, 300);
          });
          input.addEventListener("blur", save);
        };
        bindAutoSave(priceInput, "price", "price");
        bindAutoSave(addressInput, "address", "address");
        bindAutoSave(commentInput, "note", "comment");

        const statusRow = document.createElement("div");
        statusRow.className = "link-status";

        const contactedLabel = document.createElement("label");
        contactedLabel.className = "link-checkbox";
        const contactedCheckbox = document.createElement("input");
        contactedCheckbox.type = "checkbox";
        contactedCheckbox.checked = Boolean(link.contacted);
        contactedCheckbox.setAttribute("aria-label", message("contactedFor", link.title || link.url));
        contactedCheckbox.addEventListener("change", () => {
          saveLinkField(topic.id, link.url, "contacted", contactedCheckbox.checked, "contactedStatus");
        });
        contactedLabel.append(contactedCheckbox, document.createTextNode(message("contacted")));

        const finishedLabel = document.createElement("label");
        finishedLabel.className = "link-checkbox";
        const finishedCheckbox = document.createElement("input");
        finishedCheckbox.type = "checkbox";
        finishedCheckbox.checked = Boolean(link.finished);
        finishedCheckbox.setAttribute("aria-label", message("finishedFor", link.title || link.url));
        finishedCheckbox.addEventListener("change", () => {
          saveLinkField(topic.id, link.url, "finished", finishedCheckbox.checked, "finishedStatus");
        });
        finishedLabel.append(finishedCheckbox, document.createTextNode(message("finished")));

        statusRow.append(contactedLabel, finishedLabel);
        entry.append(row, priceInput, addressRow, commentInput, statusRow);
        savedLinks.append(entry);
      }

      content.append(savedLinks);
    }

    const footer = document.createElement("div");
    footer.className = "topic-footer";
    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-topic";
    deleteButton.type = "button";
    deleteButton.textContent = message("deleteTopic");
    deleteButton.addEventListener("click", () => deleteTopic(topic.id));
    footer.append(deleteButton);
    content.append(footer);
    topicList.append(section);
  }
}

async function saveTopics() {
  try {
    await persistTopics(topics);
  } catch (error) {
    statusMessage.textContent = syncErrorMessage(error);
    renderTopics();
    return false;
  }
  renderTopics();
  return true;
}

function exportTopic(topicId) {
  const topic = topics.find((item) => item.id === topicId);
  if (!topic) return;

  const escapeCsvValue = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = [
    [
      message("csvUrlHeader"),
      message("csvPriceHeader"),
      message("csvAddressHeader"),
      message("csvCommentHeader"),
      message("csvContactedHeader"),
      message("csvFinishedHeader"),
    ],
    ...topic.links.map((link) => [
      link.url,
      link.price || "",
      link.address || "",
      link.note || "",
      link.contacted ? message("yes") : message("no"),
      link.finished ? message("yes") : message("no"),
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n")}`;
  const blobUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const downloadLink = document.createElement("a");
  const filename = topic.name.replace(/[\\/:*?"<>|]/g, "_").trim() || message("defaultFilename");

  downloadLink.href = blobUrl;
  downloadLink.download = `${filename}.csv`;
  downloadLink.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  statusMessage.textContent = message("topicExported", topic.name);
}

async function copyAddress(address) {
  const value = address.trim();
  if (!value) {
    statusMessage.textContent = message("enterAddressFirst");
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    statusMessage.textContent = message("addressCopied");
  } catch {
    statusMessage.textContent = message("addressCopyFailed");
  }
}

async function searchAddress(address) {
  const value = address.trim();
  if (!value) {
    statusMessage.textContent = message("enterAddressFirst");
    return;
  }

  try {
    await browser.tabs.create({
      url: `https://www.openstreetmap.org/search?query=${encodeURIComponent(value)}`,
    });
  } catch {
    statusMessage.textContent = message("openStreetMapFailed");
  }
}

async function saveLinkField(topicId, url, field, value, label) {
  const topic = topics.find((item) => item.id === topicId);
  const link = topic?.links.find((item) => item.url === url);
  if (!link) return;

  link[field] = value;
  try {
    await persistTopics(topics);
    statusMessage.textContent = message("fieldSaved", message(label));
  } catch (error) {
    statusMessage.textContent = syncErrorMessage(error);
  }
}

async function addCurrentPage(topicId) {
  if (!currentTab?.url) return;

  const topic = topics.find((item) => item.id === topicId);
  if (!topic) return;

  if (topic.links.some((link) => link.url === currentTab.url)) {
    statusMessage.textContent = message("pageAlreadySaved");
    return;
  }

  topic.links.unshift({
    url: currentTab.url,
    title: currentTab.title || currentTab.url,
    price: "",
    address: "",
    note: "",
    contacted: false,
    finished: false,
    savedAt: new Date().toISOString(),
  });
  if (await saveTopics()) {
    statusMessage.textContent = message("pageAdded", topic.name);
  }
}

async function removeLink(topicId, url) {
  const topic = topics.find((item) => item.id === topicId);
  if (!topic) return;

  topic.links = topic.links.filter((link) => link.url !== url);
  if (await saveTopics()) {
    statusMessage.textContent = message("pageRemoved");
  }
}

async function deleteTopic(topicId) {
  topics = topics.filter((topic) => topic.id !== topicId);
  if (await saveTopics()) {
    statusMessage.textContent = message("topicDeleted");
  }
}

topicForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = topicNameInput.value.trim();
  if (!name) return;

  topics.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    links: [],
  });
  if (await saveTopics()) {
    topicForm.reset();
    topicNameInput.focus();
    statusMessage.textContent = message("topicCreated", name);
  }
});

loadPanel().catch((error) => {
  statusMessage.textContent = message(
    "topicsLoadFailed",
    error instanceof Error ? ` ${error.message}` : "",
  );
});

listenForTopicChanges({
  onTopicsChanged(updatedTopics) {
    if (JSON.stringify(updatedTopics) === JSON.stringify(topics)) return;

    topics = updatedTopics;
    renderTopics();
    statusMessage.textContent = message("syncUpdated");
  },
  onError(error) {
    statusMessage.textContent = message(
      "topicsUpdateFailed",
      error instanceof Error ? ` ${error.message}` : "",
    );
  },
});

browser.tabs.onActivated.addListener(() => refreshActiveTab());
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.title)) {
    refreshActiveTab();
  }
});