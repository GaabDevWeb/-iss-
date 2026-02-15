/**
 * ISS — Fetch de conteúdo estático (disciplines.json, lessons.json, .md)
 */

const CONTENT_BASE = 'content';

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// #region agent log
function _log(msg, data, hypothesisId) {
  fetch('http://127.0.0.1:7244/ingest/a1df76ee-37a5-4177-b72b-ed8c0644a45c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'content.js', message: msg, data: Object.assign({ pathname: typeof location !== 'undefined' ? location.pathname : '' }, data || {}), timestamp: Date.now(), hypothesisId: hypothesisId || null }) }).catch(function() {});
}
// #endregion

async function fetchJSON(path) {
  var fullUrl = typeof location !== 'undefined' ? (new URL(CONTENT_BASE + '/' + path, location.href)).href : CONTENT_BASE + '/' + path;
  // #region agent log
  _log('fetchJSON request', { path: path, fullUrl: fullUrl }, 'H1');
  // #endregion
  const res = await fetch(`${CONTENT_BASE}/${path}`);
  // #region agent log
  if (!res.ok) _log('fetchJSON failed', { path: path, fullUrl: fullUrl, status: res.status }, 'H4');
  // #endregion
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

async function fetchText(path) {
  var fullUrl = typeof location !== 'undefined' ? (new URL(CONTENT_BASE + '/' + path, location.href)).href : CONTENT_BASE + '/' + path;
  // #region agent log
  _log('fetchText request', { path: path, fullUrl: fullUrl }, 'H2');
  // #endregion
  const res = await fetch(`${CONTENT_BASE}/${path}`);
  // #region agent log
  if (!res.ok) _log('fetchText failed', { path: path, fullUrl: fullUrl, status: res.status }, 'H4');
  // #endregion
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.text();
}

async function fetchDisciplines() {
  const data = await fetchJSON('disciplines.json');
  return Array.isArray(data) ? data.sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
}

async function fetchLessons() {
  const data = await fetchJSON('lessons.json');
  return Array.isArray(data) ? data : [];
}

function getLessonsByDiscipline(lessons, disciplineSlug) {
  return lessons
    .filter((l) => l.discipline === disciplineSlug)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

function getLesson(lessons, disciplineSlug, lessonSlug) {
  return lessons.find(
    (l) => l.discipline === disciplineSlug && l.slug === lessonSlug
  );
}

function getDiscipline(disciplines, slug) {
  return disciplines.find((d) => d.slug === slug);
}

async function fetchLessonMarkdown(disciplineSlug, filename) {
  // #region agent log
  var relPath = disciplineSlug + '/' + filename;
  _log('fetchLessonMarkdown', { disciplineSlug: disciplineSlug, filename: filename, relativePath: relPath }, 'H5');
  // #endregion
  return fetchText(`${disciplineSlug}/${filename}`);
}
