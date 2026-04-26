(function () {
    const store = window.L2WikiStore;

    if (!store) {
        console.error('L2WikiStore is not available.');
        return;
    }

    const state = {
        activePanel: 'dashboard',
        editingArticleId: '',
        editingSectionId: '',
        articleSearch: '',
        articleSectionFilter: '',
        articlePage: 1,
        sectionPage: 1,
        database: store.getDatabase(),
        articleSummaryIds: new Set(),
        backups: [],
        adminUsername: window.L2WikiAdminSession?.username || 'admin',
        adminPasswordManagedByEnv: Boolean(window.L2WikiAdminSession?.passwordManagedByEnv),
        contactsRowSeed: 0,
        builderSeed: 0,
    };

    const ADMIN_ARTICLE_PAGE_SIZE = 18;
    const ADMIN_SECTION_PAGE_SIZE = 10;

    const elements = {
        panelButtons: Array.from(document.querySelectorAll('[data-panel-button]')),
        panels: Array.from(document.querySelectorAll('.admin-panel')),
        sidebarSections: document.getElementById('adminSidebarSections'),
        sidebarCount: document.getElementById('adminSidebarCount'),
        updatedAt: document.getElementById('adminUpdatedAt'),
        stats: document.getElementById('adminStats'),
        dashboardSections: document.getElementById('adminDashboardSections'),
        dashboardArticles: document.getElementById('adminDashboardArticles'),
        articleSearchInput: document.getElementById('articleSearchInput'),
        articleSectionFilter: document.getElementById('articleSectionFilter'),
        articleList: document.getElementById('articleList'),
        articleForm: document.getElementById('articleForm'),
        articleFormTitle: document.getElementById('articleFormTitle'),
        articleId: document.getElementById('articleId'),
        articleOrder: document.getElementById('articleOrder'),
        articleTitle: document.getElementById('articleTitle'),
        articleSection: document.getElementById('articleSection'),
        articleGroup: document.getElementById('articleGroup'),
        articleEyebrow: document.getElementById('articleEyebrow'),
        articleLayout: document.getElementById('articleLayout'),
        articleHeroImage: document.getElementById('articleHeroImage'),
        articleSummary: document.getElementById('articleSummary'),
        articleMeta: document.getElementById('articleMeta'),
        articleAliases: document.getElementById('articleAliases'),
        articleIntro: document.getElementById('articleIntro'),
        articleChecklist: document.getElementById('articleChecklist'),
        articleSteps: document.getElementById('articleSteps'),
        articleRewards: document.getElementById('articleRewards'),
        articleTips: document.getElementById('articleTips'),
        articleRelated: document.getElementById('articleRelated'),
        articleSidebarFacts: document.getElementById('articleSidebarFacts'),
        articleBlocks: document.getElementById('articleBlocks'),
        articleQuestGuide: document.getElementById('articleQuestGuide'),
        articleSourceUrl: document.getElementById('articleSourceUrl'),
        articleSourceArchivedAt: document.getElementById('articleSourceArchivedAt'),
        articleSourcePath: document.getElementById('articleSourcePath'),
        articleSourceSnapshot: document.getElementById('articleSourceSnapshot'),
        articleSourceType: document.getElementById('articleSourceType'),
        articleResetButton: document.getElementById('articleResetButton'),
        newArticleButton: document.getElementById('adminNewArticleButton'),
        sectionList: document.getElementById('sectionList'),
        sectionForm: document.getElementById('sectionForm'),
        sectionFormTitle: document.getElementById('sectionFormTitle'),
        sectionId: document.getElementById('sectionId'),
        sectionOrder: document.getElementById('sectionOrder'),
        sectionTitle: document.getElementById('sectionTitle'),
        sectionDescription: document.getElementById('sectionDescription'),
        sectionStats: document.getElementById('sectionStats'),
        sectionGroups: document.getElementById('sectionGroups'),
        sectionLandingLayout: document.getElementById('sectionLandingLayout'),
        sectionLandingSidebarFacts: document.getElementById('sectionLandingSidebarFacts'),
        sectionLandingBlocks: document.getElementById('sectionLandingBlocks'),
        sectionCatalogColumns: document.getElementById('sectionCatalogColumns'),
        sectionCatalogRows: document.getElementById('sectionCatalogRows'),
        sectionResetButton: document.getElementById('sectionResetButton'),
        newSectionButton: document.getElementById('adminNewSectionButton'),
        siteForm: document.getElementById('siteForm'),
        siteName: document.getElementById('siteName'),
        siteSubtitle: document.getElementById('siteSubtitle'),
        siteSeoDescription: document.getElementById('siteSeoDescription'),
        siteSocialImage: document.getElementById('siteSocialImage'),
        siteSocialImageAlt: document.getElementById('siteSocialImageAlt'),
        siteAds: document.getElementById('siteAds'),
        securityForm: document.getElementById('securityForm'),
        securityUsername: document.getElementById('securityUsername'),
        securityCurrentPassword: document.getElementById('securityCurrentPassword'),
        securityNewPassword: document.getElementById('securityNewPassword'),
        securityConfirmPassword: document.getElementById('securityConfirmPassword'),
        securitySubmitButton: document.querySelector('#securityForm button[type="submit"]'),
        contactsBuilderForm: document.getElementById('contactsBuilderForm'),
        contactsTitle: document.getElementById('contactsTitle'),
        contactsEyebrow: document.getElementById('contactsEyebrow'),
        contactsSummary: document.getElementById('contactsSummary'),
        contactsIntroTitle: document.getElementById('contactsIntroTitle'),
        contactsIntroParagraphs: document.getElementById('contactsIntroParagraphs'),
        contactsTableTitle: document.getElementById('contactsTableTitle'),
        contactsRows: document.getElementById('contactsRows'),
        contactsAddRowButton: document.getElementById('contactsAddRowButton'),
        exportButton: document.getElementById('adminExportButton'),
        importInput: document.getElementById('adminImportInput'),
        resetButton: document.getElementById('adminResetButton'),
        backupInfo: document.getElementById('backupInfo'),
        toast: document.getElementById('adminToast'),
    };

    const ui = {};

    let toastTimer = null;

    const escapeHtml = (value = '') =>
        String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');

    const formatDate = (value) => {
        if (!value) {
            return '--';
        }

        try {
            return new Intl.DateTimeFormat('ru-RU', {
                dateStyle: 'medium',
                timeStyle: 'short',
            }).format(new Date(value));
        } catch (error) {
            return value;
        }
    };

    const formatSize = (value) => {
        const numeric = Number(value);

        if (!Number.isFinite(numeric) || numeric <= 0) {
            return '0 B';
        }

        if (numeric < 1024) {
            return `${numeric} B`;
        }

        if (numeric < 1024 * 1024) {
            return `${(numeric / 1024).toFixed(1)} KB`;
        }

        return `${(numeric / (1024 * 1024)).toFixed(1)} MB`;
    };

    const sortByOrder = (left, right) => {
        const leftOrder = Number.isFinite(Number(left?.order)) ? Number(left.order) : 9999;
        const rightOrder = Number.isFinite(Number(right?.order)) ? Number(right.order) : 9999;

        if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
        }

        return String(left?.title || left?.label || '').localeCompare(String(right?.title || right?.label || ''), 'ru');
    };

    const clampPage = (page, totalPages) => {
        const safeTotal = Math.max(1, Number(totalPages) || 1);
        const numericPage = Number(page) || 1;
        return Math.min(Math.max(1, numericPage), safeTotal);
    };

    const scrollIntoViewX = (container, item) => {
        if (!container || !item || typeof item.scrollIntoView !== 'function') {
            return;
        }

        item.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center',
        });
    };

    const scrollAdminListToTop = (kind) => {
        const target = kind === 'sections' ? elements.sectionList : elements.articleList;

        if (!target || typeof target.scrollIntoView !== 'function') {
            return;
        }

        target.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest',
        });
    };

    const buildAdminPager = ({ kind, currentPage, totalPages, totalItems, pageSize }) => {
        const safeCurrentPage = clampPage(currentPage, totalPages);
        const safeTotalPages = Math.max(1, totalPages || 1);
        const safeTotalItems = Math.max(0, totalItems || 0);
        const start = safeTotalItems ? (safeCurrentPage - 1) * pageSize + 1 : 0;
        const end = safeTotalItems ? Math.min(safeTotalItems, start + pageSize - 1) : 0;

        if (safeTotalPages <= 1) {
            return `
                <div class="admin-pagination admin-pagination--single">
                    <span class="admin-pagination__summary">Показано ${start}-${end} из ${safeTotalItems}</span>
                </div>
            `;
        }

        const pages = [];
        let lastPage = 0;

        for (let page = 1; page <= safeTotalPages; page += 1) {
            const nearCurrent = Math.abs(page - safeCurrentPage) <= 1;
            const isEdge = page === 1 || page === safeTotalPages;

            if (!nearCurrent && !isEdge) {
                continue;
            }

            if (page - lastPage > 1) {
                pages.push('<span class="admin-pagination__gap">…</span>');
            }

            pages.push(`
                <button
                    class="admin-pagination__page ${page === safeCurrentPage ? 'is-active' : ''}"
                    type="button"
                    data-admin-page-kind="${escapeHtml(kind)}"
                    data-admin-page="${page}"
                    ${page === safeCurrentPage ? 'aria-current="page"' : ''}
                >
                    ${page}
                </button>
            `);
            lastPage = page;
        }

        return `
            <div class="admin-pagination">
                <span class="admin-pagination__summary">Показано ${start}-${end} из ${safeTotalItems}</span>
                <div class="admin-pagination__actions">
                    <button
                        class="admin-button admin-button--ghost admin-button--small"
                        type="button"
                        data-admin-page-kind="${escapeHtml(kind)}"
                        data-admin-page-nav="prev"
                        ${safeCurrentPage <= 1 ? 'disabled' : ''}
                    >
                        Назад
                    </button>
                    <div class="admin-pagination__pages" role="navigation" aria-label="Страницы списка">
                        ${pages.join('')}
                    </div>
                    <button
                        class="admin-button admin-button--ghost admin-button--small"
                        type="button"
                        data-admin-page-kind="${escapeHtml(kind)}"
                        data-admin-page-nav="next"
                        ${safeCurrentPage >= safeTotalPages ? 'disabled' : ''}
                    >
                        Вперед
                    </button>
                </div>
            </div>
        `;
    };

    const showToast = (message, type = 'success') => {
        if (!elements.toast) {
            return;
        }

        elements.toast.textContent = message;
        elements.toast.className = `admin-toast is-visible ${type === 'error' ? 'is-error' : 'is-success'}`;

        if (toastTimer) {
            window.clearTimeout(toastTimer);
        }

        toastTimer = window.setTimeout(() => {
            elements.toast.className = 'admin-toast';
        }, 2800);
    };

    const api = async (url, options = {}) => {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {}),
            },
            cache: 'no-store',
            credentials: 'same-origin',
            ...options,
        });

        const text = await response.text();
        let payload = null;

        if (text) {
            try {
                payload = JSON.parse(text);
            } catch (error) {
                payload = text;
            }
        }

        if (response.status === 401) {
            window.location.href = '/admin.html?unauthorized=1';
            throw new Error('Требуется повторный вход в админ-панель.');
        }

        if (!response.ok) {
            const htmlLike = typeof payload === 'string' && /<!doctype html|<html[\s>]/i.test(payload);
            const message =
                (htmlLike &&
                    (response.status === 413
                        ? 'Сервер отклонил слишком большой запрос. Проверьте client_max_body_size в nginx.'
                        : 'Сервер вернул HTML-страницу ошибки. Проверьте права на папку хранения и логи journalctl/nginx.')) ||
                (payload && typeof payload === 'object' && payload.error) ||
                (typeof payload === 'string' && payload) ||
                `Request failed with status ${response.status}`;
            throw new Error(message);
        }

        return payload;
    };

    const parseLines = (value) =>
        String(value || '')
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean);

    const serializeLines = (items = []) =>
        (Array.isArray(items) ? items : [])
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .join('\n');

    const parseMeta = (value) =>
        parseLines(value)
            .map((line) => {
                const parts = line.split('|').map((item) => item.trim());

                if (parts.length < 2) {
                    return null;
                }

                return {
                    label: parts[0],
                    value: parts.slice(1).join(' | '),
                };
            })
            .filter(Boolean);

    const serializeMeta = (items = []) =>
        (Array.isArray(items) ? items : [])
            .map((item) => {
                const label = String(item?.label || '').trim();
                const value = String(item?.value || '').trim();
                return label && value ? `${label} | ${value}` : '';
            })
            .filter(Boolean)
            .join('\n');

    const parseGroups = (value) =>
        parseLines(value)
            .map((line, index) => {
                const parts = line.split('|').map((item) => item.trim());

                if (parts.length < 2) {
                    return null;
                }

                return {
                    id: parts[0],
                    label: parts[1] || parts[0],
                    description: parts.slice(2).join(' | '),
                    order: index,
                };
            })
            .filter(Boolean);

    const serializeGroups = (groups = []) =>
        (Array.isArray(groups) ? groups : [])
            .map((group) => `${group.id} | ${group.label} | ${group.description || ''}`.trim())
            .join('\n');

    const parseRelated = (value) =>
        String(value || '')
            .split(/[\n,]/)
            .map((item) => item.trim())
            .filter(Boolean);

    const normalizeIdLike = (value, fallback = 'item') => {
        const normalized = String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9\u0400-\u04ff]+/g, '-')
            .replace(/^-+|-+$/g, '');

        return normalized || fallback;
    };

    const parseJsonField = (value, fieldName) => {
        const trimmed = String(value || '').trim();

        if (!trimmed) {
            return [];
        }

        try {
            return JSON.parse(trimmed);
        } catch (error) {
            throw new Error(`Поле "${fieldName}" содержит невалидный JSON.`);
        }
    };

    const parseJsonFieldSafe = (value, fallback) => {
        const trimmed = String(value || '').trim();

        if (!trimmed) {
            if (fallback == null) {
                return fallback;
            }

            return Array.isArray(fallback) ? [...fallback] : { ...(fallback || {}) };
        }

        try {
            return JSON.parse(trimmed);
        } catch (error) {
            if (fallback == null) {
                return fallback;
            }

            return Array.isArray(fallback) ? [...fallback] : { ...(fallback || {}) };
        }
    };

    const stringifyJson = (value) => JSON.stringify(value || [], null, 2);

    const buildQuestGuideBlock = (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length) {
            return null;
        }

        return {
            id: 'quest-guide',
            type: 'questGuide',
            title: '',
            ...value,
        };
    };

    const SUPPORTED_CONSTRUCTOR_BLOCK_TYPES = new Set(['prose', 'list', 'steps', 'callout', 'media', 'table']);
    const BLOCK_TYPE_LABELS = {
        prose: 'Текст',
        list: 'Список',
        steps: 'Шаги',
        callout: 'Подсказка',
        media: 'Медиа',
        table: 'Таблица',
        questGuide: 'Квест-гайд',
        html: 'HTML-блок',
        classTree: 'Дерево классов',
        imageMap: 'Карта',
    };
    const AD_SLOT_PRESETS = [
        { id: 'homeHeader', title: 'Главная: верхний баннер' },
        { id: 'homeSidebar', title: 'Главная: боковой блок' },
        { id: 'homeSectionBreak', title: 'Главная: между разделами' },
        { id: 'homeContentBottom', title: 'Главная: низ страницы' },
        { id: 'articleTop', title: 'Статья: верхний баннер' },
        { id: 'articleBottom', title: 'Статья: низ статьи' },
        { id: 'sectionTop', title: 'Раздел: верхний баннер' },
    ];

    const nextBuilderId = (prefix = 'item') => {
        state.builderSeed += 1;
        return `${prefix}-${state.builderSeed}`;
    };

    const createBuilderHost = (sourceElement, className = '') => {
        const field = sourceElement?.closest('.admin-field');

        if (!field) {
            return null;
        }

        const host = document.createElement('div');
        host.className = `admin-builder ${className}`.trim();
        field.appendChild(host);
        sourceElement.classList.add('admin-hidden-source');
        sourceElement.setAttribute('aria-hidden', 'true');
        sourceElement.tabIndex = -1;
        return host;
    };

    const setFieldTitle = (sourceElement, title) => {
        const label = sourceElement?.closest('.admin-field')?.querySelector('span');

        if (label && title) {
            label.textContent = title;
        }
    };

    const createSelectOptions = (options, currentValue) =>
        options
            .map((option) => {
                const value = typeof option === 'string' ? option : option.value;
                const label = typeof option === 'string' ? option : option.label;
                return `<option value="${escapeHtml(value)}"${value === currentValue ? ' selected' : ''}>${escapeHtml(label)}</option>`;
            })
            .join('');

    const moveBuilderItem = (item, direction) => {
        if (!item?.parentElement) {
            return;
        }

        const sibling = direction < 0 ? item.previousElementSibling : item.nextElementSibling;

        if (!sibling) {
            return;
        }

        if (direction < 0) {
            item.parentElement.insertBefore(item, sibling);
            return;
        }

        item.parentElement.insertBefore(sibling, item);
    };

    const parseRawJsonNode = (node) => {
        try {
            return JSON.parse(node?.value || '{}');
        } catch (error) {
            return null;
        }
    };

    const createMediaRowMarkup = (item = {}) => `
        <article class="admin-inline-card" data-builder-item data-media-row>
            <div class="admin-inline-card__actions">
                <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="move-up">Вверх</button>
                <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="move-down">Вниз</button>
                <button class="admin-button admin-button--danger admin-button--small" type="button" data-builder-action="remove-item">Удалить</button>
            </div>
            <div class="admin-form__grid admin-form__grid--two">
                <label class="admin-field">
                    <span>Ссылка на изображение</span>
                    <input type="text" data-media-src value="${escapeHtml(item.src || '')}" placeholder="/assets/img/example.jpg" />
                </label>
                <label class="admin-field">
                    <span>Alt</span>
                    <input type="text" data-media-alt value="${escapeHtml(item.alt || '')}" placeholder="Описание изображения" />
                </label>
            </div>
            <label class="admin-field">
                <span>Подпись</span>
                <input type="text" data-media-caption value="${escapeHtml(item.caption || '')}" placeholder="Подпись под изображением" />
            </label>
        </article>
    `;

    const readMediaRows = (container) =>
        Array.from(container?.querySelectorAll('[data-media-row]') || [])
            .map((row) => ({
                src: String(row.querySelector('[data-media-src]')?.value || '').trim(),
                alt: String(row.querySelector('[data-media-alt]')?.value || '').trim(),
                caption: String(row.querySelector('[data-media-caption]')?.value || '').trim(),
            }))
            .filter((item) => item.src || item.alt || item.caption);

    const createTableColumnMarkup = (column = {}) => `
        <article class="admin-inline-card admin-inline-card--compact" data-builder-item data-table-column>
            <div class="admin-inline-card__actions">
                <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="move-up">Вверх</button>
                <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="move-down">Вниз</button>
                <button class="admin-button admin-button--danger admin-button--small" type="button" data-builder-action="remove-item">Удалить</button>
            </div>
            <div class="admin-form__grid admin-form__grid--two">
                <label class="admin-field">
                    <span>Ключ</span>
                    <input type="text" data-column-key value="${escapeHtml(column.key || '')}" placeholder="name" />
                </label>
                <label class="admin-field">
                    <span>Название колонки</span>
                    <input type="text" data-column-label value="${escapeHtml(column.label || '')}" placeholder="Название" />
                </label>
            </div>
            <div class="admin-form__grid admin-form__grid--two">
                <label class="admin-field">
                    <span>Выравнивание</span>
                    <select data-column-align>
                        ${createSelectOptions(
                            [
                                { value: '', label: 'Обычное' },
                                { value: 'left', label: 'По левому краю' },
                                { value: 'center', label: 'По центру' },
                                { value: 'right', label: 'По правому краю' },
                            ],
                            column.align || ''
                        )}
                    </select>
                </label>
                <label class="admin-field">
                    <span>Ширина</span>
                    <input type="text" data-column-width value="${escapeHtml(column.width || '')}" placeholder="120px или 20%" />
                </label>
            </div>
        </article>
    `;

    const readTableColumns = (container) =>
        Array.from(container?.querySelectorAll('[data-table-column]') || [])
            .map((row, index) => {
                const label = String(row.querySelector('[data-column-label]')?.value || '').trim();

                if (!label) {
                    return null;
                }

                return {
                    key: String(row.querySelector('[data-column-key]')?.value || '').trim() || `column-${index + 1}`,
                    label,
                    align: String(row.querySelector('[data-column-align]')?.value || '').trim(),
                    width: String(row.querySelector('[data-column-width]')?.value || '').trim(),
                };
            })
            .filter(Boolean);

    const createTableCellMarkup = (cell = {}) => `
        <article class="admin-inline-card admin-inline-card--compact" data-builder-item data-table-cell>
            <input type="hidden" data-cell-original-value value="${escapeHtml(cell.value || '')}" />
            <input type="hidden" data-cell-original-href value="${escapeHtml(cell.href || '')}" />
            <input type="hidden" data-cell-original-html value="${escapeHtml(cell.html || '')}" />
            <div class="admin-inline-card__actions">
                <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="move-up">Вверх</button>
                <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="move-down">Вниз</button>
                <button class="admin-button admin-button--danger admin-button--small" type="button" data-builder-action="remove-item">Удалить</button>
            </div>
            <div class="admin-form__grid admin-form__grid--two">
                <label class="admin-field">
                    <span>Текст ячейки</span>
                    <input type="text" data-cell-value value="${escapeHtml(cell.value || '')}" placeholder="Значение" />
                </label>
                <label class="admin-field">
                    <span>Ссылка</span>
                    <input type="text" data-cell-href value="${escapeHtml(cell.href || '')}" placeholder="/pages/article.html?article=..." />
                </label>
            </div>
            ${
                cell.html
                    ? '<p class="admin-builder__note">В этой ячейке есть готовое оформление. Оно сохранится автоматически, пока вы не измените текст или ссылку.</p>'
                    : ''
            }
        </article>
    `;

    const readTableCells = (container) =>
        Array.from(container?.querySelectorAll('[data-table-cell]') || [])
            .map((row) => {
                const value = String(row.querySelector('[data-cell-value]')?.value || '').trim();
                const href = String(row.querySelector('[data-cell-href]')?.value || '').trim();
                const originalValue = String(row.querySelector('[data-cell-original-value]')?.value || '');
                const originalHref = String(row.querySelector('[data-cell-original-href]')?.value || '');
                const originalHtml = String(row.querySelector('[data-cell-original-html]')?.value || '');
                const payload = {};

                if (value || originalHtml) {
                    payload.value = value;
                }

                if (href) {
                    payload.href = href;
                }

                if (originalHtml && value === originalValue && href === originalHref) {
                    payload.html = originalHtml;
                }

                return Object.keys(payload).length ? payload : null;
            })
            .filter(Boolean);

    const createTableRowMarkup = (row = {}) => `
        <article class="admin-builder-card admin-builder-card--nested" data-builder-item data-table-row>
            <input type="hidden" data-row-id value="${escapeHtml(row.id || nextBuilderId('row'))}" />
            <div class="admin-builder__card-head">
                <div>
                    <h4 class="admin-builder__card-title">Строка таблицы</h4>
                </div>
                <div class="admin-inline-card__actions">
                    <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="move-up">Вверх</button>
                    <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="move-down">Вниз</button>
                    <button class="admin-button admin-button--danger admin-button--small" type="button" data-builder-action="remove-item">Удалить</button>
                </div>
            </div>
            <div class="admin-form__grid admin-form__grid--two">
                <label class="admin-field">
                    <span>Название строки</span>
                    <input type="text" data-row-title value="${escapeHtml(row.title || '')}" placeholder="Необязательно" />
                </label>
                <label class="admin-field">
                    <span>Ссылка строки</span>
                    <input type="text" data-row-href value="${escapeHtml(row.href || '')}" placeholder="/pages/article.html?article=..." />
                </label>
            </div>
            <div class="admin-builder__subhead">
                <strong>Ячейки</strong>
                <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="add-table-cell">Добавить ячейку</button>
            </div>
            <div class="admin-builder__stack" data-table-cells>
                ${(row.cells || []).map((cell) => createTableCellMarkup(cell)).join('')}
            </div>
        </article>
    `;

    const readTableRows = (container) =>
        Array.from(container?.querySelectorAll('[data-table-row]') || [])
            .map((row, index) => {
                const cells = readTableCells(row.querySelector('[data-table-cells]'));

                if (!cells.length) {
                    return null;
                }

                const payload = {
                    id: String(row.querySelector('[data-row-id]')?.value || '').trim() || `row-${index + 1}`,
                    cells,
                };
                const title = String(row.querySelector('[data-row-title]')?.value || '').trim();
                const href = String(row.querySelector('[data-row-href]')?.value || '').trim();

                if (title) {
                    payload.title = title;
                }

                if (href) {
                    payload.href = href;
                }

                return payload;
            })
            .filter(Boolean);

    const createQuestSubstepMarkup = (item = {}) => `
        <article class="admin-inline-card admin-inline-card--compact" data-builder-item data-quest-substep>
            <input type="hidden" data-substep-original-text value="${escapeHtml(item.text || '')}" />
            <input type="hidden" data-substep-original-html value="${escapeHtml(item.html || '')}" />
            <div class="admin-inline-card__actions">
                <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="move-up">Вверх</button>
                <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="move-down">Вниз</button>
                <button class="admin-button admin-button--danger admin-button--small" type="button" data-builder-action="remove-item">Удалить</button>
            </div>
            <div class="admin-form__grid admin-form__grid--two">
                <label class="admin-field">
                    <span>Текст</span>
                    <input type="text" data-substep-text value="${escapeHtml(item.text || '')}" placeholder="Blacksmith's Frame - 1 шт." />
                </label>
                <label class="admin-field">
                    <span>Количество</span>
                    <input type="text" data-substep-quantity value="${escapeHtml(item.quantity || '')}" placeholder="1 шт." />
                </label>
            </div>
            <div class="admin-form__grid admin-form__grid--two">
                <label class="admin-field">
                    <span>Иконка</span>
                    <input type="text" data-substep-icon-src value="${escapeHtml(item.iconSrc || '')}" placeholder="/assets/img/item.jpg" />
                </label>
                <label class="admin-field">
                    <span>Alt иконки</span>
                    <input type="text" data-substep-icon-alt value="${escapeHtml(item.iconAlt || '')}" placeholder="Название предмета" />
                </label>
            </div>
        </article>
    `;

    const readQuestSubsteps = (container) =>
        Array.from(container?.querySelectorAll('[data-quest-substep]') || [])
            .map((row) => {
                const text = String(row.querySelector('[data-substep-text]')?.value || '').trim();
                const quantity = String(row.querySelector('[data-substep-quantity]')?.value || '').trim();
                const iconSrc = String(row.querySelector('[data-substep-icon-src]')?.value || '').trim();
                const iconAlt = String(row.querySelector('[data-substep-icon-alt]')?.value || '').trim();
                const originalText = String(row.querySelector('[data-substep-original-text]')?.value || '');
                const originalHtml = String(row.querySelector('[data-substep-original-html]')?.value || '');

                if (!text && !quantity && !iconSrc && !iconAlt && !originalHtml) {
                    return null;
                }

                return {
                    text,
                    quantity,
                    iconSrc,
                    iconAlt,
                    ...(originalHtml && text === originalText ? { html: originalHtml } : {}),
                };
            })
            .filter(Boolean);

    const createQuestEntryMarkup = (item = {}, allowSubsteps = false) => `
        <article class="admin-builder-card admin-builder-card--nested" data-builder-item data-quest-entry>
            <input type="hidden" data-entry-original-text value="${escapeHtml(item.text || '')}" />
            <input type="hidden" data-entry-original-html value="${escapeHtml(item.html || '')}" />
            <div class="admin-builder__card-head">
                <div>
                    <h4 class="admin-builder__card-title">Элемент гайда</h4>
                </div>
                <div class="admin-inline-card__actions">
                    <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="move-up">Вверх</button>
                    <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="move-down">Вниз</button>
                    <button class="admin-button admin-button--danger admin-button--small" type="button" data-builder-action="remove-item">Удалить</button>
                </div>
            </div>
            <label class="admin-field">
                <span>Основной текст</span>
                <textarea rows="3" data-entry-text placeholder="Описание шага или награды">${escapeHtml(item.text || '')}</textarea>
            </label>
            <div class="admin-form__grid admin-form__grid--two">
                <label class="admin-field">
                    <span>NPC</span>
                    <input type="text" data-entry-npc value="${escapeHtml(item.npc || '')}" placeholder="Blacksmith Pushkin" />
                </label>
                <label class="admin-field">
                    <span>Локация</span>
                    <input type="text" data-entry-location value="${escapeHtml(item.location || '')}" placeholder="Town of Giran" />
                </label>
            </div>
            <div class="admin-form__grid admin-form__grid--two">
                <label class="admin-field">
                    <span>Количество</span>
                    <input type="text" data-entry-quantity value="${escapeHtml(item.quantity || '')}" placeholder="1 шт." />
                </label>
                <label class="admin-field">
                    <span>Короткая награда</span>
                    <input type="text" data-entry-reward value="${escapeHtml(item.rewardPreview || '')}" placeholder="EXP, SP, адена" />
                </label>
            </div>
            <div class="admin-form__grid admin-form__grid--two">
                <label class="admin-field">
                    <span>Иконка</span>
                    <input type="text" data-entry-icon-src value="${escapeHtml(item.iconSrc || '')}" placeholder="/assets/img/item.jpg" />
                </label>
                <label class="admin-field">
                    <span>Alt иконки</span>
                    <input type="text" data-entry-icon-alt value="${escapeHtml(item.iconAlt || '')}" placeholder="Название предмета" />
                </label>
            </div>
            ${
                allowSubsteps
                    ? `
                        <div class="admin-builder__subhead">
                            <strong>Подшаги / список предметов</strong>
                            <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="add-quest-substep">Добавить подшаг</button>
                        </div>
                        <div class="admin-builder__stack" data-quest-substeps>
                            ${(item.substeps || []).map((substep) => createQuestSubstepMarkup(substep)).join('')}
                        </div>
                    `
                    : ''
            }
            ${
                item.html
                    ? '<p class="admin-builder__note">Готовое оформление сохранится автоматически, пока вы не измените основной текст.</p>'
                    : ''
            }
        </article>
    `;

    const readQuestEntries = (container, allowSubsteps = false) =>
        Array.from(container?.querySelectorAll('[data-quest-entry]') || [])
            .map((row) => {
                const text = String(row.querySelector('[data-entry-text]')?.value || '').trim();
                const npc = String(row.querySelector('[data-entry-npc]')?.value || '').trim();
                const location = String(row.querySelector('[data-entry-location]')?.value || '').trim();
                const quantity = String(row.querySelector('[data-entry-quantity]')?.value || '').trim();
                const rewardPreview = String(row.querySelector('[data-entry-reward]')?.value || '').trim();
                const iconSrc = String(row.querySelector('[data-entry-icon-src]')?.value || '').trim();
                const iconAlt = String(row.querySelector('[data-entry-icon-alt]')?.value || '').trim();
                const originalText = String(row.querySelector('[data-entry-original-text]')?.value || '');
                const originalHtml = String(row.querySelector('[data-entry-original-html]')?.value || '');
                const substeps = allowSubsteps ? readQuestSubsteps(row.querySelector('[data-quest-substeps]')) : [];

                if (!text && !npc && !location && !quantity && !rewardPreview && !iconSrc && !iconAlt && !substeps.length && !originalHtml) {
                    return null;
                }

                return {
                    text,
                    npc,
                    location,
                    quantity,
                    rewardPreview,
                    iconSrc,
                    iconAlt,
                    ...(allowSubsteps && substeps.length ? { substeps } : {}),
                    ...(originalHtml && text === originalText ? { html: originalHtml } : {}),
                };
            })
            .filter(Boolean);

    const createBlockCardMarkup = (block = {}) => {
        const type = block.type || 'prose';
        const blockId = block.id || nextBuilderId(type);

        if (!SUPPORTED_CONSTRUCTOR_BLOCK_TYPES.has(type)) {
            return `
                <article class="admin-builder-card" data-builder-item data-block-card data-block-type="${escapeHtml(type)}" data-block-readonly="true">
                    <textarea hidden data-block-raw>${escapeHtml(JSON.stringify(block))}</textarea>
                    <div class="admin-builder__card-head">
                        <div>
                            <h4 class="admin-builder__card-title">${escapeHtml(BLOCK_TYPE_LABELS[type] || type)}</h4>
                            <p class="admin-builder__note">Этот тип блока пока оставлен в безопасном режиме. Он сохранится без потерь, даже если вы редактируете другие части статьи.</p>
                        </div>
                        <div class="admin-inline-card__actions">
                            <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="move-up">Вверх</button>
                            <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="move-down">Вниз</button>
                            <button class="admin-button admin-button--danger admin-button--small" type="button" data-builder-action="remove-item">Удалить</button>
                        </div>
                    </div>
                    <div class="admin-builder__intro">
                        <strong>Безопасный режим сохранения</strong>
                        <p>Этот редкий тип блока пока не редактируется через конструктор, но сохранится без потерь и не сломает страницу.</p>
                    </div>
                </article>
            `;
        }

        let body = '';

        if (type === 'prose') {
            body = `
                <label class="admin-field">
                    <span>Заголовок блока</span>
                    <input type="text" data-block-title value="${escapeHtml(block.title || '')}" placeholder="Введение" />
                </label>
                <label class="admin-field">
                    <span>Абзацы</span>
                    <textarea rows="6" data-block-paragraphs placeholder="Каждая строка станет отдельным абзацем.">${escapeHtml(serializeLines(block.paragraphs || []))}</textarea>
                </label>
            `;
        }

        if (type === 'list' || type === 'steps') {
            body = `
                <div class="admin-form__grid admin-form__grid--two">
                    <label class="admin-field">
                        <span>Заголовок блока</span>
                        <input type="text" data-block-title value="${escapeHtml(block.title || '')}" placeholder="Полезный список" />
                    </label>
                    ${
                        type === 'list'
                            ? `
                                <label class="admin-field">
                                    <span>Стиль списка</span>
                                    <select data-block-style>
                                        ${createSelectOptions(
                                            [
                                                { value: 'unordered', label: 'Обычный список' },
                                                { value: 'check', label: 'Чек-лист' },
                                            ],
                                            block.style || 'unordered'
                                        )}
                                    </select>
                                </label>
                            `
                            : '<div></div>'
                    }
                </div>
                <label class="admin-field">
                    <span>Пункты</span>
                    <textarea rows="6" data-block-items placeholder="Каждая строка станет отдельным пунктом.">${escapeHtml(serializeLines(block.items || []))}</textarea>
                </label>
            `;
        }

        if (type === 'callout') {
            body = `
                <div class="admin-form__grid admin-form__grid--two">
                    <label class="admin-field">
                        <span>Заголовок блока</span>
                        <input type="text" data-block-title value="${escapeHtml(block.title || '')}" placeholder="Важно" />
                    </label>
                    <label class="admin-field">
                        <span>Тип подсказки</span>
                        <select data-block-tone>
                            ${createSelectOptions(
                                [
                                    { value: 'info', label: 'Информация' },
                                    { value: 'success', label: 'Успех' },
                                    { value: 'warning', label: 'Предупреждение' },
                                    { value: 'danger', label: 'Опасно' },
                                ],
                                block.tone || 'info'
                            )}
                        </select>
                    </label>
                </div>
                <label class="admin-field">
                    <span>Главный текст</span>
                    <textarea rows="3" data-block-text placeholder="Короткая важная мысль">${escapeHtml(block.text || '')}</textarea>
                </label>
                <label class="admin-field">
                    <span>Дополнительные пункты</span>
                    <textarea rows="5" data-block-items placeholder="Каждая строка станет отдельным пунктом.">${escapeHtml(serializeLines(block.items || []))}</textarea>
                </label>
            `;
        }

        if (type === 'media') {
            body = `
                <label class="admin-field">
                    <span>Заголовок блока</span>
                    <input type="text" data-block-title value="${escapeHtml(block.title || '')}" placeholder="Галерея" />
                </label>
                <div class="admin-builder__subhead">
                    <strong>Изображения</strong>
                    <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="add-media-item">Добавить изображение</button>
                </div>
                <div class="admin-builder__stack" data-media-rows>
                    ${(block.items || []).map((item) => createMediaRowMarkup(item)).join('')}
                </div>
            `;
        }

        if (type === 'table') {
            body = `
                <div class="admin-form__grid admin-form__grid--two">
                    <label class="admin-field">
                        <span>Заголовок блока</span>
                        <input type="text" data-block-title value="${escapeHtml(block.title || '')}" placeholder="Таблица" />
                    </label>
                    <label class="admin-checkbox">
                        <input type="checkbox" data-block-compact ${block.compact ? 'checked' : ''} />
                        <span>Компактная таблица</span>
                    </label>
                </div>
                <div class="admin-builder__subhead">
                    <strong>Колонки</strong>
                    <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="add-table-column">Добавить колонку</button>
                </div>
                <div class="admin-builder__stack" data-table-columns>
                    ${(block.columns || []).map((column) => createTableColumnMarkup(column)).join('')}
                </div>
                <div class="admin-builder__subhead">
                    <strong>Строки</strong>
                    <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="add-table-row">Добавить строку</button>
                </div>
                <div class="admin-builder__stack" data-table-rows>
                    ${(block.rows || []).map((row) => createTableRowMarkup(row)).join('')}
                </div>
            `;
        }

        return `
            <article class="admin-builder-card" data-builder-item data-block-card data-block-type="${escapeHtml(type)}">
                <input type="hidden" data-block-id value="${escapeHtml(blockId)}" />
                <div class="admin-builder__card-head">
                    <div>
                        <h4 class="admin-builder__card-title">${escapeHtml(BLOCK_TYPE_LABELS[type] || type)}</h4>
                    </div>
                    <div class="admin-inline-card__actions">
                        <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="move-up">Вверх</button>
                        <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="move-down">Вниз</button>
                        <button class="admin-button admin-button--danger admin-button--small" type="button" data-builder-action="remove-item">Удалить</button>
                    </div>
                </div>
                ${body}
            </article>
        `;
    };

    const readBlockCollection = (host) =>
        Array.from(host?.querySelectorAll('[data-block-card]') || [])
            .map((card, index) => {
                if (card.dataset.blockReadonly === 'true') {
                    return parseRawJsonNode(card.querySelector('[data-block-raw]'));
                }

                const type = card.dataset.blockType || 'prose';
                const blockId = String(card.querySelector('[data-block-id]')?.value || '').trim() || `${type}-${index + 1}`;
                const title = String(card.querySelector('[data-block-title]')?.value || '').trim();
                const payload = {
                    id: blockId,
                    type,
                };

                if (title) {
                    payload.title = title;
                }

                if (type === 'prose') {
                    payload.paragraphs = parseLines(card.querySelector('[data-block-paragraphs]')?.value || '');
                }

                if (type === 'list' || type === 'steps') {
                    payload.items = parseLines(card.querySelector('[data-block-items]')?.value || '');
                    if (type === 'list') {
                        payload.style = String(card.querySelector('[data-block-style]')?.value || 'unordered').trim() || 'unordered';
                    }
                }

                if (type === 'callout') {
                    payload.tone = String(card.querySelector('[data-block-tone]')?.value || 'info').trim() || 'info';
                    payload.text = String(card.querySelector('[data-block-text]')?.value || '').trim();
                    payload.items = parseLines(card.querySelector('[data-block-items]')?.value || '');
                }

                if (type === 'media') {
                    payload.items = readMediaRows(card.querySelector('[data-media-rows]'));
                }

                if (type === 'table') {
                    payload.compact = Boolean(card.querySelector('[data-block-compact]')?.checked);
                    payload.columns = readTableColumns(card.querySelector('[data-table-columns]'));
                    payload.rows = readTableRows(card.querySelector('[data-table-rows]'));
                }

                return payload;
            })
            .filter(Boolean);

    const renderBlockCollectionBuilder = (host, blocks = [], titleText = 'Конструктор блоков') => {
        if (!host) {
            return;
        }

        host.innerHTML = `
            <div class="admin-builder__intro">
                <strong>${escapeHtml(titleText)}</strong>
                <p>Здесь больше не нужен JSON. Добавляйте обычные блоки как карточки.</p>
            </div>
            <div class="admin-builder__toolbar">
                <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="add-block" data-block-template="prose">Текст</button>
                <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="add-block" data-block-template="list">Список</button>
                <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="add-block" data-block-template="steps">Шаги</button>
                <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="add-block" data-block-template="callout">Подсказка</button>
                <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="add-block" data-block-template="media">Медиа</button>
                <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="add-block" data-block-template="table">Таблица</button>
            </div>
            <div class="admin-builder__stack" data-block-list>
                ${blocks.map((block) => createBlockCardMarkup(block)).join('')}
            </div>
        `;
    };

    const renderQuestGuideBuilder = (host, block) => {
        if (!host) {
            return;
        }

        const enabled = Boolean(block);
        const guide = block || {};

        host.innerHTML = `
            <div class="admin-builder__intro">
                <strong>Конструктор квест-гайда</strong>
                <p>Вместо JSON вы управляете шагами, подготовкой и наградами через обычные поля.</p>
            </div>
            <label class="admin-checkbox">
                <input type="checkbox" data-quest-enabled ${enabled ? 'checked' : ''} />
                <span>Использовать подробный квест-гайд</span>
            </label>
            <div data-quest-body ${enabled ? '' : 'hidden'}>
                <div class="admin-builder__subhead">
                    <strong>Главные изображения</strong>
                    <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="add-media-item" data-builder-scope="quest-media">Добавить изображение</button>
                </div>
                <div class="admin-builder__stack" data-quest-media>
                    ${(guide.heroMedia || []).map((item) => createMediaRowMarkup(item)).join('')}
                </div>

                <label class="admin-field">
                    <span>Абзацы вступления</span>
                    <textarea rows="5" data-quest-overview placeholder="Каждая строка станет отдельным абзацем.">${escapeHtml(serializeLines(guide.overviewParagraphs || []))}</textarea>
                </label>

                <div class="admin-builder__subhead">
                    <strong>Что подготовить</strong>
                    <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="add-quest-entry" data-quest-target="prep">Добавить пункт</button>
                </div>
                <div class="admin-builder__stack" data-quest-prep>
                    ${(guide.prepItems || []).map((item) => createQuestEntryMarkup(item, false)).join('')}
                </div>

                <div class="admin-builder__subhead">
                    <strong>Шаги</strong>
                    <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="add-quest-entry" data-quest-target="steps">Добавить шаг</button>
                </div>
                <div class="admin-builder__stack" data-quest-steps>
                    ${(guide.steps || []).map((item) => createQuestEntryMarkup(item, true)).join('')}
                </div>

                <div class="admin-builder__subhead">
                    <strong>Награды</strong>
                    <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="add-quest-entry" data-quest-target="rewards">Добавить награду</button>
                </div>
                <div class="admin-builder__stack" data-quest-rewards>
                    ${(guide.rewards || []).map((item) => createQuestEntryMarkup(item, false)).join('')}
                </div>

                <label class="admin-field">
                    <span>Полезные заметки</span>
                    <textarea rows="4" data-quest-notes placeholder="Каждая строка станет отдельной заметкой.">${escapeHtml(serializeLines(guide.notes || []))}</textarea>
                </label>

                <label class="admin-field">
                    <span>Связанные ID квестов</span>
                    <textarea rows="4" data-quest-related placeholder="Каждая строка — отдельный ID.">${escapeHtml(serializeLines(guide.relatedQuestIds || []))}</textarea>
                </label>
            </div>
        `;
    };

    const readQuestGuideBuilder = (host) => {
        if (!host?.querySelector('[data-quest-enabled]')?.checked) {
            return null;
        }

        return buildQuestGuideBlock({
            heroMedia: readMediaRows(host.querySelector('[data-quest-media]')),
            overviewParagraphs: parseLines(host.querySelector('[data-quest-overview]')?.value || ''),
            prepItems: readQuestEntries(host.querySelector('[data-quest-prep]'), false),
            steps: readQuestEntries(host.querySelector('[data-quest-steps]'), true),
            rewards: readQuestEntries(host.querySelector('[data-quest-rewards]'), false),
            notes: parseLines(host.querySelector('[data-quest-notes]')?.value || ''),
            relatedQuestIds: parseLines(host.querySelector('[data-quest-related]')?.value || ''),
        });
    };

    const renderCatalogConstructors = (columns = [], rows = []) => {
        if (ui.sectionCatalogColumnsBuilder) {
            ui.sectionCatalogColumnsBuilder.innerHTML = `
                <div class="admin-builder__intro">
                    <strong>Конструктор колонок каталога</strong>
                    <p>Настройте названия и порядок колонок без JSON.</p>
                </div>
                <div class="admin-builder__toolbar">
                    <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="add-table-column">Добавить колонку</button>
                </div>
                <div class="admin-builder__stack" data-table-columns>
                    ${columns.map((column) => createTableColumnMarkup(column)).join('')}
                </div>
            `;
        }

        if (ui.sectionCatalogRowsBuilder) {
            ui.sectionCatalogRowsBuilder.innerHTML = `
                <div class="admin-builder__intro">
                    <strong>Конструктор строк каталога</strong>
                    <p>Каждая строка собирается из обычных ячеек.</p>
                </div>
                <div class="admin-builder__toolbar">
                    <button class="admin-button admin-button--ghost admin-button--small" type="button" data-builder-action="add-table-row">Добавить строку</button>
                </div>
                <div class="admin-builder__stack" data-table-rows>
                    ${rows.map((row) => createTableRowMarkup(row)).join('')}
                </div>
            `;
        }
    };

    const renderAdsBuilder = (ads = {}) => {
        if (!ui.siteAdsBuilder) {
            return;
        }

        const slotIds = Array.from(new Set([...AD_SLOT_PRESETS.map((slot) => slot.id), ...Object.keys(ads || {})]));

        ui.siteAdsBuilder.innerHTML = `
            <div class="admin-builder__intro">
                <strong>Конструктор рекламных блоков</strong>
                <p>Теперь баннеры и подписи редактируются по-человечески, без JSON.</p>
            </div>
            <div class="admin-builder__stack">
                ${slotIds
                    .map((slotId) => {
                        const preset = AD_SLOT_PRESETS.find((slot) => slot.id === slotId);
                        const slot = ads?.[slotId] || {};
                        return `
                            <article class="admin-builder-card">
                                <input type="hidden" data-ad-slot-id value="${escapeHtml(slotId)}" />
                                <input type="hidden" data-ad-original-html value="${escapeHtml(slot.html || '')}" />
                                <input type="hidden" data-ad-original-text value="${escapeHtml(slot.text || '')}" />
                                <input type="hidden" data-ad-original-image-src value="${escapeHtml(slot.imageSrc || '')}" />
                                <input type="hidden" data-ad-original-image-alt value="${escapeHtml(slot.imageAlt || '')}" />
                                <input type="hidden" data-ad-original-href value="${escapeHtml(slot.href || '')}" />
                                <div class="admin-builder__card-head">
                                    <div>
                                        <h4 class="admin-builder__card-title">${escapeHtml(preset?.title || slotId)}</h4>
                                    </div>
                                    <label class="admin-checkbox">
                                        <input type="checkbox" data-ad-enabled ${slot.enabled !== false ? 'checked' : ''} />
                                        <span>Показывать блок</span>
                                    </label>
                                </div>
                                <label class="admin-field">
                                    <span>Служебная подпись</span>
                                    <input type="text" data-ad-label value="${escapeHtml(slot.label || '')}" placeholder="Рекламный блок" />
                                </label>
                                <label class="admin-field">
                                    <span>Текст внутри блока</span>
                                    <textarea rows="3" data-ad-text placeholder="Короткий текст или подпись баннера.">${escapeHtml(slot.text || '')}</textarea>
                                </label>
                                <div class="admin-form__grid admin-form__grid--two">
                                    <label class="admin-field">
                                        <span>Картинка</span>
                                        <input type="text" data-ad-image-src value="${escapeHtml(slot.imageSrc || '')}" placeholder="/assets/img/ad.jpg" />
                                    </label>
                                    <label class="admin-field">
                                        <span>Alt картинки</span>
                                        <input type="text" data-ad-image-alt value="${escapeHtml(slot.imageAlt || '')}" placeholder="Реклама" />
                                    </label>
                                </div>
                                <label class="admin-field">
                                    <span>Ссылка</span>
                                    <input type="text" data-ad-href value="${escapeHtml(slot.href || '')}" placeholder="https://example.com" />
                                </label>
                                ${
                                    slot.html
                                        ? '<p class="admin-builder__note">В этом слоте уже был кастомный HTML. Он сохранится автоматически, пока вы не измените содержимое блока через конструктор.</p>'
                                        : ''
                                }
                            </article>
                        `;
                    })
                    .join('')}
            </div>
        `;
    };

    const readAdsBuilder = () =>
        Object.fromEntries(
            Array.from(ui.siteAdsBuilder?.querySelectorAll('[data-ad-slot-id]') || []).map((card) => {
                const slotId = String(card.querySelector('[data-ad-slot-id]')?.value || '').trim();
                const enabled = Boolean(card.querySelector('[data-ad-enabled]')?.checked);
                const label = String(card.querySelector('[data-ad-label]')?.value || '').trim();
                const text = String(card.querySelector('[data-ad-text]')?.value || '').trim();
                const imageSrc = String(card.querySelector('[data-ad-image-src]')?.value || '').trim();
                const imageAlt = String(card.querySelector('[data-ad-image-alt]')?.value || '').trim();
                const href = String(card.querySelector('[data-ad-href]')?.value || '').trim();
                const originalText = String(card.querySelector('[data-ad-original-text]')?.value || '');
                const originalImageSrc = String(card.querySelector('[data-ad-original-image-src]')?.value || '');
                const originalImageAlt = String(card.querySelector('[data-ad-original-image-alt]')?.value || '');
                const originalHref = String(card.querySelector('[data-ad-original-href]')?.value || '');
                const originalHtml = String(card.querySelector('[data-ad-original-html]')?.value || '');

                return [
                    slotId,
                    {
                        enabled,
                        label,
                        text,
                        imageSrc,
                        imageAlt,
                        href,
                        ...(originalHtml &&
                        text === originalText &&
                        imageSrc === originalImageSrc &&
                        imageAlt === originalImageAlt &&
                        href === originalHref
                            ? { html: originalHtml }
                            : {}),
                    },
                ];
            })
        );

    const renderArticleConstructors = () => {
        renderBlockCollectionBuilder(
            ui.articleBlocksBuilder,
            parseJsonFieldSafe(elements.articleBlocks.value, []).filter((block) => block?.type !== 'questGuide'),
            'Конструктор контента статьи'
        );
        renderQuestGuideBuilder(ui.articleQuestGuideBuilder, parseJsonFieldSafe(elements.articleQuestGuide.value, null));
    };

    const renderSectionConstructors = () => {
        renderBlockCollectionBuilder(
            ui.sectionLandingBlocksBuilder,
            parseJsonFieldSafe(elements.sectionLandingBlocks.value, []),
            'Конструктор landing-блоков'
        );
        renderCatalogConstructors(
            parseJsonFieldSafe(elements.sectionCatalogColumns.value, []),
            parseJsonFieldSafe(elements.sectionCatalogRows.value, [])
        );
    };

    const syncArticleConstructorsToSources = () => {
        elements.articleBlocks.value = stringifyJson(readBlockCollection(ui.articleBlocksBuilder));
        const questGuide = readQuestGuideBuilder(ui.articleQuestGuideBuilder);
        elements.articleQuestGuide.value = questGuide ? stringifyJson(questGuide) : '';
    };

    const syncSectionConstructorsToSources = () => {
        elements.sectionLandingBlocks.value = stringifyJson(readBlockCollection(ui.sectionLandingBlocksBuilder));
        elements.sectionCatalogColumns.value = stringifyJson(readTableColumns(ui.sectionCatalogColumnsBuilder?.querySelector('[data-table-columns]')));
        elements.sectionCatalogRows.value = stringifyJson(readTableRows(ui.sectionCatalogRowsBuilder?.querySelector('[data-table-rows]')));
    };

    const syncSiteConstructorToSource = () => {
        elements.siteAds.value = stringifyJson(readAdsBuilder());
    };

    const initializeConstructors = () => {
        if (ui.initialized) {
            return;
        }

        ui.initialized = true;
        const articleMetaLabel = elements.articleFormTitle?.closest('.admin-card__head')?.querySelector('.admin-card__meta');
        const sectionMetaLabel = elements.sectionFormTitle?.closest('.admin-card__head')?.querySelector('.admin-card__meta');

        if (articleMetaLabel) {
            articleMetaLabel.textContent = 'Теперь контент собирается через обычные поля, карточки и таблицы без JSON.';
        }

        if (sectionMetaLabel) {
            sectionMetaLabel.textContent = 'Раздел, landing и каталог теперь настраиваются через конструкторы, а не через код.';
        }

        setFieldTitle(elements.articleBlocks, 'Конструктор блоков');
        setFieldTitle(elements.articleQuestGuide, 'Конструктор квест-гайда');
        setFieldTitle(elements.sectionLandingBlocks, 'Конструктор landing-блоков');
        setFieldTitle(elements.sectionCatalogColumns, 'Конструктор колонок');
        setFieldTitle(elements.sectionCatalogRows, 'Конструктор строк каталога');
        setFieldTitle(elements.siteAds, 'Конструктор рекламных блоков');
        ui.articleBlocksBuilder = createBuilderHost(elements.articleBlocks, 'admin-builder--block-editor');
        ui.articleQuestGuideBuilder = createBuilderHost(elements.articleQuestGuide, 'admin-builder--quest-editor');
        ui.sectionLandingBlocksBuilder = createBuilderHost(elements.sectionLandingBlocks, 'admin-builder--block-editor');
        ui.sectionCatalogColumnsBuilder = createBuilderHost(elements.sectionCatalogColumns, 'admin-builder--table-editor');
        ui.sectionCatalogRowsBuilder = createBuilderHost(elements.sectionCatalogRows, 'admin-builder--table-editor');
        ui.siteAdsBuilder = createBuilderHost(elements.siteAds, 'admin-builder--ads-editor');

        renderArticleConstructors();
        renderSectionConstructors();
        renderAdsBuilder(parseJsonFieldSafe(elements.siteAds.value, {}));
    };

    const createContactRowMarkup = (row = {}, index = 0) => `
        <article class="admin-contact-row" data-contact-row data-row-key="${escapeHtml(row.key || `contact-${index + 1}`)}">
            <div class="admin-contact-row__head">
                <h4 class="admin-contact-row__title">Канал ${index + 1}</h4>
                <button class="admin-button admin-button--ghost admin-button--small" type="button" data-remove-contact-row>Удалить</button>
            </div>
            <div class="admin-form__grid admin-form__grid--two">
                <label class="admin-field">
                    <span>Направление</span>
                    <input type="text" data-contact-field="direction" value="${escapeHtml(row.direction || '')}" placeholder="Поддержка" />
                </label>
                <label class="admin-field">
                    <span>Контакт</span>
                    <input type="text" data-contact-field="person" value="${escapeHtml(row.person || '')}" placeholder="Администратор сайта" />
                </label>
            </div>
            <div class="admin-form__grid admin-form__grid--two">
                <label class="admin-field">
                    <span>Подпись кнопки / ссылки</span>
                    <input type="text" data-contact-field="channel" value="${escapeHtml(row.channel || '')}" placeholder="contact@site.ru" />
                </label>
                <label class="admin-field">
                    <span>Ссылка</span>
                    <input type="text" data-contact-field="href" value="${escapeHtml(row.href || '')}" placeholder="mailto:contact@site.ru или https://t.me/..." />
                </label>
            </div>
            <label class="admin-field">
                <span>Комментарий</span>
                <textarea rows="3" data-contact-field="note" placeholder="Короткое пояснение для этого канала.">${escapeHtml(row.note || '')}</textarea>
            </label>
        </article>
    `;

    const getDefaultContactsArticle = () => ({
        id: 'contacts',
        section: 'misc',
        group: 'contacts',
        title: 'Контакты',
        eyebrow: 'Контакты',
        summary: 'Свяжитесь с нами по вопросам контента, правок, технических ошибок и сотрудничества.',
        order: 0,
        layout: 'contacts-page',
        aliases: ['contact', 'contacts-page', 'svyaz'],
        blocks: [
            {
                id: 'contacts-intro',
                type: 'prose',
                title: 'Связь с нами',
                paragraphs: [
                    'Выберите удобный канал связи и напишите нам по вопросам контента, правок, сотрудничества или технических ошибок на сайте.',
                    'Все карточки ниже можно менять прямо из отдельного конструктора в админ-панели.',
                ],
            },
            {
                id: 'contacts-table',
                type: 'table',
                title: 'Каналы связи',
                columns: [
                    { key: 'direction', label: 'Направление' },
                    { key: 'person', label: 'Контакт' },
                    { key: 'channel', label: 'Канал связи' },
                    { key: 'note', label: 'Комментарий' },
                ],
                rows: [
                    {
                        id: 'contacts-support-email',
                        cells: [
                            { value: 'Поддержка' },
                            { value: 'Администратор сайта' },
                            { value: 'contact@lwiki.su', href: 'mailto:contact@lwiki.su' },
                            { value: 'Вопросы по ошибкам, контенту и наполнению страниц' },
                        ],
                    },
                    {
                        id: 'contacts-telegram',
                        cells: [
                            { value: 'Telegram' },
                            { value: 'L2Wiki Support' },
                            { value: 'https://t.me/lwiki_support', href: 'https://t.me/lwiki_support' },
                            { value: 'Быстрая связь по текущим вопросам и согласованиям' },
                        ],
                    },
                ],
                compact: false,
            },
        ],
    });

    const parseContactsArticle = (article) => {
        const source = article || getDefaultContactsArticle();
        const introBlock = (source.blocks || []).find((block) => block?.id === 'contacts-intro' || block?.type === 'prose');
        const tableBlock = (source.blocks || []).find((block) => block?.id === 'contacts-table' || block?.type === 'table');

        return {
            title: source.title || 'Контакты',
            eyebrow: source.eyebrow || 'Контакты',
            summary: source.summary || '',
            introTitle: introBlock?.title || 'Связь с нами',
            introParagraphs: Array.isArray(introBlock?.paragraphs) ? introBlock.paragraphs : [],
            tableTitle: tableBlock?.title || 'Каналы связи',
            rows: (tableBlock?.rows || []).map((row, index) => ({
                key: row.id || `contact-${index + 1}`,
                direction: row?.cells?.[0]?.value || '',
                person: row?.cells?.[1]?.value || '',
                channel: row?.cells?.[2]?.value || '',
                href: row?.cells?.[2]?.href || '',
                note: row?.cells?.[3]?.value || '',
            })),
        };
    };

    const renderContactsRows = (rows = []) => {
        if (!elements.contactsRows) {
            return;
        }

        const safeRows = rows.length ? rows : [{ key: `contact-${++state.contactsRowSeed}` }];
        elements.contactsRows.innerHTML = safeRows.map((row, index) => createContactRowMarkup(row, index)).join('');
        renumberContactRows();
    };

    const renumberContactRows = () => {
        if (!elements.contactsRows) {
            return;
        }

        Array.from(elements.contactsRows.querySelectorAll('[data-contact-row]')).forEach((row, index) => {
            const title = row.querySelector('.admin-contact-row__title');

            if (title) {
                title.textContent = `Канал ${index + 1}`;
            }
        });
    };

    const appendContactsRow = (row = {}) => {
        if (!elements.contactsRows) {
            return;
        }

        state.contactsRowSeed += 1;
        elements.contactsRows.insertAdjacentHTML(
            'beforeend',
            createContactRowMarkup(
                {
                    key: row.key || `contact-${state.contactsRowSeed}`,
                    direction: row.direction || '',
                    person: row.person || '',
                    channel: row.channel || '',
                    href: row.href || '',
                    note: row.note || '',
                },
                elements.contactsRows.querySelectorAll('[data-contact-row]').length
            )
        );
        renumberContactRows();
    };

    const fillContactsBuilder = () => {
        if (!elements.contactsBuilderForm) {
            return;
        }

        const parsed = parseContactsArticle(getDatabase().articles?.contacts);
        elements.contactsTitle.value = parsed.title;
        elements.contactsEyebrow.value = parsed.eyebrow;
        elements.contactsSummary.value = parsed.summary;
        elements.contactsIntroTitle.value = parsed.introTitle;
        elements.contactsIntroParagraphs.value = serializeLines(parsed.introParagraphs);
        elements.contactsTableTitle.value = parsed.tableTitle;
        state.contactsRowSeed = Math.max(state.contactsRowSeed, parsed.rows.length);
        renderContactsRows(parsed.rows);
    };

    const readContactsBuilder = () => {
        const rows = Array.from(elements.contactsRows?.querySelectorAll('[data-contact-row]') || [])
            .map((row, index) => {
                const readField = (name) => row.querySelector(`[data-contact-field="${name}"]`)?.value?.trim() || '';
                return {
                    key: row.dataset.rowKey || `contact-${index + 1}`,
                    direction: readField('direction'),
                    person: readField('person'),
                    channel: readField('channel'),
                    href: readField('href'),
                    note: readField('note'),
                };
            })
            .filter((row) => row.direction || row.person || row.channel || row.href || row.note);

        if (!rows.length) {
            throw new Error('Добавьте хотя бы один канал связи для страницы контактов.');
        }

        const title = String(elements.contactsTitle?.value || '').trim() || 'Контакты';
        const eyebrow = String(elements.contactsEyebrow?.value || '').trim() || 'Контакты';
        const summary = String(elements.contactsSummary?.value || '').trim();
        const introTitle = String(elements.contactsIntroTitle?.value || '').trim() || 'Связь с нами';
        const introParagraphs = parseLines(elements.contactsIntroParagraphs?.value || '');
        const tableTitle = String(elements.contactsTableTitle?.value || '').trim() || 'Каналы связи';

        return {
            id: 'contacts',
            section: 'misc',
            group: 'contacts',
            title,
            eyebrow,
            summary,
            order: 0,
            layout: 'contacts-page',
            aliases: ['contact', 'contacts-page', 'svyaz'],
            meta: [],
            intro: [],
            checklist: [],
            steps: [],
            rewards: [],
            tips: [],
            related: [],
            sidebarFacts: [],
            blocks: [
                {
                    id: 'contacts-intro',
                    type: 'prose',
                    title: introTitle,
                    paragraphs: introParagraphs.length
                        ? introParagraphs
                        : ['Выберите удобный канал связи и напишите нам по вопросам контента, правок, сотрудничества или технических ошибок на сайте.'],
                },
                {
                    id: 'contacts-table',
                    type: 'table',
                    title: tableTitle,
                    columns: [
                        { key: 'direction', label: 'Направление' },
                        { key: 'person', label: 'Контакт' },
                        { key: 'channel', label: 'Канал связи' },
                        { key: 'note', label: 'Комментарий' },
                    ],
                    rows: rows.map((row, index) => ({
                        id: `contacts-${normalizeIdLike(`${row.direction}-${row.person}-${row.channel}`, `row-${index + 1}`)}`,
                        cells: [
                            { value: row.direction || 'Контакт' },
                            { value: row.person || 'Без имени' },
                            { value: row.channel || row.href || 'Открыть канал', href: row.href || '' },
                            { value: row.note || '' },
                        ],
                    })),
                    compact: false,
                },
            ],
        };
    };

    const downloadFile = (fileName, text) => {
        const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const getDatabase = () => state.database || store.getDatabase();
    const cloneDatabase = () => store.normalizeDatabase(JSON.parse(JSON.stringify(getDatabase() || {})));
    const getSections = () => Object.values(getDatabase().sections || {}).sort(sortByOrder);
    const getArticles = () => Object.values(getDatabase().articles || {}).sort(sortByOrder);
    const isArticleSummaryOnly = (articleId) => state.articleSummaryIds.has(articleId);
    const getSectionTitle = (sectionId) => getDatabase().sections?.[sectionId]?.title || sectionId || 'Без раздела';
    const getGroupLabel = (sectionId, groupId) =>
        getDatabase().sections?.[sectionId]?.groups?.find((group) => group.id === groupId)?.label || groupId || 'Без группы';

    const switchPanel = (panelName) => {
        state.activePanel = panelName;

        elements.panelButtons.forEach((button) => {
            button.classList.toggle('is-active', button.dataset.panelButton === panelName);
        });

        elements.panels.forEach((panel) => {
            panel.classList.toggle('is-active', panel.dataset.panel === panelName);
        });
    };

    const syncStoreSnapshot = (database) => {
        try {
            if (typeof store.setDatabase === 'function') {
                store.setDatabase(database, 'admin-sync');
            } else {
                store.importFromJson(JSON.stringify(database));
            }
        } catch (error) {
            console.warn('[Admin] Failed to sync store snapshot:', error);
        }
    };

    const applyDatabase = (database) => {
        state.database = store.normalizeDatabase(database || {});
        syncStoreSnapshot(state.database);
    };

    const applyBootstrapPayload = (payload) => {
        state.articleSummaryIds = new Set(Array.isArray(payload?.articleSummaryIds) ? payload.articleSummaryIds : []);
        applyDatabase(payload?.database || {});
    };

    const fetchAdminBootstrap = async () => api('/api/admin/bootstrap');

    const ensureArticleLoaded = async (articleId) => {
        const normalizedId = String(articleId || '').trim();

        if (!normalizedId || !isArticleSummaryOnly(normalizedId)) {
            return getDatabase().articles?.[normalizedId] || null;
        }

        const article = await api(`/api/article/${encodeURIComponent(normalizedId)}`);
        const nextDatabase = cloneDatabase();
        nextDatabase.articles[normalizedId] = article;
        state.articleSummaryIds.delete(normalizedId);
        applyDatabase(nextDatabase);
        return nextDatabase.articles?.[normalizedId] || article;
    };

    const syncSecurityFormState = () => {
        const passwordManagedByEnv = Boolean(window.L2WikiAdminSession?.passwordManagedByEnv || state.adminPasswordManagedByEnv);
        state.adminPasswordManagedByEnv = passwordManagedByEnv;

        if (!elements.securityForm) {
            return;
        }

        const fields = [elements.securityCurrentPassword, elements.securityNewPassword, elements.securityConfirmPassword].filter(Boolean);
        fields.forEach((field) => {
            field.disabled = passwordManagedByEnv;
            field.required = !passwordManagedByEnv;
        });

        if (elements.securitySubmitButton) {
            elements.securitySubmitButton.disabled = passwordManagedByEnv;
            elements.securitySubmitButton.textContent = passwordManagedByEnv ? 'Пароль задается через ADMIN_PASSWORD' : 'Обновить пароль';
        }

        let note = elements.securityForm.querySelector('[data-security-note]');

        if (!note) {
            note = document.createElement('p');
            note.className = 'admin-item__summary';
            note.dataset.securityNote = '1';
            elements.securityForm.insertBefore(note, elements.securityForm.firstChild);
        }

        note.hidden = !passwordManagedByEnv;
        note.textContent = passwordManagedByEnv
            ? 'На Render пароль администратора управляется переменной окружения ADMIN_PASSWORD. Из формы его менять не нужно: он общий для всех пользователей и сохраняется после перезапуска сервиса.'
            : '';
    };

    const rebuildSectionSnapshotLocally = (database, sectionId) => {
        const nextDatabase = cloneDatabase();
        const nextSection = nextDatabase.sections?.[sectionId];

        if (!nextSection) {
            return nextDatabase;
        }

        const groups = Array.isArray(nextSection.groups) ? nextSection.groups.map((group) => ({ ...group, entries: [] })) : [];
        const allowedGroups = new Set(groups.map((group) => group.id));
        const fallbackGroupId = groups[0]?.id || '';

        Object.values(nextDatabase.articles || {})
            .filter((article) => article.section === sectionId)
            .sort(sortByOrder)
            .forEach((article) => {
                if ((!article.group || !allowedGroups.has(article.group)) && fallbackGroupId) {
                    article.group = fallbackGroupId;
                }

                const targetGroup = groups.find((group) => group.id === article.group) || groups[0];

                if (targetGroup) {
                    targetGroup.entries.push(article.id);
                }
            });

        groups.forEach((group) => {
            group.entries.sort((leftId, rightId) => sortByOrder(nextDatabase.articles[leftId], nextDatabase.articles[rightId]));
        });

        nextDatabase.sections[sectionId] = {
            ...nextSection,
            groups,
        };

        return nextDatabase;
    };

    const populateGroupSelect = (sectionId, selectedGroupId = '') => {
        const section = getDatabase().sections?.[sectionId];
        const groups = [...(section?.groups || [])].sort(sortByOrder);

        elements.articleGroup.innerHTML = groups
            .map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.label)}</option>`)
            .join('');

        if (selectedGroupId && groups.some((group) => group.id === selectedGroupId)) {
            elements.articleGroup.value = selectedGroupId;
            return;
        }

        if (groups[0]) {
            elements.articleGroup.value = groups[0].id;
        }
    };

    const populateSectionSelects = () => {
        const sections = getSections();
        const filterOptions = ['<option value="">Все разделы</option>']
            .concat(sections.map((section) => `<option value="${escapeHtml(section.id)}">${escapeHtml(section.title)}</option>`))
            .join('');

        elements.articleSectionFilter.innerHTML = filterOptions;
        elements.articleSectionFilter.value = state.articleSectionFilter;
        elements.articleSection.innerHTML = sections
            .map((section) => `<option value="${escapeHtml(section.id)}">${escapeHtml(section.title)}</option>`)
            .join('');

        if (state.editingArticleId && getDatabase().articles[state.editingArticleId]) {
            const article = getDatabase().articles[state.editingArticleId];
            elements.articleSection.value = article.section;
            populateGroupSelect(article.section, article.group);
            return;
        }

        if (!elements.articleSection.value && sections[0]) {
            elements.articleSection.value = sections[0].id;
        }

        populateGroupSelect(elements.articleSection.value, elements.articleGroup.value);
    };

    const renderStats = () => {
        const database = getDatabase();
        const sections = getSections();
        const articles = getArticles();
        const blockCount = articles.reduce((total, article) => total + (article.blocks?.length || 0), 0);
        const catalogRowCount = sections.reduce((total, section) => total + (section.catalogRows?.length || 0), 0);

        elements.updatedAt.textContent = `Последняя публикация: ${formatDate(database.updatedAt)}`;
        elements.stats.innerHTML = [
            { label: 'Разделов', value: sections.length },
            { label: 'Статей', value: articles.length },
            { label: 'Rich-блоков', value: blockCount },
            { label: 'Строк каталога', value: catalogRowCount },
        ]
            .map(
                (item) => `
                    <article class="admin-stat">
                        <span class="admin-stat__label">${escapeHtml(item.label)}</span>
                        <strong class="admin-stat__value">${escapeHtml(item.value)}</strong>
                    </article>
                `
            )
            .join('');
    };

    const renderSidebarSections = () => {
        const database = getDatabase();
        const sections = getSections();
        elements.sidebarCount.textContent = String(sections.length);
        elements.sidebarSections.innerHTML = sections
            .map((section) => {
                const articleCount = Object.values(database.articles || {}).filter((article) => article.section === section.id).length;
                return `
                    <button class="admin-sidebar__item" type="button" data-edit-section="${escapeHtml(section.id)}">
                        <strong>${escapeHtml(section.title)}</strong>
                        <span>${articleCount} материалов</span>
                    </button>
                `;
            })
            .join('');
    };

    const renderDashboard = () => {
        const sections = getSections();
        const articles = getArticles();

        elements.dashboardSections.innerHTML = sections
            .map((section) => {
                const articleCount = articles.filter((article) => article.section === section.id).length;
                return `
                    <article class="admin-item">
                        <div class="admin-item__head">
                            <div>
                                <h3 class="admin-item__title">${escapeHtml(section.title)}</h3>
                                <div class="admin-item__meta">
                                    <span class="admin-chip">ID: ${escapeHtml(section.id)}</span>
                                    <span class="admin-chip">${articleCount} материалов</span>
                                    <span class="admin-chip">${section.catalogRows?.length || 0} строк каталога</span>
                                </div>
                            </div>
                            <div class="admin-item__actions">
                                <button class="admin-button admin-button--ghost" type="button" data-open-panel="sections" data-edit-section="${escapeHtml(section.id)}">Редактировать</button>
                            </div>
                        </div>
                        <p class="admin-item__summary">${escapeHtml(section.description || 'Описание пока не добавлено.')}</p>
                        <div class="admin-group-list">
                            ${(section.groups || [])
                                .map(
                                    (group) =>
                                        `<span><strong>${escapeHtml(group.label)}</strong> ${escapeHtml(group.description || '')}</span>`
                                )
                                .join('')}
                        </div>
                    </article>
                `;
            })
            .join('');

        elements.dashboardArticles.innerHTML = articles
            .slice(0, 10)
            .map(
                (article) => `
                    <article class="admin-item">
                        <div class="admin-item__head">
                            <div>
                                <h3 class="admin-item__title">${escapeHtml(article.title)}</h3>
                                <div class="admin-item__meta">
                                    <span class="admin-chip">${escapeHtml(getSectionTitle(article.section))}</span>
                                    <span class="admin-chip">${escapeHtml(getGroupLabel(article.section, article.group))}</span>
                                    <span class="admin-chip">${article.blocks?.length || 0} blocks</span>
                                </div>
                            </div>
                            <div class="admin-item__actions">
                                <a class="admin-button admin-button--ghost" href="/pages/article.html?article=${encodeURIComponent(article.id)}" target="_blank" rel="noreferrer">Открыть</a>
                                <button class="admin-button admin-button--ghost" type="button" data-open-panel="articles" data-edit-article="${escapeHtml(article.id)}">Редактировать</button>
                            </div>
                        </div>
                        <p class="admin-item__summary">${escapeHtml(article.summary || 'Краткое описание пока не заполнено.')}</p>
                    </article>
                `
            )
            .join('');
    };

    const renderArticleList = () => {
        const searchTerm = state.articleSearch.trim().toLowerCase();
        const articles = getArticles().filter((article) => {
            if (state.articleSectionFilter && article.section !== state.articleSectionFilter) {
                return false;
            }

            if (!searchTerm) {
                return true;
            }

            const haystack = [
                article.id,
                article.title,
                article.summary,
                article.eyebrow,
                article.section,
                article.group,
                ...(article.aliases || []),
                ...(article.meta || []).flatMap((item) => [item.label, item.value]),
                ...(article.sidebarFacts || []).flatMap((item) => [item.label, item.value]),
            ]
                .join(' ')
                .toLowerCase();

            return haystack.includes(searchTerm);
        });

        if (!articles.length) {
            elements.articleList.innerHTML = '<div class="admin-empty">По этому фильтру ничего не найдено.</div>';
            return;
        }

        const totalPages = Math.ceil(articles.length / ADMIN_ARTICLE_PAGE_SIZE);
        const safePage = clampPage(state.articlePage, totalPages);
        const offset = (safePage - 1) * ADMIN_ARTICLE_PAGE_SIZE;
        const visibleArticles = articles.slice(offset, offset + ADMIN_ARTICLE_PAGE_SIZE);

        state.articlePage = safePage;

        elements.articleList.innerHTML = `
            ${buildAdminPager({
                kind: 'articles',
                currentPage: safePage,
                totalPages,
                totalItems: articles.length,
                pageSize: ADMIN_ARTICLE_PAGE_SIZE,
            })}
            ${visibleArticles
                .map(
                    (article) => `
                        <article class="admin-item ${state.editingArticleId === article.id ? 'is-selected' : ''}">
                            <div class="admin-item__head">
                                <div>
                                    <h3 class="admin-item__title">${escapeHtml(article.title)}</h3>
                                    <div class="admin-item__meta">
                                        <span class="admin-chip">ID: ${escapeHtml(article.id)}</span>
                                        <span class="admin-chip">${escapeHtml(getSectionTitle(article.section))}</span>
                                        <span class="admin-chip">${escapeHtml(getGroupLabel(article.section, article.group))}</span>
                                        <span class="admin-chip">${article.blocks?.length || 0} blocks</span>
                                    </div>
                                </div>
                                <div class="admin-item__actions">
                                    <a class="admin-button admin-button--ghost" href="/pages/article.html?article=${encodeURIComponent(article.id)}" target="_blank" rel="noreferrer">Открыть</a>
                                    <button class="admin-button admin-button--ghost" type="button" data-edit-article="${escapeHtml(article.id)}">Редактировать</button>
                                    <button class="admin-button admin-button--danger" type="button" data-delete-article="${escapeHtml(article.id)}">Удалить</button>
                                </div>
                            </div>
                            <p class="admin-item__summary">${escapeHtml(article.summary || 'Краткое описание пока не заполнено.')}</p>
                        </article>
                    `
                )
                .join('')}
        `;

        scrollIntoViewX(
            elements.articleList.querySelector('.admin-pagination__pages'),
            elements.articleList.querySelector('.admin-pagination__page.is-active')
        );
        elements.articleList.querySelector('.admin-item.is-selected')?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
        });
    };

    const renderSectionList = () => {
        const database = getDatabase();
        const sections = getSections();

        if (!sections.length) {
            elements.sectionList.innerHTML = '<div class="admin-empty">Разделов пока нет.</div>';
            return;
        }

        const totalPages = Math.ceil(sections.length / ADMIN_SECTION_PAGE_SIZE);
        const safePage = clampPage(state.sectionPage, totalPages);
        const offset = (safePage - 1) * ADMIN_SECTION_PAGE_SIZE;
        const visibleSections = sections.slice(offset, offset + ADMIN_SECTION_PAGE_SIZE);

        state.sectionPage = safePage;

        elements.sectionList.innerHTML = `
            ${buildAdminPager({
                kind: 'sections',
                currentPage: safePage,
                totalPages,
                totalItems: sections.length,
                pageSize: ADMIN_SECTION_PAGE_SIZE,
            })}
            ${visibleSections
                .map((section) => {
                    const articleCount = Object.values(database.articles || {}).filter((article) => article.section === section.id).length;
                    return `
                        <article class="admin-item ${state.editingSectionId === section.id ? 'is-selected' : ''}">
                            <div class="admin-item__head">
                                <div>
                                    <h3 class="admin-item__title">${escapeHtml(section.title)}</h3>
                                    <div class="admin-item__meta">
                                        <span class="admin-chip">ID: ${escapeHtml(section.id)}</span>
                                        <span class="admin-chip">${articleCount} материалов</span>
                                        <span class="admin-chip">${section.groups?.length || 0} групп</span>
                                        <span class="admin-chip">${section.catalogRows?.length || 0} строк каталога</span>
                                    </div>
                                </div>
                                <div class="admin-item__actions">
                                    <a class="admin-button admin-button--ghost" href="/pages/section.html?section=${encodeURIComponent(section.id)}" target="_blank" rel="noreferrer">Открыть</a>
                                    <button class="admin-button admin-button--ghost" type="button" data-edit-section="${escapeHtml(section.id)}">Редактировать</button>
                                    <button class="admin-button admin-button--danger" type="button" data-delete-section="${escapeHtml(section.id)}">Удалить</button>
                                </div>
                            </div>
                            <p class="admin-item__summary">${escapeHtml(section.description || 'Описание раздела пока не заполнено.')}</p>
                        </article>
                    `;
                })
                .join('')}
        `;

        scrollIntoViewX(
            elements.sectionList.querySelector('.admin-pagination__pages'),
            elements.sectionList.querySelector('.admin-pagination__page.is-active')
        );
        elements.sectionList.querySelector('.admin-item.is-selected')?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
        });
    };





    const renderBackups = () => {
        const database = getDatabase();
        const items = [
            `
                <article class="admin-item">
                    <div class="admin-item__head">
                        <div>
                            <h3 class="admin-item__title">Canonical snapshot</h3>
                            <div class="admin-item__meta">
                                <span class="admin-chip">${Object.keys(database.sections || {}).length} разделов</span>
                                <span class="admin-chip">${Object.keys(database.articles || {}).length} статей</span>
                                <span class="admin-chip">Обновлено: ${escapeHtml(formatDate(database.updatedAt))}</span>
                            </div>
                        </div>
                        <div class="admin-item__actions">
                            <a class="admin-button admin-button--ghost" href="/data/canonical/l2wiki-canonical.json" target="_blank" rel="noreferrer">Открыть JSON</a>
                            <a class="admin-button admin-button--ghost" href="/assets/js/static-data.js" target="_blank" rel="noreferrer">Открыть static-data</a>
                        </div>
                    </div>
                    <p class="admin-item__summary">Публичный сайт читает статический seed из canonical-снимка и не зависит от localStorage.</p>
                </article>
            `,
        ];

        if (!state.backups.length) {
            items.push('<div class="admin-empty">Автобэкапы появятся после первой публикации через новую схему.</div>');
        } else {
            state.backups.slice(0, 12).forEach((backup) => {
                const relativePath = `/data/backups/${encodeURIComponent(backup.fileName)}`;
                items.push(`
                    <article class="admin-item">
                        <div class="admin-item__head">
                            <div>
                                <h3 class="admin-item__title">${escapeHtml(backup.fileName)}</h3>
                                <div class="admin-item__meta">
                                    <span class="admin-chip">${escapeHtml(formatDate(backup.updatedAt))}</span>
                                    <span class="admin-chip">${escapeHtml(formatSize(backup.size))}</span>
                                </div>
                            </div>
                            <div class="admin-item__actions">
                                <a class="admin-button admin-button--ghost" href="${relativePath}" target="_blank" rel="noreferrer">Скачать</a>
                            </div>
                        </div>
                    </article>
                `);
            });
        }

        elements.backupInfo.innerHTML = items.join('');
    };

    const renderAll = () => {
        renderStats();
        renderSidebarSections();
        renderDashboard();
        populateSectionSelects();
        renderArticleList();
        renderSectionList();
        renderBackups();
        fillContactsBuilder();
        elements.siteName.value = getDatabase().site?.name || '';
        elements.siteSubtitle.value = getDatabase().site?.subtitle || '';
        elements.siteSeoDescription.value = getDatabase().site?.seoDescription || '';
        elements.siteSocialImage.value = getDatabase().site?.socialImage || '';
        elements.siteSocialImageAlt.value = getDatabase().site?.socialImageAlt || '';
        elements.siteAds.value = stringifyJson(getDatabase().site?.ads || {});
        renderAdsBuilder(parseJsonFieldSafe(elements.siteAds.value, {}));
        if (elements.securityUsername) {
            elements.securityUsername.value = state.adminUsername || window.L2WikiAdminSession?.username || 'admin';
        }
        syncSecurityFormState();
        switchPanel(state.activePanel);
    };

    const resetArticleForm = () => {
        state.editingArticleId = '';
        elements.articleForm.reset();
        elements.articleFormTitle.textContent = 'Новая статья';
        elements.articleId.readOnly = false;
        elements.articleId.value = '';
        elements.articleOrder.value = '9999';
        elements.articleLayout.value = '';
        elements.articleHeroImage.value = '';
        elements.articleBlocks.value = '';
        elements.articleSidebarFacts.value = '';
        elements.articleAliases.value = '';
        elements.articleRelated.value = '';
        elements.articleMeta.value = '';
        elements.articleQuestGuide.value = '';
        elements.articleIntro.value = '';
        elements.articleChecklist.value = '';
        elements.articleSteps.value = '';
        elements.articleRewards.value = '';
        elements.articleTips.value = '';
        elements.articleSourceUrl.value = '';
        elements.articleSourceArchivedAt.value = '';
        elements.articleSourcePath.value = '';
        elements.articleSourceSnapshot.value = '';
        elements.articleSourceType.value = '';
        renderArticleConstructors();
        populateSectionSelects();
        renderArticleList();
    };

    const fillArticleForm = async (articleId) => {
        const article = await ensureArticleLoaded(articleId);

        if (!article) {
            return;
        }

        state.editingArticleId = articleId;
        elements.articleFormTitle.textContent = `Редактирование: ${article.title}`;
        elements.articleId.readOnly = true;
        elements.articleId.value = article.id;
        elements.articleOrder.value = article.order ?? 9999;
        elements.articleTitle.value = article.title || '';
        elements.articleSection.value = article.section || '';
        populateGroupSelect(article.section, article.group);
        elements.articleEyebrow.value = article.eyebrow || '';
        elements.articleLayout.value = article.layout || '';
        elements.articleHeroImage.value = article.heroImage || '';
        elements.articleSummary.value = article.summary || '';
        elements.articleMeta.value = serializeMeta(article.meta);
        elements.articleAliases.value = serializeLines(article.aliases);
        elements.articleIntro.value = serializeLines(article.intro);
        elements.articleChecklist.value = serializeLines(article.checklist);
        elements.articleSteps.value = serializeLines(article.steps);
        elements.articleRewards.value = serializeLines(article.rewards);
        elements.articleTips.value = serializeLines(article.tips);
        elements.articleRelated.value = serializeLines(article.related);
        elements.articleSidebarFacts.value = serializeMeta(article.sidebarFacts);
        elements.articleBlocks.value = stringifyJson(article.blocks);
        elements.articleQuestGuide.value = article.blocks?.find((block) => block.type === 'questGuide')
            ? stringifyJson(article.blocks.find((block) => block.type === 'questGuide'))
            : '';
        elements.articleSourceUrl.value = article.source?.url || '';
        elements.articleSourceArchivedAt.value = article.source?.archivedAt || '';
        elements.articleSourcePath.value = article.source?.path || '';
        elements.articleSourceSnapshot.value = article.source?.snapshot || '';
        elements.articleSourceType.value = article.source?.sourceType || '';
        renderArticleConstructors();
        renderArticleList();
        switchPanel('articles');
    };

    const resetSectionForm = () => {
        state.editingSectionId = '';
        elements.sectionForm.reset();
        elements.sectionFormTitle.textContent = 'Новый раздел';
        elements.sectionId.readOnly = false;
        elements.sectionId.value = '';
        elements.sectionOrder.value = '9999';
        elements.sectionStats.value = '';
        elements.sectionGroups.value = '';
        elements.sectionLandingLayout.value = '';
        elements.sectionLandingSidebarFacts.value = '';
        elements.sectionLandingBlocks.value = '';
        elements.sectionCatalogColumns.value = '';
        elements.sectionCatalogRows.value = '';
        renderSectionConstructors();
        renderSectionList();
    };

    const fillSectionForm = (sectionId) => {
        const section = getDatabase().sections?.[sectionId];

        if (!section) {
            return;
        }

        state.editingSectionId = sectionId;
        elements.sectionFormTitle.textContent = `Редактирование: ${section.title}`;
        elements.sectionId.readOnly = true;
        elements.sectionId.value = section.id;
        elements.sectionOrder.value = section.order ?? 9999;
        elements.sectionTitle.value = section.title || '';
        elements.sectionDescription.value = section.description || '';
        elements.sectionStats.value = serializeMeta(section.stats);
        elements.sectionGroups.value = serializeGroups(section.groups);
        elements.sectionLandingLayout.value = section.landingLayout || '';
        elements.sectionLandingSidebarFacts.value = serializeMeta(section.landingSidebarFacts);
        elements.sectionLandingBlocks.value = stringifyJson(section.landingBlocks);
        elements.sectionCatalogColumns.value = stringifyJson(section.catalogColumns);
        elements.sectionCatalogRows.value = stringifyJson(section.catalogRows);
        renderSectionConstructors();
        renderSectionList();
        switchPanel('sections');
    };

    const readArticleForm = () => {
        syncArticleConstructorsToSources();
        const articleId = String(elements.articleId.value || '').trim();

        if (!articleId) {
            throw new Error('Укажите ID статьи.');
        }

        const blocks = parseJsonField(elements.articleBlocks.value, 'Blocks JSON');
        const questGuideRaw = String(elements.articleQuestGuide.value || '').trim();
        const questGuide = questGuideRaw ? buildQuestGuideBlock(parseJsonField(questGuideRaw, 'Quest guide JSON')) : null;
        const normalizedBlocks = questGuide ? [questGuide, ...blocks.filter((block) => block?.type !== 'questGuide')] : blocks;

        return {
            id: articleId,
            order: Number(elements.articleOrder.value || 9999),
            title: String(elements.articleTitle.value || '').trim(),
            section: String(elements.articleSection.value || '').trim(),
            group: String(elements.articleGroup.value || '').trim(),
            eyebrow: String(elements.articleEyebrow.value || '').trim(),
            layout: String(elements.articleLayout.value || '').trim(),
            heroImage: String(elements.articleHeroImage.value || '').trim(),
            summary: String(elements.articleSummary.value || '').trim(),
            meta: parseMeta(elements.articleMeta.value),
            aliases: parseLines(elements.articleAliases.value),
            intro: parseLines(elements.articleIntro.value),
            checklist: parseLines(elements.articleChecklist.value),
            steps: parseLines(elements.articleSteps.value),
            rewards: parseLines(elements.articleRewards.value),
            tips: parseLines(elements.articleTips.value),
            related: parseRelated(elements.articleRelated.value),
            sidebarFacts: parseMeta(elements.articleSidebarFacts.value),
            blocks: normalizedBlocks,
            source: {
                url: String(elements.articleSourceUrl.value || '').trim(),
                archivedAt: String(elements.articleSourceArchivedAt.value || '').trim(),
                path: String(elements.articleSourcePath.value || '').trim(),
                snapshot: String(elements.articleSourceSnapshot.value || '').trim(),
                sourceType: String(elements.articleSourceType.value || '').trim(),
            },
        };
    };

    const readSectionForm = () => {
        syncSectionConstructorsToSources();
        const sectionId = String(elements.sectionId.value || '').trim();
        const groups = parseGroups(elements.sectionGroups.value);

        if (!sectionId) {
            throw new Error('Укажите ID раздела.');
        }

        if (!groups.length) {
            throw new Error('Добавьте хотя бы одну группу раздела.');
        }

        return {
            id: sectionId,
            order: Number(elements.sectionOrder.value || 9999),
            title: String(elements.sectionTitle.value || '').trim(),
            description: String(elements.sectionDescription.value || '').trim(),
            stats: parseMeta(elements.sectionStats.value),
            groups,
            landingLayout: String(elements.sectionLandingLayout.value || '').trim(),
            landingSidebarFacts: parseMeta(elements.sectionLandingSidebarFacts.value),
            landingBlocks: parseJsonField(elements.sectionLandingBlocks.value, 'Landing blocks JSON'),
            catalogColumns: parseJsonField(elements.sectionCatalogColumns.value, 'Catalog columns JSON'),
            catalogRows: parseJsonField(elements.sectionCatalogRows.value, 'Catalog rows JSON'),
        };
    };

    const refreshBackups = async () => {
        try {
            const backupPayload = await api('/api/backups');
            state.backups = backupPayload?.backups || [];
        } catch (error) {
            console.warn('[Admin] Failed to refresh backups:', error);
        }
    };

    const refreshDatabase = async (options = {}) => {
        if (options.database) {
            applyDatabase(options.database);
        } else if (options.forceServerExport) {
            applyBootstrapPayload(await fetchAdminBootstrap());
        } else if (!Object.keys(getDatabase().articles || {}).length) {
            applyBootstrapPayload(await fetchAdminBootstrap());
        }

        await refreshBackups();
        renderAll();

        if (options.articleId && state.database.articles[options.articleId]) {
            await fillArticleForm(options.articleId);
        }

        if (options.sectionId && state.database.sections[options.sectionId]) {
            fillSectionForm(options.sectionId);
        }
    };

    const handleArticleSave = async (event) => {
        event.preventDefault();

        try {
            const article = readArticleForm();
            const savedArticle = await api(`/api/article/${encodeURIComponent(article.id)}`, {
                method: 'PUT',
                body: JSON.stringify(article),
            });
            const nextDatabase = cloneDatabase();
            nextDatabase.articles[savedArticle.id] = savedArticle;
            state.articleSummaryIds.delete(savedArticle.id);
            await refreshDatabase({ articleId: savedArticle.id, database: nextDatabase });
            showToast(`Статья "${article.title}" сохранена.`);
        } catch (error) {
            showToast(error.message || 'Не удалось сохранить статью.', 'error');
        }
    };

    const handleSectionSave = async (event) => {
        event.preventDefault();

        try {
            const section = readSectionForm();
            const savedSection = await api(`/api/section/${encodeURIComponent(section.id)}`, {
                method: 'PUT',
                body: JSON.stringify(section),
            });
            const nextDatabase = cloneDatabase();
            nextDatabase.sections[savedSection.id] = savedSection;
            await refreshDatabase({ sectionId: savedSection.id, database: rebuildSectionSnapshotLocally(nextDatabase, savedSection.id) });
            showToast(`Раздел "${section.title}" сохранен.`);
        } catch (error) {
            showToast(error.message || 'Не удалось сохранить раздел.', 'error');
        }
    };

    const handleSiteSave = async (event) => {
        event.preventDefault();

        try {
            syncSiteConstructorToSource();
            const adsValue = String(elements.siteAds.value || '').trim();
            const savedSite = await api('/api/site', {
                method: 'PUT',
                body: JSON.stringify({
                    name: String(elements.siteName.value || '').trim(),
                    subtitle: String(elements.siteSubtitle.value || '').trim(),
                    seoDescription: String(elements.siteSeoDescription.value || '').trim(),
                    socialImage: String(elements.siteSocialImage.value || '').trim(),
                    socialImageAlt: String(elements.siteSocialImageAlt.value || '').trim(),
                    ads: adsValue ? parseJsonField(adsValue, 'Ads JSON') : {},
                }),
            });
            const nextDatabase = cloneDatabase();
            nextDatabase.site = savedSite;
            await refreshDatabase({ database: nextDatabase });
            showToast('Настройки сайта сохранены.');
        } catch (error) {
            showToast(error.message || 'Не удалось сохранить настройки сайта.', 'error');
        }
    };

    const handleContactsSave = async (event) => {
        event.preventDefault();

        try {
            const article = readContactsBuilder();
            const savedArticle = await api('/api/article/contacts', {
                method: 'PUT',
                body: JSON.stringify(article),
            });
            const nextDatabase = cloneDatabase();
            nextDatabase.articles[savedArticle.id] = savedArticle;
            state.articleSummaryIds.delete(savedArticle.id);
            await refreshDatabase({ articleId: savedArticle.id, database: nextDatabase });
            showToast('Страница контактов сохранена.');
        } catch (error) {
            showToast(error.message || 'Не удалось сохранить страницу контактов.', 'error');
        }
    };

    const handlePasswordChange = async (event) => {
        event.preventDefault();

        try {
            if (state.adminPasswordManagedByEnv) {
                throw new Error('Пароль администратора управляется переменной окружения ADMIN_PASSWORD на сервере.');
            }

            const currentPassword = String(elements.securityCurrentPassword?.value || '');
            const newPassword = String(elements.securityNewPassword?.value || '');
            const confirmPassword = String(elements.securityConfirmPassword?.value || '');

            if (!currentPassword) {
                throw new Error('Введите текущий пароль.');
            }

            if (!newPassword || newPassword.length < 4) {
                throw new Error('Новый пароль должен содержать минимум 4 символа.');
            }

            if (newPassword !== confirmPassword) {
                throw new Error('Подтверждение пароля не совпадает.');
            }

            const payload = await api('/api/admin/change-password', {
                method: 'POST',
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                    confirmPassword,
                }),
            });

            state.adminUsername = payload?.username || state.adminUsername;

            if (window.L2WikiAdminSession) {
                window.L2WikiAdminSession.username = state.adminUsername;
            }

            if (elements.securityForm) {
                elements.securityForm.reset();
            }

            if (elements.securityUsername) {
                elements.securityUsername.value = state.adminUsername || 'admin';
            }

            showToast(payload?.message || 'Пароль обновлен.');
        } catch (error) {
            showToast(error.message || 'Не удалось обновить пароль.', 'error');
        }
    };

    const handleExport = async () => {
        try {
            const database = await api('/api/export');
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            downloadFile(`l2wiki-canonical-${stamp}.json`, JSON.stringify(database, null, 2));
            showToast('Экспорт подготовлен.');
        } catch (error) {
            showToast(error.message || 'Не удалось экспортировать JSON.', 'error');
        }
    };

    const handleImport = async (event) => {
        const [file] = event.target.files || [];

        if (!file) {
            return;
        }

        try {
            const text = await file.text();
            const normalized = store.normalizeDatabase(JSON.parse(text));

            if (!window.confirm(`Импорт заменить текущий canonical snapshot?\n\nРазделов: ${Object.keys(normalized.sections).length}\nСтатей: ${Object.keys(normalized.articles).length}`)) {
                return;
            }

            await api('/api/import', {
                method: 'POST',
                body: JSON.stringify(normalized),
            });
            await refreshDatabase({ forceServerExport: true });
            showToast('Canonical snapshot импортирован.');
        } catch (error) {
            showToast(error.message || 'Не удалось импортировать JSON.', 'error');
        } finally {
            event.target.value = '';
        }
    };

    const handleReset = async () => {
        if (!window.confirm('Перепубликовать текущий canonical snapshot и обновить static-data.js?')) {
            return;
        }

        try {
            await api('/api/reset', {
                method: 'POST',
                body: JSON.stringify({}),
            });
            await refreshDatabase({ forceServerExport: true });
            showToast('Canonical snapshot перепубликован.');
        } catch (error) {
            showToast(error.message || 'Не удалось перепубликовать snapshot.', 'error');
        }
    };

    const handleArticleDelete = async (articleId) => {
        const article = getDatabase().articles?.[articleId];

        if (!article) {
            return;
        }

        if (!window.confirm(`Удалить статью "${article.title}"?`)) {
            return;
        }

        try {
            await api(`/api/article/${encodeURIComponent(articleId)}`, {
                method: 'DELETE',
                body: JSON.stringify({}),
            });

            if (state.editingArticleId === articleId) {
                resetArticleForm();
            }

            const nextDatabase = cloneDatabase();
            delete nextDatabase.articles[articleId];
            state.articleSummaryIds.delete(articleId);
            await refreshDatabase({ database: nextDatabase });
            showToast(`Статья "${article.title}" удалена.`);
        } catch (error) {
            showToast(error.message || 'Не удалось удалить статью.', 'error');
        }
    };

    const handleSectionDelete = async (sectionId) => {
        const section = getDatabase().sections?.[sectionId];

        if (!section) {
            return;
        }

        if (!window.confirm(`Удалить раздел "${section.title}"? Раздел можно удалить только без статей.`)) {
            return;
        }

        try {
            await api(`/api/section/${encodeURIComponent(sectionId)}`, {
                method: 'DELETE',
                body: JSON.stringify({}),
            });

            if (state.editingSectionId === sectionId) {
                resetSectionForm();
            }

            const nextDatabase = cloneDatabase();
            delete nextDatabase.sections[sectionId];
            await refreshDatabase({ database: nextDatabase });
            showToast(`Раздел "${section.title}" удален.`);
        } catch (error) {
            showToast(error.message || 'Не удалось удалить раздел.', 'error');
        }
    };

    const handleBuilderAction = (button) => {
        const action = button.dataset.builderAction;

        if (!action) {
            return false;
        }

        if (action === 'add-block') {
            const list = button.closest('.admin-builder')?.querySelector('[data-block-list]');

            if (!list) {
                return false;
            }

            list.insertAdjacentHTML('beforeend', createBlockCardMarkup({ type: button.dataset.blockTemplate || 'prose' }));
            return true;
        }

        if (action === 'add-media-item') {
            const target =
                button.dataset.builderScope === 'quest-media'
                    ? ui.articleQuestGuideBuilder?.querySelector('[data-quest-media]')
                    : button.closest('[data-block-card], .admin-builder')?.querySelector('[data-media-rows]');

            if (!target) {
                return false;
            }

            target.insertAdjacentHTML('beforeend', createMediaRowMarkup({}));
            return true;
        }

        if (action === 'add-table-column') {
            const target = button.closest('[data-block-card], .admin-builder')?.querySelector('[data-table-columns]');

            if (!target) {
                return false;
            }

            target.insertAdjacentHTML('beforeend', createTableColumnMarkup({}));
            return true;
        }

        if (action === 'add-table-row') {
            const target = button.closest('[data-block-card], .admin-builder')?.querySelector('[data-table-rows]');

            if (!target) {
                return false;
            }

            target.insertAdjacentHTML('beforeend', createTableRowMarkup({}));
            return true;
        }

        if (action === 'add-table-cell') {
            const target = button.closest('[data-table-row]')?.querySelector('[data-table-cells]');

            if (!target) {
                return false;
            }

            target.insertAdjacentHTML('beforeend', createTableCellMarkup({}));
            return true;
        }

        if (action === 'add-quest-entry') {
            const target = ui.articleQuestGuideBuilder?.querySelector(`[data-quest-${button.dataset.questTarget || 'steps'}]`);

            if (!target) {
                return false;
            }

            target.insertAdjacentHTML('beforeend', createQuestEntryMarkup({}, button.dataset.questTarget === 'steps'));
            return true;
        }

        if (action === 'add-quest-substep') {
            const target = button.closest('[data-quest-entry]')?.querySelector('[data-quest-substeps]');

            if (!target) {
                return false;
            }

            target.insertAdjacentHTML('beforeend', createQuestSubstepMarkup({}));
            return true;
        }

        if (action === 'move-up' || action === 'move-down') {
            moveBuilderItem(button.closest('[data-builder-item]'), action === 'move-up' ? -1 : 1);
            return true;
        }

        if (action === 'remove-item') {
            button.closest('[data-builder-item]')?.remove();
            return true;
        }

        return false;
    };

    elements.panelButtons.forEach((button) => {
        button.addEventListener('click', () => {
            switchPanel(button.dataset.panelButton);
        });
    });

    elements.articleSearchInput.addEventListener('input', (event) => {
        state.articleSearch = event.target.value || '';
        state.articlePage = 1;
        renderArticleList();
    });

    elements.articleSectionFilter.addEventListener('change', (event) => {
        state.articleSectionFilter = event.target.value || '';
        state.articlePage = 1;
        renderArticleList();
    });

    elements.articleSection.addEventListener('change', (event) => {
        populateGroupSelect(event.target.value, '');
    });

    elements.newArticleButton.addEventListener('click', () => {
        resetArticleForm();
        switchPanel('articles');
    });

    elements.articleResetButton.addEventListener('click', () => {
        resetArticleForm();
    });

    elements.newSectionButton.addEventListener('click', () => {
        resetSectionForm();
        switchPanel('sections');
    });

    elements.sectionResetButton.addEventListener('click', () => {
        resetSectionForm();
    });

    elements.articleForm.addEventListener('submit', handleArticleSave);
    elements.sectionForm.addEventListener('submit', handleSectionSave);
    elements.siteForm.addEventListener('submit', handleSiteSave);
    elements.contactsBuilderForm?.addEventListener('submit', handleContactsSave);
    elements.securityForm?.addEventListener('submit', handlePasswordChange);
    elements.exportButton.addEventListener('click', handleExport);
    elements.importInput.addEventListener('change', handleImport);
    elements.resetButton.addEventListener('click', handleReset);
    elements.contactsAddRowButton?.addEventListener('click', () => {
        appendContactsRow();
    });
    elements.contactsRows?.addEventListener('click', (event) => {
        const removeButton = event.target.closest('[data-remove-contact-row]');

        if (!removeButton) {
            return;
        }

        const row = removeButton.closest('[data-contact-row]');
        row?.remove();

        if (!elements.contactsRows.querySelector('[data-contact-row]')) {
            appendContactsRow();
            return;
        }

        renumberContactRows();
    });

    document.addEventListener('click', (event) => {
        const builderButton = event.target.closest('[data-builder-action]');

        if (builderButton) {
            event.preventDefault();

            if (handleBuilderAction(builderButton)) {
                return;
            }
        }

        const panelButton = event.target.closest('[data-open-panel]');

        if (panelButton) {
            switchPanel(panelButton.dataset.openPanel);
        }

        const pageButton = event.target.closest('[data-admin-page-kind]');

        if (pageButton) {
            const kind = pageButton.dataset.adminPageKind || '';
            const pageValue = Number(pageButton.dataset.adminPage || 0);

            if (kind === 'articles') {
                if (pageButton.dataset.adminPageNav === 'prev') {
                    state.articlePage = Math.max(1, state.articlePage - 1);
                } else if (pageButton.dataset.adminPageNav === 'next') {
                    state.articlePage += 1;
                } else if (pageValue > 0) {
                    state.articlePage = pageValue;
                }

                renderArticleList();
                scrollAdminListToTop('articles');
                return;
            }

            if (kind === 'sections') {
                if (pageButton.dataset.adminPageNav === 'prev') {
                    state.sectionPage = Math.max(1, state.sectionPage - 1);
                } else if (pageButton.dataset.adminPageNav === 'next') {
                    state.sectionPage += 1;
                } else if (pageValue > 0) {
                    state.sectionPage = pageValue;
                }

                renderSectionList();
                scrollAdminListToTop('sections');
                return;
            }
        }

        const editArticleButton = event.target.closest('[data-edit-article]');

        if (editArticleButton) {
            fillArticleForm(editArticleButton.dataset.editArticle).catch((error) => {
                console.error('[Admin]', error);
                showToast(error.message || 'Не удалось загрузить статью.', 'error');
            });
        }

        const deleteArticleButton = event.target.closest('[data-delete-article]');

        if (deleteArticleButton) {
            handleArticleDelete(deleteArticleButton.dataset.deleteArticle);
        }

        const editSectionButton = event.target.closest('[data-edit-section]');

        if (editSectionButton) {
            fillSectionForm(editSectionButton.dataset.editSection);
        }

        const deleteSectionButton = event.target.closest('[data-delete-section]');

        if (deleteSectionButton) {
            handleSectionDelete(deleteSectionButton.dataset.deleteSection);
        }
    });

    document.addEventListener('change', (event) => {
        const questToggle = event.target.closest('[data-quest-enabled]');

        if (questToggle) {
            const questBody = ui.articleQuestGuideBuilder?.querySelector('[data-quest-body]');

            if (questBody) {
                questBody.hidden = !questToggle.checked;
            }
        }
    });

    initializeConstructors();

    refreshDatabase({ forceServerExport: false })
        .then(() => {
            resetArticleForm();
            resetSectionForm();
            renderAll();
        })
        .catch((error) => {
            console.error('[Admin]', error);
            showToast(error.message || 'Не удалось загрузить canonical snapshot.', 'error');
            renderAll();
        });
})();
