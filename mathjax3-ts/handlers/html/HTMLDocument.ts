/*************************************************************
 *
 *  Copyright (c) 2017 The MathJax Consortium
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

/**
 * @fileoverview  Implements the HTMLDocument class
 *
 * @author dpvc@mathjax.org (Davide Cervone)
 */

import {MathDocument, AbstractMathDocument} from '../../core/MathDocument.js';
import {userOptions, separateOptions, OptionList} from '../../util/Options.js';
import {HTMLMathItem} from './HTMLMathItem.js';
import {HTMLMathList} from './HTMLMathList.js';
import {HTMLDomStrings} from './HTMLDomStrings.js';
import {DOMAdaptor} from '../../core/DOMAdaptor.js';
import {InputJax} from '../../core/InputJax.js';
import {MathItem, ProtoItem, Location} from '../../core/MathItem.js';

/*****************************************************************/
/**
 * List of Lists of pairs consisting of a DOM node and its text length
 *
 * These represent the Text elements that make up a single
 * string in the list of strings to be searched for math
 * (multiple consecutive Text nodes can form a single string).
 *
 * @template N  The HTMLElement node class
 * @template T  The Text node class
 */
export type HTMLNodeArray<N, T> = [N | T, number][][];

/*****************************************************************/
/**
 *  The HTMLDocument class (extends AbstractMathDocument)
 *
 * @template N  The HTMLElement node class
 * @template T  The Text node class
 * @template D  The Document class
 */
export class HTMLDocument<N, T, D> extends AbstractMathDocument<N, T, D> {

    public static KIND: string = 'HTML';
    public static OPTIONS: OptionList = {
        ...AbstractMathDocument.OPTIONS,
        MathList: HTMLMathList,           // Use the HTMLMathList for Mathlists
        DomStrings: null                  // Use the default DomString parser
    };
    public static STATE = AbstractMathDocument.STATE;

    /**
     * The DomString parser for locating the text in DOM trees
     */
    public domStrings: HTMLDomStrings<N, T, D>;

    /**
     * @override
     * @constructor
     * @extends {AbstractMathDocument}
     */
    constructor(document: any, adaptor: DOMAdaptor<N, T, D>, options: OptionList) {
        let [html, dom] = separateOptions(options, HTMLDomStrings.OPTIONS);
        super(document, adaptor, html);
        this.domStrings = this.options['DomStrings'] || new HTMLDomStrings<N, T, D>(dom);
        this.domStrings.adaptor = adaptor;
    }

    /**
     * Creates a Location object for a delimiter at the position given by index in the N's string
     *  of the array of strings searched for math, recovering the original DOM node where the delimiter
     *  was found.
     *
     * @param {number} N             The index of the string in the string array
     * @param {number} index         The position within the N's string that needs to be found
     * @param {string} delim         The delimiter for this position
     * @param {HTMLNodeArray} nodes  The list of node lists representing the string array
     * @return {Location}            The Location object for the position of the delimiter in the document
     */
    protected findPosition(N: number, index: number, delim: string, nodes: HTMLNodeArray<N, T>): Location<N, T> {
        for (const list of nodes[N]) {
            let [node, n] = list;
            if (index <= n) {
                return {node: node, n: index, delim: delim};
            }
            index -= n;
        }
        return {node: null, n: 0, delim: delim};
    }

    /**
     * Convert a ProtoItem to a MathItem (i.e., determine the actual Location
     *  objects for its start and end)
     *
     * @param {ProtoItem} item       The proto math item to turn into an actual MathItem
     * @param {InputJax} jax         The input jax to use for the MathItem
     * @param {HTMLNodeArray} nodes  The array of node lists that produced the string array
     * @return {HTMLMathItem}        The MathItem for the given proto item
     */
    protected mathItem(item: ProtoItem<N, T>, jax: InputJax<N, T, D>, nodes: HTMLNodeArray<N, T>) {
        let math = item.math;
        let start = this.findPosition(item.n, item.start.n, item.open, nodes);
        let end = this.findPosition(item.n, item.end.n, item.close, nodes);
        return new HTMLMathItem(math, jax, item.display, start, end);
    }

    /**
     * Find math within the document:
     *  Get the list of containers (default is document.body), and for each:
     *    For each input jax:
     *      Make a new MathList to store the located math
     *      If the input jax processes strings:
     *        If we haven't already made the string array and corresponding node list, do so
     *        Ask the jax to find the math in the string array, and
     *          for each one, push it onto the math list
     *      Otherwise (the jax processes DOM nodes):
     *        Ask the jax to find the math in the container, and
     *          for each one, make the result into a MathItem, and push it on the list
     *      Merge the new math list into the document's math list
     *        (we use merge to maintain a sorted list of MathItems)
     *
     * @override
     */
    public findMath(options: OptionList) {
        if (!this.processed.findMath) {
            this.adaptor.document = this.document;
            options = userOptions({elements: [this.adaptor.body(this.document)]}, options);
            for (const container of this.adaptor.getElements(options['elements'], this.document)) {
                let [strings, nodes] = [null, null] as [string[], HTMLNodeArray<N, T>];
                for (const jax of this.inputJax) {
                    let list = new (this.options['MathList'])();
                    if (jax.processStrings) {
                        if (strings === null) {
                            [strings, nodes] = this.domStrings.find(container);
                        }
                        for (const math of jax.findMath(strings)) {
                            list.push(this.mathItem(math, jax, nodes));
                        }
                    } else {
                        for (const math of jax.findMath(container)) {
                            let item = new HTMLMathItem(math.math, jax, math.display, math.start, math.end);
                            list.push(item);
                        }
                    }
                    this.math.merge(list);
                }
            }
            this.processed.findMath = true;
        }
        return this;
    }

    /**
     * @override
     */
    public updateDocument() {
        if (!this.processed.updateDocument) {
            super.updateDocument();
            const sheet = this.documentStyleSheet();
            if (sheet) {
                const head = this.adaptor.head(this.document);
                let styles = this.findSheet(head, this.adaptor.getAttribute(sheet, 'id'));
                if (styles) {
                    this.adaptor.replace(sheet, styles);
                } else {
                    this.adaptor.append(head, sheet);
                }
            }
            this.processed.updateDocument = true;
        }
        return this;
    }

    /**
     * @param {N} head     The document <head>
     * @param {string} id  The id of the stylesheet to find
     * @param {N|null}     The stylesheet with the given ID
     */
    protected findSheet(head: N, id: string) {
        if (id) {
            for (const sheet of this.adaptor.tags(head, 'style')) {
                if (this.adaptor.getAttribute(sheet, 'id') === id) {
                    return sheet;
                }
            }
        }
        return null as N;
    }

    /**
     * @override
     */
    public removeFromDocument(restore: boolean = false) {
        if (this.processed.updateDocument) {
            for (const math of this.math) {
                if (math.state() >= STATE.INSERTED) {
                    math.state(STATE.TYPESET, restore);
                }
            }
        }
        this.processed.updateDocument = false;
        return this;
    }

    /**
     * @override
     */
    public documentStyleSheet() {
        return this.outputJax.styleSheet(this);
    }

    /**
     * Temporary function for testing purposes.  Will be removed
     */
    public TestMath(text: string, display: boolean = true) {
        if (!this.processed['TestMath']) {
            let math = new HTMLMathItem<N, T, D>(text, this.inputJax[0], display);
            math.setMetrics(16, 8, 1000000, 1000000, 1);
            this.math.push(math);
            this.processed['TestMath'] = true;
        }
        return this;
    }

}

let STATE = HTMLDocument.STATE;
