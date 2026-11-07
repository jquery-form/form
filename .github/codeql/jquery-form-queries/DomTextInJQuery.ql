/**
 * @name DOM text parsed by jQuery
 * @description An attribute or element name read from the page reaches a jQuery argument that
 *              may be parsed as HTML or as a selector, so escaped markup becomes live again.
 * @kind path-problem
 * @problem.severity error
 * @security-severity 7.5
 * @precision high
 * @id js/jquery-form/dom-text-in-jquery
 * @tags security
 *       external/cwe/cwe-079
 */

import javascript
import JQueryFormSecurity

module DomTextConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node node) { node instanceof DomText }

  predicate isSink(DataFlow::Node node) { node instanceof JQueryHtmlOrSelectorArgument }

  predicate isAdditionalFlowStep(DataFlow::Node pred, DataFlow::Node succ) {
    objectKeyStep(pred, succ)
  }
}

module DomTextFlow = TaintTracking::Global<DomTextConfig>;

import DomTextFlow::PathGraph

from DomTextFlow::PathNode source, DomTextFlow::PathNode sink
where DomTextFlow::flowPath(source, sink)
select sink.getNode(), source, sink, "jQuery may parse this as HTML or a selector; it contains $@.",
  source.getNode(), "DOM text"
