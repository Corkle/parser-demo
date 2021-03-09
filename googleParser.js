const { parseResultItem } = require('./google/resultItemParser');
const resultFormatV1 = require('./resultFormat/googleV1');
const { isKnowledgePanelEntry, parseKnowledgePanel } = require('./google/knowledgePanelParser');
const { parseAds } = require('./google/adParser');
const { parseLocalServiceAd } = require('./google/localServiceAdParser');
const { parseShoppingBox } = require('./google/shoppingBoxParser');
const {
  getText,
  parseHtml,
  select,
  selectAll,
} = require('./utils/parser');

function isNotNullOrUndefined(value) {
  return value !== null && value !== undefined;
}

function flatten(acc, array) {
  const val = Array.isArray(array) ? array : [array];
  return [...acc, ...val];
}

function isExpectedHtmlPlatform(document, request) {
  const { mobile: isMobileRequest = false } = request;
  const [desktopBody] = select('body#gsr', document);
  const isMobileDocument = !desktopBody;

  return isMobileDocument === isMobileRequest;
}

function parseAutoCorrectText(element) {
  const [autoCorrectElement] = select('div#taw a#fprsl', element);
  const value = getText(autoCorrectElement, { separator: ' ' });

  if (value) {
    const { startIndex = null } = autoCorrectElement;

    return { _meta: { type: 'autoCorrectText', startIndex }, value };
  }

  return null;
}

function parseDidYouMeanText(element) {
  const [featureElement] = select('div#taw p.gqLncc.card-section a.gL9Hy', element);
  const value = getText(featureElement, { separator: ' ' });

  if (value) {
    const { startIndex = null } = featureElement;

    return { _meta: { type: 'didYouMeanText', startIndex }, value };
  }

  return null;
}

function parseRelatedSearches(element) {
  const relatedItemElements = select([
    'div#brs p.nVcaUb a', // desktop, Apr 2020
    'div#bres div.DExtrc a.F3dFTe div.s75CSd', // mobile, Apr 2020
    'div#bres a.k8XOCe div.s75CSd', // some desktop, Sep 2020
  ], element);

  if (relatedItemElements.length) {
    const { startIndex = null } = relatedItemElements[0];
    const items = relatedItemElements.map((el) => getText(el, { separator: ' ' }));

    return { _meta: { type: 'relatedSearches', startIndex }, items };
  }

  return null;
}

function parseInvalidSearch(element) {
  const topStuffElements = select('div#topstuff [role=heading]', element);

  return topStuffElements.reduce((acc, el) => {
    const text = getText(el) || '';
    const isInvalidSearch = text.includes('did not match any documents');
    const { startIndex = null } = el;
    const meta = { type: 'NoMatchingSearchResults', startIndex };

    return !acc && isInvalidSearch ? { _meta: meta, value: text } : null;
  }, null);
}

function parseTotalResultsCount(element) {
  const [resultCountElement] = select('div#result-stats', element);
  const resultsText = getText(resultCountElement) || '';
  const [count] = resultsText
    .replace(/[,.]/g, '')
    .match(/[0-9]+/) || [null];

  if (typeof count === 'string') {
    const value = parseInt(count, 10) || null;
    const { startIndex = null } = resultCountElement;

    return { _meta: { type: 'totalSearchResults', startIndex }, value };
  }

  return null;
}

function getContainers(document) {
  const containerQuery = [
    'div#rso > div:not([tabindex="-1"])', // ignore navigation links
    'div#rso > g-card', // Mar 2020
    'div#rso > g-inner-card', // flights, Apr 2020
    'div#rso > g-section-with-header', // May 2020
    'div#appbar div.rl_feature', // events feature, Mar 2020
  ];

  const containers = selectAll(containerQuery, document);

  // Some mobile knowledge panel results wrap the whole page's results in a tabbed knowledge element.
  // If this is the case (i.e. the containers are all knowledge panels), break into smaller pieces.
  if (containers.every(isKnowledgePanelEntry)) {
    return containers.reduce((acc, currentContainer) => {
      const wholePageSubContainers = select('div#kp-wp-tab-overview > div', currentContainer);

      return wholePageSubContainers.length ? [...acc, ...wholePageSubContainers] : [...acc, currentContainer];
    }, []);
  }

  return containers;
}

// If container has no features, the organic result with site links needs a query that
// returns the parent element of the base result and the site links table.
function getDesktopResultWithSiteLinksElement(container) {
  const resultElements = select('div.g > div', container);

  const hasSiteLinks = (element) => {
    const [organicResult] = select('div.tF2Cxc', element);
    const [siteLinksTable] = select('table.jmjoTe', element);

    return organicResult && siteLinksTable;
  };

  return resultElements.filter(hasSiteLinks);
}

function getDesktopResultElements(container) {
  const query = [
    'div.srg div.g', // Mar 2020
    'div.g > div.rc', // Mar 2020
    'div.g > div.tF2Cxc', // Jan 2021
    'div.kp-blk.cUnQKe', // override for people also ask which may contain organic selectors
  ];

  const resultElements = selectAll(query, container);
  const resultsWithSiteLinks = getDesktopResultWithSiteLinksElement(container);

  return [...resultsWithSiteLinks, ...resultElements];
}

function getMobileResultElements(container) {
  const query = [
    'div.mnr-c.xpd', // Mar 2020
    'g-card.XqIXXe', // results with embedded video packs, Mar 2020
    'div.mnr-c.srg', // Google Play results, Mar 2020
  ];

  return selectAll(query, container);
}

function getFnGetResultElements(isMobile) {
  return function getResultElements(container) {
    const getElements = isMobile ? getMobileResultElements : getDesktopResultElements;

    const resultElements = getElements(container);
    const hasMultipleElements = resultElements.length > 1;

    // If container has organic results, return those results.
    // Otherwise, the container is a feature.
    // If container has only one organic result, it could be a result embedded in a feature.
    return hasMultipleElements ? resultElements : [container];
  };
}

function filterUniqueElements(element, index, allResults) {
  const doesAContainB = (a, b) => b.startIndex > a.startIndex && b.startIndex < a.endIndex;

  if (!element || !element.startIndex) {
    return false;
  }

  // Is element contained in another result element
  const isNested = allResults.some((testElement) => doesAContainB(testElement, element));
  // Does element exist in the array more than once
  const isDuplicate = allResults.indexOf(element) !== index;

  return !(isNested || isDuplicate);
}

function parseSearchResultFeatures(element, request) {
  const isMobile = request.mobile;

  return getContainers(element)
    .map(getFnGetResultElements(isMobile))
    .reduce(flatten, [])
    .filter(filterUniqueElements)
    .filter(isNotNullOrUndefined)
    .map((el) => parseResultItem(el, request));
}

function parseBottomExtraFeatures(document) {
  const bottomExtrasContainer = select('div#botstuff', document);

  return [
    parseRelatedSearches(bottomExtrasContainer),
    // TODO: parseRelatedKnowledge(bottomExtrasContainer),
  ];
}

function setColumnNumber(columnNumber) {
  return (parsedObject) => {
    const { _meta = {} } = parsedObject;
    const metadata = { ..._meta, column: columnNumber };

    return { ...parsedObject, _meta: metadata };
  };
}

function parseAppBarFeatures(document) {
  const appbar = select('div#appbar', document);
  const totalResults = parseTotalResultsCount(appbar);

  return [totalResults]
    .filter(isNotNullOrUndefined)
    .map(setColumnNumber(-1));
}

function parseColumn1(document, request) {
  const column1 = select('div#center_col', document);
  const adArray = parseAds(column1) || [];
  const localServiceAdArray = parseLocalServiceAd(column1) || [];
  const shoppingBoxArray = parseShoppingBox(column1) || [];

  return [
    parseInvalidSearch(column1),
    parseAutoCorrectText(column1),
    parseDidYouMeanText(column1),
    ...adArray,
    ...localServiceAdArray,
    ...shoppingBoxArray,
    parseKnowledgePanel(column1),
    ...parseSearchResultFeatures(column1, request),
    ...parseBottomExtraFeatures(column1),
  ].filter(isNotNullOrUndefined)
    .map(setColumnNumber(1));
}

function parseColumn2(document) {
  const column2 = select('div#rhs', document);

  const shoppingBoxArray = parseShoppingBox(column2) || [];
  const knowledgePanel = parseKnowledgePanel(column2);

  return [
    ...shoppingBoxArray,
    knowledgePanel,
  ].filter(isNotNullOrUndefined)
    .map(setColumnNumber(2));
}

function parse(html, request) {
  const document = parseHtml(html, true);

  if (!isExpectedHtmlPlatform(document, request)) {
    throw new Error('HTML did not match requested user agent platform.');
  }

  const result = {
    parsedFeatures: [
      ...parseAppBarFeatures(document),
      ...parseColumn1(document, request),
      ...parseColumn2(document),
    ],
    parseDate: Date.now(),
  };

  return resultFormatV1.format(result, request);
}

module.exports = { parse };
