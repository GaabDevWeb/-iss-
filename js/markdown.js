/**
 * ISS — Parse frontmatter, render Markdown (Marked.js), Highlight.js, injeção de exercícios
 */

function parseFrontmatter(raw) {
  const delim = '---';
  const start = raw.indexOf(delim);
  if (start === -1) return { frontmatter: {}, body: raw.trim() };
  const afterFirst = raw.slice(start + delim.length);
  const end = afterFirst.indexOf(delim);
  if (end === -1) return { frontmatter: {}, body: raw.trim() };
  const yamlStr = afterFirst.slice(0, end).trim();
  const body = afterFirst.slice(end + delim.length).trim();

  const frontmatter = {};
  const lines = yamlStr.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const keyMatch = line.match(/^(\w+):\s*(.*)$/);
    if (keyMatch) {
      const [, key, rest] = keyMatch;
      let value = rest.trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1).replace(/\\"/g, '"');
      } else if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (/^\d+$/.test(value)) value = parseInt(value, 10);
      if (key !== 'exercises') frontmatter[key] = value;
    }
    if (line.match(/^exercises:\s*$/)) {
      const exercises = [];
      // Captura string entre aspas permitindo aspas do outro tipo dentro (ex.: "texto com 'aspas'")
      const quotedValue = (key, line) => {
        const re = new RegExp(`${key}:\\s*(["'])((?:\\\\.|(?!\\1)[\\s\\S])*)\\1`);
        const m = line.match(re);
        return m ? m[2].replace(/\\(.)/g, '$1') : null;
      };
      i++;
      while (i < lines.length) {
        const ln = lines[i];
        if (ln.match(/^\s+-\s+question:/)) {
          const ex = { question: '', answer: '', hint: '' };
          const q = quotedValue('question', ln);
          if (q != null) ex.question = q;
          i++;
          while (i < lines.length && !lines[i].match(/^\s+-\s+question:/)) {
            const rest = lines[i];
            const an = quotedValue('answer', rest);
            const hi = quotedValue('hint', rest);
            if (an != null) ex.answer = an;
            if (hi != null) ex.hint = hi;
            i++;
          }
          if (ex.question && ex.answer) exercises.push(ex);
        } else {
          i++;
        }
      }
      frontmatter.exercises = exercises;
      continue;
    }
    i++;
  }

  return { frontmatter, body };
}

function renderBody(body) {
  if (typeof marked === 'undefined') return escapeHtml(body).replace(/\n/g, '<br>');
  return marked.parse(body);
}

function highlightCodeBlocks(container) {
  if (typeof hljs === 'undefined' || !container) return;
  container.querySelectorAll('pre code').forEach((el) => {
    hljs.highlightElement(el);
  });
}

function ensureSectionIds(container) {
  if (!container) return;
  const h2s = container.querySelectorAll('.iss-prose h2');
  const ids = ['resumo', 'explicacoes'];
  h2s.forEach((h2, i) => {
    if (ids[i]) h2.id = ids[i];
  });
}

function renderExercisesHTML(exercises, disciplineSlug, lessonSlug, reviewedIds) {
  if (!Array.isArray(exercises) || exercises.length === 0) return '';
  const ids = reviewedIds instanceof Set ? reviewedIds : new Set();
  const list = exercises
    .map((ex, i) => {
      const exerciseId = `${disciplineSlug}_${lessonSlug}_${i}`;
      const isReviewed = ids.has(exerciseId);
      const revisadoClass = isReviewed ? ' iss-exercise--revisado' : '';
      const revisadoLabel = isReviewed ? ' <span class="iss-exercise__revisado-label text-sm iss-text-muted">Revisado</span>' : '';
      return `
    <div class="iss-exercise${revisadoClass}" data-exercise-id="${escapeHtml(exerciseId)}">
      <p class="font-medium mb-2">${escapeHtml(ex.question)}${revisadoLabel}</p>
      <details class="group">
        <summary class="iss-exercise__toggle cursor-pointer list-none">
          <span class="inline">Ver resposta sugerida</span>
        </summary>
        <div class="mt-3 pt-3 border-t iss-border">
          <p class="mb-0">${escapeHtml(ex.answer)}</p>
          ${ex.hint ? `<p class="text-sm iss-text-muted mt-2 mb-0"><strong>Dica:</strong> ${escapeHtml(ex.hint)}</p>` : ''}
        </div>
      </details>
    </div>
  `;
    })
    .join('');
  return `
  <h2 id="exercicios" class="text-xl font-semibold mt-8 mb-4 pb-1 border-b iss-border">Exercícios</h2>
  <div class="space-y-4">${list}</div>
  `;
}

function renderPrevNextNav(prevLesson, nextLesson, disciplineSlug) {
  if (!prevLesson && !nextLesson) return '';
  const prevLink = prevLesson
    ? `<a href="aula.html?d=${encodeURIComponent(disciplineSlug)}&a=${encodeURIComponent(prevLesson.slug)}" class="iss-link">Aula anterior</a>`
    : '<span class="iss-text-muted">Aula anterior</span>';
  const nextLink = nextLesson
    ? `<a href="aula.html?d=${encodeURIComponent(disciplineSlug)}&a=${encodeURIComponent(nextLesson.slug)}" class="iss-link">Próxima aula</a>`
    : '<span class="iss-text-muted">Próxima aula</span>';
  return `<nav class="mt-8 pt-6 border-t iss-border flex justify-between text-sm" aria-label="Navegação entre aulas">${prevLink}${nextLink}</nav>`;
}

function renderLessonClosure(readToggleHtml) {
  const content = readToggleHtml ? `✓ Aula concluída, ${readToggleHtml}` : '✓ Aula concluída';
  return `<div class="mt-8 pt-6 border-t iss-border"><p class="mb-0">${content}</p></div>`;
}

function renderAulaPage({ raw, lesson, discipline, prevLesson, nextLesson, lessonIndex, totalLessons }) {
  const { frontmatter, body } = parseFrontmatter(raw);
  const title = frontmatter.title || lesson.title;

  document.title = `${title} — ISS`;

  const breadcrumbEl = document.getElementById('breadcrumb-aula');
  if (breadcrumbEl) {
    const d = new URLSearchParams(window.location.search).get('d');
    breadcrumbEl.innerHTML = `
      <a href="index.html" class="iss-link-muted">Home</a>
      <span class="iss-text-muted mx-1">/</span>
      <a href="disciplina.html?d=${encodeURIComponent(d)}" class="iss-link-muted">${escapeHtml(discipline ? discipline.title : d)}</a>
      <span class="iss-text-muted mx-1">/</span>
      <span>${escapeHtml(title)}</span>
    `;
  }

  const titleEl = document.getElementById('lesson-title');
  if (titleEl) titleEl.textContent = title;

  const contentEl = document.getElementById('lesson-content');
  if (contentEl) {
    const disciplineSlug = discipline ? discipline.slug : '';
    const lessonSlug = lesson.slug;
    const read = typeof isLessonRead !== 'undefined' && isLessonRead(disciplineSlug, lessonSlug);
    const readToggleLabel = read ? 'Desmarcar como lida' : 'Marcar como lida';
    const readToggleBtnHtml = `<button type="button" id="iss-mark-read-toggle" class="text-sm iss-link border-0 bg-transparent cursor-pointer p-0 underline hover:no-underline">${escapeHtml(readToggleLabel)}</button>`;

    const words = body.trim().split(/\s+/).filter(Boolean).length;
    const readingMinutes = frontmatter.readingMinutes != null
      ? Math.max(1, parseInt(frontmatter.readingMinutes, 10) || 1)
      : Math.max(1, Math.ceil(words / 200));
    const exerciseCount = (frontmatter.exercises || []).length;
    const readingTimeText = exerciseCount > 0
      ? `~${readingMinutes} min de leitura, ${exerciseCount} exercícios`
      : `~${readingMinutes} min de leitura`;
    const readingTimeHtml = `<p class="iss-reading-time iss-text-muted text-sm mb-4">${readingTimeText}</p>`;
    const bodyHtml = renderBody(body);
    const reviewedIds = typeof getReviewedExerciseIds !== 'undefined' ? getReviewedExerciseIds() : new Set();
    const exercisesHtml = renderExercisesHTML(frontmatter.exercises || [], disciplineSlug, lesson.slug, reviewedIds);
    const closureHtml = renderLessonClosure(readToggleBtnHtml);
    const prevNextHtml = renderPrevNextNav(prevLesson || null, nextLesson || null, disciplineSlug);
    contentEl.innerHTML = `${readingTimeHtml}<nav class="mb-6 text-sm" aria-label="Nesta página"><a href="#resumo" class="iss-link hover:underline">Resumo</a><span class="iss-text-muted mx-1" aria-hidden="true">·</span><a href="#explicacoes" class="iss-link hover:underline">Explicações</a><span class="iss-text-muted mx-1" aria-hidden="true">·</span><a href="#exercicios" class="iss-link hover:underline">Exercícios</a></nav><div class="iss-prose">${bodyHtml}</div>${exercisesHtml}${closureHtml}${prevNextHtml}`;
    contentEl.querySelectorAll('img').forEach((img) => img.setAttribute('loading', 'lazy'));
    contentEl.querySelectorAll('iframe').forEach((iframe) => iframe.setAttribute('loading', 'lazy'));
    highlightCodeBlocks(contentEl);
    ensureSectionIds(contentEl);
    const resumoH2 = contentEl.querySelector('#resumo');
    if (resumoH2) {
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'text-sm iss-link border-0 bg-transparent cursor-pointer p-0 underline hover:no-underline block mb-7';
      copyBtn.textContent = 'Copiar resumo';
      copyBtn.addEventListener('click', () => {
        const explicacoesEl = contentEl.querySelector('#explicacoes');
        let node = resumoH2.nextSibling;
        const parts = [];
        while (node && node !== explicacoesEl) {
          if (node.nodeType === Node.ELEMENT_NODE && node.innerText) parts.push(node.innerText);
          node = node.nextSibling;
        }
        const bodyText = parts.join('\n\n');
        const text = (resumoH2.innerText ? resumoH2.innerText + '\n\n' : '') + bodyText;
        if (text && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => {
            copyBtn.textContent = 'Copiado!';
            setTimeout(() => { copyBtn.textContent = 'Copiar resumo'; }, 2000);
          });
        }
      });
      resumoH2.after(copyBtn);
    }
    contentEl.querySelectorAll('.iss-exercise').forEach((block) => {
      const details = block.querySelector('details');
      const id = block.getAttribute('data-exercise-id');
      if (details && id && typeof markExerciseAsReviewed !== 'undefined') {
        details.addEventListener('toggle', () => {
          if (details.open) {
            markExerciseAsReviewed(id);
            block.classList.add('iss-exercise--revisado');
            const label = block.querySelector('.iss-exercise__revisado-label');
            if (!label) {
              const p = block.querySelector('p.font-medium');
              if (p) {
                const span = document.createElement('span');
                span.className = 'iss-exercise__revisado-label text-sm iss-text-muted';
                span.textContent = ' Revisado';
                p.appendChild(span);
              }
            }
          }
        });
      }
    });

    const readToggleBtn = contentEl.querySelector('#iss-mark-read-toggle');
    if (readToggleBtn && typeof markLessonAsRead !== 'undefined' && typeof markLessonAsUnread !== 'undefined') {
      readToggleBtn.addEventListener('click', () => {
        const nowRead = isLessonRead(disciplineSlug, lessonSlug);
        if (nowRead) {
          markLessonAsUnread(disciplineSlug, lessonSlug);
          readToggleBtn.textContent = 'Marcar como lida';
        } else {
          markLessonAsRead(disciplineSlug, lessonSlug);
          readToggleBtn.textContent = 'Desmarcar como lida';
        }
      });
    }
  }

}
