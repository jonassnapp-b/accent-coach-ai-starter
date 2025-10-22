// Simple localStorage helpers for bookmarks
const KEY = "ac_bookmarks_v1";

export function getBookmarks() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}

export function setBookmarks(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function isBookmarked(text) {
  const t = (text || "").trim().toLowerCase();
  return getBookmarks().some(b => (b.text || "").trim().toLowerCase() === t);
}

export function addBookmark(entry) {
  const list = getBookmarks();
  // de-dupe on text
  if (!isBookmarked(entry.text)) {
    list.unshift({ id: Date.now(), ...entry });
    setBookmarks(list);
  }
  return list;
}

export function removeBookmarkByText(text) {
  const t = (text || "").trim().toLowerCase();
  setBookmarks(getBookmarks().filter(b => (b.text || "").trim().toLowerCase() !== t));
  return getBookmarks();
}

export function toggleBookmark(entry) {
  if (isBookmarked(entry.text)) return removeBookmarkByText(entry.text);
  return addBookmark(entry);
}
