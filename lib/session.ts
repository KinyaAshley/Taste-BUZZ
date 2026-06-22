// Anonymous viewers can like and save recipes without an account.
// We tag their browser with a random id, stored locally, so we know
// which recipes *they* have liked/saved.

export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('recipe-box-session');
  if (!id) {
    id = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('recipe-box-session', id);
  }
  return id;
}