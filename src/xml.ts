export class Comment {
	constructor(public comment: string) {}
	toString() { return `<!--${this.comment}-->`; }
}

export class CDATA {
	constructor(public cdata: string) {}
	toString() { return `<![CDATA[${this.cdata.replace(']]>', ']]]]><![CDATA[>')}]]>`; }
}

export class DocType {
	constructor(public doctype: string) {}
	toString() { return `<!DOCTYPE ${this.doctype}>`; }
}

export interface StringLike {
	toString(options?: OutputOptions): string;
}

export type Node = Element | string | StringLike;
export type Attributes = Record<string, any>;
export type Entities = Record<string, string>;

export function isElement(arg: Node | undefined): arg is Element { return typeof(arg) == 'object' && 'name' in arg; }
export function isText(arg: Node | undefined): arg is string { return typeof(arg) == 'string'; }

export const criticalEntities: Entities = {
	amp: '&',
	gt: '>',
	lt: '<',
};
export const defaultEntities = { ...criticalEntities, quot: '"' };

export interface OutputOptions {
	newline?: 			string,
	indent?: 			string,
	afteratt?: 			string,
	entities?: 			Entities | EntityCreator,
	entities_att?: 		EntityCreator,
	noSelfClose?: 		RegExp,
}

export class Element {
	next?:		Element;
	parent?:	Element;
	_elements?:	Record<string, Element>;
	//options?:	OutputOptions;

	constructor(public name: string, public attributes: Attributes = {}, public children: Node[] = []) {
		for (const i of children) {
			if (isElement(i))
				i.parent = this;
		}
	}

	public get elements() {
		if (!this._elements) {
			this._elements = {};
			for (const i of this.allElements().reverse()) {
				i.next = this.elements[i.name];
				this._elements[i.name] = i;
			}
		}
		return this._elements;
	}

	public firstElement():	Element | undefined		{ return this.children.find(i => isElement(i)); }
	public allElements():	Element[]				{ return this.children.filter(i => isElement(i)); }
	public firstText(): 	string | undefined		{ return this.children.find(i => isText(i)); }
	public allText():		string[]				{ return this.children.filter(i => isText(i)); }

	public toString(options?: OutputOptions): string {
		options = { indent: '  ', afteratt: '', ...options};//, ...this.options };
		if (!options.entities || !(options.entities instanceof EntityCreator)) {
			options.entities = new EntityCreator({ ...criticalEntities, ...options?.entities });
			options.entities_att = new EntityCreator({ quot: '"' }, options.entities);
		}

		const newline = options?.newline ?? '\n';
		let xml = `<${this.name}${writeAttributes(this.attributes, options.entities_att, options.afteratt)}`;

		if (this.name.startsWith('?'))
			return xml += '?>' + newline + this.children[0].toString(options);

		if (this.children.length || this.attributes['xml:space'] === 'preserve' || options.noSelfClose?.test(this.name)) {
			const entities = options.entities;
			const nextline = newline + options.indent;
			options = { ...options, newline: nextline };

			let result = [xml, '>', ...this.children.map(i =>
				isText(i) ? entities.replace(i) : nextline + i.toString(options)
			)].join('');

			if (this.children.length > 1 || !isText(this.children[0]))
				result += newline;
			return result + `</${this.name}>`;
		} else {
			return xml + '/>';
		}
	}

	//public setOptions(options: OutputOptions) {
	//	this.options = options; return this;
	//}

	public add(e: Node) {
		this.children.push(e);
		if (isElement(e))
			e.parent = this;
	}
	public remove(e: Node) {
		const index = this.children.indexOf(e);
		if (index === -1)
			return false;
		this.children.splice(index, 1);
		return true;
	}
	public setText(text: string) {
		for (const i in this.children) {
			if (isText(this.children[i])) {
				this.children[i] = text;
				return;
			}
		}
		this.add(text);
	}

	[Symbol.iterator]() {
		const initial = this;
		let i: Element | undefined = initial;
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

export const reENTITY = /&(?:#(\d{1,7})|#(x[a-f0-9]{1,6})|([a-z][a-z0-9]{1,31}));/g;

export function decodeEntity(entities: Entities, ...m: string[]) {
	return m[1] ? String.fromCharCode(parseInt(m[1], 10))
		: m[2] ? String.fromCharCode(parseInt(m[2], 16))
		: entities[m[3]] ?? m[0];
}

export function removeEntities(text: string, entities: Entities) {
	return text.replace(reENTITY, (...m) => decodeEntity(entities, ...m));
}

export class EntityCreator {
	reverse: Record<string, string>;
	re: RegExp;

	constructor(entities: Entities, from?: EntityCreator) {
		if (from) {
			this.reverse = { ...from.reverse, ...Object.fromEntries(Object.entries(entities).map(([k, v]) => [v, k])) };
			this.re = new RegExp(`([${Object.values(entities).join('')}${from.re.source.slice(2)}`);
		} else {
			this.reverse = Object.fromEntries(Object.entries(entities).map(([k, v]) => [v, k]));
			this.re = new RegExp(`([${Object.values(entities).join('')}])|([\u0000-\u0008\u000b-\u001f\ufffe-\uffff]|[\uD800-\uDBFF][\uDC00-\uDFFF])`, 'g');
		}
	}
	replace(text: string) {
		return text.replace(this.re, (s, cap, hex) => cap ? `&${this.reverse[cap]};` : `&#x${hex.codePointAt(0).toString(16)};`);
	}
}

export const defaultEntityCreator = new EntityCreator(defaultEntities);

export function writeAttributes(attributes: Attributes, entity_creator: EntityCreator = defaultEntityCreator, after = ' ') {
	const a = Object.entries(attributes).filter(([_, v]) => v !== undefined).map(([k, v]) => `${k}="${entity_creator.replace(v.toString())}"`).join(' ');
	return a ? ' ' + a + after : '';
}

const nameStart = ':_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD';
const nameBody	= ':_.A-Za-z0-9\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7-';
const reName	= `[${nameStart}][${nameBody}]*`;
const reAttr	= new RegExp(`\\s*(${reName})(:?\\s*=\\s*(?:"([^"]*)"|'([^']*)'|(${reName})))?`, 'ys');

export function parseAttributes(text: string, entities: Entities): Attributes {
	const attributes: Attributes = {};
	let m;
	while ((m = reAttr.exec(text))) {
		const value = m[3] ?? m[4] ?? m[5];
		attributes[m[1]] = value && removeEntities(value, entities);
	}
	return attributes;
}

export interface SaxOptions {
	onerror?: 		(e: Error) => boolean | void;
	ontext?: 		(t: string) => void;
	ondoctype?: 	(doctype: string) => void;
	onprocessing?: 	(name: string, body: string) => void;
	onopentag?: 	(tagName: string, attributes: Attributes) => void;
	onclosetag?: 	(tagName: string) => void;
	oncomment?: 	(comment: string) => void;
	oncdata?: 		(cdata: string) => void;
	entities?: 		Entities;
}

export function sax(xml: string, options: SaxOptions) {
	let lastIndex = 0;
	let m: RegExpExecArray | null = null;

	function error(message: string) {
		if (options.onerror) {
			const count = xml.substring(0, lastIndex).match(/\n/g)?.length ?? 0;
			return options.onerror(new Error(`${message} at line ${count + 1}`));
		}
		return false;
	}

	function match(re: RegExp, from = lastIndex) {
		re.lastIndex = from;
		m = re.exec(xml);
		if (!m)
			return false;
		lastIndex = re.lastIndex;
		return true;
	}

	const entities = { ...defaultEntities, ...options?.entities };

	const re = /(.*?)<(.)/sy;
	const reOpen	= new RegExp(`${reName}`, 'y');
	const reClose	= new RegExp(`(${reName})\\s*>`, 'ys');
	const reProc	= new RegExp(`(${reName})(.*)\\?>`, 'ys');

	while (match(re)) {
		if (!m)
			return;

		if (m[1])
			options.ontext?.(removeEntities(m[1], entities));

		switch (m[2]) {
			case '/':
				if (match(reClose))
					options.onclosetag?.(m[1]);
				else if (!error('bad closing tag'))
					return;
				break;

			case '?':
				if (match(reProc))
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

				} else if (xml.substring(lastIndex, lastIndex + 7) === '[CDATA[') {
					if (match(/(.*?)]]>/ys, lastIndex + 7))
						options.oncdata?.(m[1]);
					else if (!error('unterminated cdata'))
						return;

				} else if (xml.substring(lastIndex, lastIndex + 7) === 'DOCTYPE') {
					if (match(/([^[]*(\[.*]\s+))>/ys, lastIndex + 7))
						options.ondoctype?.(m[1]);
					else if (!error('bad DOCTYPE'))
						return;

				} else if (!error('bad directive')) {
					return;
				}
				break;

			default:
				if (match(reOpen, lastIndex - 1)) {
					const name = m[0];

					const attributes: Attributes = {};
					while (match(reAttr)) {
						if (m[5] && !error("missing quotes"))
							return;
						const value = m[3] ?? m[4] ?? m[5];
						if (value === undefined) {
							if (!error("missing value"))
								return;
							attributes[m[1]] = true;
						} else {
							attributes[m[1]] = removeEntities(value, entities);
						}
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

export interface InputOptions {
	entities?: 					Entities,
	allowUnclosed?: 			RegExp,
	allowAttributeWithoutValue?: boolean,
	allowNonQuotedAttribute?:	boolean,
}

export function parse(xml: string, options?: InputOptions) {
	let current = new Element('');
	sax(xml, {
		onopentag: (name: string, attributes: Attributes) => {
			const element = new Element(name, attributes);
			current.add(element);
			current = element;
		},
		onclosetag: (name: string) => {
			while (name !== current.name) {
				if (!options?.allowUnclosed?.test(current.name))
					return 'end tag mismatch';
				current = current.parent!;
			}
			current = current.parent!;
		},

		ontext: (text: string) => {
			if ((text = text.trim()))
				current.add(text);
		},
		oncomment: (comment: string) => {
			current.add(new Comment(comment));
		},
		oncdata: (cdata: string) => {
			current.add(new CDATA(cdata));
		},
		ondoctype: (doctype: string) => {
			current.add(new DocType(doctype.replace(/^ /, '')));
		},
		onprocessing: (name: string, body: string) => {
			if (name.toLowerCase() === 'xml') {
				current.name = '?' + name;
				current.attributes = parseAttributes(body, { ...defaultEntities, ...options?.entities });
			}
		},
		onerror: (e: Error) => {
			console.log(e.message);
			return (e.message == "missing quotes" && options?.allowNonQuotedAttribute)
				|| (e.message == "missing value" && options?.allowAttributeWithoutValue);
		},
		entities: options?.entities,
	});
	return current;
}