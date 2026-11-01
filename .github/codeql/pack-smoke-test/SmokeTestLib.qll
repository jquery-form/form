/** A local library module, to check that a pack's own imports resolve in Actions. */

import javascript

/** Holds for no node: the smoke test must never report a result. */
predicate noSource(DataFlow::Node node) { none() }

/** A `typeof x === "string"` test, to check the barrier-guard API. */
class TypeofStringTest extends DataFlow::ValueNode {
  override EqualityTest astNode;

  TypeofStringTest() { TaintTracking::isTypeofGuard(astNode, _, "string") }

  predicate blocksExpr(boolean outcome, Expr e) {
    TaintTracking::isTypeofGuard(astNode, e, "string") and outcome = astNode.getPolarity()
  }
}
