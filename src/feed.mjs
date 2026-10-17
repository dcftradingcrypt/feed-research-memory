import { SaxesParser } from 'saxes';

const ATOM = 'http://www.w3.org/2005/Atom';
const DC = 'http://purl.org/dc/elements/1.1/';
const CONTENT = 'http://purl.org/rss/1.0/modules/content/';
const XHTML = 'http://www.w3.org/1999/xhtml';
const BLOCKS = new Set(['div', 'p', 'br', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre']);
const textOf = (node) => node.text.trim();
const children = (node, name, uri = node.uri) => node.children.filter((n) => n.local === name && n.uri === uri);
const firstIn = (node, uri, name) => children(node, name, uri).map(textOf).find(Boolean) || '';
const first = (node, ...names) => {
  for (const name of names) {
    const found = children(node, name).find((n) => textOf(n));
    if (found) return textOf(found);
  }
  return '';
};

function httpUrl(value, base, stripFragment = false) {
  if (!value) return '';
  try {
    const url = new URL(value, base);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (stripFragment) url.hash = '';
    return url.href;
  } catch { return ''; }
}

function isoDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toISOString();
}

/** Parse an RSS 2.0 or Atom 1.0 document without fetching linked content. */
export function parseFeed(xml, sourceUrl) {
  const source = httpUrl(sourceUrl, undefined, true);
  if (!source) throw new Error('The feed source must be an absolute HTTP(S) URL.');
  const parser = new SaxesParser({ xmlns: true });
  const document = { children: [], text: '', base: source };
  const stack = [document];
  const appendText = (value) => { for (const node of stack) node.text += value; };
  parser.on('opentag', (tag) => {
    if (tag.uri === XHTML) {
      if (BLOCKS.has(tag.local)) appendText('\n');
      else if (tag.local === 'td' || tag.local === 'th') appendText('\t');
    }
    const parent = stack.at(-1);
    const attrs = Object.fromEntries(Object.values(tag.attributes).map((a) => [a.name, a.value]));
    const base = httpUrl(attrs['xml:base'], parent.base) || parent.base;
    const node = { local: tag.local, uri: tag.uri, attrs, base, text: '', children: [] };
    parent.children.push(node);
    stack.push(node);
  });
  parser.on('text', appendText);
  parser.on('cdata', appendText);
  parser.on('closetag', (tag) => {
    if (tag.uri === XHTML && BLOCKS.has(tag.local)) appendText('\n');
    stack.pop();
  });
  parser.write(xml).close();
  const root = document.children[0];
  let entries;
  let title;
  let format;
  if (root?.local === 'feed' && root.uri === ATOM) {
    format = 'atom';
    title = first(root, 'title');
    entries = children(root, 'entry').map((entry) => {
      const links = children(entry, 'link');
      const link = links.find((n) => (!n.attrs.rel || n.attrs.rel === 'alternate') && httpUrl(n.attrs.href, n.base));
      const url = link ? httpUrl(link.attrs.href, link.base) : '';
      return {
        id: first(entry, 'id') || url,
        url,
        title: first(entry, 'title'),
        summary: first(entry, 'summary', 'content'),
        author: (children(entry, 'author').length ? children(entry, 'author') : children(root, 'author'))
          .map((n) => first(n, 'name')).filter(Boolean).join('; '),
        published: isoDate(first(entry, 'published')),
        updated: isoDate(first(entry, 'updated')),
        categories: children(entry, 'category').map((n) => n.attrs.term).filter(Boolean),
      };
    });
  } else if (root?.local === 'rss' && root.attrs.version === '2.0') {
    const channel = children(root, 'channel')[0];
    if (!channel) throw new Error('RSS document has no channel.');
    format = 'rss';
    title = first(channel, 'title');
    entries = children(channel, 'item').map((entry) => {
      const link = children(entry, 'link')[0];
      const guid = children(entry, 'guid')[0];
      const permalink = guid && guid.attrs.isPermaLink !== 'false' ? httpUrl(textOf(guid)) : '';
      const url = (link ? httpUrl(textOf(link), link.base) : '') || permalink;
      return {
        id: first(entry, 'guid') || url,
        url,
        title: first(entry, 'title'),
        summary: first(entry, 'description') || firstIn(entry, CONTENT, 'encoded'),
        author: first(entry, 'author') || firstIn(entry, DC, 'creator'),
        published: isoDate(first(entry, 'pubDate') || firstIn(entry, DC, 'date')),
        updated: '',
        categories: children(entry, 'category').map(textOf).filter(Boolean),
      };
    });
  } else {
    throw new Error('Expected an RSS 2.0 or Atom 1.0 feed.');
  }
  for (const [index, entry] of entries.entries()) {
    if (!entry.id) throw new Error(`Entry ${index + 1} has no stable id, guid or HTTP(S) link.`);
    entry.categories = [...new Set(entry.categories)].sort();
  }
  return { source, title, format, entries };
}
