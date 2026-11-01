const topicList = document.querySelector("#topic-list");
const topicForm = document.querySelector("#topic-form");
const topicNameInput = document.querySelector("#topic-name");
const emptyState = document.querySelector("#empty-state");
const listCount = document.querySelector("#list-count");
const statusMessage = document.querySelector("#status");

let currentTab;
let topics = [];

async function loadPopup() {
  const [, stored] = await Promise.all([
    refreshActiveTab(),
    browser.storage.local.get("topics"),
  ]);

  topics = Array.isArray(stored.topics) ? stored.topics : [];
  renderTopics();
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
    toggleButton.title = "Liste zuklappen";
    toggleButton.setAttribute("aria-label", `${topic.name} zuklappen`);
    toggleButton.setAttribute("aria-expanded", "true");
    toggleButton.setAttribute("aria-controls", content.id);
    toggleButton.addEventListener("click", () => {
      content.hidden = !content.hidden;
      const expanded = !content.hidden;
      toggleButton.textContent = expanded ? "▾" : "▸";
      toggleButton.title = expanded ? "Liste zuklappen" : "Liste aufklappen";
      toggleButton.setAttribute("aria-label", `${topic.name} ${expanded ? "zuklappen" : "aufklappen"}`);
      toggleButton.setAttribute("aria-expanded", String(expanded));
    });

    const name = document.createElement("span");
    name.className = "topic-name";
    name.textContent = topic.name;
    name.title = "Doppelklicken zum Umbenennen";
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
          await browser.storage.local.set({ topics });
          statusMessage.textContent = `Liste in „${newName}“ umbenannt.`;
          renderTopics();
        } catch {
          topic.name = previousName;
          statusMessage.textContent = "Liste konnte nicht umbenannt werden.";
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
    exportButton.title = "Liste als CSV exportieren";
    exportButton.setAttribute("aria-label", `${topic.name} als CSV exportieren`);
    exportButton.addEventListener("click", () => exportTopic(topic.id));

    const addButton = document.createElement("button");
    addButton.className = "add-button";
    addButton.type = "button";
    addButton.textContent = "Seite hinzufügen";
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
        removeButton.textContent = "Entfernen";
        removeButton.setAttribute("aria-label", `${anchor.textContent} aus ${topic.name} entfernen`);
        removeButton.addEventListener("click", () => removeLink(topic.id, link.url));

        row.append(anchor, removeButton);

        const priceInput = document.createElement("input");
        priceInput.className = "link-price";
        priceInput.type = "text";
        priceInput.maxLength = 60;
        priceInput.placeholder = "Preis (z. B. 12,99 €)";
        priceInput.value = link.price || "";
        priceInput.setAttribute("aria-label", `Preis zu ${link.title || link.url}`);

        const addressRow = document.createElement("div");
        addressRow.className = "address-row";

        const addressInput = document.createElement("input");
        addressInput.className = "link-address";
        addressInput.type = "text";
        addressInput.maxLength = 500;
        addressInput.placeholder = "Adresse";
        addressInput.value = link.address || "";
        addressInput.setAttribute("aria-label", `Adresse zu ${link.title || link.url}`);

        const copyAddressButton = document.createElement("button");
        copyAddressButton.className = "address-action";
        copyAddressButton.type = "button";
        copyAddressButton.textContent = "⧉";
        copyAddressButton.title = "Adresse kopieren";
        copyAddressButton.setAttribute("aria-label", `Adresse zu ${link.title || link.url} kopieren`);
        copyAddressButton.addEventListener("click", () => copyAddress(addressInput.value));

        const searchAddressButton = document.createElement("button");
        searchAddressButton.className = "address-action";
        searchAddressButton.type = "button";
        searchAddressButton.textContent = "↗";
        searchAddressButton.title = "Adresse auf OpenStreetMap suchen";
        searchAddressButton.setAttribute("aria-label", `Adresse zu ${link.title || link.url} auf OpenStreetMap suchen`);
        searchAddressButton.addEventListener("click", () => searchAddress(addressInput.value));

        addressRow.append(addressInput, copyAddressButton, searchAddressButton);

        const commentInput = document.createElement("textarea");
        commentInput.className = "link-comment";
        commentInput.rows = 2;
        commentInput.maxLength = 1000;
        commentInput.placeholder = "Kommentar zu diesem Eintrag …";
        commentInput.value = link.note || "";
        commentInput.setAttribute("aria-label", `Kommentar zu ${link.title || link.url}`);

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
        bindAutoSave(priceInput, "price", "Preis");
        bindAutoSave(addressInput, "address", "Adresse");
        bindAutoSave(commentInput, "note", "Kommentar");

        const statusRow = document.createElement("div");
        statusRow.className = "link-status";

        const contactedLabel = document.createElement("label");
        contactedLabel.className = "link-checkbox";
        const contactedCheckbox = document.createElement("input");
        contactedCheckbox.type = "checkbox";
        contactedCheckbox.checked = Boolean(link.contacted);
        contactedCheckbox.setAttribute("aria-label", `Kontaktiert: ${link.title || link.url}`);
        contactedCheckbox.addEventListener("change", () => {
          saveLinkField(topic.id, link.url, "contacted", contactedCheckbox.checked, "Kontaktiert-Status");
        });
        contactedLabel.append(contactedCheckbox, document.createTextNode("Kontaktiert"));

        const finishedLabel = document.createElement("label");
        finishedLabel.className = "link-checkbox";
        const finishedCheckbox = document.createElement("input");
        finishedCheckbox.type = "checkbox";
        finishedCheckbox.checked = Boolean(link.finished);
        finishedCheckbox.setAttribute("aria-label", `Fertig: ${link.title || link.url}`);
        finishedCheckbox.addEventListener("change", () => {
          saveLinkField(topic.id, link.url, "finished", finishedCheckbox.checked, "Fertig-Status");
        });
        finishedLabel.append(finishedCheckbox, document.createTextNode("Fertig"));

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
    deleteButton.textContent = "Thema löschen";
    deleteButton.addEventListener("click", () => deleteTopic(topic.id));
    footer.append(deleteButton);
    content.append(footer);
    topicList.append(section);
  }
}

async function saveTopics() {
  await browser.storage.local.set({ topics });
  renderTopics();
}

function exportTopic(topicId) {
  const topic = topics.find((item) => item.id === topicId);
  if (!topic) return;

  const escapeCsvValue = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = [
    ["Link", "Preis", "Adresse", "Kommentar", "Kontaktiert", "Fertig"],
    ...topic.links.map((link) => [
      link.url,
      link.price || "",
      link.address || "",
      link.note || "",
      link.contacted ? "Ja" : "Nein",
      link.finished ? "Ja" : "Nein",
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n")}`;
  const blobUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const downloadLink = document.createElement("a");
  const filename = topic.name.replace(/[\\/:*?"<>|]/g, "_").trim() || "Themenliste";

  downloadLink.href = blobUrl;
  downloadLink.download = `${filename}.csv`;
  downloadLink.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  statusMessage.textContent = `„${topic.name}“ als CSV exportiert.`;
}

async function copyAddress(address) {
  const value = address.trim();
  if (!value) {
    statusMessage.textContent = "Bitte zuerst eine Adresse eingeben.";
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    statusMessage.textContent = "Adresse kopiert.";
  } catch {
    statusMessage.textContent = "Adresse konnte nicht kopiert werden.";
  }
}

async function searchAddress(address) {
  const value = address.trim();
  if (!value) {
    statusMessage.textContent = "Bitte zuerst eine Adresse eingeben.";
    return;
  }

  try {
    await browser.tabs.create({
      url: `https://www.openstreetmap.org/search?query=${encodeURIComponent(value)}`,
    });
  } catch {
    statusMessage.textContent = "OpenStreetMap konnte nicht geöffnet werden.";
  }
}

async function saveLinkField(topicId, url, field, value, label) {
  const topic = topics.find((item) => item.id === topicId);
  const link = topic?.links.find((item) => item.url === url);
  if (!link) return;

  link[field] = value;
  try {
    await browser.storage.local.set({ topics });
    statusMessage.textContent = `${label} gespeichert.`;
  } catch {
    statusMessage.textContent = `${label} konnte nicht gespeichert werden.`;
  }
}

async function addCurrentPage(topicId) {
  if (!currentTab?.url) return;

  const topic = topics.find((item) => item.id === topicId);
  if (!topic) return;

  if (topic.links.some((link) => link.url === currentTab.url)) {
    statusMessage.textContent = "Diese Seite ist bereits in der Liste.";
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
  await saveTopics();
  statusMessage.textContent = `Seite zu „${topic.name}“ hinzugefügt.`;
}

async function removeLink(topicId, url) {
  const topic = topics.find((item) => item.id === topicId);
  if (!topic) return;

  topic.links = topic.links.filter((link) => link.url !== url);
  await saveTopics();
  statusMessage.textContent = "Seite entfernt.";
}

async function deleteTopic(topicId) {
  topics = topics.filter((topic) => topic.id !== topicId);
  await saveTopics();
  statusMessage.textContent = "Thema gelöscht.";
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
  await saveTopics();
  topicForm.reset();
  topicNameInput.focus();
  statusMessage.textContent = `Thema „${name}“ erstellt.`;
});

loadPopup().catch(() => {
  statusMessage.textContent = "Bitte die Erweiterung neu laden und erneut versuchen.";
});

browser.tabs.onActivated.addListener(() => refreshActiveTab());
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.title)) {
    refreshActiveTab();
  }
});