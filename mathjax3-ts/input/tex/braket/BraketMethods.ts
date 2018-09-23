/*************************************************************
 *
 *  Copyright (c) 2018 The MathJax Consortium
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
 * @fileoverview Methods for TeX parsing of the braket package.
 *                                            
 * @author v.sorge@mathjax.org (Volker Sorge)
 */

import {ParseMethod} from '../Types.js';
import BaseMethods from '../base/BaseMethods.js';
import {MapHandler} from '../MapHandler.js';
import TexParser from '../TexParser.js';
import {TEXCLASS} from '../../../core/MmlTree/MmlNode.js';


let BraketMethods: Record<string, ParseMethod> = {};

BraketMethods.Macro = BaseMethods.Macro;

BraketMethods.Braket = function(parser: TexParser, name: string,
                                open: string, close: string,
                                stretchy: boolean, barmax: number) {
  parser.i++;
  parser.Push(parser.itemFactory.create('braket')
              .setProperties({barmax: barmax, barcount: 0, open: open,
                              close: close, stretchy: stretchy}));
};

let splitString = function(str: string, split: string[]): string[] {
  str = str.trim();
  let j = 0;
  let parens = 0;
  return [];
};


BraketMethods.Bar = function(parser: TexParser, name: string) {
  let c = name === '|' ? '|' : '\u2225';
  let top = parser.stack.Top();
  if (top.kind !== 'braket' ||
      top.getProperty('barcount') >= top.getProperty('barmax')) {
    let mml = parser.create('token', 'mo', {texClass: TEXCLASS.ORD, stretchy: false}, c);
    parser.Push(mml);
    return;
  }
  if (c === '|' && parser.GetNext() === '|') {
    parser.i++;
    c = '\u2225';
  }
  let stretchy = top.getProperty('stretchy');
  if (!stretchy) {
    let node = parser.create('token', 'mo', {stretchy: false, braketbar: true}, c);
    parser.Push(node);
    return;
  }
  let node = parser.create('node', 'TeXAtom', [], {texClass: TEXCLASS.CLOSE});
  parser.Push(node);
  top.setProperty('barcount', top.getProperty('barcount') as number + 1);
  node = parser.create('token', 'mo', {stretchy: true, braketbar: true}, c);
  parser.Push(node);
  node = parser.create('node', 'TeXAtom', [], {texClass: TEXCLASS.OPEN});
  parser.Push(node);
};


export default BraketMethods;