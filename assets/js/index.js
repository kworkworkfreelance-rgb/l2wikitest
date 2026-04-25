const sidebarItems = Array.from(document.querySelectorAll('.sidebar__item--has-submenu'));
const desktopQuery = window.matchMedia('(hover: hover) and (pointer: fine)');

const closeAllSidebarItems = (exceptItem = null) => {
    sidebarItems.forEach((item) => {
        if (item !== exceptItem) {
            item.classList.remove('is-open');

            const link = item.querySelector('.sidebar__link');

            if (link) {
                link.setAttribute('aria-expanded', 'false');
            }
        }
    });
};

const openSidebarItem = (item) => {
    closeAllSidebarItems(item);
    item.classList.add('is-open');

    const link = item.querySelector('.sidebar__link');

    if (link) {
        link.setAttribute('aria-expanded', 'true');
    }
};

const closeSidebarItem = (item) => {
    item.classList.remove('is-open');

    const link = item.querySelector('.sidebar__link');

    if (link) {
        link.setAttribute('aria-expanded', 'false');
    }
};

sidebarItems.forEach((item) => {
    let closeTimer = null;
    const trigger = item.querySelector('.sidebar__link');

    const clearCloseTimer = () => {
        if (closeTimer) {
            window.clearTimeout(closeTimer);
            closeTimer = null;
        }
    };

    const queueClose = () => {
        clearCloseTimer();

        closeTimer = window.setTimeout(() => {
            closeSidebarItem(item);
        }, 120);
    };

    item.addEventListener('mouseenter', () => {
        if (!desktopQuery.matches) {
            return;
        }

        clearCloseTimer();
        openSidebarItem(item);
    });

    item.addEventListener('mouseleave', () => {
        if (!desktopQuery.matches) {
            return;
        }

        queueClose();
    });

    item.addEventListener('focusin', () => {
        clearCloseTimer();
        openSidebarItem(item);
    });

    item.addEventListener('focusout', () => {
        window.setTimeout(() => {
            if (!item.contains(document.activeElement)) {
                closeSidebarItem(item);
            }
        }, 0);
    });

    if (trigger) {
        trigger.addEventListener('click', (event) => {
            if (!desktopQuery.matches) {
                if (!item.classList.contains('is-open')) {
                    event.preventDefault();
                    openSidebarItem(item);
                    return;
                }

                closeSidebarItem(item);
            }
        });
    }
});

document.addEventListener('click', (event) => {
    if (!event.target.closest('.sidebar')) {
        closeAllSidebarItems();
    }
});

window.addEventListener('resize', () => {
    closeAllSidebarItems();
});

// Page initialization logging
document.addEventListener('DOMContentLoaded', () => {
    console.log('[L2Wiki] Page fully loaded');
    const database = window.L2WikiStore?.getDatabase?.() || window.L2WIKI_CONTENT || {};
    console.log('[L2Wiki] Final check - articles available:', Object.keys(database.articles || {}).length);
});
