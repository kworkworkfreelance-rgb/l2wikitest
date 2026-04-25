/**
 * JSON-LD Structured Data for SEO
 * Adds schema.org markup for better search engine understanding
 */

(function() {
    'use strict';

    function extractBlockText(block) {
        if (!block || typeof block !== 'object') {
            return '';
        }

        if (block.type === 'prose') {
            return [block.title, ...(block.paragraphs || [])].join(' ');
        }

        if (block.type === 'list' || block.type === 'steps') {
            return [block.title, ...(block.items || [])].join(' ');
        }

        if (block.type === 'callout') {
            return [block.title, block.text, ...(block.items || [])].join(' ');
        }

        if (block.type === 'table') {
            return [
                block.title,
                ...(block.columns || []).map((column) => column.label),
                ...(block.rows || []).flatMap((row) => (row.cells || []).map((cell) => cell.value || cell.html || '')),
            ].join(' ');
        }

        if (block.type === 'html') {
            return [block.title, String(block.html || '').replace(/<[^>]+>/g, ' ')].join(' ');
        }

        return block.title || '';
    }

    // Wait for L2WIKI_SEED_DATA to be loaded
    function initStructuredData() {
        if (!window.L2WIKI_SEED_DATA) {
            console.warn('[SEO] L2WIKI_SEED_DATA not loaded yet');
            return;
        }

        const data = window.L2WIKI_SEED_DATA;
        const url = window.location.href;
        const siteRoot = window.location.origin;
        const urlParams = new URLSearchParams(window.location.search);
        const articleId = urlParams.get('article');
        const sectionId = urlParams.get('section');

        // Base WebSite structured data
        const website = {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            'name': data.site.name,
            'alternateName': ['L2Wiki', 'Lineage II Wiki', 'L2INT'],
            'url': siteRoot + '/',
            'description': data.site.subtitle,
            'inLanguage': 'ru-RU',
            'about': {
                '@type': 'VideoGame',
                'name': 'Lineage II',
                'genre': ['MMORPG', 'RPG'],
                'gamePlatform': 'PC'
            },
            'potentialAction': {
                '@type': 'SearchAction',
                'target': {
                    '@type': 'EntryPoint',
                    'urlTemplate': siteRoot + '/pages/search.html?query={search_term_string}'
                },
                'query-input': 'required name=search_term_string'
            }
        };

        let schemaData;

        // Article page
        if (articleId && data.articles[articleId]) {
            const article = data.articles[articleId];
            const section = data.sections[article.section];
            
            schemaData = {
                '@context': 'https://schema.org',
                '@type': 'Article',
                'headline': article.title,
                'description': article.summary,
                'inLanguage': 'ru-RU',
                'author': {
                    '@type': 'Organization',
                    'name': data.site.name,
                    'url': siteRoot + '/'
                },
                'publisher': {
                    '@type': 'Organization',
                    'name': data.site.name,
                    'logo': {
                        '@type': 'ImageObject',
                        'url': siteRoot + '/assets/img/logo.png'
                    }
                },
                'datePublished': data.updatedAt,
                'dateModified': data.updatedAt,
                'url': url,
                'mainEntityOfPage': {
                    '@type': 'WebPage',
                    '@id': url
                },
                'keywords': [article.title, article.eyebrow, 'Lineage II', 'L2', 'гайд'].join(', '),
                'articleSection': section ? section.title : '',
                'articleBody': (article.blocks || []).map(extractBlockText).join('\n\n').substring(0, 5000)
            };
        }
        // Section page
        else if (sectionId && data.sections[sectionId]) {
            const section = data.sections[sectionId];
            
            schemaData = {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                'name': section.title + ' - ' + data.site.name,
                'description': section.description,
                'inLanguage': 'ru-RU',
                'url': url,
                'isPartOf': {
                    '@type': 'WebSite',
                    'name': data.site.name
                },
                'about': {
                    '@type': 'Thing',
                    'name': 'Lineage II ' + section.title
                }
            };
        }
        // Home page
        else {
            schemaData = {
                ...website,
                '@type': 'WebPage',
                'name': data.site.name + ' - База знаний Lineage II',
                'description': data.site.subtitle
            };
        }

        // Add JSON-LD to head
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.text = JSON.stringify(schemaData, null, 2);
        document.head.appendChild(script);

        console.log('[SEO] JSON-LD structured data added');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStructuredData);
    } else {
        initStructuredData();
    }
})();
