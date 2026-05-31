// Генератор статического сайта брошюры «Мебельщикам в кризис»
// Никаких зависимостей — чистый Node.js

const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const BROCH = path.join(BASE, '..', '_брошюра');
const RAW = path.join(BROCH, 'raw');
const ART_OUT = path.join(BASE, 'articles');
const META = JSON.parse(fs.readFileSync(path.join(BROCH, 'metadata.json'), 'utf8'));

const SITE_TITLE = META.title;
const SITE_SUBTITLE = META.subtitle;
const AUTHOR = META.author;

const esc = s => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const inline = (text) => {
  text = esc(text).replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^\*])\*([^*\n]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');
  text = text.replace(/(^|[^_])_([^_\n]+)_([^_]|$)/g, '$1<em>$2</em>$3');
  return text;
};

function parseArticle(num) {
  const raw = fs.readFileSync(path.join(RAW, `${num}.md`), 'utf8');
  const lines = raw.split(/\r?\n/);
  let title = '', url = '', bodyStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('Title:')) title = lines[i].slice(6).trim();
    if (lines[i].startsWith('URL Source:')) url = lines[i].slice(11).trim();
    if (lines[i].startsWith('Markdown Content:')) { bodyStart = i + 1; break; }
  }
  const body = lines.slice(bodyStart).join('\n').trim();
  const urlClean = url.replace(/\?.*$/, '');
  return { num, title, url: urlClean, body, blocks: blockify(body, num) };
}

function blockify(md, articleNum) {
  const blocks = [];
  const lines = md.split('\n');
  let imgIdx = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const imgMatch = line.match(/^!\[([^\]]*)\]\((https?:\/\/[^\)]+)\)\s*$/);
    if (imgMatch) {
      imgIdx++;
      const local = `${articleNum}_${String(imgIdx).padStart(2, '0')}.jpg`;
      blocks.push({ type: 'img', src: local, alt: imgMatch[1] || `Иллюстрация ${imgIdx}` });
      i++; continue;
    }
    if (line.startsWith('#### ')) { blocks.push({ type: 'h4', text: line.slice(5).trim() }); i++; continue; }
    if (line.startsWith('### ')) { blocks.push({ type: 'h3', text: line.slice(4).trim() }); i++; continue; }
    if (line.startsWith('## ')) { blocks.push({ type: 'h2', text: line.slice(3).trim() }); i++; continue; }
    if (line.startsWith('# ')) { blocks.push({ type: 'h2', text: line.slice(2).trim() }); i++; continue; }
    if (/^[-_*]{3,}\s*$/.test(line)) { blocks.push({ type: 'hr' }); i++; continue; }
    if (line.startsWith('> ')) {
      const parts = [];
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i].startsWith('>'))) {
        parts.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'quote', text: parts.join(' ').trim() });
      continue;
    }
    if (/^[\*\-]\s+/.test(line) || /^\*\s{2,}/.test(line)) {
      const items = [];
      while (i < lines.length && (/^[\*\-]\s+/.test(lines[i]) || /^\*\s{2,}/.test(lines[i]) || !lines[i].trim())) {
        const ln = lines[i];
        if (!ln.trim()) { i++; continue; }
        const text = ln.replace(/^[\*\-]\s+/, '').replace(/^\*\s+/, '').trim();
        if (text) items.push(text);
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }
    const paraLines = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,4} |> |!\[|[\*\-]\s|\*\s{2,}|[-_*]{3,}\s*$)/.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'p', text: paraLines.join(' ').trim() });
  }
  return blocks;
}

function renderBlock(b, imgPrefix) {
  if (b.type === 'h2') return `<h2>${inline(b.text)}</h2>`;
  if (b.type === 'h3') return `<h3>${inline(b.text)}</h3>`;
  if (b.type === 'h4') return `<h4>${inline(b.text)}</h4>`;
  if (b.type === 'p') return `<p>${inline(b.text)}</p>`;
  if (b.type === 'quote') return `<blockquote>${inline(b.text)}</blockquote>`;
  if (b.type === 'ul') return `<ul>${b.items.map(it => `<li>${inline(it)}</li>`).join('')}</ul>`;
  if (b.type === 'hr') return '<hr>';
  if (b.type === 'img') return `<img src="${imgPrefix}${b.src}" alt="${esc(b.alt)}" loading="lazy">`;
  return '';
}

function blocksToHtml(blocks, opts = {}) {
  const imgPrefix = opts.imgPrefix || '../images/';
  return blocks.map(b => renderBlock(b, imgPrefix)).join('\n');
}

// Группировка блоков статьи в раскрывающиеся секции по H2.
// Всё до первого H2 — вступление (не сворачивается).
// Каждая секция: { heading: "...", blocks: [...] }
function groupIntoSections(blocks) {
  const intro = [];
  const sections = [];
  let cur = null;
  for (const b of blocks) {
    if (b.type === 'h2') {
      if (cur) sections.push(cur);
      cur = { heading: b.text, blocks: [] };
    } else {
      if (cur) cur.blocks.push(b);
      else intro.push(b);
    }
  }
  if (cur) sections.push(cur);
  return { intro, sections };
}

function articleBodyHtml(blocks, imgPrefix) {
  const { intro, sections } = groupIntoSections(blocks);
  const out = [];
  if (intro.length) out.push(intro.map(b => renderBlock(b, imgPrefix)).join('\n'));
  for (const sec of sections) {
    const inner = sec.blocks.map(b => renderBlock(b, imgPrefix)).join('\n');
    out.push(`<details class="section" open>
<summary><h2>${inline(sec.heading)}</h2></summary>
${inner}
</details>`);
  }
  return out.join('\n');
}

function readingTime(blocks) {
  const text = blocks
    .filter(b => b.text || (b.items && b.items.join))
    .map(b => b.text || b.items.join(' '))
    .join(' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.round(words / 180));
}

function readSimpleMd(filename) {
  let raw = fs.readFileSync(path.join(BROCH, filename), 'utf8');
  raw = raw.replace(/^---[\s\S]+?---\s*/, '');
  return blockify(raw, '00');
}

// ── Sidebar ──────────────────────────────────────────────────────
// active: 'home' | 'preface' | 'about' | 'conclusion' | 'article:NN' (где NN — chapter index)
function renderSidebar(active, articlesByNum, depth = 0) {
  const up = depth === 0 ? '' : '../'.repeat(depth);
  const isActive = id => active === id ? ' class="is-active"' : '';

  let chapter = 0;
  const partsHtml = META.parts.map(part => {
    const chaptersHtml = part.articles.map(num => {
      chapter++;
      const a = articlesByNum[num];
      const chId = `article:${String(chapter).padStart(2, '0')}`;
      const fname = `${String(chapter).padStart(2, '0')}.html`;
      return `<li><a href="${up}articles/${fname}"${isActive(chId)}>${esc(a.title)}</a></li>`;
    }).join('\n');
    const partActive = chapter >= 1 && (() => {
      // часть «активна» если активная глава внутри неё
      let c = 0;
      for (const p of META.parts) {
        for (const num of p.articles) {
          c++;
          if (`article:${String(c).padStart(2, '0')}` === active && p === part) return true;
        }
      }
      return false;
    })();
    return `<details${partActive ? ' open' : ''}>
<summary><span class="sidebar__part-num">${esc(part.number)}</span> ${esc(part.title)}</summary>
<ul>
${chaptersHtml}
</ul>
</details>`;
  }).join('\n');

  const hasDocx = fs.existsSync(path.join(BROCH, META.outputFilename));

  return `<aside class="sidebar" id="sidebar">
  <nav class="sidebar__nav">
    <a href="${up}index.html"${isActive('home')}>Главная</a>
    <a href="${up}index.html#preface"${isActive('preface')}>Предисловие</a>

    <div class="sidebar__nav-section">Содержание</div>
    ${partsHtml}

    <a href="${up}conclusion.html"${isActive('conclusion')}>Заключение</a>

    <div class="sidebar__nav-section">Автор</div>
    <a href="${up}about.html"${isActive('about')}>Об авторе</a>
  </nav>

  ${hasDocx ? `<a class="sidebar__download" href="${up}${esc(META.outputFilename)}" download>
    Скачать в Word
    <span class="sidebar__download-note">.docx · 20 МБ</span>
  </a>` : ''}
</aside>
<div class="sidebar-backdrop" id="sidebarBackdrop"></div>
<button class="sidebar-toggle" id="sidebarToggle" aria-label="Меню">☰</button>`;
}

const SIDEBAR_JS = `(function(){
  var t = document.getElementById('sidebarToggle');
  var s = document.getElementById('sidebar');
  var b = document.getElementById('sidebarBackdrop');
  if (!t || !s) return;
  function close(){ s.classList.remove('is-open'); b.classList.remove('is-open'); }
  function open(){ s.classList.add('is-open'); b.classList.add('is-open'); }
  t.addEventListener('click', function(){ s.classList.contains('is-open') ? close() : open(); });
  b.addEventListener('click', close);
  // закрыть по выбору пункта на мобильном
  s.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', function(){ if (window.innerWidth <= 900) close(); }); });
})();`;

const PROGRESS_JS = `(function(){
  var bar = document.getElementById('readProgress');
  if (!bar) return;
  function upd(){
    var h = document.documentElement;
    var max = (h.scrollHeight - h.clientHeight) || 1;
    bar.style.width = (Math.min(100, (h.scrollTop / max) * 100)) + '%';
  }
  window.addEventListener('scroll', upd, { passive: true });
  upd();
})();`;

// ── Шаблон страницы ──────────────────────────────────────────────
function pageLayout({ title, ogDesc, content, depth = 0, active = '', includeProgress = false }) {
  const up = depth === 0 ? '' : '../'.repeat(depth);
  // articlesByNum понадобится для sidebar — передаём через замыкание
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title === SITE_TITLE ? esc(`${title}. ${SITE_SUBTITLE}`) : `${esc(title)} — ${esc(SITE_TITLE)}`}</title>
<meta name="description" content="${esc(ogDesc || SITE_SUBTITLE)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(ogDesc || SITE_SUBTITLE)}">
<meta property="og:type" content="article">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=PT+Serif:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${up}assets/styles.css">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%237a1b1b'/%3E%3Ctext x='50%25' y='66%25' text-anchor='middle' fill='%23f3e8d4' font-family='Georgia' font-size='20' font-weight='700'%3EМ%3C/text%3E%3C/svg%3E">
</head>
<body>
${includeProgress ? '<div class="read-progress" id="readProgress"></div>' : ''}
<div class="layout">

<header class="site-header">
  <div class="site-header__inner">
    <a class="site-header__brand" href="${up}index.html">
      ${esc(SITE_TITLE)}<span class="site-header__brand-sub">— ${esc(SITE_SUBTITLE)}</span>
    </a>
    <nav class="site-header__nav">
      <a href="${up}index.html">Главная</a>
      <a href="${up}index.html#preface">Предисловие</a>
      <a href="${up}about.html">Об авторе</a>
      ${fs.existsSync(path.join(BROCH, META.outputFilename)) ? `<a class="site-header__cta" href="${up}${esc(META.outputFilename)}" download>Скачать .docx</a>` : ''}
    </nav>
  </div>
</header>

${renderSidebar(active, GLOBAL_ARTICLES, depth)}

<main>
${content}
</main>

<footer class="site-footer">
  <div class="site-footer__inner">
    <div class="site-footer__links">
      ${AUTHOR.telegramGroupUrl ? `<a href="${esc(AUTHOR.telegramGroupUrl)}" target="_blank" rel="noopener">Телеграм-канал</a>` : ''}
      ${AUTHOR.telegramBlogUrl ? `<a href="${esc(AUTHOR.telegramBlogUrl)}" target="_blank" rel="noopener">Пятничные посты</a>` : ''}
      ${AUTHOR.dzenChannelUrl ? `<a href="${esc(AUTHOR.dzenChannelUrl)}" target="_blank" rel="noopener">Канал в Дзене</a>` : ''}
      ${AUTHOR.telegramPersonalUrl ? `<a href="${esc(AUTHOR.telegramPersonalUrl)}" target="_blank" rel="noopener">Связаться</a>` : ''}
    </div>
    <div class="site-footer__copy">© ${META.year} ${esc(AUTHOR.displayName || '')}</div>
  </div>
</footer>

</div>
<script>${SIDEBAR_JS}${includeProgress ? PROGRESS_JS : ''}</script>
</body>
</html>`;
}

// Глобальная переменная для sidebar (грязно, но просто)
let GLOBAL_ARTICLES = {};

// ── Контактный блок ──────────────────────────────────────────────
function renderContactsBlock() {
  const rows = [];
  if (AUTHOR.telegramBlogUrl) rows.push({
    label: 'Телеграм-канал',
    href: AUTHOR.telegramBlogUrl,
    value: AUTHOR.telegramBlogHandle || AUTHOR.telegramBlogUrl,
    note: AUTHOR.telegramBlogDescription
  });
  if (AUTHOR.telegramGroupUrl) rows.push({
    label: 'Группа со статьями',
    href: AUTHOR.telegramGroupUrl,
    value: AUTHOR.telegramGroupHandle || AUTHOR.telegramGroupUrl,
    note: AUTHOR.telegramGroupDescription
  });
  if (AUTHOR.telegramPersonalUrl) rows.push({
    label: 'Личный Telegram',
    href: AUTHOR.telegramPersonalUrl,
    value: AUTHOR.telegramPersonalHandle || AUTHOR.telegramPersonalUrl
  });
  if (AUTHOR.dzenChannelUrl) rows.push({
    label: 'Канал на Дзене',
    href: AUTHOR.dzenChannelUrl,
    value: AUTHOR.dzenChannelLabel || AUTHOR.dzenChannelUrl
  });
  if (AUTHOR.phone) rows.push({
    label: AUTHOR.phoneLabel || 'Телефон',
    value: AUTHOR.phone,
    note: AUTHOR.phoneNote
  });
  if (AUTHOR.email) rows.push({
    label: 'Email',
    href: `mailto:${AUTHOR.email}`,
    value: AUTHOR.email
  });

  const items = rows.map(r => {
    const value = r.href
      ? `<a href="${esc(r.href)}" ${r.href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${esc(r.value)}</a>`
      : esc(r.value);
    return `<div class="contacts__row">
      <span class="contacts__label">${esc(r.label)}</span>
      <span class="contacts__value">${value}${r.note ? `<div class="contacts__note">${esc(r.note)}</div>` : ''}</span>
    </div>`;
  }).join('');

  return `<section class="contacts">
    <h3 class="contacts__title">Связь с автором</h3>
    <div class="contacts__list">${items}</div>
  </section>`;
}

// ── Главная ──────────────────────────────────────────────────────
function renderIndex(articlesByNum) {
  // Предисловие — инлайн на главной (без первого H2 «Предисловие»)
  const prefBlocks = readSimpleMd('предисловие.md').filter((b, idx) =>
    !(idx === 0 && (b.type === 'h2' || b.type === 'h3') && /^Предисловие/i.test(b.text))
  );
  const prefaceHtml = blocksToHtml(prefBlocks, { imgPrefix: 'images/' });

  // Содержание
  let chapterCounter = 0;
  const tocHtml = META.parts.map(part => {
    const chapters = part.articles.map(num => {
      chapterCounter++;
      const a = articlesByNum[num];
      const rt = readingTime(a.blocks);
      return `<a class="toc__chapter" href="articles/${String(chapterCounter).padStart(2, '0')}.html">
        <div class="toc__chapter-meta">
          <span>Глава ${chapterCounter}</span>
          <span>~${rt} мин</span>
        </div>
        <div class="toc__chapter-title">${esc(a.title)}</div>
      </a>`;
    }).join('');
    return `<section class="toc__part" id="part-${part.number.toLowerCase()}">
      <header class="toc__part-header">
        <div class="toc__part-num">Часть ${part.number}</div>
        <h3 class="toc__part-title">${esc(part.title)}</h3>
        <p class="toc__part-subtitle">${esc(part.subtitle)}</p>
      </header>
      <div class="toc__chapters">${chapters}</div>
    </section>`;
  }).join('');

  const hasDocx = fs.existsSync(path.join(BROCH, META.outputFilename));

  const content = `
<section class="hero">
  <div class="container">
    <div class="hero__kicker">Девять статей. Одна логика. Свободное чтение.</div>
    <h1 class="hero__title">${esc(SITE_TITLE)}</h1>
    <p class="hero__subtitle">${esc(SITE_SUBTITLE)}</p>
    <p class="hero__intro">
      Сборник из девяти статей о мебельном бизнесе в нынешнем кризисе.
      Не учебник и не методичка — разговор с собственником о том, что делать,
      когда привычные действия перестают давать результат.
    </p>
    <a class="hero__cta" href="#toc">К содержанию →</a>
    <div class="hero__author">${esc(AUTHOR.displayName)} · ${META.year}</div>
  </div>
</section>

<section class="preface-inline" id="preface">
  <div class="container">
    <h2>Предисловие</h2>
    <div class="preface-inline__body">
      ${prefaceHtml}
    </div>
  </div>
</section>

<section class="toc" id="toc">
  <div class="container">
    <h2>Содержание</h2>
    ${tocHtml}
  </div>
</section>

<section class="author">
  <div class="container">
    <div class="author__card">
      <img class="author__photo" src="images/_author.jpg" alt="${esc(AUTHOR.displayName)}">
      <div>
        <h3 class="author__name">${esc(AUTHOR.displayName)}</h3>
        <p class="author__role">${esc(AUTHOR.role || '')}</p>
        <p>Я помогаю собственникам разобраться, что на самом деле происходит в бизнесе, и превратить хаос ежедневных решений в понятную систему цифр, процессов и действий.</p>
        <p style="margin-top:1.5rem"><a href="about.html">Полная информация и контакты →</a></p>
      </div>
    </div>
    ${renderContactsBlock()}
  </div>
</section>

${hasDocx ? `<section class="container" style="text-align:center; padding-bottom:3rem">
  <p style="color:var(--text-muted); font-family:var(--font-ui); font-size:.95rem">
    Удобнее читать офлайн? <a href="${esc(META.outputFilename)}" download>Скачать брошюру в Word (.docx, 20 МБ)</a>
  </p>
</section>` : ''}
`;

  return pageLayout({
    title: SITE_TITLE,
    ogDesc: SITE_SUBTITLE,
    content,
    depth: 0,
    active: 'home',
    includeProgress: false
  });
}

// ── Об авторе ────────────────────────────────────────────────────
function renderAbout() {
  const bioHtml = (AUTHOR.aboutParagraphs || []).map(item => {
    if (typeof item === 'string') return `<p>${inline(item)}</p>`;
    if (item.h) return `<h3>${inline(item.h)}</h3>`;
    if (Array.isArray(item.ul)) return `<ul>${item.ul.map(li => `<li>${inline(li)}</li>`).join('')}</ul>`;
    return '';
  }).join('\n');

  const content = `
<section class="author">
  <div class="container">
    <div class="author__card">
      <img class="author__photo" src="images/_author.jpg" alt="${esc(AUTHOR.displayName)}">
      <div>
        <h1 class="author__name">${esc(AUTHOR.displayName)}</h1>
        <p class="author__role">${esc(AUTHOR.role || '')}</p>
        <div class="author__bio">${bioHtml}</div>
      </div>
    </div>
    ${renderContactsBlock()}
  </div>
</section>
`;
  return pageLayout({ title: 'Об авторе', content, depth: 0, active: 'about', includeProgress: false });
}

// ── Заключение ───────────────────────────────────────────────────
function renderConclusion(articlesByNum) {
  const trBlocks = readSimpleMd('переходы.md');
  const concludeIdx = trBlocks.findIndex(b => (b.type === 'h2' || b.type === 'h3') && /^Заключение/i.test(b.text));
  const blocks = concludeIdx >= 0 ? trBlocks.slice(concludeIdx + 1) : [];
  const bodyHtml = blocksToHtml(blocks, { imgPrefix: 'images/' });

  const lastPart = META.parts[META.parts.length - 1];
  const lastPartLast = lastPart.articles[lastPart.articles.length - 1];
  let totalIdx = 0;
  for (const p of META.parts) for (const n of p.articles) { totalIdx++; if (n === lastPartLast) break; }

  const content = `
<article class="article">
  <div class="container">
    <nav class="article__breadcrumb">
      <a href="index.html">Главная</a> <span>→</span> Заключение
    </nav>
    <header class="article__header">
      <h1 class="article__title">Заключение</h1>
    </header>
    <div class="article__body">
      ${bodyHtml}
    </div>
    <nav class="chapter-nav">
      <a class="chapter-nav__item" href="articles/${String(totalIdx).padStart(2, '0')}.html">
        <div class="chapter-nav__direction">← Глава ${totalIdx}</div>
        <div class="chapter-nav__title">${esc(articlesByNum[lastPartLast].title)}</div>
      </a>
      <a class="chapter-nav__item chapter-nav__item--next" href="about.html">
        <div class="chapter-nav__direction">Дальше →</div>
        <div class="chapter-nav__title">Об авторе</div>
      </a>
    </nav>
  </div>
</article>
`;
  return pageLayout({ title: 'Заключение', content, depth: 0, active: 'conclusion', includeProgress: true });
}

// ── Статья ───────────────────────────────────────────────────────
function renderArticle(chapterIdx, article, part, prevLink, nextLink) {
  const bodyHtml = articleBodyHtml(article.blocks, '../images/');
  const rt = readingTime(article.blocks);

  const content = `
<article class="article">
  <div class="container">
    <nav class="article__breadcrumb">
      <a href="../index.html">Главная</a>
      <span>→</span>
      <a href="../index.html#part-${part.number.toLowerCase()}">Часть ${part.number}. ${esc(part.title)}</a>
      <span>→</span>
      Глава ${chapterIdx}
    </nav>
    <header class="article__header">
      <div class="article__part">Часть ${part.number}. ${esc(part.title)} · Глава ${chapterIdx}</div>
      <h1 class="article__title">${esc(article.title)}</h1>
      <div class="article__meta">
        <span>~${rt} мин чтения</span>
        ${article.url ? `<span>Оригинал: <a href="${esc(article.url)}" target="_blank" rel="noopener">${esc(article.url.replace(/^https?:\/\//, ''))}</a></span>` : ''}
      </div>
    </header>
    <div class="article__body">
      ${bodyHtml}
    </div>

    ${article.url ? `<p class="article__cta">
      Прочитать на Дзене и оставить комментарий: <a href="${esc(article.url)}" target="_blank" rel="noopener">${esc(article.url.replace(/^https?:\/\//, ''))}</a>
    </p>` : ''}

    <nav class="chapter-nav">
      ${prevLink
        ? `<a class="chapter-nav__item" href="${prevLink.href}"><div class="chapter-nav__direction">← ${esc(prevLink.kicker)}</div><div class="chapter-nav__title">${esc(prevLink.title)}</div></a>`
        : `<a class="chapter-nav__item" href="../index.html#preface"><div class="chapter-nav__direction">← Назад</div><div class="chapter-nav__title">К предисловию</div></a>`
      }
      ${nextLink
        ? `<a class="chapter-nav__item chapter-nav__item--next" href="${nextLink.href}"><div class="chapter-nav__direction">${esc(nextLink.kicker)} →</div><div class="chapter-nav__title">${esc(nextLink.title)}</div></a>`
        : `<a class="chapter-nav__item chapter-nav__item--next" href="../conclusion.html"><div class="chapter-nav__direction">Дальше →</div><div class="chapter-nav__title">Заключение</div></a>`
      }
    </nav>
  </div>
</article>
`;

  return pageLayout({
    title: article.title,
    ogDesc: `Часть ${part.number}. ${part.title} · Глава ${chapterIdx}`,
    content,
    depth: 1,
    active: `article:${String(chapterIdx).padStart(2, '0')}`,
    includeProgress: true
  });
}

// ── Сборка ───────────────────────────────────────────────────────
function build() {
  const articlesByNum = {};
  for (let n = 1; n <= 9; n++) {
    const num = String(n).padStart(2, '0');
    articlesByNum[num] = parseArticle(num);
  }
  GLOBAL_ARTICLES = articlesByNum;

  const order = [];
  let counter = 0;
  for (const part of META.parts) {
    for (const num of part.articles) {
      counter++;
      order.push({ chapterIdx: counter, num, part });
    }
  }

  fs.writeFileSync(path.join(BASE, 'index.html'), renderIndex(articlesByNum), 'utf8');
  fs.writeFileSync(path.join(BASE, 'about.html'), renderAbout(), 'utf8');
  fs.writeFileSync(path.join(BASE, 'conclusion.html'), renderConclusion(articlesByNum), 'utf8');

  for (let i = 0; i < order.length; i++) {
    const o = order[i];
    const a = articlesByNum[o.num];
    const fname = `${String(o.chapterIdx).padStart(2, '0')}.html`;
    const prev = i > 0 ? {
      href: `${String(order[i - 1].chapterIdx).padStart(2, '0')}.html`,
      kicker: `Глава ${order[i - 1].chapterIdx}`,
      title: articlesByNum[order[i - 1].num].title
    } : null;
    const next = i < order.length - 1 ? {
      href: `${String(order[i + 1].chapterIdx).padStart(2, '0')}.html`,
      kicker: `Глава ${order[i + 1].chapterIdx}`,
      title: articlesByNum[order[i + 1].num].title
    } : null;
    fs.writeFileSync(
      path.join(ART_OUT, fname),
      renderArticle(o.chapterIdx, a, o.part, prev, next),
      'utf8'
    );
  }

  // Старая preface.html — оставим как редирект на главную #preface
  fs.writeFileSync(path.join(BASE, 'preface.html'), `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0; url=index.html#preface"><title>Предисловие — ${esc(SITE_TITLE)}</title></head>
<body><p>Предисловие теперь на <a href="index.html#preface">главной</a>.</p></body></html>`, 'utf8');

  const docxSrc = path.join(BROCH, META.outputFilename);
  if (fs.existsSync(docxSrc)) {
    fs.copyFileSync(docxSrc, path.join(BASE, META.outputFilename));
  }

  fs.writeFileSync(path.join(BASE, '.nojekyll'), '', 'utf8');
  fs.writeFileSync(path.join(BASE, 'robots.txt'), 'User-agent: *\nAllow: /\n', 'utf8');

  const today = new Date().toISOString().slice(0, 10);
  const baseUrl = 'https://abdublinn.github.io/mebelshchikam-v-krizis/';
  const urls = [
    'index.html', 'about.html', 'conclusion.html',
    ...order.map(o => `articles/${String(o.chapterIdx).padStart(2, '0')}.html`)
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${baseUrl}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(BASE, 'sitemap.xml'), sitemap, 'utf8');

  console.log(`OK pages: index, about, conclusion, ${order.length} articles`);
}

build();
