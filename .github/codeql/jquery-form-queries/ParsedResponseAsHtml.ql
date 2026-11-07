/**
 * @name Parsed AJAX response inserted as HTML
 * @description jQuery parses JSON and XML responses before the success callback runs. Inserting
 *              such data with `.html()` or `.replaceWith()` parses each of its strings as HTML.
 * @kind path-problem
 * @problem.severity error
 * @security-severity 6.1
 * @precision high
 * @id js/jquery-form/parsed-response-as-html
 * @tags security
 *       external/cwe/cwe-079
 */

import javascript
import JQueryFormSecurity

module ParsedResponseConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node node) { node instanceof AjaxResponseData }

  predicate isSink(DataFlow::Node node) { node instanceof JQueryHtmlArgument }

  predicate isBarrier(DataFlow::Node node) {
    node = DataFlow::MakeBarrierGuard<TypeofStringGuard>::getABarrierNode()
  }

  predicate isAdditionalFlowStep(DataFlow::Node pred, DataFlow::Node succ) {
    callbackListStep(pred, succ)
  }
}

module ParsedResponseFlow = TaintTracking::Global<ParsedResponseConfig>;

import ParsedResponseFlow::PathGraph

from ParsedResponseFlow::PathNode source, ParsedResponseFlow::PathNode sink
where ParsedResponseFlow::flowPath(source, sink)
select sink.getNode(), source, sink, "This inserts $@ as HTML without checking that it is a string.",
  source.getNode(), "AJAX response data"
