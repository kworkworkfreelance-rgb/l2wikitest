const body = document.body;
const currentPage = body?.dataset?.page || 'home';
const isRootPage = currentPage === 'home';
const store = window.L2WikiStore || null;

const routes = {
    home: isRootPage ? './index.html' : '../index.html',
    article: isRootPage ? './pages/article.html' : './article.html',
    section: isRootPage ? './pages/section.html' : './section.html',
    search: isRootPage ? './pages/search.html' : './search.html',
};

const FEATURED_ARTICLES = [
    { id: 'class-tree', title: 'ДЕРЕВО КЛАССОВ', text: 'Профессии, ветки развития и быстрый переход к нужному классу.' },
    { id: 'catacombs-necropolis', title: 'КАТАКОМБЫ И НЕКРОПОЛИ', text: 'Локации Seven Signs, входы, маршруты и полезные таблицы.' },
    { id: 'mammon-services', title: 'МАГАЗИН И КУЗНИЦА МАММОНА', text: 'Распечатка, обмен, улучшение и полезные сервисы Маммона.' },
    { id: 'spoiler-guide', title: 'ГАЙД СПОЙЛЕРУ', text: 'Маршруты, добыча ресурсов и полезные связки для фарма.' },
];

const escapeHtml = (value = '') =>
    String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

const stripHtml = (value = '') => String(value).replace(/<[^>]+>/g, ' ');

const getParam = (key) => new URLSearchParams(window.location.search).get(key);
const buildArticleUrl = (id) => `${routes.article}?article=${encodeURIComponent(id)}`;
const buildSectionUrl = (id, group = '') =>
    `${routes.section}?section=${encodeURIComponent(id)}${group ? `&group=${encodeURIComponent(group)}` : ''}`;

const readDatabase = () => store?.getDatabase?.() || window.L2WIKI_SEED_DATA || { site: { name: 'L2Wiki.Su' }, sections: {}, articles: {} };
const readPageData = () => window.L2WIKI_PAGE_DATA || null;
const hasDatabaseContent = (database) => Boolean(Object.keys(database?.sections || {}).length || Object.keys(database?.articles || {}).length);
const isDataPending = (database) => !window.L2WIKI_DATA_LOADED && !hasDatabaseContent(database);
const getSection = (database, id) => database.sections?.[id] || null;
const getArticle = (database, id) => database.articles?.[id] || null;
const sanitizeInternalHref = (href, database = readDatabase()) => {
    if (!href) {
        return '';
    }

    if (/^(#|mailto:|tel:)/i.test(href)) {
        return href;
    }

    let parsedUrl;

    try {
        parsedUrl = new URL(href, window.location.origin);
    } catch {
        return '';
    }

    if (parsedUrl.origin !== window.location.origin) {
        return href;
    }

    const normalizedPath = parsedUrl.pathname.replace(/\/+$/, '');
    const currentPath = window.location.pathname.replace(/\/+$/, '');
    const currentArticleId = getParam('article') || '';
    const currentSectionId = getParam('section') || '';
    const currentGroupId = getParam('group') || '';
    const targetArticleId = parsedUrl.searchParams.get('article') || '';
    const targetSectionId = parsedUrl.searchParams.get('section') || '';
    const targetGroupId = parsedUrl.searchParams.get('group') || '';

    if (targetArticleId) {
        if (!getArticle(database, targetArticleId)) {
            return '';
        }

        if (normalizedPath === currentPath && targetArticleId === currentArticleId && !parsedUrl.hash) {
            return '';
        }
    }

    if (targetSectionId) {
        if (!getSection(database, targetSectionId)) {
            return '';
        }

        if (normalizedPath === currentPath && targetSectionId === currentSectionId && targetGroupId === currentGroupId && !parsedUrl.hash) {
            return '';
        }
    }

    if (
        !targetArticleId &&
        !targetSectionId &&
        normalizedPath === currentPath &&
        parsedUrl.search === window.location.search &&
        !parsedUrl.hash
    ) {
        return '';
    }

    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
};
const findGroup = (section, groupId) => section?.groups?.find((group) => group.id === groupId) || null;

const PAGED_TABLE_PAGE_SIZE = 25;
let pagedTableRuntimeId = 0;
const pagedTableRegistry = new Map();

const resetPagedTableRegistry = () => {
    pagedTableRuntimeId = 0;
    pagedTableRegistry.clear();
};

const buildVirtualGroup = (section, groupId = '') => {
    if (section?.id !== 'quests' || groupId !== 'profession') {
        return null;
    }

    const professionGroups = (section.groups || []).filter(
        (group) => /^profession-\d+$/.test(group.id) || group.id === 'alternative-profession'
    );

    if (!professionGroups.length) {
        return null;
    }

    return {
        id: 'profession',
        label: 'На профессию',
        description: 'Квесты и цепочки для всех смен профессии.',
        entries: professionGroups.flatMap((group) => group.entries || []),
    };
};
const resolveActiveGroup = (section, groupId = '') => buildVirtualGroup(section, groupId) || (groupId ? findGroup(section, groupId) : null);
const resolveRenderableGroups = (section, groupId = '') => {
    const virtualGroup = buildVirtualGroup(section, groupId);
    if (virtualGroup) {
        return [virtualGroup];
    }

    return groupId ? section.groups.filter((group) => group.id === groupId) : section.groups;
};
const getGroupLandingArticle = (database, section, group) => {
    if (!group) {
        return null;
    }

    const explicitArticle = group.landingArticleId ? getArticle(database, group.landingArticleId) : null;

    if (explicitArticle) {
        return explicitArticle;
    }

    const leadArticleId = (group.entries || []).find((articleId) => {
        const article = getArticle(database, articleId);
        return article && (!section || article.section === section.id);
    });

    return leadArticleId ? getArticle(database, leadArticleId) : null;
};

const buildGroupNavigationUrl = (database, section, group) => {
    const landingArticle = getGroupLandingArticle(database, section, group);
    const shouldOpenLandingArticle =
        Boolean(group?.landingArticleId && landingArticle) ||
        (section?.id === 'quests' && (/^profession-\d+$/.test(group?.id || '') || group?.id === 'alternative-profession') && landingArticle);

    if (shouldOpenLandingArticle) {
        return buildArticleUrl(landingArticle.id);
    }

    return buildSectionUrl(section.id, group.id);
};

const getProfessionRoman = (sectionId, groupId) => {
    if (sectionId !== 'quests') {
        return '';
    }

    const map = {
        'profession-1': 'I',
        'profession-2': 'II',
        'profession-3': 'III',
        'profession-4': 'IV',
    };

    return map[groupId] || '';
};

const getProfessionRomanTone = (sectionId, groupId) => {
    if (sectionId !== 'quests') {
        return '';
    }

    const map = {
        'profession-1': 'i',
        'profession-2': 'ii',
        'profession-3': 'iii',
        'profession-4': 'iv',
    };

    return map[groupId] || '';
};

const renderSidebarGroupLabel = (section, group) => {
    const skillsLabelOverrides = {
        'class-tree': 'Классы и дерево',
        'clan-skills': 'Поддерживающие умения',
        'enchanting-skills': 'Усиление',
    };
    const displayLabel = section.id === 'skills' && skillsLabelOverrides[group.id] ? skillsLabelOverrides[group.id] : group.label;
    const roman = getProfessionRoman(section.id, group.id);
    const romanTone = getProfessionRomanTone(section.id, group.id);

    if (!roman) {
        return escapeHtml(displayLabel);
    }

    const romanClass = `sidebar__submenu-roman${romanTone ? ` sidebar__submenu-roman--${romanTone}` : ''}`;

    return `
        <span class="sidebar__submenu-label">
            <span class="${romanClass}">${roman}</span>
            <span class="sidebar__submenu-text">${escapeHtml(displayLabel)}</span>
        </span>
    `;
};

const getSidebarGroups = (section) => {
    const groups = Array.isArray(section?.groups) ? [...section.groups] : [];

    if (section?.id !== 'skills') {
        return groups.sort(sortByOrder);
    }

    const preferred = ['class-tree', 'clan-skills', 'enchanting-skills'];
    const byId = new Map(groups.map((group) => [group.id, group]));
    const curated = preferred.map((id) => byId.get(id)).filter(Boolean);

    return curated.length ? curated : groups.sort(sortByOrder);
};

const sortByOrder = (left, right) => {
    const leftOrder = Number.isFinite(Number(left?.order)) ? Number(left.order) : 9999;
    const rightOrder = Number.isFinite(Number(right?.order)) ? Number(right.order) : 9999;

    if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
    }

    return String(left?.title || left?.label || '').localeCompare(String(right?.title || right?.label || ''), 'ru');
};

const renderBreadcrumbs = (items) => `
    <nav class="breadcrumbs" aria-label="Хлебные крошки">
        <ol class="breadcrumbs__list">
            ${items
                .map(
                    (item) => `
                        <li class="breadcrumbs__item">
                            ${item.href ? `<a href="${item.href}">${escapeHtml(item.label)}</a>` : `<span>${escapeHtml(item.label)}</span>`}
                        </li>
                    `
                )
                .join('')}
        </ol>
    </nav>
`;

const getFooterTrail = (database) => {
    const home = { label: 'Главная', href: routes.home };
    const sectionId = getParam('section') || '';
    const groupId = getParam('group') || '';
    const articleId = getParam('article') || '';
    const query = (getParam('query') || '').trim();

    if (articleId) {
        const article = getArticle(database, articleId);
        const section = article ? getSection(database, article.section) : null;
        const group = article && section ? findGroup(section, article.group) : null;

        return [
            home,
            section ? { label: section.title, href: buildSectionUrl(section.id, article.group) } : null,
            group ? { label: group.label, href: buildSectionUrl(section.id, group.id) } : null,
            article ? { label: article.title } : { label: 'Материал' },
        ].filter(Boolean);
    }

    if (sectionId) {
        const section = getSection(database, sectionId);
        const group = section && groupId ? findGroup(section, groupId) : null;

        return [
            home,
            section ? { label: section.title, href: buildSectionUrl(section.id) } : { label: 'Раздел' },
            group ? { label: group.label } : null,
        ].filter(Boolean);
    }

    if (query) {
        return [home, { label: 'Поиск' }, { label: query }];
    }

    return [home];
};

const renderFooter = (database) => {
    const footer = document.querySelector('.footer__inner');

    if (!footer) {
        return;
    }

    const sections = Object.values(database.sections || {}).sort(sortByOrder);
    const totalArticles = Object.values(database.articles || {}).length;
    const trail = getFooterTrail(database);
    const featuredSections = sections.slice(0, 6);
    const spotlightArticles = ['class-tree', 'mammon-services', 'catacombs-necropolis', 'spoiler-guide']
        .map((id) => getArticle(database, id))
        .filter(Boolean);
    const lastUpdated = database.updatedAt
        ? new Intl.DateTimeFormat('ru-RU', {
              dateStyle: 'medium',
              timeStyle: 'short',
          }).format(new Date(database.updatedAt))
        : '';

    if (!sections.length && !totalArticles) {
        return;
    }

    footer.innerHTML = `
        <div class="footer-shell">
            <div class="footer-topline">
                <div class="footer-topline__label">Вы здесь:</div>
                <ol class="footer-topline__trail">
                    ${trail
                        .map(
                            (item) => `
                                <li class="footer-topline__item">
                                    ${
                                        item.href
                                            ? `<a href="${item.href}">${escapeHtml(item.label)}</a>`
                                            : `<span>${escapeHtml(item.label)}</span>`
                                    }
                                </li>
                            `
                        )
                        .join('')}
                </ol>
            </div>

            <div class="footer-bottomline">
                <p class="footer-bottomline__copy">
                    ${escapeHtml(database.site?.name || 'L2Wiki.Su')} — статическая и серверная база знаний, изменения из админ-панели
                    публикуются для всех пользователей и не пропадают после повторного деплоя.
                </p>
                <div class="footer-bottomline__actions">
                    <a href="${routes.home}">Главная</a>
                    <a href="${routes.search}">Поиск</a>
                </div>
            </div>
        </div>
    `;
};

const renderAdSlotInner = (slot = {}, fallbackLabel = '') => {
    const label = slot.label || fallbackLabel || 'Рекламный блок';

    if (slot.enabled === false) {
        return '';
    }

    if (slot.html) {
        return slot.html;
    }

    if (slot.imageSrc) {
        const image = `<img class="ad-block__media" src="${slot.imageSrc}" alt="${escapeHtml(slot.imageAlt || label)}" loading="lazy" />`;
        const media = slot.href
            ? `<a class="ad-block__link" href="${slot.href}" target="_blank" rel="nofollow noopener noreferrer">${image}</a>`
            : image;

        return `
            <div class="ad-block__content">
                ${media}
                ${slot.text ? `<p class="ad-block__text">${escapeHtml(slot.text)}</p>` : ''}
            </div>
        `;
    }

    return `
        <span class="ad-block__label">${escapeHtml(label)}</span>
        ${slot.text ? `<p class="ad-block__text">${escapeHtml(slot.text)}</p>` : ''}
    `;
};

const activateAdScripts = (container) => {
    if (!container) {
        return;
    }

    container.querySelectorAll('script').forEach((oldScript) => {
        const nextScript = document.createElement('script');

        Array.from(oldScript.attributes).forEach((attribute) => {
            nextScript.setAttribute(attribute.name, attribute.value);
        });

        nextScript.textContent = oldScript.textContent || '';
        oldScript.replaceWith(nextScript);
    });
};

const hydrateAdSlots = (database) => {
    document.querySelectorAll('[data-ad-slot]').forEach((block) => {
        const slotId = block.dataset.adSlot || '';
        const slot = database.site?.ads?.[slotId] || {};
        const fallbackLabel = block.dataset.defaultLabel || block.querySelector('.ad-block__label')?.textContent || 'Рекламный блок';

        if (slot.enabled === false) {
            block.hidden = true;
            return;
        }

        block.hidden = false;
        block.innerHTML = renderAdSlotInner(slot, fallbackLabel);
        block.classList.toggle('has-content', Boolean(slot.html || slot.imageSrc || slot.href));

        if (slot.html) {
            activateAdScripts(block);
        }
    });
};

const renderFactList = (items = [], className = 'wiki-meta') =>
    items.length
        ? `
            <ul class="${className}">
                ${items
                    .map(
                        (item) => `
                            <li class="${className}__item">
                                <span class="${className}__label">${escapeHtml(item.label)}</span>
                                <strong class="${className}__value">${escapeHtml(item.value)}</strong>
                            </li>
                        `
                    )
                    .join('')}
            </ul>
        `
        : '';

const renderKnowledgeCardMedia = (imageSrc, altText) => {
    if (!imageSrc) {
        return '';
    }

    return `
        <div class="knowledge-card__media">
            <img class="knowledge-card__image" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(altText || 'Lineage II')}" loading="lazy" />
        </div>
    `;
};

const renderArticlePreview = (database, articleId) => {
    const article = getArticle(database, articleId);

    if (!article) {
        return '';
    }

    return `
        <article class="knowledge-card">
            ${renderKnowledgeCardMedia(article.heroImage, article.title)}
            <div class="knowledge-card__head">
                <span class="knowledge-card__eyebrow">${escapeHtml(article.eyebrow || 'Материал')}</span>
                <h3 class="knowledge-card__title">
                    <a href="${buildArticleUrl(article.id)}">${escapeHtml(article.title)}</a>
                </h3>
            </div>
            <p class="knowledge-card__text">${escapeHtml(article.summary || 'Открыть материал')}</p>
            <a class="knowledge-card__link" href="${buildArticleUrl(article.id)}">Открыть материал</a>
        </article>
    `;
};

const renderRelatedArticles = (database, related = []) => {
    const cards = related.map((articleId) => renderArticlePreview(database, articleId)).join('');

    if (!cards) {
        return '';
    }

    return `
        <section class="wiki-panel">
            <div class="wiki-panel__head">
                <h2 class="wiki-panel__title">Похожие материалы</h2>
            </div>
            <div class="knowledge-grid">
                ${cards}
            </div>
        </section>
    `;
};

const renderTableCell = (cell = {}, database = readDatabase()) => {
    const iconHtml = cell.icon ? `<img class="weapon-type-icon" src="${escapeHtml(cell.icon)}" alt="" loading="lazy" />` : '';
    const value = cell.html ? cell.html : escapeHtml(cell.value || '');
    const href = sanitizeInternalHref(cell.href, database);
    const content = `${iconHtml}${value}`;
    return href ? `<a href="${href}">${content}</a>` : content;
};

const isSkillTableData = (table = {}) => {
    const labels = (table.columns || []).map((column) => String(column.label || '').trim());
    return (
        labels.length >= 8 &&
        labels[1] === 'Название' &&
        labels[2] === 'Описание' &&
        labels[3] === 'Тип' &&
        labels.includes('MP') &&
        labels.includes('SP')
    );
};

const renderRichTableRows = (rows = [], columns = [], database = readDatabase()) =>
    rows
        .map(
            (row) => `
                <tr>
                    ${(row.cells || [])
                        .map((cell, index) => {
                            const column = columns[index] || {};
                            return `<td${column.align ? ` class="is-${escapeHtml(column.align)}"` : ''}>${renderTableCell(cell, database)}</td>`;
                        })
                        .join('')}
                </tr>
            `
        )
        .join('');

const getPagedTablePages = (totalPages, currentPage) => {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);

    if (currentPage <= 3) {
        pages.add(2);
        pages.add(3);
        pages.add(4);
    }

    if (currentPage >= totalPages - 2) {
        pages.add(totalPages - 1);
        pages.add(totalPages - 2);
        pages.add(totalPages - 3);
    }

    return Array.from(pages)
        .filter((page) => page >= 1 && page <= totalPages)
        .sort((left, right) => left - right);
};

const renderPagedTablePager = (tableId, totalRows, totalPages, currentPage) => {
    const pages = getPagedTablePages(totalPages, currentPage);
    let lastPage = 0;

    return `
        <div class="wiki-rich-table__pager" data-paged-table-pager>
            <div class="wiki-rich-table__pager-summary">
                <strong>${totalRows}</strong> записей
                <span>Страница ${currentPage} из ${totalPages}</span>
            </div>
            <div class="wiki-rich-table__pager-actions">
                <button class="wiki-rich-table__pager-button" type="button" data-table-nav="prev" ${currentPage <= 1 ? 'disabled' : ''}>
                    Назад
                </button>
                <div class="wiki-rich-table__pager-pages" role="navigation" aria-label="Страницы таблицы">
                    ${pages
                        .map((page) => {
                            const gap = page - lastPage > 1 ? '<span class="wiki-rich-table__pager-gap">…</span>' : '';
                            lastPage = page;
                            return `${gap}
                                <button
                                    class="wiki-rich-table__pager-page ${page === currentPage ? 'is-active' : ''}"
                                    type="button"
                                    data-table-page="${page}"
                                    aria-current="${page === currentPage ? 'page' : 'false'}"
                                >
                                    ${page}
                                </button>
                            `;
                        })
                        .join('')}
                </div>
                <button class="wiki-rich-table__pager-button" type="button" data-table-nav="next" ${currentPage >= totalPages ? 'disabled' : ''}>
                    Далее
                </button>
            </div>
        </div>
    `;
};

const renderRichTable = (table, className = 'wiki-rich-table') => {
    const columns = table.columns || [];
    const rows = table.rows || [];
    const database = readDatabase();

    if (!columns.length || !rows.length) {
        return '';
    }

    const tableClassName = [className, table.compact ? `${className}--compact` : '', isSkillTableData(table) ? `${className}--skills` : '']
        .filter(Boolean)
        .join(' ');
    const pageSize = Number.isFinite(Number(table.pageSize)) ? Math.max(5, Number(table.pageSize)) : PAGED_TABLE_PAGE_SIZE;
    const shouldPaginate = rows.length > pageSize;
    const totalPages = shouldPaginate ? Math.ceil(rows.length / pageSize) : 1;
    const tableId = shouldPaginate ? `${table.id || 'table'}-${++pagedTableRuntimeId}` : '';
    const visibleRows = shouldPaginate ? rows.slice(0, pageSize) : rows;

    if (shouldPaginate) {
        pagedTableRegistry.set(tableId, {
            columns,
            rows,
            pageSize,
        });
    }

    return `
        <div
            class="${tableClassName}${shouldPaginate ? ' is-paginated' : ''}"
            ${shouldPaginate ? `data-paged-table="${escapeHtml(tableId)}" data-current-page="1" data-total-pages="${totalPages}"` : ''}
        >
            <table>
                <thead>
                    <tr>
                        ${columns
                            .map(
                                (column) => `
                                    <th${column.width ? ` style="width:${escapeHtml(column.width)}"` : ''}${
                                        column.align ? ` class="is-${escapeHtml(column.align)}"` : ''
                                    }>${escapeHtml(column.label)}</th>
                                `
                            )
                            .join('')}
                    </tr>
                </thead>
                <tbody>${renderRichTableRows(visibleRows, columns, database)}</tbody>
            </table>
            ${shouldPaginate ? renderPagedTablePager(tableId, rows.length, totalPages, 1) : ''}
        </div>
    `;
};

const updatePagedTable = (tableRoot, nextPage) => {
    if (!tableRoot) {
        return;
    }

    const tableId = tableRoot.dataset.pagedTable || '';
    const state = pagedTableRegistry.get(tableId);

    if (!state) {
        return;
    }

    const totalPages = Math.max(1, Math.ceil(state.rows.length / state.pageSize));
    const safePage = Math.min(Math.max(1, Number(nextPage) || 1), totalPages);
    const offset = (safePage - 1) * state.pageSize;
    const tbody = tableRoot.querySelector('tbody');
    const pager = tableRoot.querySelector('[data-paged-table-pager]');

    tableRoot.dataset.currentPage = String(safePage);

    if (tbody) {
        tbody.innerHTML = renderRichTableRows(state.rows.slice(offset, offset + state.pageSize), state.columns, readDatabase());
    }

    if (pager) {
        pager.outerHTML = renderPagedTablePager(tableId, state.rows.length, totalPages, safePage);
        bindPaginatedTables(tableRoot.parentElement || tableRoot);
    }
};

const bindPaginatedTables = (root = document) => {
    root.querySelectorAll('[data-paged-table]').forEach((tableRoot) => {
        if (tableRoot.dataset.pagerBound === 'true') {
            return;
        }

        tableRoot.dataset.pagerBound = 'true';

        tableRoot.addEventListener('click', (event) => {
            const pageButton = event.target.closest('[data-table-page]');
            const navButton = event.target.closest('[data-table-nav]');

            if (pageButton) {
                event.preventDefault();
                updatePagedTable(tableRoot, Number(pageButton.dataset.tablePage || 1));
                return;
            }

            if (!navButton) {
                return;
            }

            event.preventDefault();
            const currentPage = Number(tableRoot.dataset.currentPage || 1);
            const delta = navButton.dataset.tableNav === 'next' ? 1 : -1;
            updatePagedTable(tableRoot, currentPage + delta);
        });
    });
};

const getClassTreeBadge = (label = '') => {
    const words = String(label)
        .split(/\s+/)
        .map((word) => word.replace(/[^A-Za-zА-Яа-яЁё]/g, ''))
        .filter(Boolean);

    if (!words.length) {
        return 'L2';
    }

    const badge = words
        .slice(0, 2)
        .map((word) => word.charAt(0))
        .join('')
        .toUpperCase();

    return badge || words[0].slice(0, 2).toUpperCase();
};

const renderClassTreeNode = (node = {}) => {
    const content = `
        <span class="class-tree-node__icon-shell">
            ${
                node.iconSrc
                    ? `<img class="class-tree-node__icon" src="${node.iconSrc}" alt="${escapeHtml(node.iconAlt || node.label || 'Lineage II')}" loading="lazy" />`
                    : `<span class="class-tree-node__badge">${escapeHtml(getClassTreeBadge(node.label))}</span>`
            }
        </span>
        <span class="class-tree-node__label">${escapeHtml(node.label || '')}</span>
        ${node.note ? `<span class="class-tree-node__note">${escapeHtml(node.note)}</span>` : ''}
    `;

    const tag = node.href ? 'a' : 'div';
    const href = node.href ? ` href="${node.href}"` : '';
    const extraClass = node.href ? ' class-tree-node--link' : '';

    return `
        <${tag}
            class="class-tree-node${extraClass}"
            style="grid-column:${node.column};grid-row:${node.row};"
            ${href}
            ${node.href ? `title="${escapeHtml(node.label || '')}"` : ''}
        >
            ${content}
        </${tag}>
    `;
};

const buildClassTreePath = (fromNode, toNode, columns, rows) => {
    if (!fromNode || !toNode) {
        return '';
    }

    const width = columns * 160;
    const height = rows * 150;
    const x1 = (fromNode.column - 0.5) * 160;
    const y1 = (fromNode.row - 0.5) * 150;
    const x2 = (toNode.column - 0.5) * 160;
    const y2 = (toNode.row - 0.5) * 150;
    const startY = Math.min(height, y1 + 42);
    const endY = Math.max(0, y2 - 48);
    const midY = startY + (endY - startY) / 2;

    return {
        width,
        height,
        d: `M ${x1} ${startY} V ${midY} H ${x2} V ${endY}`,
    };
};

const renderClassTreeGroup = (group, nodes = [], links = []) => {
    if (!group || !nodes.length) {
        return '';
    }

    const columns = Math.max(group.columns || 1, ...nodes.map((node) => Number(node.column) || 1));
    const rows = Math.max(group.rows || 1, ...nodes.map((node) => Number(node.row) || 1));
    const nodeMap = Object.fromEntries(nodes.map((node) => [node.id, node]));
    const width = columns * 160;
    const height = rows * 150;

    const linksMarkup = links
        .map((link) => {
            const path = buildClassTreePath(nodeMap[link.from], nodeMap[link.to], columns, rows);

            if (!path) {
                return '';
            }

            return `<path d="${path.d}" marker-end="url(#class-tree-arrow-${escapeHtml(group.id)})" />`;
        })
        .join('');

    return `
        <section class="class-tree-group">
            <div class="class-tree-group__head">
                <h3 class="class-tree-group__title">${escapeHtml(group.title)}</h3>
                ${group.description ? `<p class="class-tree-group__description">${escapeHtml(group.description)}</p>` : ''}
            </div>
            <div class="class-tree-group__canvas" style="--class-tree-columns:${columns};--class-tree-rows:${rows};">
                <svg class="class-tree-group__links" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
                    <defs>
                        <marker id="class-tree-arrow-${escapeHtml(group.id)}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                            <path d="M 0 0 L 8 4 L 0 8 z" />
                        </marker>
                    </defs>
                    ${linksMarkup}
                </svg>
                <div class="class-tree-group__grid">
                    ${nodes.map(renderClassTreeNode).join('')}
                </div>
            </div>
        </section>
    `;
};

const renderClassTreeBlock = (block) => {
    const tabs = block.tabs || [];
    const groups = block.groups || [];
    const nodes = block.nodes || [];
    const links = block.links || [];
    const activeTabId = tabs[0]?.id || groups[0]?.tabId || nodes[0]?.raceTab || '';

    if (!tabs.length || !groups.length || !nodes.length) {
        return '';
    }

    return `
        <section class="wiki-panel rich-block rich-block--class-tree"${block.id ? ` id="${escapeHtml(block.id)}"` : ''}>
            ${block.title ? `<h2 class="rich-block__title">${escapeHtml(block.title)}</h2>` : ''}
            <div class="class-tree" data-class-tree data-active-tab="${escapeHtml(activeTabId)}">
                <div class="class-tree__tabs" role="tablist" aria-label="Расы">
                    ${tabs
                        .map(
                            (tab) => `
                                <button
                                    class="class-tree__tab${tab.id === activeTabId ? ' is-active' : ''}"
                                    type="button"
                                    role="tab"
                                    aria-selected="${tab.id === activeTabId ? 'true' : 'false'}"
                                    data-class-tree-tab="${escapeHtml(tab.id)}"
                                >
                                    ${escapeHtml(tab.label)}
                                </button>
                            `
                        )
                        .join('')}
                </div>
                ${tabs
                    .map((tab) => {
                        const tabGroups = groups.filter((group) => group.tabId === tab.id);

                        return `
                            <div
                                class="class-tree__pane${tab.id === activeTabId ? ' is-active' : ''}"
                                data-class-tree-pane="${escapeHtml(tab.id)}"
                                role="tabpanel"
                                ${tab.id === activeTabId ? '' : 'hidden'}
                            >
                                ${tabGroups
                                    .map((group) =>
                                        renderClassTreeGroup(
                                            group,
                                            nodes.filter((node) => node.groupId === group.id && node.raceTab === tab.id),
                                            links.filter((link) => link.groupId === group.id && link.raceTab === tab.id)
                                        )
                                    )
                                    .join('')}
                            </div>
                        `;
                    })
                    .join('')}
            </div>
        </section>
    `;
};

const renderImageMapBlock = (block) => {
    if (!block.imageSrc) {
        return '';
    }

    return `
        <section class="wiki-panel rich-block rich-block--image-map"${block.id ? ` id="${escapeHtml(block.id)}"` : ''}>
            ${block.title ? `<h2 class="rich-block__title">${escapeHtml(block.title)}</h2>` : ''}
            <div class="npc-map-container">
                <div class="npc-map-stage">
                    <img class="npc-map-image" src="${block.imageSrc}" alt="${escapeHtml(block.imageAlt || block.title || 'Lineage II map')}" loading="lazy" decoding="async" />
                    <div class="npc-map-overlay">
                        ${(block.markers || [])
                            .map((marker) => {
                                const tag = marker.href ? 'a' : 'button';
                                const href = marker.href ? ` href="${marker.href}"` : ' type="button"';
                                const note = marker.note ? ` <span class="npc-map-tooltip__note">${escapeHtml(marker.note)}</span>` : '';
                                const ariaLabel = escapeHtml(marker.note ? `${marker.label}. ${marker.note}` : marker.label);

                                return `
                                    <${tag}
                                    class="npc-map-marker npc-map-marker--${escapeHtml(marker.kind || 'location')}"
                                    style="left:${marker.x}%;top:${marker.y}%;"
                                    ${href}
                                    aria-label="${ariaLabel}"
                                >
                                        <span class="npc-map-tooltip">
                                            <strong>${escapeHtml(marker.label)}</strong>${note}
                                        </span>
                                    </${tag}>
                                `;
                            })
                            .join('')}
                    </div>
                </div>
                ${
                    block.legend?.length
                        ? `
                            <div class="npc-map-legend">
                                ${block.legend
                                    .map(
                                        (item) => `
                                            <div class="npc-map-legend-item">
                                                <span class="npc-map-legend-marker npc-map-legend-marker--${escapeHtml(item.kind || 'location')}"></span>
                                                <span class="npc-map-legend-text">${escapeHtml(item.label)}</span>
                                            </div>
                                        `
                                    )
                                    .join('')}
                            </div>
                        `
                        : ''
                }
            </div>
        </section>
    `;
};

const isQuestStyledArticle = (article) => {
    if (!article || article.section !== 'quests' || article.layout === 'catalog') {
        return false;
    }

    return (article.blocks || []).length > 0 || (article.steps || []).length > 0;
};

const renderQuestCompatContent = (article) => {
    const blocks = article.blocks || [];

    if (!blocks.length) {
        return '';
    }

    const compatHtml = blocks
        .map((block, index) => {
            if (!block) {
                return '';
            }

            if (block.type === 'prose') {
                return `
                    ${block.title ? `<h2 class="quest-subtitle">${escapeHtml(block.title)}</h2>` : ''}
                    ${(block.paragraphs || []).map((paragraph) => `<p class="quest-paragraph">${escapeHtml(paragraph)}</p>`).join('')}
                `;
            }

            if (block.type === 'steps') {
                return `
                    <h2 class="${index === 0 ? 'quest-section-title' : 'quest-subtitle'}">${escapeHtml(block.title || 'Прохождение квеста')}</h2>
                    <ol class="quest-steps">
                        ${(block.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                    </ol>
                `;
            }

            if (block.type === 'list') {
                const listClass = block.style === 'check' ? 'quest-bullets quest-bullets--check' : 'quest-bullets';
                return `
                    ${block.title ? `<h2 class="quest-subtitle">${escapeHtml(block.title)}</h2>` : ''}
                    <ul class="${listClass}">
                        ${(block.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                    </ul>
                `;
            }

            if (block.type === 'callout') {
                return `
                    ${block.title ? `<h2 class="quest-subtitle">${escapeHtml(block.title)}</h2>` : ''}
                    <blockquote class="quest-note">
                        ${block.text ? `<p class="quest-paragraph">${escapeHtml(block.text)}</p>` : ''}
                        ${
                            block.items?.length
                                ? `<ul class="quest-bullets">${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
                                : ''
                        }
                    </blockquote>
                `;
            }

            if (block.type === 'table') {
                return `
                    ${block.title ? `<h2 class="quest-subtitle">${escapeHtml(block.title)}</h2>` : ''}
                    ${renderRichTable(block, 'quest-inline-table')}
                `;
            }

            return renderBlock(block);
        })
        .filter(Boolean)
        .join('');

    if (!compatHtml) {
        return '';
    }

    return `
        <section class="wiki-panel rich-block rich-block--html">
            <div class="wiki-html">
                <div class="quest-archive quest-archive--compat">
                    ${compatHtml}
                </div>
            </div>
        </section>
    `;
};

const findQuestGuideBlock = (article) => (article?.blocks || []).find((block) => block?.type === 'questGuide') || null;

const renderQuestGuideEntryMarkup = (entry, fallbackText = '') => {
    if (!entry) {
        return fallbackText ? `<p class="quest-guide__entry-text">${escapeHtml(fallbackText)}</p>` : '';
    }

    if (entry.html) {
        return `<div class="quest-guide__entry-text">${entry.html}</div>`;
    }

    return entry.text
        ? `<p class="quest-guide__entry-text">${escapeHtml(entry.text)}</p>`
        : fallbackText
          ? `<p class="quest-guide__entry-text">${escapeHtml(fallbackText)}</p>`
          : '';
};

const renderQuestGuideEntryMeta = (entry) => {
    void entry;
    return '';
};

const renderQuestGuideEntries = (entries = [], options = {}) => {
    if (!entries.length) {
        return '';
    }

    const tag = options.ordered ? 'ol' : 'ul';
    const listClass = options.className || 'quest-guide__list';
    const itemClass = options.itemClass || 'quest-guide__entry';

    const renderEntry = (entry, index) => {
        const hasInlineHtmlIcon = /<img\b/i.test(entry?.html || '');
        const iconHtml =
            !hasInlineHtmlIcon && entry?.iconSrc
                ? `<img class="quest-inline-icon" src="${entry.iconSrc}" alt="${escapeHtml(entry.iconAlt || entry.text || 'Lineage II')}" loading="lazy" />`
                : '';
        const substepsHtml = entry?.substeps?.length
            ? renderQuestGuideEntries(entry.substeps, {
                  ordered: true,
                  className: 'quest-guide__substeps',
                  itemClass: 'quest-guide__substep',
              })
            : '';

        return `
            <li class="${itemClass}">
                <div class="quest-guide__entry-shell">
                    ${iconHtml ? `<div class="quest-guide__icon-wrap">${iconHtml}</div>` : ''}
                    <div class="quest-guide__content">
                        ${renderQuestGuideEntryMarkup(entry, options.fallbackPrefix ? `${options.fallbackPrefix} ${index + 1}` : '')}
                        ${renderQuestGuideEntryMeta(entry)}
                        ${substepsHtml}
                    </div>
                </div>
            </li>
        `;
    };

    return `
        <${tag} class="${listClass}">
            ${entries.map(renderEntry).join('')}
        </${tag}>
    `;
};

const renderQuestGuideBlock = (block) => {
    if (!block) {
        return '';
    }

    const heroMedia = block.heroMedia || [];
    const heroHtml = heroMedia.length
        ? `
            <section class="quest-guide__hero${heroMedia.length === 1 ? ' quest-guide__hero--single' : ''}">
                ${heroMedia
                    .map(
                        (item) => `
                            <figure class="quest-guide__hero-card">
                                <img src="${item.src}" alt="${escapeHtml(item.alt || item.caption || 'Lineage II')}" loading="lazy" />
                                ${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ''}
                            </figure>
                        `
                    )
                    .join('')}
            </section>
        `
        : '';

    const overviewHtml = (block.overviewParagraphs || []).length
        ? `
            <section class="quest-guide__lead">
                <div class="quest-guide__prose">
                    ${(block.overviewParagraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
                </div>
            </section>
        `
        : '';

    const prepHtml = (block.prepItems || []).length
        ? `
            <section class="quest-guide__lead quest-guide__lead--prep">
                ${renderQuestGuideEntries(block.prepItems, {
                    className: 'quest-guide__lead-list',
                    itemClass: 'quest-guide__lead-item',
                })}
            </section>
        `
        : '';

    const stepsHtml = (block.steps || []).length
        ? `
            <section class="quest-guide__section">
                <h2 class="quest-guide__section-title">Прохождение квеста</h2>
                ${renderQuestGuideEntries(block.steps, {
                    ordered: true,
                    className: 'quest-guide__steps',
                    itemClass: 'quest-guide__step',
                })}
            </section>
        `
        : '';

    const rewardsHtml = (block.rewards || []).length
        ? `
            <section class="quest-guide__section">
                ${renderQuestGuideEntries(block.rewards, {
                    className: 'quest-guide__rewards',
                    itemClass: 'quest-guide__reward',
                })}
            </section>
        `
        : '';

    return `
        <section class="wiki-panel rich-block rich-block--quest-guide"${block.id ? ` id="${escapeHtml(block.id)}"` : ''}>
            <div class="quest-guide">
                ${heroHtml}
                ${overviewHtml}
                ${prepHtml}
                ${stepsHtml}
                ${rewardsHtml}
            </div>
        </section>
    `;
};

const renderFilteredCatalogTable = (section, activeGroup = null, database = null) => {
    const isGroupView = Boolean(activeGroup && database);
    const columns = isGroupView
        ? [
              { key: 'title', label: 'Материал', width: '30%' },
              { key: 'details', label: 'Краткие данные', width: '24%' },
              { key: 'summary', label: 'Описание' },
          ]
        : section.catalogColumns || [];
    let rows = isGroupView ? buildSectionGroupCatalogRows(database, section, activeGroup) : section.catalogRows || [];

    // Add weapon type icons to weapons catalog - using local files from /guns/
    const weaponTypeIcons = {
        Мечи: '/guns/мечи.jpg',
        'Двуручные мечи': '/guns/двуручныемечи.jpg',
        Луки: '/guns/луки.jpg',
        Кинжалы: '/guns/кинжалы.jpg',
        Дуалы: '/guns/дуалы.jpg',
        Дубинки: '/guns/дубинки.jpg',
        'Двуручные дубинки': '/guns/двуручныедубинки.jpg',
        Кастеты: '/guns/кастеты.jpg',
        Алебарды: '/guns/Алебарды.jpg',
        Рапиры: '/guns/двуручные.jpg',
        Арбалеты: '/guns/луки.jpg',
        'Магические книги': '/guns/Магические.jpg',
        'Древние мечи': '/guns/двуручныемечи.jpg',
        'Парные кинжалы': '/guns/кинжалы.jpg',
        'Парные дубины': '/guns/дубинки.jpg',
    };

    // Enhance rows with weapon icons for weapons section
    if (section.id === 'weapons' && !isGroupView) {
        rows = rows.map((row) => {
            if (row.cells && row.cells[0]) {
                const title = row.cells[0].value || '';
                for (const [weaponType, iconUrl] of Object.entries(weaponTypeIcons)) {
                    if (title.includes(weaponType)) {
                        row.cells[0].icon = iconUrl;
                        break;
                    }
                }
            }
            return row;
        });
    }

    return columns.length && rows.length
        ? `
            <section class="wiki-panel wiki-panel--catalog">
                <div class="wiki-panel__head">
                    <div>
                        <span class="wiki-panel__eyebrow">${escapeHtml(section.title)}</span>
                        <h2 class="wiki-panel__title">${escapeHtml(isGroupView ? `Каталог группы: ${activeGroup.label}` : 'Каталог раздела')}</h2>
                    </div>
                </div>
                ${renderRichTable({ columns, rows, compact: true }, 'wiki-catalog-table')}
            </section>
        `
        : '';
};

const renderCatalogTable = (section) =>
    section.catalogColumns?.length && section.catalogRows?.length
        ? `
            <section class="wiki-panel wiki-panel--catalog">
                <div class="wiki-panel__head">
                    <div>
                        <span class="wiki-panel__eyebrow">${escapeHtml(section.title)}</span>
                        <h2 class="wiki-panel__title">Каталог раздела</h2>
                    </div>
                </div>
                ${renderRichTable({ columns: section.catalogColumns, rows: section.catalogRows, compact: true }, 'wiki-catalog-table')}
            </section>
        `
        : '';

const renderSectionOverviewCards = (database, section) => {
    const cards = (section.groups || [])
        .map((group) => {
            const landingArticle = getGroupLandingArticle(database, section, group);
            const href = buildGroupNavigationUrl(database, section, group);
            const summary = landingArticle?.summary || group.description || section.description || '';
            const iconLabel = String(group.label || section.title || '')
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

            return `
                <article class="section-overview-card">
                    <a class="section-overview-card__link" href="${href}">
                        <span class="section-overview-card__media">
                            ${
                                group.iconSrc
                                    ? `<img class="section-overview-card__image" src="${group.iconSrc}" alt="${escapeHtml(group.label)}" loading="lazy" />`
                                    : `<span class="section-overview-card__badge">${escapeHtml(iconLabel || 'L2')}</span>`
                            }
                        </span>
                        <span class="section-overview-card__body">
                            <span class="section-overview-card__eyebrow">${escapeHtml(section.title)}</span>
                            <span class="section-overview-card__title">${escapeHtml(group.label)}</span>
                            <span class="section-overview-card__text">${escapeHtml(summary)}</span>
                        </span>
                        <span class="section-overview-card__meta">${escapeHtml(`${group.entries.length} материалов`)}</span>
                    </a>
                </article>
            `;
        })
        .join('');

    if (!cards) {
        return '';
    }

    return `
        <section class="wiki-panel section-overview">
            <div class="wiki-panel__head">
                <div>
                    <span class="wiki-panel__eyebrow">${escapeHtml(section.title)}</span>
                    <h2 class="wiki-panel__title">Основные разделы</h2>
                </div>
            </div>
            <div class="section-overview-grid">
                ${cards}
            </div>
        </section>
    `;
};

const buildSectionGroupCatalogRows = (database, section, group) =>
    (group.entries || [])
        .map((articleId) => getArticle(database, articleId))
        .filter(Boolean)
        .map((article) => {
            const facts = [...(article.sidebarFacts || []), ...(article.meta || [])];
            const detail =
                facts
                    .slice(0, 2)
                    .map((fact) => `${fact.label}: ${fact.value}`)
                    .join(' • ') ||
                article.eyebrow ||
                section.title;

            // Weapon icon support
            const iconHtml = article.icon
                ? `<img class="catalog-item-icon" src="${escapeHtml(article.icon)}" alt="" loading="lazy" />`
                : '';

            return {
                id: article.id,
                cells: [
                    {
                        href: buildArticleUrl(article.id),
                        value: `${iconHtml}${article.title}`,
                    },
                    {
                        value: detail,
                    },
                    {
                        value: article.summary || 'Открыть подробную страницу материала.',
                    },
                ],
            };
        });

const getSkillArticleParts = (article) => {
    const blocks = article?.blocks || [];
    const skillTables = blocks.filter(
        (block) => block.type === 'table' && /^\d+$/.test(String(block.title || '').trim()) && isSkillTableData(block)
    );

    if (article?.section !== 'skills' || skillTables.length < 2) {
        return null;
    }

    const excludedIds = new Set(skillTables.map((block) => block.id));
    const levelList = blocks.find(
        (block) =>
            block.type === 'list' &&
            (block.items || []).length >= skillTables.length &&
            (block.items || []).every((item) => /^\d+$/.test(String(item).trim()))
    );

    if (levelList) {
        excludedIds.add(levelList.id);
    }

    const firstSkillIndex = blocks.findIndex((block) => excludedIds.has(block.id));
    const lastSkillIndex = Math.max(...blocks.map((block, index) => (excludedIds.has(block.id) ? index : -1)));

    return {
        before: blocks.slice(0, Math.max(0, firstSkillIndex)).map(renderBlock).join(''),
        skillTables,
        after: blocks
            .slice(lastSkillIndex + 1)
            .map(renderBlock)
            .join(''),
    };
};

const renderSkillProgression = (tables = []) => {
    if (!tables.length) {
        return '';
    }

    const activeLevel = tables[0].title || '40';

    return `
        <section class="wiki-panel rich-block rich-block--skills" data-skill-progress data-active-level="${escapeHtml(activeLevel)}">
            <div class="skill-progress">
                <div class="skill-progress__tabs" role="tablist" aria-label="Уровни навыков">
                    ${tables
                        .map(
                            (table) => `
                                <button class="skill-progress__tab" type="button" role="tab" data-skill-level="${escapeHtml(table.title || '')}">
                                    ${escapeHtml(table.title || '')}
                                </button>
                            `
                        )
                        .join('')}
                </div>
                <div class="skill-progress__panes">
                    ${tables
                        .map(
                            (table) => `
                                <section class="skill-progress__pane" data-skill-pane="${escapeHtml(table.title || '')}" hidden>
                                    ${renderRichTable(table)}
                                </section>
                            `
                        )
                        .join('')}
                </div>
            </div>
        </section>
    `;
};

const renderBlock = (block) => {
    if (!block) {
        return '';
    }

    const title = block.title ? `<h2 class="rich-block__title">${escapeHtml(block.title)}</h2>` : '';
    const blockAnchor = block.id ? ` id="${escapeHtml(block.id)}"` : '';

    if (block.type === 'prose') {
        return `
            <section class="wiki-panel rich-block rich-block--prose"${blockAnchor}>
                ${title}
                <div class="wiki-text">
                    ${(block.paragraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
                </div>
            </section>
        `;
    }

    if (block.type === 'list' || block.type === 'steps') {
        const ordered = block.type === 'steps' || block.style === 'ordered';
        const tag = ordered ? 'ol' : 'ul';
        return `
            <section class="wiki-panel rich-block rich-block--list"${blockAnchor}>
                ${title}
                <${tag} class="wiki-list ${ordered ? 'wiki-list--ordered' : ''}">
                    ${(block.items || []).map((item) => `<li class="wiki-list__item">${escapeHtml(item)}</li>`).join('')}
                </${tag}>
            </section>
        `;
    }

    if (block.type === 'table') {
        return `
            <section class="wiki-panel rich-block rich-block--table"${blockAnchor}>
                ${title}
                ${renderRichTable(block)}
            </section>
        `;
    }

    if (block.type === 'callout') {
        return `
            <section class="wiki-callout wiki-callout--${escapeHtml(block.tone || 'info')}"${blockAnchor}>
                ${title}
                ${block.text ? `<p>${escapeHtml(block.text)}</p>` : ''}
                ${
                    block.items?.length
                        ? `<ul class="wiki-list">${block.items.map((item) => `<li class="wiki-list__item">${escapeHtml(item)}</li>`).join('')}</ul>`
                        : ''
                }
            </section>
        `;
    }

    if (block.type === 'media') {
        const items = block.items || [];
        return `
            <section class="wiki-panel rich-block rich-block--media"${blockAnchor}>
                ${title}
                <div class="wiki-media-grid${items.length === 1 ? ' wiki-media-grid--single' : ''}">
                    ${items
                        .map(
                            (item) => `
                                <figure class="wiki-media-card">
                                    <img src="${item.src}" alt="${escapeHtml(item.alt || item.caption || 'Lineage II')}" loading="lazy" />
                                    ${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ''}
                                </figure>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `;
    }

    if (block.type === 'html') {
        return `
            <section class="wiki-panel rich-block rich-block--html"${blockAnchor}>
                ${title}
                <div class="wiki-html">${block.html || ''}</div>
            </section>
        `;
    }

    if (block.type === 'questGuide') {
        return renderQuestGuideBlock(block);
    }

    if (block.type === 'classTree') {
        return renderClassTreeBlock(block);
    }

    if (block.type === 'imageMap') {
        return renderImageMapBlock(block);
    }

    return '';
};

const renderSectionGroupPanels = (database, section, activeGroupId = '') => {
    const groups = resolveRenderableGroups(section, activeGroupId);

    return groups
        .map((group) => {
            const rows = buildSectionGroupCatalogRows(database, section, group);
            const cards = rows.length
                ? `
                    <div class="knowledge-grid__wide">
                        ${renderRichTable(
                            {
                                compact: true,
                                columns: [
                                    { key: 'title', label: 'Материал', width: '30%' },
                                    { key: 'details', label: 'Краткие данные', width: '24%' },
                                    { key: 'summary', label: 'Описание' },
                                ],
                                rows,
                            },
                            'wiki-catalog-table'
                        )}
                    </div>
                `
                : '<div class="wiki-empty-inline">В этой группе пока нет материалов.</div>';

            return `
                <section class="wiki-panel">
                    <div class="wiki-panel__head">
                        <div>
                            <span class="wiki-panel__eyebrow">${escapeHtml(section.title)}</span>
                            <h2 class="wiki-panel__title">${escapeHtml(group.label)}</h2>
                        </div>
                    </div>
                    ${group.description ? `<p class="wiki-panel__text">${escapeHtml(group.description)}</p>` : ''}
                    <div class="knowledge-grid">
                        ${cards || '<div class="wiki-empty-inline">В этой группе пока нет материалов.</div>'}
                    </div>
                </section>
            `;
        })
        .join('');
};

const renderSectionPage = (database) => {
    const target = document.querySelector('[data-wiki-section]');
    const sectionId = getParam('section') || Object.values(database.sections).sort(sortByOrder)[0]?.id;
    const groupId = getParam('group') || '';
    const section = sectionId ? getSection(database, sectionId) : null;

    if (!target) {
        return;
    }

    if (!section) {
        target.innerHTML = `
            <section class="wiki-empty">
                <h1 class="wiki-empty__title">Раздел не найден</h1>
                <p class="wiki-empty__text">Похоже, ссылка ведет в раздел, который еще не подключен к каталогу.</p>
                <a class="wiki-empty__link" href="${routes.home}">Вернуться на главную</a>
            </section>
        `;
        return;
    }

    const activeGroup = resolveActiveGroup(section, groupId);
    const hasGroupNavigation = Array.isArray(section.groups) && section.groups.length > 0;
    const showHubOverview = !activeGroup && hasGroupNavigation;
    const breadcrumbs = [
        { label: 'Главная', href: routes.home },
        { label: section.title, href: buildSectionUrl(section.id) },
    ];

    if (activeGroup) {
        breadcrumbs.push({ label: activeGroup.label });
    }

    target.innerHTML = `
        ${renderBreadcrumbs(breadcrumbs)}
        <section class="page-hero page-hero--section-rich">
            <div class="page-hero__content">
                <span class="page-hero__eyebrow">Раздел базы знаний</span>
                <h1 class="page-hero__title">${escapeHtml(activeGroup ? `${section.title} — ${activeGroup.label}` : section.title)}</h1>
                <p class="page-hero__text">${escapeHtml(activeGroup?.description || section.description || 'Материалы, таблицы и подробные статьи по разделу.')}</p>
            </div>
            ${renderFactList(section.landingSidebarFacts?.length ? section.landingSidebarFacts : section.stats)}
        </section>
        <nav class="section-switcher" aria-label="Группы раздела">
            <a class="section-switcher__link ${!groupId ? 'is-active' : ''}" href="${buildSectionUrl(section.id)}">Все материалы</a>
            ${section.groups
                .map(
                    (group) => `
                        <a class="section-switcher__link ${group.id === groupId ? 'is-active' : ''}" href="${buildSectionUrl(section.id, group.id)}">
                            ${escapeHtml(group.label)}
                        </a>
                    `
                )
                .join('')}
        </nav>
        <div class="wiki-columns wiki-columns--section">
            <div class="wiki-stack">
                ${activeGroup ? '' : (section.landingBlocks || []).map(renderBlock).join('')}
                ${showHubOverview ? renderSectionOverviewCards(database, section) : ''}
                ${showHubOverview ? '' : renderFilteredCatalogTable(section, activeGroup, database)}
                ${activeGroup ? renderSectionGroupPanels(database, section, activeGroup?.id || '') : ''}
            </div>
            <aside class="wiki-stack wiki-stack--aside">
                <section class="wiki-panel">
                    <div class="wiki-panel__head">
                        <h2 class="wiki-panel__title">Группы раздела</h2>
                    </div>
                    <ul class="wiki-link-list">
                        ${section.groups
                            .map(
                                (group) => `
                                    <li class="wiki-link-list__item">
                                        <a href="${buildGroupNavigationUrl(database, section, group)}">${escapeHtml(group.label)}</a>
                                        <span>${group.entries.length}</span>
                                    </li>
                                `
                            )
                            .join('')}
                    </ul>
                </section>
            </aside>
        </div>
    `;
};

const renderInfobox = (article, section, group, className = '') => {
    const facts = [
        ...((article.sidebarFacts || []).length ? article.sidebarFacts : []),
        ...((article.meta || []).length ? article.meta : []),
    ];

    if (!facts.length && !section) {
        return '';
    }

    return `
        <section class="wiki-infobox${className ? ` ${className}` : ''}">
            <div class="wiki-infobox__head">
                <h2 class="wiki-infobox__title">${escapeHtml(article.title)}</h2>
                ${group ? `<p class="wiki-infobox__subtitle">${escapeHtml(group.label)}</p>` : ''}
            </div>
            ${renderFactList(facts, 'wiki-infobox-meta')}
        </section>
    `;
};

const renderArticleHero = (article, section, isQuestDetail = false) => {
    const heroImage = article.heroImage;
    const heroImageHtml = heroImage
        ? `
        <div class="page-hero__image">
            <img src="${escapeHtml(heroImage)}" alt="${escapeHtml(article.title)}" loading="lazy" />
        </div>
    `
        : '';

    // Render maps from intro if present
    let mapsHtml = '';
    if (article.intro && Array.isArray(article.intro)) {
        const mapKeywords = ['карт', 'map', 'схем', 'маршрут'];
        const mapLines = article.intro.filter(
            (line) =>
                mapKeywords.some((keyword) => line.toLowerCase().includes(keyword)) ||
                line.includes('.gif') ||
                line.includes('.png') ||
                line.includes('.jpg')
        );

        if (mapLines.length > 0) {
            const mapImageMatch = mapLines.join(' ').match(/(карта[^.]+\.(gif|png|jpg))/i);
            if (mapImageMatch) {
                const mapFile = mapImageMatch[1];
                mapsHtml = `
                    <div class="page-hero__map">
                        <h3>Карта прохождения</h3>
                        <img src="/${escapeHtml(mapFile)}" alt="Карта ${escapeHtml(article.title)}" loading="lazy" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);" />
                    </div>
                `;
            }
        }
    }

    if (isQuestDetail) {
        return `
            <section class="page-hero page-hero--article page-hero--quest">
                ${heroImageHtml}
                <div class="page-hero__content">
                    <span class="page-hero__eyebrow">${escapeHtml(article.eyebrow || section.title)}</span>
                    <h1 class="page-hero__title">${escapeHtml(article.title)}</h1>
                    <p class="page-hero__text">${escapeHtml(article.summary || 'Подробное прохождение квеста, требования, NPC, локации и награды.')}</p>
                </div>
            </section>
            ${mapsHtml}
        `;
    }

    return `
        <section class="page-hero page-hero--article">
            ${heroImageHtml}
            <div class="page-hero__content">
                <span class="page-hero__eyebrow">${escapeHtml(article.eyebrow || section.title)}</span>
                <h1 class="page-hero__title">${escapeHtml(article.title)}</h1>
                <p class="page-hero__text">${escapeHtml(article.summary || 'Подробный материал по Lineage II.')}</p>
            </div>
            ${renderFactList(article.meta)}
        </section>
        ${mapsHtml}
    `;
};

const renderFlatArticleHero = (article, section) => `
    <section class="page-hero page-hero--article page-hero--article-flat">
        <div class="page-hero__content">
            <span class="page-hero__eyebrow">${escapeHtml(article.eyebrow || section.title)}</span>
            <h1 class="page-hero__title">${escapeHtml(article.title)}</h1>
            ${article.summary ? `<p class="page-hero__text">${escapeHtml(article.summary)}</p>` : ''}
        </div>
    </section>
`;

const bindQuestImageFallbacks = (target) => {
    if (!target) {
        return;
    }

    target.querySelectorAll('.quest-inline-icon, .wiki-html img, .quest-guide img').forEach((image) => {
        if (image.dataset.fallbackBound === 'true') {
            return;
        }

        image.dataset.fallbackBound = 'true';
        image.addEventListener('error', () => {
            const currentSrc = image.getAttribute('src') || '';

            if (!image.dataset.originalRetryDone) {
                const archiveMatch = currentSrc.match(/https?:\/\/web\.archive\.org\/web\/\d+[^/]*\/(https?:\/\/.+)$/i);

                if (archiveMatch?.[1]) {
                    image.dataset.originalRetryDone = 'true';
                    image.src = archiveMatch[1];
                    return;
                }
            }

            image.classList.add('is-broken');
            image.setAttribute('aria-hidden', 'true');
        });
    });
};

const bindArchiveDetailTabs = (target) => {
    if (!target) {
        return;
    }

    target.querySelectorAll('.archive-detail__tabs').forEach((tabList) => {
        if (tabList.dataset.tabsBound === 'true') {
            return;
        }

        const root = tabList.closest('.archive-detail');
        const parent = tabList.parentElement;
        const content = Array.from(parent?.children || []).find((child) => child.classList?.contains('archive-detail__tab-content'));
        const links = Array.from(tabList.querySelectorAll('.archive-detail__tab-link[href^="#"]'));
        const panes = Array.from(content?.children || []).filter((child) => child.classList?.contains('archive-detail__tab-pane'));

        if (!root || !content || !links.length || !panes.length) {
            return;
        }

        const activate = (hash) => {
            const cleanHash = String(hash || '').replace(/^#/, '');

            links.forEach((link) => {
                const item = link.closest('.archive-detail__tab-item');
                const active = link.getAttribute('href') === `#${cleanHash}`;
                link.classList.toggle('is-active', active);
                item?.classList.toggle('is-active', active);
            });

            panes.forEach((pane) => {
                const isActive = pane.id === cleanHash;
                pane.classList.toggle('active', isActive);

                if (isActive) {
                    pane.querySelectorAll('img').forEach((image) => {
                        image.setAttribute('loading', 'eager');
                        image.setAttribute('fetchpriority', 'high');

                        if (!image.complete) {
                            const currentSrc = image.getAttribute('src');

                            if (currentSrc) {
                                image.src = currentSrc;
                            }
                        }
                    });
                }
            });
        };

        const initialHash =
            links.find((link) => link.classList.contains('is-active'))?.getAttribute('href') || links[0]?.getAttribute('href') || '';
        activate(initialHash);

        links.forEach((link) => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const href = link.getAttribute('href') || '';
                activate(href);
                const cleanHash = href.replace(/^#/, '');
                const targetPane = panes.find((pane) => pane.id === cleanHash);
                targetPane?.scrollIntoView({ block: 'start', behavior: 'smooth' });
            });
        });

        tabList.dataset.tabsBound = 'true';
    });
};

const bindClassTreeTabs = (target) => {
    if (!target) {
        return;
    }

    target.querySelectorAll('[data-class-tree]').forEach((root) => {
        if (root.dataset.tabsBound === 'true') {
            return;
        }

        const tabs = Array.from(root.querySelectorAll('[data-class-tree-tab]'));
        const panes = Array.from(root.querySelectorAll('[data-class-tree-pane]'));

        if (!tabs.length || !panes.length) {
            return;
        }

        const activate = (tabId) => {
            tabs.forEach((tab) => {
                const isActive = tab.dataset.classTreeTab === tabId;
                tab.classList.toggle('is-active', isActive);
                tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });

            panes.forEach((pane) => {
                const isActive = pane.dataset.classTreePane === tabId;
                pane.classList.toggle('is-active', isActive);
                pane.hidden = !isActive;
            });
        };

        tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                activate(tab.dataset.classTreeTab || '');
            });
        });

        activate(root.dataset.activeTab || tabs[0].dataset.classTreeTab || '');
        root.dataset.tabsBound = 'true';
    });
};

const bindSkillProgressTabs = (target) => {
    if (!target) {
        return;
    }

    target.querySelectorAll('[data-skill-progress]').forEach((root) => {
        if (root.dataset.tabsBound === 'true') {
            return;
        }

        const tabs = Array.from(root.querySelectorAll('[data-skill-level]'));
        const panes = Array.from(root.querySelectorAll('[data-skill-pane]'));

        if (!tabs.length || !panes.length) {
            return;
        }

        const activate = (level) => {
            tabs.forEach((tab) => {
                const isActive = tab.dataset.skillLevel === level;
                tab.classList.toggle('is-active', isActive);
                tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });

            panes.forEach((pane) => {
                const isActive = pane.dataset.skillPane === level;
                pane.hidden = !isActive;
                pane.classList.toggle('is-active', isActive);
            });
        };

        tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                activate(tab.dataset.skillLevel || '');
            });
        });

        activate(root.dataset.activeLevel || tabs[0].dataset.skillLevel || '');
        root.dataset.tabsBound = 'true';
    });
};

const renderArticlePage = (database) => {
    const target = document.querySelector('[data-wiki-article]');
    const articleId = getParam('article');
    const article = articleId ? getArticle(database, articleId) : null;
    const section = article ? getSection(database, article.section) : null;
    const group = article && section ? findGroup(section, article.group) : null;

    if (!target) {
        return;
    }

    if (article?.id) {
        target.dataset.articleId = article.id;
    } else {
        delete target.dataset.articleId;
    }

    if (!article || !section) {
        target.innerHTML = `
            <section class="wiki-empty">
                <h1 class="wiki-empty__title">Материал не найден</h1>
                <p class="wiki-empty__text">Ссылка ведет на страницу, которой пока нет в каталоге.</p>
                <a class="wiki-empty__link" href="${routes.home}">Вернуться на главную</a>
            </section>
        `;
        return;
    }

    const isQuestDetail = isQuestStyledArticle(article);
    const questGuideBlock = isQuestDetail ? findQuestGuideBlock(article) : null;
    const hasQuestHtmlBlock = isQuestDetail && (article.blocks || []).some((block) => block.type === 'html');
    const preferSourceQuestHtml = hasQuestHtmlBlock && String(article.source?.path || '').startsWith('quests/');
    const skillArticleParts = !isQuestDetail ? getSkillArticleParts(article) : null;
    const isFlatArticle = article.layout === 'contacts-page';
    const articleBlocksHtml = preferSourceQuestHtml
        ? (article.blocks || [])
              .filter((block) => block.type !== 'questGuide')
              .map(renderBlock)
              .join('')
        : questGuideBlock
          ? [questGuideBlock]
                .concat((article.blocks || []).filter((block) => block.type !== 'questGuide' && block.type !== 'html'))
                .map(renderBlock)
                .join('')
          : hasQuestHtmlBlock
            ? (article.blocks || []).map(renderBlock).join('')
            : isQuestDetail
              ? renderQuestCompatContent(article)
              : skillArticleParts
                ? `${skillArticleParts.before}${renderSkillProgression(skillArticleParts.skillTables)}${skillArticleParts.after}`
                : (article.blocks || []).map(renderBlock).join('');
    const relatedIds = isFlatArticle
        ? []
        : Array.from(new Set([...(article.related || []), ...(questGuideBlock?.relatedQuestIds || [])])).filter(Boolean);
    const articleLayoutClass = isQuestDetail ? ' article-layout--quest' : isFlatArticle ? ' article-layout--flat' : '';
    const articleColumnsClass = isQuestDetail ? ' wiki-columns--article-quest' : isFlatArticle ? ' wiki-columns--article-single' : '';
    const heroHtml = isFlatArticle ? renderFlatArticleHero(article, section) : renderArticleHero(article, section, isQuestDetail);
    const asideHtml = isFlatArticle
        ? ''
        : `
            <aside class="wiki-stack wiki-stack--aside">
                ${renderInfobox(article, section, group, isQuestDetail ? 'wiki-infobox--quest' : '')}
            </aside>
        `;

    target.innerHTML = `
        <div class="article-layout${articleLayoutClass}">
            ${renderBreadcrumbs([
                { label: 'Главная', href: routes.home },
                { label: section.title, href: buildSectionUrl(section.id, article.group) },
                { label: article.title },
            ])}
            ${heroHtml}
        </div>
        <div class="wiki-columns wiki-columns--article${articleColumnsClass}">
            <div class="wiki-stack">
                ${articleBlocksHtml}
                ${renderRelatedArticles(database, relatedIds)}
            </div>
            ${asideHtml}
        </div>
    `;

    bindQuestImageFallbacks(target);
    bindArchiveDetailTabs(target);
    bindClassTreeTabs(target);
};

const normalizeSearchText = (value = '') =>
    String(value)
        .toLowerCase()
        .replaceAll('ё', 'е')
        .replace(/[^a-z0-9\u0400-\u04ff]+/g, ' ')
        .trim();

const searchDatabase = (database, query) => {
    const normalized = normalizeSearchText(query);

    if (!normalized) {
        return [];
    }

    const tokens = normalized.split(/\s+/).filter(Boolean);
    const source = store?.buildSearchIndex?.() || [];

    return source
        .map((item) => {
            const haystack = normalizeSearchText(item.searchableText || `${item.title} ${item.summary || ''}`);
            let score = 0;

            if (normalizeSearchText(item.title) === normalized) {
                score += 10;
            }

            if (normalizeSearchText(item.title).includes(normalized)) {
                score += 6;
            }

            if (haystack.includes(normalized)) {
                score += 4;
            }

            tokens.forEach((token) => {
                if (haystack.includes(token)) {
                    score += 1;
                }
            });

            return {
                ...item,
                score,
            };
        })
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 40);
};

const renderSearchResults = (database) => {
    const target = document.querySelector('[data-wiki-search]');
    const query = (getParam('query') || '').trim();
    const serverResults = Array.isArray(readPageData()?.searchResults) ? readPageData().searchResults : null;
    const results = query ? serverResults || searchDatabase(database, query) : [];

    if (!target) {
        return;
    }

    target.innerHTML = `
        ${renderBreadcrumbs([{ label: 'Главная', href: routes.home }, { label: 'Поиск' }])}
        <section class="page-hero page-hero--search">
            <div class="page-hero__content">
                <span class="page-hero__eyebrow">Поиск по базе знаний</span>
                <h1 class="page-hero__title">${query ? `Результаты по запросу "${escapeHtml(query)}"` : 'Введите запрос в поиск'}</h1>
                <p class="page-hero__text">
                    ${query ? `Найдено материалов: ${results.length}` : 'Ищите квесты, локации, NPC, предметы и игровые системы.'}
                </p>
            </div>
        </section>
        ${
            query
                ? results.length
                    ? `
                        <div class="knowledge-grid">
                            ${results
                                .map(
                                    (item) => `
                                        <article class="knowledge-card">
                                            ${renderKnowledgeCardMedia(item.previewImage, item.title)}
                                            <div class="knowledge-card__head">
                                                <span class="knowledge-card__eyebrow">${escapeHtml(item.type === 'section' ? 'Раздел' : 'Материал')}</span>
                                                <h2 class="knowledge-card__title">
                                                    <a href="${item.type === 'section' ? buildSectionUrl(item.id) : buildArticleUrl(item.id)}">${escapeHtml(
                                                        item.title
                                                    )}</a>
                                                </h2>
                                            </div>
                                            <p class="knowledge-card__text">${escapeHtml(item.summary || 'Открыть материал')}</p>
                                            <a class="knowledge-card__link" href="${
                                                item.type === 'section' ? buildSectionUrl(item.id) : buildArticleUrl(item.id)
                                            }">Перейти</a>
                                        </article>
                                    `
                                )
                                .join('')}
                        </div>
                    `
                    : `
                        <section class="wiki-empty">
                            <h2 class="wiki-empty__title">Ничего не найдено</h2>
                            <p class="wiki-empty__text">Попробуйте другой запрос короче или на английском названии объекта.</p>
                            <a class="wiki-empty__link" href="${routes.home}">Открыть главную</a>
                        </section>
                    `
                : `
                    <section class="wiki-empty">
                        <h2 class="wiki-empty__title">Поиск готов</h2>
                        <p class="wiki-empty__text">Используйте поле в шапке, чтобы быстро перейти к нужному материалу.</p>
                    </section>
                `
        }
    `;
};

const renderSidebar = (database) => {
    const sidebarList = document.querySelector('.sidebar__list');

    if (!sidebarList) {
        return;
    }

    const sections = Object.values(database.sections).sort(sortByOrder);

    if (!sections.length) {
        return;
    }

    sidebarList.innerHTML = sections
        .map((section) => {
            const sidebarGroups = getSidebarGroups(section);
            const hasGroups = sidebarGroups.length > 0;

            return `
                <li class="sidebar__item ${hasGroups ? 'sidebar__item--has-submenu' : ''}" data-section="${escapeHtml(section.id)}">
                    <a class="sidebar__link" href="${buildSectionUrl(section.id)}" ${hasGroups ? 'aria-expanded="false"' : ''}>
                        <span class="text">${escapeHtml(section.title)}</span>
                        ${hasGroups ? '<span class="arrow" aria-hidden="true">›</span>' : ''}
                    </a>
                    ${
                        hasGroups
                            ? `
                                <ul class="sidebar__submenu">
                                    ${sidebarGroups
                                        .map(
                                            (group) => `
                                                <li class="sidebar__submenu-item">
                                                    <a class="sidebar__submenu-link" data-group="${escapeHtml(group.id)}" href="${buildGroupNavigationUrl(
                                                        database,
                                                        section,
                                                        group
                                                    )}">${renderSidebarGroupLabel(section, group)}</a>
                                                </li>
                                            `
                                        )
                                        .join('')}
                                </ul>
                            `
                            : ''
                    }
                </li>
            `;
        })
        .join('');
};

const syncSidebarState = (sectionId, groupId = '') => {
    document.querySelectorAll('.sidebar__item').forEach((item) => {
        item.classList.remove('sidebar__item--current', 'is-open');
        const link = item.querySelector('.sidebar__link');

        if (link) {
            link.setAttribute('aria-expanded', 'false');
        }
    });

    document.querySelectorAll('.sidebar__submenu-link').forEach((link) => {
        link.classList.remove('is-active');
    });

    const currentItem = document.querySelector(`.sidebar__item[data-section="${sectionId}"]`);

    if (!currentItem) {
        return;
    }

    currentItem.classList.add('sidebar__item--current');

    const currentLink = currentItem.querySelector('.sidebar__link');

    if (currentLink) {
        currentLink.setAttribute('aria-expanded', 'true');
    }

    if (currentItem.classList.contains('sidebar__item--has-submenu')) {
        currentItem.classList.add('is-open');
    }

    if (groupId) {
        const activeGroupLink = currentItem.querySelector(`.sidebar__submenu-link[data-group="${groupId}"]`);

        if (activeGroupLink) {
            activeGroupLink.classList.add('is-active');
        }
    }
};

const syncHomeBanners = (database) => {
    const cards = document.querySelectorAll('.intro__banner-card');

    cards.forEach((card, index) => {
        const config = FEATURED_ARTICLES[index];
        const article = config ? getArticle(database, config.id) : null;
        const titleNode = card.querySelector('.intro__banner-title');
        const textNode = card.querySelector('.intro__banner-info');

        if (config && article) {
            card.setAttribute('href', buildArticleUrl(article.id));
        }

        if (titleNode && config) {
            titleNode.textContent = config.title;
        }

        if (textNode) {
            textNode.textContent = article?.summary || config?.text || textNode.textContent;
        }
    });
};

const wireSearchForms = () => {
    const initialQuery = getParam('query') || '';

    document.querySelectorAll('.header__search-input').forEach((input) => {
        if (initialQuery && !input.value) {
            input.value = initialQuery;
        }
    });

    document.querySelectorAll('.header__search').forEach((form) => {
        if (form.dataset.searchBound === 'true') {
            return;
        }

        form.addEventListener('submit', (event) => {
            const input = form.querySelector('.header__search-input');
            const value = input?.value?.trim() || '';

            if (!value) {
                event.preventDefault();
                return;
            }

            const action = form.getAttribute('action');

            if (!action) {
                event.preventDefault();
                window.location.href = `${routes.search}?query=${encodeURIComponent(value)}`;
            }
        });

        form.dataset.searchBound = 'true';
    });
};

const ensureContactsButtons = () => {
    document.querySelectorAll('.header__search').forEach((form) => {
        if (form.querySelector('.header__contacts-button')) {
            return;
        }

        const button = document.createElement('a');
        button.className = 'header__contacts-button';
        button.href = buildArticleUrl('contacts');
        button.textContent = 'Контакты';
        button.setAttribute('aria-label', 'Контакты');
        form.appendChild(button);
    });
};

const updateDocumentTitle = (database) => {
    const sectionId = getParam('section');
    const articleId = getParam('article');
    const query = getParam('query');
    const siteName = database.site?.name || 'L2Wiki.Su';

    if (articleId && database.articles[articleId]) {
        document.title = `${database.articles[articleId].title} | ${siteName}`;
        return;
    }

    if (sectionId && database.sections[sectionId]) {
        document.title = `${database.sections[sectionId].title} | ${siteName}`;
        return;
    }

    if (query) {
        document.title = `Поиск: ${query} | ${siteName}`;
        return;
    }

    document.title = siteName;
};

const setMetaContent = (selector, value) => {
    const element = document.querySelector(selector);

    if (element && value) {
        element.setAttribute('content', value);
    }
};

const setLinkHref = (selector, value) => {
    const element = document.querySelector(selector);

    if (element && value) {
        element.setAttribute('href', value);
    }
};

const updateSeoMetadata = (database) => {
    const sectionId = getParam('section');
    const articleId = getParam('article');
    const query = getParam('query');
    const siteName = database.site?.name || 'L2Wiki.Su';
    const canonicalUrl = new URL(window.location.pathname + window.location.search, window.location.origin).href;

    let title = siteName;
    let description = 'База знаний по Lineage II: гайды, локации, NPC, предметы и полезные маршруты.';
    let ogType = 'website';

    if (articleId && database.articles[articleId]) {
        const article = database.articles[articleId];
        title = `${article.title} | ${siteName}`;
        description = article.summary || description;
        ogType = 'article';
    } else if (sectionId && database.sections[sectionId]) {
        const section = database.sections[sectionId];
        title = `${section.title} | ${siteName}`;
        description = section.description || description;
    } else if (query) {
        title = `Поиск: ${query} | ${siteName}`;
        description = `Результаты поиска по запросу "${query}" на ${siteName}.`;
    }

    setMetaContent('meta[name="description"]', description);
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[property="og:url"]', canonicalUrl);
    setMetaContent('meta[property="og:type"]', ogType);
    setMetaContent('meta[name="twitter:title"]', title);
    setMetaContent('meta[name="twitter:description"]', description);
    setMetaContent('meta[name="twitter:url"]', canonicalUrl);
    setLinkHref('link[rel="canonical"]', canonicalUrl);
};

const renderLoadingState = () => {
    if (currentPage === 'article') {
        const target = document.querySelector('[data-wiki-article]');

        if (target) {
            target.innerHTML = `
                <section class="wiki-empty wiki-empty--loading">
                    <h1 class="wiki-empty__title">Загружаем материал</h1>
                    <p class="wiki-empty__text">Подтягиваем статью, навигацию и связанные данные.</p>
                </section>
            `;
        }

        return;
    }

    if (currentPage === 'section') {
        const target = document.querySelector('[data-wiki-section]');

        if (target) {
            target.innerHTML = `
                <section class="wiki-empty wiki-empty--loading">
                    <h1 class="wiki-empty__title">Загружаем раздел</h1>
                    <p class="wiki-empty__text">Готовим группы, карточки и таблицы этого раздела.</p>
                </section>
            `;
        }

        return;
    }

    if (currentPage === 'search') {
        const target = document.querySelector('[data-wiki-search]');

        if (target) {
            target.innerHTML = `
                <section class="wiki-empty wiki-empty--loading">
                    <h1 class="wiki-empty__title">Готовим поиск</h1>
                    <p class="wiki-empty__text">Загружаем актуальный индекс и результаты.</p>
                </section>
            `;
        }
    }
};

const renderCurrentPage = () => {
    const database = readDatabase();

    ensureContactsButtons();
    wireSearchForms();

    if (isDataPending(database)) {
        renderLoadingState();
        return;
    }

    resetPagedTableRegistry();
    renderSidebar(database);
    renderFooter(database);
    hydrateAdSlots(database);
    syncHomeBanners(database);

    if (currentPage === 'section') {
        renderSectionPage(database);
        syncSidebarState(getParam('section') || '', getParam('group') || '');
    } else if (currentPage === 'article') {
        renderArticlePage(database);
        const article = getArticle(database, getParam('article') || '');
        syncSidebarState(article?.section || '', article?.group || '');
    } else if (currentPage === 'search') {
        renderSearchResults(database);
    }

    bindClassTreeTabs(document);
    bindSkillProgressTabs(document);
    bindPaginatedTables(document);
    updateDocumentTitle(database);
    updateSeoMetadata(database);
};

renderCurrentPage();

if (store?.subscribe) {
    store.subscribe(() => {
        renderCurrentPage();
    });
}

// Re-render when weapons data is loaded
window.addEventListener('l2wiki:weapons-data-loaded', function (event) {
    console.log('[Wiki] Weapons data loaded, re-rendering page', event.detail);
    renderCurrentPage();
});


