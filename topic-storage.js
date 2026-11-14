const topicIdsKey = "topicIds";
const topicStoragePrefix = "topic:";

export async function loadStoredTopics(incompleteTopicsMessage) {
  const [synced, local] = await Promise.all([
    browser.storage.sync.get(null),
    browser.storage.local.get(["topics", "topicsMigratedToSync"]),
  ]);

  if (Array.isArray(synced[topicIdsKey])) {
    const syncedTopics = synced[topicIdsKey].map((id) => synced[`${topicStoragePrefix}${id}`]);
    if (syncedTopics.some((topic) => !topic || !Array.isArray(topic.links))) {
      throw new Error(incompleteTopicsMessage);
    }

    if (
      !local.topicsMigratedToSync &&
      Array.isArray(local.topics) &&
      local.topics.length > 0
    ) {
      const syncedIds = new Set(syncedTopics.map((topic) => topic.id));
      const mergedTopics = [
        ...syncedTopics,
        ...local.topics.filter((topic) => !syncedIds.has(topic.id)),
      ];
      await persistTopics(mergedTopics);
      await browser.storage.local.set({ topicsMigratedToSync: true });
      return { topics: mergedTopics, migrated: true };
    }

    return { topics: syncedTopics, migrated: false };
  }

  const legacySyncTopics = Array.isArray(synced.topics) ? synced.topics : [];
  const localTopics = Array.isArray(local.topics) && !local.topicsMigratedToSync
    ? local.topics
    : [];
  const topicsToMigrate = [...legacySyncTopics];
  const syncedIds = new Set(legacySyncTopics.map((topic) => topic.id));
  topicsToMigrate.push(...localTopics.filter((topic) => !syncedIds.has(topic.id)));

  if (topicsToMigrate.length > 0 || Array.isArray(local.topics) || Array.isArray(synced.topics)) {
    await persistTopics(topicsToMigrate);
    if (Array.isArray(local.topics)) {
      await browser.storage.local.set({ topicsMigratedToSync: true });
    }
    return {
      topics: topicsToMigrate,
      migrated: Array.isArray(local.topics) && !local.topicsMigratedToSync,
    };
  }

  return { topics: [], migrated: false };
}

export async function persistTopics(nextTopics) {
  const topicKeys = nextTopics.map((topic) => `${topicStoragePrefix}${topic.id}`);
  const values = Object.fromEntries(
    nextTopics.map((topic) => [`${topicStoragePrefix}${topic.id}`, topic]),
  );
  values[topicIdsKey] = nextTopics.map((topic) => topic.id);

  await browser.storage.sync.set(values);

  const stored = await browser.storage.sync.get(null);
  const staleKeys = Object.keys(stored).filter(
    (key) => key.startsWith(topicStoragePrefix) && !topicKeys.includes(key),
  );
  if (staleKeys.length > 0) {
    await browser.storage.sync.remove(staleKeys);
  }
  if (Object.hasOwn(stored, "topics")) {
    await browser.storage.sync.remove("topics");
  }
}

export function listenForTopicChanges({ onTopicsChanged, onError }) {
  browser.storage.onChanged.addListener(async (changes, areaName) => {
    if (
      areaName !== "sync" ||
      !Object.keys(changes).some((key) => key === topicIdsKey || key.startsWith(topicStoragePrefix))
    ) {
      return;
    }

    try {
      const stored = await browser.storage.sync.get(null);
      if (!Array.isArray(stored[topicIdsKey])) return;

      const updatedTopics = stored[topicIdsKey].map((id) => stored[`${topicStoragePrefix}${id}`]);
      await onTopicsChanged(updatedTopics);
    } catch (error) {
      onError(error);
    }
  });
}
