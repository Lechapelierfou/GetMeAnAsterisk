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

  document.querySelector("#current-title").textContent = currentTab?.title || "Unbenannte Seite";
  document.querySelector("#current-url").textContent = currentTab?.url || "Keine Seitenadresse verfügbar";

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

    const name = document.createElement("span");
    name.className = "topic-name";
    name.textContent = topic.name;

    const actions = document.createElement("div");
    actions.className = "topic-actions";

    const size = document.createElement("span");
    size.className = "topic-size";
    size.textContent = String(topic.links.length);

    const addButton = document.createElement("button");
    addButton.className = "add-button";
    addButton.type = "button";
    addButton.textContent = "Seite hinzufügen";
    addButton.disabled = !currentTab?.url;
    addButton.addEventListener("click", () => addCurrentPage(topic.id));

    actions.append(size, addButton);
    heading.append(name, actions);
    section.append(heading);

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

        const noteInput = document.createElement("textarea");
        noteInput.className = "link-note";
        noteInput.rows = 2;
        noteInput.maxLength = 1000;
        noteInput.placeholder = "Notiz zu diesem Eintrag …";
        noteInput.value = link.note || "";
        noteInput.setAttribute("aria-label", `Notiz zu ${link.title || link.url}`);

        let saveTimer;
        const saveNote = () => {
          clearTimeout(saveTimer);
          saveLinkNote(topic.id, link.url, noteInput.value);
        };
        noteInput.addEventListener("input", () => {
          clearTimeout(saveTimer);
          saveTimer = setTimeout(saveNote, 300);
        });
        noteInput.addEventListener("blur", saveNote);

        entry.append(row, noteInput);
        savedLinks.append(entry);
      }

      section.append(savedLinks);
    }

    const footer = document.createElement("div");
    footer.className = "topic-footer";
    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-topic";
    deleteButton.type = "button";
    deleteButton.textContent = "Thema löschen";
    deleteButton.addEventListener("click", () => deleteTopic(topic.id));
    footer.append(deleteButton);
    section.append(footer);
    topicList.append(section);
  }
}

async function saveTopics() {
  await browser.storage.local.set({ topics });
  renderTopics();
}

async function saveLinkNote(topicId, url, note) {
  const topic = topics.find((item) => item.id === topicId);
  const link = topic?.links.find((item) => item.url === url);
  if (!link) return;

  link.note = note;
  try {
    await browser.storage.local.set({ topics });
    statusMessage.textContent = "Notiz gespeichert.";
  } catch {
    statusMessage.textContent = "Notiz konnte nicht gespeichert werden.";
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
  document.querySelector("#current-title").textContent = "Erweiterung konnte nicht geladen werden";
  statusMessage.textContent = "Bitte die Erweiterung neu laden und erneut versuchen.";
});

browser.tabs.onActivated.addListener(() => refreshActiveTab());
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.title)) {
    refreshActiveTab();
  }
});