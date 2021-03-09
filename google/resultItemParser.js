const { isKnowledgePanelEntry } = require('./knowledgePanelParser');
const { parseAnswerBox } = require('./answerBoxParser');
const { parseEventPack } = require('./eventPackParser');
const { parseFlightBox } = require('./flightBoxParser');
const { parseHotelPack } = require('./hotelPackParser');
const { parseImagePack } = require('./imagePackParser');
const { parseJobPack } = require('./jobPackParser');
const { parseLocalPack } = require('./localPackParser');
const { parseNewsPack } = require('./newsPackParser');
const { parsePeopleAlsoAsk } = require('./peopleAlsoAskParser');
const { parseRichContent } = require('./richContentParser');
const { parseSalaryPack } = require('./salaryPackParser');
const { parseVideoPack } = require('./videoPackParser');
const { getText, parseByConfig, select } = require('../utils/parser');
const { GOOGLE_FEATURE_URL } = require('../utils/constants');

// pipe utility fn for composing fns
const pipe = (...fns) => (initialValue) => fns.reduce((acc, fn) => fn(acc), initialValue);

function wrapElement(resultObject) {
  const { element } = resultObject;

  // CSS select fns only query element's children. Wrapping in an array allows queries to reference the root element.
  return { ...resultObject, element: [element] };
}

function parseTitle(element, isMobile) {
  const desktopQuery = [
    'h3', // answer box and desktop, Mar 2020
    'g-section-with-header g-link', // desktop twitter, Mar 2020
    '[role="heading"]', // google features, Mar 2020
    'h2',
    'h1',
  ];

  const mobileQuery = [
    'div#wp-tabs-container [data-attrid=title]', // mobile knowledge-panel section, Apr 2020
    'div#wp-tabs-container h2', // mobile knowledge-panel page-wrap, Apr 2020
    'g-card-section .zTpPx.ellip', // twitter, Jan 2021
    'div.ifM9O h3', // mobile answerbox, Jan 2021
    '[role="heading"]', // google features and mobile, Mar 2020
    'g-card .aDrpNd', // google features, Jan 2021
    'h3',
    'h2',
    'h1',
  ];

  const [titleElement] = select(isMobile ? mobileQuery : desktopQuery, element);
  return getText(titleElement);
}

function parseDescription(element) {
  const query = [
    'div.LGOjhe span.e24Kjd', // answerbox [paragraph], Mar 2020
    'div.BmP5tf div.MUxGbd', // mobile, Mar 2020
    'div.IsZvec span.aCOpRe', // desktop, Oct 2020
    'div.s > div > span.st', // desktop, Mar 2020
  ];

  const [descriptionElement] = select(query, element);
  const description = getText(descriptionElement, { separator: '', trim: false });

  if (typeof description === 'string') {
    // Remove prefix from description text
    const prefixQuery = [
      'span.MUxGbd', // mobile, Mar 2020
      'span.f', // desktop, Mar 2020
    ];
    const [prefixElement] = select(prefixQuery, descriptionElement);
    const prefix = getText(prefixElement);

    const descriptionBase = description.replace(`${prefix} `, '');

    return { base: descriptionBase, prefix };
  }

  return { base: null, prefix: null };
}

function parseUrl(element) {
  const config = {
    query: [
      'a.C8nzq[href]', // mobile, Mar 2020
      'div.r a[href]', // desktop, Jun 2020
      'g-link > a[href]', // twitter, Mar 2020
      'div.yuRUbf a[href]', // desktop, Sep 2020
      'h3 > a', // youtube, Mar 2020
    ],
    attribute: 'href',
  };

  return parseByConfig(config, element) || GOOGLE_FEATURE_URL;
}

function parseResultDate(text) {
  if (typeof text === 'string') {
    const regex = /\d{1,2} (?:minutes?|days?|hours?|mins?) ago|[A-Z][a-z]{2} \d{1,2}, \d{4}/;
    const [match] = text.match(regex) || [];
    return match || null;
  }

  return null;
}

function getIsAmp(element) {
  const query = 'a.C8nzq'; // mobile, Jun 2020
  return !!parseByConfig({ query, attribute: 'data-amp' }, element);
}

function parseCommonProperties(resultObject) {
  const { element, request } = resultObject;
  const { mobile: isMobile = false } = request;
  const { base: descriptionBase, prefix: descriptionPrefix } = parseDescription(element);
  const isKnowledgeCard = isKnowledgePanelEntry(element);
  const url = isKnowledgeCard ? GOOGLE_FEATURE_URL : parseUrl(element);

  const parsed = {
    url,
    title: parseTitle(element, isMobile),
    description: descriptionBase,
    resultDate: parseResultDate(descriptionPrefix),
    isAmp: getIsAmp(element),
    isKnowledgeCard,
  };

  return { ...resultObject, parsed };
}

function addAnswerBox(resultObject) {
  const { element, parsed } = resultObject;
  const answerBox = parseAnswerBox(element);
  const url = answerBox?.url ?? parsed.url;

  return { ...resultObject, parsed: { ...parsed, url, answerBox } };
}

function addNewsPack(resultObject) {
  const { element, parsed } = resultObject;
  const newsPack = parseNewsPack(element);

  return { ...resultObject, parsed: { ...parsed, newsPack } };
}

function addImagePack(resultObject) {
  const { element, parsed } = resultObject;
  const imagePack = parseImagePack(element);

  return { ...resultObject, parsed: { ...parsed, imagePack } };
}

function addVideoPack(resultObject) {
  const { element, parsed } = resultObject;

  const videoPack = parseVideoPack(element);
  return { ...resultObject, parsed: { ...parsed, videoPack } };
}

function addEventPack(resultObject) {
  const { element, parsed } = resultObject;
  const eventPack = parseEventPack(element);

  return { ...resultObject, parsed: { ...parsed, eventPack } };
}

function addFlightBox(resultObject) {
  const { element, parsed } = resultObject;
  const flightBox = parseFlightBox(element);

  return { ...resultObject, parsed: { ...parsed, flightBox } };
}

function addJobPack(resultObject) {
  const { element, parsed } = resultObject;
  const jobPack = parseJobPack(element);

  return { ...resultObject, parsed: { ...parsed, jobPack } };
}

function addSalaryPack(resultObject) {
  const { element, parsed } = resultObject;
  const salaryPack = parseSalaryPack(element);

  return { ...resultObject, parsed: { ...parsed, salaryPack } };
}

function addLocalPack(resultObject) {
  const { element, parsed, request } = resultObject;
  const localPack = parseLocalPack(element, { locale: request.locale });

  return { ...resultObject, parsed: { ...parsed, localPack } };
}

function addHotelPack(resultObject) {
  const { element, parsed } = resultObject;
  const hotelPack = parseHotelPack(element);

  return { ...resultObject, parsed: { ...parsed, hotelPack } };
}

function addPeopleAlsoAsk(resultObject) {
  const { element, parsed } = resultObject;
  const peopleAlsoAsk = parsePeopleAlsoAsk(element);

  return { ...resultObject, parsed: { ...parsed, peopleAlsoAsk } };
}

// TODO: move to rich content parser
function addHasThumbnails(resultObject) {
  const { element, parsed } = resultObject;
  const hasThumbnail = !!select('g-img.BA0A6c > img.rISBZc', element).length;

  const hasVideoThumbnail = !!select([
    'div.Woharf.LQFTgb',
    'div.WfVh8d.Lw2oL',
    'span.vdur',
    'div.OIL2le',
  ], element).length;

  return { ...resultObject, parsed: { ...parsed, hasThumbnail, hasVideoThumbnail } };
}

function addOrganicRichContent(resultObject) {
  const { element, parsed } = resultObject;
  const richContent = parseRichContent(element);

  return { ...resultObject, parsed: { ...parsed, richContent } };
}

function updateKnowledgePanelTitle(resultObject) {
  const { parsed, request } = resultObject;
  const { mobile: isMobile = false } = request;

  if (isMobile && parsed.isKnowledgeCard) {
    const title = parsed.title ? `${parsed.title} (Knowledge Card)` : 'Knowledge Card';

    return { ...resultObject, parsed: { ...parsed, title } };
  }

  return resultObject;
}

function setMetaData(resultObject) {
  const { element, parsed } = resultObject;
  const [unwrappedElement = {}] = element;
  const { startIndex = null } = unwrappedElement;
  const meta = {
    type: 'organic',
    startIndex,
  };

  return { ...resultObject, parsed: { ...parsed, _meta: meta } };
}

function checkIfEmptyResult({ element, parsed }) {
  if (!parsed.title && !parsed.description && !getText(element)) {
    return null;
  }

  return parsed;
}

module.exports.parseResultItem = (element, request) => pipe(
  wrapElement,
  parseCommonProperties,
  addAnswerBox,
  addNewsPack,
  addImagePack,
  addVideoPack,
  addEventPack,
  addFlightBox,
  addJobPack,
  addSalaryPack,
  addLocalPack,
  addHotelPack,
  addPeopleAlsoAsk,
  addHasThumbnails,
  addOrganicRichContent,
  updateKnowledgePanelTitle,
  setMetaData,
  checkIfEmptyResult,
)({ element, request });
