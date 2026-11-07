/**
 * @name HTML built from strings in a jQuery plugin
 * @description Passing a string that starts with markup and contains plugin input or DOM text
 *              to `$()` lets that input add elements and event handlers.
 * @kind path-problem
 * @problem.severity error
 * @security-severity 7.5
 * @precision high
 * @id js/jquery-form/html-from-strings
 * @tags security
 *       external/cwe/cwe-079
 */

import javascript
import JQueryFormSecurity

module HtmlFromStringsConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node node) { node instanceof PluginInput or node instanceof DomText }

  predicate isSink(DataFlow::Node node) { node instanceof HtmlString }

  predicate isAdditionalFlowStep(DataFlow::Node pred, DataFlow::Node succ) {
    objectKeyStep(pred, succ)
  }
}

module HtmlFromStringsFlow = TaintTracking::Global<HtmlFromStringsConfig>;

import HtmlFromStringsFlow::PathGraph

from HtmlFromStringsFlow::PathNode source, HtmlFromStringsFlow::PathNode sink
where HtmlFromStringsFlow::flowPath(source, sink)
select sink.getNode(), source, sink, "This markup passed to $() contains $@.", source.getNode(),
  "plugin input or DOM text"
