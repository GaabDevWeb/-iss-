/**
 * ISS — Inicialização e orquestração por página
 */

const LAST_VISITED_KEY = 'iss-last-visited';

function getParam(name) {
  return typeof Router !== 'undefined' ? Router.getParam(name) : new URLSearchParams(window.location.search).get(name) || '';
}

function getLastVisited() {
  try {
    const raw = localStorage.getItem(LAST_VISITED_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj && typeof obj.discipline === 'string' && typeof obj.lesson === 'string') return obj;
    return null;
  } catch {
    return null;
  }
}

function setLastVisited(disciplineSlug, lessonSlug) {
  try {
    localStorage.setItem(LAST_VISITED_KEY, JSON.stringify({ discipline: disciplineSlug, lesson: lessonSlug }));
  } catch (_) {}
}

function initHome() {
  const container = document.getElementById('disciplines-list');
  const searchInput = document.getElementById('iss-search');
  const searchResultsEl = document.getElementById('search-results');
  if (!container) return;

  const minChars = 2;

  function getSearchMatches(disciplines, lessons, q) {
    const qLower = q.trim().toLowerCase();
    if (qLower.length < minChars) return [];
    const flat = lessons.map((lesson) => ({
      lesson,
      discipline: getDiscipline(disciplines, lesson.discipline),
    })).filter((item) => item.discipline);
    return flat.filter(
      (item) =>
        item.lesson.title.toLowerCase().includes(qLower) ||
        (item.discipline && (
          item.discipline.title.toLowerCase().includes(qLower) ||
          (item.discipline.professor && item.discipline.professor.toLowerCase().includes(qLower))
        ))
    );
  }

  function runSearch(disciplines, lessons) {
    if (!searchInput || !searchResultsEl) return;
    const q = searchInput.value.trim();
    const matches = getSearchMatches(disciplines, lessons, q);
    if (q.length < minChars) {
      searchResultsEl.classList.add('hidden');
      searchResultsEl.innerHTML = '';
      return;
    }
    searchResultsEl.classList.remove('hidden');
    if (matches.length === 0) {
      searchResultsEl.innerHTML = '<p class="iss-text-muted text-sm py-1">Nenhuma aula encontrada.</p>';
    } else {
      searchResultsEl.innerHTML =
        '<ul class="iss-search-results-list">' +
        matches
          .map(
            (item) =>
              '<li class="iss-search-result-item">' +
              '<a href="aula.html?d=' +
              encodeURIComponent(item.lesson.discipline) +
              '&a=' +
              encodeURIComponent(item.lesson.slug) +
              '" class="iss-search-result-link block no-underline py-2.5 px-2 rounded">' +
              '<span class="block text-xs iss-text-muted mb-0.5">' + escapeHtml(item.discipline.title) + '</span>' +
              '<span class="block text-sm font-medium iss-text-foreground">' + escapeHtml(item.lesson.title) + '</span>' +
              '</a></li>'
          )
          .join('') +
        '</ul>';
    }
  }

  Promise.all([fetchDisciplines(), fetchLessons()])
    .then(([disciplines, lessons]) => {
      const last = getLastVisited();
      let lesson = null;
      let discipline = null;
      if (last) {
        lesson = getLesson(lessons, last.discipline, last.lesson);
        discipline = getDiscipline(disciplines, last.discipline);
      }
      const continueCardHtml =
        lesson && discipline
          ? `
        <a href="aula.html?d=${encodeURIComponent(last.discipline)}&a=${encodeURIComponent(last.lesson)}" class="iss-card block no-underline text-inherit">
          <h3 class="font-semibold text-lg m-0">Continuar a ler</h3>
          <p class="text-sm iss-text-muted mt-1 mb-0">${escapeHtml(discipline.title)} › ${escapeHtml(lesson.title)}</p>
        </a>
      `
          : '';

      if (disciplines.length === 0) {
        container.innerHTML = continueCardHtml || '<p class="iss-text-muted">Nenhuma disciplina disponível.</p>';
      } else {
        const disciplinesHtml = disciplines
          .map(
            (d) => `
        <a href="disciplina.html?d=${encodeURIComponent(d.slug)}" class="iss-card block no-underline text-inherit">
          <h3 class="font-semibold text-lg m-0">${escapeHtml(d.title)}</h3>
          ${d.description ? `<p class="text-sm iss-text-muted mt-1 mb-0">${escapeHtml(d.description)}</p>` : ''}
        </a>
      `
          )
          .join('');
        container.innerHTML = continueCardHtml + disciplinesHtml;
      }

      if (searchInput && searchResultsEl) {
        const searchWrapper = searchInput.closest('.relative');
        searchInput.addEventListener('input', () => runSearch(disciplines, lessons));
        searchInput.addEventListener('search', () => runSearch(disciplines, lessons));
        searchInput.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const q = searchInput.value.trim();
          const matches = getSearchMatches(disciplines, lessons, q);
          if (matches.length === 0) return;
          const first = matches[0];
          window.location.href =
            'aula.html?d=' +
            encodeURIComponent(first.lesson.discipline) +
            '&a=' +
            encodeURIComponent(first.lesson.slug);
        });
        document.addEventListener('click', (e) => {
          if (searchResultsEl.classList.contains('hidden')) return;
          if (searchWrapper && searchWrapper.contains(e.target)) return;
          searchResultsEl.classList.add('hidden');
        });
      }
    })
    .catch((err) => {
      container.innerHTML = '<p class="text-red-600">Erro ao carregar disciplinas.</p>';
      console.error(err);
    });
}

function initDisciplina() {
  const d = getParam('d');
  const container = document.getElementById('lessons-list');
  const titleEl = document.getElementById('discipline-title');
  const breadcrumbEl = document.getElementById('breadcrumb-discipline');
  const progressEl = document.getElementById('discipline-progress');

  if (!d) {
    if (typeof Router !== 'undefined') Router.navigateHome();
    else window.location.href = 'index.html';
    return;
  }

  Promise.all([fetchDisciplines(), fetchLessons()])
    .then(([disciplines, lessons]) => {
      const discipline = getDiscipline(disciplines, d);
      const disciplineLessons = getLessonsByDiscipline(lessons, d);

      if (!discipline) {
        if (titleEl) titleEl.textContent = 'Disciplina não encontrada';
        if (breadcrumbEl) breadcrumbEl.innerHTML = '<a href="index.html" class="iss-link-muted">Home</a>';
        if (progressEl) progressEl.textContent = '';
        if (container) container.innerHTML = '<p class="iss-text-muted mb-4">Esta disciplina não existe.</p><a href="index.html" class="iss-link hover:underline">Voltar à página inicial</a>';
        return;
      }

      if (disciplineLessons.length === 0) {
        if (titleEl) titleEl.textContent = discipline.title;
        if (breadcrumbEl) {
          breadcrumbEl.innerHTML = `
            <a href="index.html" class="iss-link-muted">Home</a>
            <span class="iss-text-muted mx-1">/</span>
            <span>${escapeHtml(discipline.title)}</span>
          `;
        }
        if (progressEl) progressEl.textContent = '';
        if (container) container.innerHTML = '<p class="iss-text-muted mb-4">Nenhuma aula publicada ainda.</p><a href="index.html" class="iss-link hover:underline">Voltar à página inicial</a>';
        return;
      }

      if (titleEl) titleEl.textContent = discipline.title;
      if (breadcrumbEl) {
        breadcrumbEl.innerHTML = `
          <a href="index.html" class="iss-link-muted">Home</a>
          <span class="iss-text-muted mx-1">/</span>
          <span>${escapeHtml(discipline.title)}</span>
        `;
      }

      const readCount = typeof isLessonRead !== 'undefined' ? disciplineLessons.filter((l) => isLessonRead(d, l.slug)).length : 0;
      const total = disciplineLessons.length;
      if (progressEl) progressEl.textContent = `Progresso: ${readCount} / ${total} aulas`;

      if (container) {
        container.innerHTML = disciplineLessons
          .map(
            (l) => {
              const read = typeof isLessonRead !== 'undefined' && isLessonRead(d, l.slug);
              const readLabel = read ? '<span class="block text-sm iss-text-muted mt-1 iss-lesson-read">Lida</span>' : '';
              return `
          <a href="aula.html?d=${encodeURIComponent(d)}&a=${encodeURIComponent(l.slug)}" class="iss-card block no-underline text-inherit">
            <span class="font-medium">${escapeHtml(l.title)}</span>
            ${readLabel}
          </a>
        `;
            }
          )
          .join('');
      }
    })
    .catch(() => {
      if (typeof Router !== 'undefined') Router.navigateHome();
      else window.location.href = 'index.html';
    });
}

function initAula() {
  const d = getParam('d');
  const a = getParam('a');
  const contentEl = document.getElementById('lesson-content');
  const titleEl = document.getElementById('lesson-title');
  const breadcrumbEl = document.getElementById('breadcrumb-aula');

  function showAulaError(msg) {
    document.title = 'Aula não encontrada — ISS';
    if (titleEl) titleEl.textContent = 'Aula não encontrada';
    if (breadcrumbEl) breadcrumbEl.innerHTML = '<a href="index.html" class="iss-link-muted">Home</a>';
    if (contentEl) contentEl.innerHTML = '<p class="iss-text-muted mb-4">' + escapeHtml(msg) + '</p><a href="index.html" class="iss-link hover:underline">Voltar à página inicial</a>';
  }

  if (!d || !a) {
    showAulaError('Parâmetros de disciplina ou aula em falta.');
    return;
  }

  fetchLessons()
    .then((lessons) => {
      const lesson = getLesson(lessons, d, a);
      if (!lesson) {
        showAulaError('Esta aula não existe.');
        return null;
      }
      setLastVisited(d, a);
      const disciplineLessons = getLessonsByDiscipline(lessons, d);
      const idx = disciplineLessons.findIndex((l) => l.slug === lesson.slug);
      const prevLesson = idx > 0 ? disciplineLessons[idx - 1] : null;
      const nextLesson = idx >= 0 && idx < disciplineLessons.length - 1 ? disciplineLessons[idx + 1] : null;
      return fetchLessonMarkdown(d, lesson.file).then((raw) => ({
        raw,
        lesson,
        prevLesson,
        nextLesson,
        lessonIndex: idx + 1,
        totalLessons: disciplineLessons.length,
      }));
    })
    .then((data) => {
      if (!data) return;
      const { raw, lesson, prevLesson, nextLesson, lessonIndex, totalLessons } = data;
      return fetchDisciplines().then((disciplines) => {
        const discipline = getDiscipline(disciplines, d);
        renderAulaPage({ raw, lesson, discipline, prevLesson, nextLesson, lessonIndex, totalLessons });
      });
    })
    .catch(() => {
      showAulaError('Erro ao carregar o conteúdo da aula.');
    });
}

function getPageType() {
  const path = window.location.pathname;
  if (path.endsWith('disciplina.html')) return 'disciplina';
  if (path.endsWith('aula.html')) return 'aula';
  return 'home';
}

function initBackToTop() {
  const btn = document.getElementById('iss-back-to-top');
  if (!btn) return;
  const scrollThreshold = 300;
  function updateVisibility() {
    if (window.scrollY > scrollThreshold) {
      btn.style.display = '';
      btn.classList.add('is-visible');
    } else {
      btn.classList.remove('is-visible');
      btn.style.display = 'none';
    }
  }
  window.addEventListener('scroll', updateVisibility, { passive: true });
  updateVisibility();
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const page = getPageType();
  if (page === 'home') initHome();
  else if (page === 'disciplina') {
    initDisciplina();
    initBackToTop();
  } else if (page === 'aula') {
    initAula();
    initBackToTop();
  }
});
