const { parseDOM } = require('htmlparser2');
const { selectAll, selectOne } = require('css-select');

function parseHtml(html, withIndices = false) {
  const options = {
    withStartIndices: withIndices,
    withEndIndices: withIndices,
    decodeEntities: true,
  };
  return parseDOM(html, options);
}

function getArrayText(elements, options) {
  return elements.reduce((textArray, element) => {
    // eslint-disable-next-line no-use-before-define
    const text = getText(element, options);

    if (Array.isArray(text)) {
      return [...textArray, ...text];
    }

    if (text && typeof text === 'string') {
      return [...textArray, text];
    }

    return textArray;
  }, []);
}

/*
Returns text value(s) from element nodes and its children. Options:
`separator`: String. Default is `', '`. The separator to be used for the `join` concatenation of
  child text values.
`shallowSearch`: Boolean. Default is `false`. If `true`, will only return the value for the first
  text node found.
`trim`: Boolean. Default is `true`. If `true`, whitespace will be trimmed from start and end of all
  text node values.
 */
function getText(element, options = {}) {
  const defaultOpts = { separator: ', ', shallowSearch: false, trim: true };
  const opts = { ...defaultOpts, ...options };

  if (!element) {
    return null;
  }

  if (Array.isArray(element)) {
    const textArray = getArrayText(element, opts);
    const returnText = opts.shallowSearch ? textArray[0] : textArray.join(opts.separator);

    return returnText || null;
  }

  if (element.type === 'text') {
    return opts.trim ? element.data.trim() : element.data;
  }

  if (element.children && element.type === 'tag') {
    return getText(element.children, opts);
  }

  return null;
}

function getAttribute(attribute, element = {}) {
  const { attribs } = Array.isArray(element) ? element[0] : element;

  if (attribute && attribs && attribs[attribute]) {
    return attribs[attribute];
  }

  return null;
}

/*
Query the element with a selector string or function. If an array of queries is given,
will only return results for the first query to find one or more matches.
*/
function select(query, element) {
  const queries = Array.isArray(query) ? query : [query];

  return queries.reduce((matches, q) => {
    if (!matches.length) {
      return selectAll(q, element);
    }

    return matches;
  }, []);
}

function getPropertiesMapFn(properties) {
  return (element) => {
    const propertiesReducer = (acc, [key, config]) => {
      // eslint-disable-next-line no-use-before-define
      const result = parseByConfig(config, element);
      return { ...acc, [key]: result };
    };

    return Object.entries(properties).reduce(propertiesReducer, {});
  };
}

/*
A config object can have the following properties:
- `query`: A string, fn, or array of string/fn which will be passed to `select` with `element`. If query is
  omitted, the config will be applied the current `element` argument.
- `attribute`: The string name of the attribute to be returned for the first matched item of the `query` result.
  Alternatively, use 'text' to get the result of `getText` on all the matched items of the `query` result.
- `separator` - used only when `attribute` is 'text' to override the default separator in `getText`.
- `properties` - Overrides `attribute`. An object whose property values are each config objects. Every
  item of the `query` result will be mapped over with `parseByConfig` using these config objects
  to assign the value of the associated key on the object returned by the map.
- `process` - Overrides `properties`. A fn that will be called with the value of the current element and
  the config object itself.
*/
function parseByConfig(config, element) {
  if (!config || !element) {
    return null;
  }

  const { attribute, properties, query } = config;
  if (config.process) {
    return config.process(element, config);
  }

  let found;

  if (query) {
    found = select(query, element);
  } else {
    found = Array.isArray(element) ? element : [element];
  }

  if (!Array.isArray(found) || !found.length || !element) {
    return null;
  }

  if (properties) {
    return found.map(getPropertiesMapFn(properties));
  }

  if (attribute === 'text') {
    return getText(found, config);
  }

  if (attribute) {
    return getAttribute(attribute, found, config);
  }

  return found;
}

module.exports = {
  getAttribute,
  getText,
  parseByConfig,
  parseHtml,
  select,
  selectAll,
  selectOne,
};
