import { type DBSchema, type IDBPDatabase, openDB } from "idb";

const DB_NAME = "donegeon";
const DB_VERSION = 1;
const STORE_NAME = "board_state";

type BoardStateStoreValue = unknown;

interface BoardCacheDB extends DBSchema {
  board_state: {
    key: string;
    value: BoardStateStoreValue;
  };
}

let dbPromise: Promise<IDBPDatabase<BoardCacheDB>> | null = null;

function openCacheDB(): Promise<IDBPDatabase<BoardCacheDB>> {
  if (dbPromise) return dbPromise;

  dbPromise = openDB<BoardCacheDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });

  return dbPromise;
}

export async function getCachedBoardState<T>(boardID: string): Promise<T | null> {
  try {
    const db = await openCacheDB();
    const cached = await db.get(STORE_NAME, boardID);
    return (cached as T | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function setCachedBoardState<T>(boardID: string, state: T): Promise<void> {
  try {
    const db = await openCacheDB();
    await db.put(STORE_NAME, state, boardID);
  } catch {
    // Silently ignore cache write failures.
  }
}
