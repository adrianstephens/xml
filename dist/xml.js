"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultEntityCreator = exports.EntityCreator = exports.reENTITY = exports.Element = exports.defaultEntities = exports.criticalEntities = exports.DocType = exports.CDATA = exports.Comment = void 0;
exports.isElement = isElement;
exports.isText = isText;
exports.isComment = isComment;
exports.isDocType = isDocType;
exports.isCDATA = isCDATA;
exports.decodeEntity = decodeEntity;
exports.removeEntities = removeEntities;
exports.writeAttributes = writeAttributes;
exports.parseAttributes = parseAttributes;
exports.sax = sax;
exports.parse = parse;
class Comment {
    comment;
    constructor(comment) {
        this.comment = comment;
    }
    toString() { return `<!--${this.comment}-->`; }
}
exports.Comment = Comment;
class CDATA {
    cdata;
    constructor(cdata) {
        this.cdata = cdata;
    }
    toString() { return `<![CDATA[${this.cdata.replace(']]>', ']]]]><![CDATA[>')}]]>`; }
}
exports.CDATA = CDATA;
class DocType {
    doctype;
    constructor(doctype) {
        this.doctype = doctype;
    }
    toString() { return `<!DOCTYPE ${this.doctype}>`; }
}
exports.DocType = DocType;
function isElement(arg) { return typeof (arg) == 'object' && 'name' in arg; }
function isText(arg) { return typeof (arg) == 'string'; }
function isComment(arg) { return typeof (arg) == 'object' && 'comment' in arg; }
function isDocType(arg) { return typeof (arg) == 'object' && 'doctype' in arg; }
function isCDATA(arg) { return typeof (arg) == 'object' && 'cdata' in arg; }
exports.criticalEntities = {
    amp: '&',
    gt: '>',
    lt: '<',
};
exports.defaultEntities = { ...exports.criticalEntities, quot: '"' };
class Element {
    name;
    attributes;
    children;
    next;
    parent;
    _elements;
    options;
    constructor(name, attributes = {}, children = []) {
        this.name = name;
        this.attributes = attributes;
        this.children = children;
        for (const i of children) {
            if (isElement(i))
                i.parent = this;
        }
    }
    get elements() {
        if (!this._elements) {
            this._elements = {};
            for (const i of this.allElements().reverse()) {
                i.next = this.elements[i.name];
                this._elements[i.name] = i;
            }
        }
        return this._elements;
    }
    firstElement() { return this.children.find(i => isElement(i)); }
    firstText() { return this.children.find(i => isText(i)); }
    allText() { return this.children.filter(i => isText(i)); }
    allElements() { return this.children.filter(i => isElement(i)); }
    toString(options) {
        options = { indent: '  ', afteratt: '', ...options, ...this.options };
        if (!options.entities || !(options.entities instanceof EntityCreator)) {
            options.entities = new EntityCreator({ ...exports.criticalEntities, ...options?.entities });
            options.entities_att = new EntityCreator({ quot: '"' }, options.entities);
        }
        const newline = options?.newline ?? '\n';
        let xml = `<${this.name}${writeAttributes(this.attributes, options.entities_att, options.afteratt)}`;
        if (this.name.startsWith('?'))
            return xml += '?>' + newline + this.children[0].toString(options);
        if (this.children.length || this.attributes['xml:space'] === 'preserve') {
            const entities = options.entities;
            const nextline = newline + options.indent;
            options = { ...options, newline: nextline };
            let result = [xml, '>', ...this.children.map(i => isText(i) ? entities.replace(i) : nextline + i.toString(options))].join('');
            if (this.children.length > 1 || !isText(this.children[0]))
                result += newline;
            return result + `</${this.name}>`;
        }
        else {
            return xml + '/>';
        }
    }
    setOptions(options) {
        this.options = options;
        return this;
    }
    add(e) {
        this.children.push(e);
        if (isElement(e))
            e.parent = this;
    }
    remove(e) {
        const index = this.children.indexOf(e);
        if (index === -1)
            return false;
        this.children.splice(index, 1);
        return true;
    }
    setText(text) {
        for (const i in this.children) {
            if (isText(this.children[i]))
                this.children[i] = text;
            return;
        }
        this.add(text);
    }
    [Symbol.iterator]() {
        const initial = this;
        let i = initial;
        return {
            next: () => {
                if (i) {
                    const i0 = i;
                    i = i?.next;
                    return { done: false, value: i0 };
                }
                return { done: true, value: initial };
            }
        };
    }
}
exports.Element = Element;
exports.reENTITY = /&(?:#(\d{1,7})|#(x[a-f0-9]{1,6})|([a-z][a-z0-9]{1,31}));/g;
function decodeEntity(entities, ...m) {
    return m[1] ? String.fromCharCode(parseInt(m[1], 10))
        : m[2] ? String.fromCharCode(parseInt(m[2], 16))
            : entities[m[3]] ?? m[0];
}
function removeEntities(text, entities) {
    return text.replace(exports.reENTITY, (...m) => decodeEntity(entities, ...m));
}
class EntityCreator {
    reverse;
    re;
    constructor(entities, from) {
        if (from) {
            this.reverse = { ...from.reverse, ...Object.fromEntries(Object.entries(entities).map(([k, v]) => [v, k])) };
            this.re = new RegExp(`([${Object.values(entities).join('')}${from.re.source.slice(2)}`);
        }
        else {
            this.reverse = Object.fromEntries(Object.entries(entities).map(([k, v]) => [v, k]));
            this.re = new RegExp(`([${Object.values(entities).join('')}])|([\u0000-\u0008\u000b-\u001f\ufffe-\uffff]|[\uD800-\uDBFF][\uDC00-\uDFFF])`, 'g');
        }
    }
    replace(text) {
        return text.replace(this.re, (s, cap, hex) => cap ? `&${this.reverse[cap]};` : `&#x${hex.codePointAt(0).toString(16)};`);
    }
}
exports.EntityCreator = EntityCreator;
exports.defaultEntityCreator = new EntityCreator(exports.defaultEntities);
function writeAttributes(attributes, entity_creator = exports.defaultEntityCreator, after = ' ') {
    const a = Object.entries(attributes).filter(([k, v]) => v !== undefined).map(([k, v]) => `${k}="${entity_creator.replace(v.toString())}"`).join(' ');
    return a ? ' ' + a + after : '';
}
const nameStart = ':_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD';
const nameBody = ':_.A-Za-z0-9\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7-';
const nameRe = new RegExp(`[${nameStart}][${nameBody}]*`);
const attrRe = new RegExp(`\\s*(${nameRe.source})(:?\\s*=\\s*(?:"([^"]*)"|'([^']*)'|(${nameRe.source})))?`, 'ys');
function parseAttributes(text, entities) {
    const attributes = {};
    let m;
    while ((m = attrRe.exec(text))) {
        const value = m[3] ?? m[4] ?? m[5];
        attributes[m[1]] = value && removeEntities(value, entities);
    }
    return attributes;
}
function sax(xml, options) {
    let lastIndex = 0;
    let m = null;
    function error(message) {
        if (options.onerror) {
            const count = xml.substring(0, lastIndex).match(/\n/g)?.length ?? 0;
            return options.onerror(new Error(`${message} at line ${count + 1}`));
        }
        return false;
    }
    function match(re, from = lastIndex) {
        re.lastIndex = from;
        m = re.exec(xml);
        if (!m)
            return false;
        lastIndex = re.lastIndex;
        return true;
    }
    const entities = { ...exports.defaultEntities, ...options?.entities };
    const re = /(.*?)<(.)/sy;
    while (match(re)) {
        if (!m)
            return;
        if (m[1])
            options.ontext?.(removeEntities(m[1], entities));
        switch (m[2]) {
            case '/':
                if (match(new RegExp(`(${nameRe.source})\\s*>`, 'ys')))
                    options.onclosetag?.(m[1]);
                else if (!error('bad closing tag'))
                    return;
                break;
            case '?':
                if (match(new RegExp(`(${nameRe.source})(.*)\\?>`, 'ys')))
                    options.onprocessing?.(m[1], m[2]);
                else if (!error('bad processing instruction'))
                    return;
                break;
            case '!':
                if (xml.substring(lastIndex, lastIndex + 2) === '--') {
                    if (match(/(.*?)-->/ys, lastIndex + 2))
                        options.oncomment?.(m[1]);
                    else if (!error('unterminated comment'))
                        return;
                }
                else if (xml.substring(lastIndex, lastIndex + 7) === '[CDATA[') {
                    if (match(/(.*?)]]>/ys, lastIndex + 7))
                        options.oncdata?.(m[1]);
                    else if (!error('unterminated cdata'))
                        return;
                }
                else if (xml.substring(lastIndex, lastIndex + 7) === 'DOCTYPE') {
                    if (match(/([^[]*(\[.*]\s+))>/ys, lastIndex + 7))
                        options.ondoctype?.(m[1]);
                    else if (!error('bad DOCTYPE'))
                        return;
                }
                else if (!error('bad directive')) {
                    return;
                }
                break;
            default:
                if (match(new RegExp(`${nameRe.source}`, 'y'), lastIndex - 1)) {
                    const name = m[0];
                    const attributes = {};
                    while (match(attrRe)) {
                        if (m[5] && !error("missing quotes"))
                            return;
                        const value = m[3] ?? m[4] ?? m[5];
                        if (value === undefined && !error("missing value"))
                            return;
                        attributes[m[1]] = removeEntities(value, entities);
                    }
                    if (match(/\s*([/])?>/y)) {
                        options.onopentag?.(name, attributes);
                        if (m[1])
                            options.onclosetag?.(name);
                        continue;
                    }
                }
                if (!error('bad opening tag'))
                    return;
        }
    }
    if (lastIndex < xml.length)
        options.ontext?.(xml.substring(lastIndex));
}
function parse(xml, options) {
    let current = new Element('');
    sax(xml, {
        onopentag: (name, attributes) => {
            const element = new Element(name, attributes);
            current.add(element);
            current = element;
        },
        onclosetag: (name) => {
            while (name !== current.name) {
                if (!options?.allowUnclosed?.test(current.name))
                    return 'end tag mismatch';
                current = current.parent;
            }
            current = current.parent;
        },
        ontext: (text) => {
            if ((text = text.trim()))
                current.add(text);
        },
        oncomment: (comment) => {
            current.add(new Comment(comment));
        },
        oncdata: (cdata) => {
            current.add(new CDATA(cdata));
        },
        ondoctype: (doctype) => {
            current.add(new DocType(doctype.replace(/^ /, '')));
        },
        onprocessing: (name, body) => {
            if (name.toLowerCase() === 'xml') {
                current.name = '?' + name;
                current.attributes = parseAttributes(body, { ...exports.defaultEntities, ...options?.entities });
            }
        },
        onerror: (e) => {
            console.log(e.message);
            return (e.message == "missing quotes" && options?.allowNonQuotedAttribute)
                || (e.message == "missing value" && options?.allowAttributeWithoutValue);
        },
        entities: options?.entities,
    });
    return current;
}
