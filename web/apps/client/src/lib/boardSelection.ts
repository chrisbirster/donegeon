const DEFAULT_BOARD = "default";
const BOARD_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const LAST_BOARD_KEY = "donegeon.board.last-selected";

function normalizeBoardID(raw: string | null | undefined): string {
  const normalized = (raw ?? "").trim();
  if (!normalized) return DEFAULT_BOARD;
  if (!BOARD_ID_PATTERN.test(normalized)) return DEFAULT_BOARD;
  return normalized;
}

export function readStoredBoardSelection(): string {
  if (typeof window === "undefined") return DEFAULT_BOARD;
  return normalizeBoardID(window.localStorage.getItem(LAST_BOARD_KEY));
}

export function writeStoredBoardSelection(nextBoardID: string): string {
  const normalized = normalizeBoardID(nextBoardID);
  if (typeof window !== "undefined") {
    if (normalized === DEFAULT_BOARD) {
      window.localStorage.removeItem(LAST_BOARD_KEY);
    } else {
      window.localStorage.setItem(LAST_BOARD_KEY, normalized);
    }
  }
  return normalized;
}

export function storedBoardHref(): string {
  const boardID = readStoredBoardSelection();
  if (boardID === DEFAULT_BOARD) return "/board";
  return `/board?board=${encodeURIComponent(boardID)}`;
}
