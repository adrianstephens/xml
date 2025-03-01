export declare class Comment {
    comment: string;
    constructor(comment: string);
    toString(): string;
}
export declare class CDATA {
    cdata: string;
    constructor(cdata: string);
    toString(): string;
}
export declare class DocType {
    doctype: string;
    constructor(doctype: string);
    toString(): string;
}
export interface StringLike {
    toString(options?: OutputOptions): string;
}
export type Node = Element | string | Comment | CDATA | DocType | StringLike;
export type Attributes = Record<string, any>;
export type Entities = Record<string, string>;
export declare function isElement(arg: Node | undefined): arg is Element;
export declare function isText(arg: Node | undefined): arg is string;
export declare function isComment(arg: Node): arg is Comment;
export declare function isDocType(arg: Node): arg is DocType;
export declare function isCDATA(arg: Node): arg is CDATA;
export declare const criticalEntities: Entities;
export declare const defaultEntities: {
    quot: string;
};
export type OutputOptions = {
    newline?: string;
    indent?: string;
    afteratt?: string;
    entities?: Entities | EntityCreator;
    entities_att?: EntityCreator;
};
export declare class Element {
    name: string;
    attributes: Attributes;
    children: Node[];
    next?: Element;
    parent?: Element;
    _elements?: Record<string, Element>;
    options?: OutputOptions;
    constructor(name: string, attributes?: Attributes, children?: Node[]);
    get elements(): Record<string, Element>;
    firstElement(): Element | undefined;
    firstText(): string | undefined;
    allText(): string[];
    allElements(): Element[];
    toString(options?: OutputOptions): string;
    setOptions(options: OutputOptions): this;
    add(e: Node): void;
    remove(e: Node): boolean;
    setText(text: string): void;
    [Symbol.iterator](): {
        next: () => {
            done: boolean;
            value: Element;
        };
    };
}
export declare const reENTITY: RegExp;
export declare function decodeEntity(entities: Entities, ...m: string[]): string;
export declare function removeEntities(text: string, entities: Entities): string;
export declare class EntityCreator {
    reverse: Record<string, string>;
    re: RegExp;
    constructor(entities: Entities, from?: EntityCreator);
    replace(text: string): string;
}
export declare const defaultEntityCreator: EntityCreator;
export declare function writeAttributes(attributes: Attributes, entity_creator?: EntityCreator, after?: string): string;
export declare function parseAttributes(text: string, entities: Entities): Attributes;
export interface SaxOptions {
    onerror?: (e: Error) => boolean | void;
    ontext?: (t: string) => void;
    ondoctype?: (doctype: string) => void;
    onprocessing?: (name: string, body: string) => void;
    onopentag?: (tagName: string, attributes: Attributes) => void;
    onclosetag?: (tagName: string) => void;
    oncomment?: (comment: string) => void;
    oncdata?: (cdata: string) => void;
    entities?: Entities;
}
export declare function sax(xml: string, options: SaxOptions): void;
export interface InputOptions {
    entities?: Entities;
    allowUnclosed?: RegExp;
    allowAttributeWithoutValue?: boolean;
    allowNonQuotedAttribute?: boolean;
}
export declare function parse(xml: string, options?: InputOptions): Element;
