/**
 * @name Query pack smoke test
 * @description Checks that a local query pack resolves codeql/javascript-all in Actions. It has no
 *              sources, so it never reports a result.
 * @kind path-problem
 * @problem.severity recommendation
 * @precision low
 * @id js/jquery-form/pack-smoke-test
 */

import javascript
import SmokeTestLib

module SmokeTestConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node node) { noSource(node) }

  predicate isSink(DataFlow::Node node) {
    exists(JQuery::MethodCall call | call.interpretsArgumentAsHtml(node))
    or
    node instanceof StringOps::ConcatenationRoot
    or
    node = any(JQuery::JQueryPluginMethod m).getAParameter()
    or
    node = any(ClientRequest r).getAResponseDataNode()
  }

  predicate isBarrier(DataFlow::Node node) {
    node = DataFlow::MakeBarrierGuard<TypeofStringTest>::getABarrierNode()
  }
}

module SmokeTestFlow = TaintTracking::Global<SmokeTestConfig>;

import SmokeTestFlow::PathGraph

from SmokeTestFlow::PathNode source, SmokeTestFlow::PathNode sink
where SmokeTestFlow::flowPath(source, sink)
select sink.getNode(), source, sink, "Never reported: $@.", source.getNode(), "no source"
