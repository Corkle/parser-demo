/* eslint-disable max-len */
const {
  getAttribute,
  getText,
  parseByConfig,
  parseHtml,
  select,
} = require('./parser');

describe('parseHtml', () => {
  test('should convert html string to javascript objects with expected properties', () => {
    const html = '<div class="my-class" my-attrib><div></div><h1>heading</h1></div>';
    const [parsed] = parseHtml(html);

    expect(typeof parsed).toEqual('object');
    expect(parsed).toHaveProperty('type');
    expect(typeof parsed.type).toEqual('string');
    expect(parsed).toHaveProperty('name');
    expect(typeof parsed.name).toEqual('string');
    expect(parsed).toHaveProperty('children');
    expect(Array.isArray(parsed.children));
    expect(parsed.children.length).toEqual(2);
    expect(parsed).toHaveProperty('attribs');
    expect(Array.isArray(parsed.attribs));
    expect(parsed).toHaveProperty('attribs.class', 'my-class');
    expect(parsed).toHaveProperty('attribs.my-attrib', '');
  });
});

describe('getText', () => {
  test('should return null if element is null or undefined', () => {
    expect(getText()).toEqual(null);
    expect(getText(undefined)).toEqual(null);
    expect(getText(null)).toEqual(null);
  });

  test('should return a string if element contains only text', () => {
    const html = '<span>This is the content</span>';
    const element = parseHtml(html);
    const expected = 'This is the content';

    const text = getText(element);
    expect(text).toEqual(expected);
  });

  test('should return a string if element contains only one child with text', () => {
    const html = '<div><div></div><span>This is the content</span></div>';
    const element = parseHtml(html);
    const expected = 'This is the content';

    const text = getText(element);
    expect(text).toEqual(expected);
  });

  test('should return string with comma separated text if element contains multiple text nodes', () => {
    const html = '<div><span>Foo</span><span>Bar</span></div>';
    const element = parseHtml(html);
    const expected = 'Foo, Bar';

    const text = getText(element);
    expect(text).toEqual(expected);
  });

  test('should return string of all nested text if element contains multiple children with text nodes', () => {
    const html = '<div><div class="foo"><span>foo1</span><span>foo2</span></div><div class="bar"><span>bar1</span><span>bar2</span></div></div>';
    const element = parseHtml(html);
    const expected = 'foo1, foo2, bar1, bar2';

    const text = getText(element);
    expect(text).toEqual(expected);
  });

  test('should return null if element has children of which none have text', () => {
    const html = '<div><span class="a"></span><span class="b"></span><span class="c"></span><span class="d"></span></div>';
    const element = parseHtml(html);
    const expected = null;

    const text = getText(element);
    expect(text).toEqual(expected);
  });

  test('with no options parameter (default), should return expected result', () => {
    const html = '<div><div class="foo"><span> foo1 </span><span> foo2 </span></div><div class="bar"><span> bar1 </span><span> bar2 </span></div></div>';
    const element = parseHtml(html);
    const expected = 'foo1, foo2, bar1, bar2';

    const textA = getText(element);
    expect(textA).toEqual(expected);

    const defaultOptions = { trim: true, separator: ', ', shallowSearch: false };
    const textB = getText(element, defaultOptions);
    expect(textB).toEqual(expected);
  });

  test('with option separator used, should use specified join separator', () => {
    const html = '<div><div class="foo"><span> foo1 </span><span> foo2 </span></div><div class="bar"><span> bar1 </span><span> bar2 </span></div></div>';
    const element = parseHtml(html);
    const expected = 'foo1-foo2-bar1-bar2';

    const options = { separator: '-' };
    const text = getText(element, options);
    expect(text).toEqual(expected);
  });

  test('with option shallowSearch: true, should only return first text value found', () => {
    const html = '<div><div></div></div><div class="foo"><span> foo1 </span><span> foo2 </span></div><div class="bar"><span> bar1 </span><span> bar2 </span></div></div>';
    const element = parseHtml(html);
    const expected = 'foo1';

    const options = { shallowSearch: true };
    const text = getText(element, options);
    expect(text).toEqual(expected);
  });

  test('with option trim = false, should not trim whitespace in result', () => {
    const html = '<div><div class="foo"><span> foo1 </span><span> foo2 </span></div><div class="bar"><span> bar1 </span><span> bar2 </span></div></div>';
    const element = parseHtml(html);
    const expected = ' foo1 ,  foo2 ,  bar1 ,  bar2 ';

    const options = { trim: false };
    const text = getText(element, options);
    expect(text).toEqual(expected);
  });
});

describe('getAttribute', () => {
  test('should return value of specified attribute in a single element', () => {
    const html = '<a href="myhref.com" class="link">link</a>';
    const [element] = parseHtml(html);

    const value = getAttribute('href', element);
    expect(value).toEqual('myhref.com');
  });

  test('should return attribute value of first element when passing array of elements', () => {
    const html = '<a href="yourhref.com" class="link">link</a><a href="myhref" class="link">link2</a>';
    const document = parseHtml(html);

    const value = getAttribute('href', document);
    expect(value).toEqual('yourhref.com');
  });

  test('should return null if first element does not contain specified attribute', () => {
    const html = '<div></div><a href="myhref.com" class="link">link</a><a href="yourhref" class="link">link2</a>';
    const document = parseHtml(html);

    const value = getAttribute('href', document);
    expect(value).toEqual(null);
  });
});

describe('parseByConfig', () => {
  test('should return null if root query finds no elements', () => {
    const html = '<div class="my-class"><div></div><h1>heading</h1></div>';
    const document = parseHtml(html);
    const config = { query: 'div#abcdefg' };

    const result = parseByConfig(config, document);
    expect(result).toEqual(null);
  });

  test('should return element array if query does not specify attribute or properties', () => {
    const html = '<div><div></div><h1 class="title">heading</h1></div>';
    const document = parseHtml(html);
    const config = { query: 'h1' };

    const result = parseByConfig(config, document);
    expect(Array.isArray(result));
    expect(result[0].type).toEqual('tag');
    expect(result[0].name).toEqual('h1');
    expect(result[0].attribs).toEqual({ class: 'title' });
  });

  test('should return text of selection if attribute: text specified', () => {
    const html = '<div><div></div><h1 class="title">heading</h1></div>';
    const document = parseHtml(html);
    const config = { query: 'h1', attribute: 'text' };
    const expected = 'heading';

    const result = parseByConfig(config, document);
    expect(result).toEqual(expected);
  });

  test('should return combined text of selection if attribute: text specified and query matches multiple elements', () => {
    const html = '<div><p>first</p><p>second</p><p>third</p></div>';
    const document = parseHtml(html);
    const config = { query: 'p', attribute: 'text' };
    const expected = 'first, second, third';

    const result = parseByConfig(config, document);
    expect(result).toEqual(expected);
  });

  test('should return combined text attribute with specified separator', () => {
    const html = '<div><p>first</p><p>second</p><p>third</p></div>';
    const document = parseHtml(html);
    const config = { query: 'p', attribute: 'text', separator: ' - ' };
    const expected = 'first - second - third';

    const result = parseByConfig(config, document);
    expect(result).toEqual(expected);
  });

  test('should return null if attribute: text specified and no text is in selection', () => {
    const html = '<div><div>text outside of selection</div><div id="main"></divm></div>';
    const document = parseHtml(html);
    const config = { query: 'div#main', attribute: 'text' };

    const result = parseByConfig(config, document);
    expect(result).toEqual(null);
  });

  test('should return value of specified attribute for selection', () => {
    const html = '<div><a href="myhref.com" class="link">link</a><div></div></div>';
    const document = parseHtml(html);
    const config = { query: 'a[href]', attribute: 'href' };

    const result = parseByConfig(config, document);
    expect(result).toEqual('myhref.com');
  });

  test('should return attribute value of first element if selection includes multiple elements', () => {
    const html = '<div><a href="yourhref.com" class="link">link</a><a href="myhref" class="link">link2</a></div>';
    const document = parseHtml(html);
    const config = { query: 'a[href]', attribute: 'href' };

    const result = parseByConfig(config, document);
    expect(result).toEqual('yourhref.com');
  });

  test('should return null if selection does not have specified attribute', () => {
    const html = '<div><a href="myhref.com" class="link">link</a><a href="yourhref" class="link">link2</a></div>';
    const document = parseHtml(html);
    const config = { query: 'a', attribute: 'custom-attrib' };

    const result = parseByConfig(config, document);
    expect(result).toEqual(null);
  });

  test('should parse properties of config as nested configs', () => {
    const html = '<div id="main"><h1>My Title</h1><a href="myhref.com">link</a></div>';
    const document = parseHtml(html);
    const config = {
      query: 'div#main',
      properties: {
        url: { query: 'a[href]', attribute: 'href' },
        title: { query: 'h1', attribute: 'text' },
      },
    };

    const expected = [
      {
        url: 'myhref.com',
        title: 'My Title',
      },
    ];

    const result = parseByConfig(config, document);
    expect(result).toEqual(expected);
  });

  test('should parse all elements matching root query using the same properties configs', () => {
    const html = '<div class="item"><h1>Title A</h1><a href="aaa.com">A</a></div><div class="item"><h1>Title B</h1><a href="bbb.com">B</a></div>';
    const document = parseHtml(html);
    const config = {
      query: 'div.item',
      properties: {
        linkText: { query: 'a', attribute: 'text' },
        url: { query: 'a[href]', attribute: 'href' },
        title: { query: 'h1', attribute: 'text' },
      },
    };

    const expected = [
      {
        linkText: 'A',
        url: 'aaa.com',
        title: 'Title A',
      },
      {
        linkText: 'B',
        url: 'bbb.com',
        title: 'Title B',
      },
    ];

    const result = parseByConfig(config, document);
    expect(result).toEqual(expected);
  });

  test('should run the passed-in fn with the current element if the config contains process', () => {
    const html = '<div class="item"><a href="aaa.com">123</a></div><div class="item"><a href="bbb.com">1234567</a></div>';
    const document = parseHtml(html);
    const config = {
      query: 'div.item',
      properties: {
        url: { query: 'a[href]', attribute: 'href' },
        linkText: { query: 'a', attribute: 'text' },
        linkTextLength: { process: (el) => getText(el).length },
      },
    };

    const expected = [
      {
        url: 'aaa.com',
        linkText: '123',
        linkTextLength: 3,
      },
      {
        url: 'bbb.com',
        linkText: '1234567',
        linkTextLength: 7,
      },
    ];

    const result = parseByConfig(config, document);
    expect(result).toEqual(expected);
  });

  test('if query is omitted, should apply properties parsing to the current element', () => {
    const html = '<div class="item"><a href="aaa.com">123</a></div>';
    const [element] = parseHtml(html);
    const config = {
      properties: {
        url: { query: 'a[href]', attribute: 'href' },
        linkText: { query: 'a', attribute: 'text' },
        linkTextLength: { process: (el) => getText(el).length },
      },
    };

    const expected = [
      {
        url: 'aaa.com',
        linkText: '123',
        linkTextLength: 3,
      },
    ];

    const result = parseByConfig(config, element);
    expect(result).toEqual(expected);
  });

  test('if query is omitted and element is array of elements, should apply properties parsing to each element', () => {
    const html = '<div class="item"><a href="aaa.com">123</a></div><div class="item"><a href="bbb.com">1234567</a></div>';
    const document = parseHtml(html);
    const config = {
      properties: {
        url: { query: 'a[href]', attribute: 'href' },
        linkText: { query: 'a', attribute: 'text' },
        linkTextLength: { process: (el) => getText(el).length },
      },
    };

    const expected = [
      {
        url: 'aaa.com',
        linkText: '123',
        linkTextLength: 3,
      },
      {
        url: 'bbb.com',
        linkText: '1234567',
        linkTextLength: 7,
      },
    ];

    const elements = select('div.item', document);
    expect(elements.length).toBe(2);
    const result = parseByConfig(config, elements);
    expect(result).toEqual(expected);
  });

  test('if query is omitted and element is falsy or empty array, should return null', () => {
    const config = { attribute: 'href' };

    const expected = null;

    const resultA = parseByConfig(config, null);
    expect(resultA).toEqual(expected);

    const resultB = parseByConfig(config, []);
    expect(resultB).toEqual(expected);
  });
});

describe('select', () => {
  test('with a single query string, should return matched results', () => {
    const html = '<div><p>first</p><p>second</p><p>third</p></div>';
    const document = parseHtml(html);
    const query = 'div > p';

    const result = select(query, document);
    expect(result.length).toEqual(3);
    expect(result[0].type).toEqual('tag');
    expect(result[0].name).toEqual('p');
  });

  test('with an array of query strings, should return results only for the first query to match', () => {
    const html = '<div><h1>title</h1><p>first</p><b><p>second</p></b><p>third</p></div>';
    const document = parseHtml(html);
    const query = [
      'h2',
      'h1',
      'div > p',
    ];

    const result = select(query, document);
    expect(result.length).toEqual(1);
    expect(result[0].type).toEqual('tag');
    expect(result[0].name).toEqual('h1');
  });

  test('with a non-matching query, should return an empty array', () => {
    const html = '<div><p>first</p><b><p>second</p></b><p>third</p></div>';
    const document = parseHtml(html);
    const query = 'h2';

    const result = select(query, document);
    expect(result).toEqual([]);
  });
});
