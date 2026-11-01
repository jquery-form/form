/**
 * Sources, sinks and flow steps shared by the jquery-form security queries. They model how the
 * plugin turns DOM text, plugin options and AJAX responses into HTML that jQuery parses.
 */

import javascript

/**
 * Text that page markup controls: an attribute read through jQuery or the DOM, or the `name`,
 * `id` or `htmlFor` of an element. A site escapes this text as an attribute, not as HTML.
 */
class DomText extends DataFlow::Node {
  DomText() {
    exists(JQuery::MethodCall call |
      call.getMethodName() = ["attr", "attr2", "prop"] and
      call.getNumArgument() = 1 and
      this = call
    )
    or
    this.(DataFlow::MethodCallNode).getMethodName() = "getAttribute"
    or
    this.(DataFlow::PropRead).getPropertyName() = ["name", "id", "htmlFor"]
  }
}

/** A parameter of a `$.fn` plugin method, such as the options of `ajaxSubmit`. */
class PluginInput extends DataFlow::Node {
  PluginInput() { this = any(JQuery::JQueryPluginMethod m).getAParameter() }
}

/** A string built by concatenation that starts with markup and is passed to `$()`. */
class HtmlString extends StringOps::ConcatenationRoot {
  HtmlString() {
    exists(JQuery::MethodCall call |
      call.getMethodName() = "$" and
      this = call.getArgument(0) and
      this.getFirstLeaf().getStringValue().regexpMatch("(?s)\\s*<.*") and
      exists(DataFlow::Node part | part = this.getALeaf() and not exists(part.getStringValue()))
    )
  }
}

/** An argument that a jQuery method may parse as HTML or as a selector. */
class JQueryHtmlOrSelectorArgument extends DataFlow::Node {
  JQueryHtmlOrSelectorArgument() {
    exists(JQuery::MethodCall call |
      call.interpretsArgumentAsHtml(this) or call.interpretsArgumentAsSelector(this)
    )
  }
}

/** An argument that a jQuery method may insert as HTML, such as the argument of `.html()`. */
class JQueryHtmlArgument extends DataFlow::Node {
  JQueryHtmlArgument() { exists(JQuery::MethodCall call | call.interpretsArgumentAsHtml(this)) }
}

/**
 * The data an AJAX request passes to its success callback, which jQuery has already parsed when
 * the response is JSON or XML.
 */
class AjaxResponseData extends DataFlow::Node {
  AjaxResponseData() {
    this = any(ClientRequest request).getAResponseDataNode()
    or
    exists(DataFlow::PropWrite write, DataFlow::FunctionNode callback |
      write.getPropertyName() = "success" and
      write.getRhs().getALocalSource() = callback and
      this = callback.getParameter(0)
    )
  }
}

/** Holds if `node` reads `v` itself (`prop = ""`) or the property `prop` of `v`. */
private predicate refersTo(DataFlow::Node node, Variable v, string prop) {
  node.asExpr().(VarAccess).getVariable() = v and prop = ""
  or
  exists(DataFlow::PropRead read |
    node = read and
    read.getPropertyName() = prop and
    read.getBase().asExpr().(VarAccess).getVariable() = v
  )
}

/**
 * Holds if a key or a value reaches the keys of an object:
 * `obj[k] = v` taints later reads of `obj` with `k`, and `for (k in obj)` taints `k` with `obj`.
 */
predicate objectKeyStep(DataFlow::Node pred, DataFlow::Node succ) {
  exists(DataFlow::PropWrite write, Variable v, string prop |
    not exists(write.getPropertyName()) and
    pred = write.getPropertyNameExpr().flow() and
    refersTo(write.getBase(), v, prop) and
    refersTo(succ, v, prop)
  )
  or
  exists(ForInStmt loop, VarAccess key |
    pred = loop.getIterationDomain().flow() and
    key = loop.getAnIterationVariable().getAnAccess()
  |
    succ.asExpr() = key
    or
    // Taint tracking treats `obj.hasOwnProperty(k)` as sanitizing `k`, which it does not do for
    // markup, so the step also reaches the strings built from the key.
    succ.(StringOps::ConcatenationRoot).getALeaf().asExpr() = key
  )
}

/**
 * A function value tracked from where it is created, through helper returns, parameters and
 * imports or exports between modules.
 */
private DataFlow::SourceNode trackedFunction(DataFlow::FunctionNode f, DataFlow::TypeTracker t) {
  t.start() and result = f
  or
  exists(DataFlow::TypeTracker t2 | result = trackedFunction(f, t2).track(t2, t))
}

/**
 * Holds if `callbacks[i].apply(context, [a, b])` passes `pred` to `succ`, a parameter of a
 * function pushed onto `callbacks`, wherever that function was created.
 */
predicate callbackListStep(DataFlow::Node pred, DataFlow::Node succ) {
  exists(
    DataFlow::MethodCallNode apply, DataFlow::ArrayCreationNode args, DataFlow::MethodCallNode push,
    DataFlow::FunctionNode callback, Variable list, int i
  |
    apply.getMethodName() = "apply" and
    refersTo(apply.getReceiver().(DataFlow::PropRead).getBase(), list, "") and
    args = apply.getArgument(1).getALocalSource() and
    push.getMethodName() = "push" and
    refersTo(push.getReceiver(), list, "") and
    trackedFunction(callback, DataFlow::TypeTracker::end()).flowsTo(push.getAnArgument()) and
    pred = args.getElement(i) and
    succ = callback.getParameter(i)
  )
}

/** A `typeof x === "string"` test: only the string branch is the documented `target` behavior. */
class TypeofStringGuard extends DataFlow::ValueNode {
  override EqualityTest astNode;

  TypeofStringGuard() { TaintTracking::isTypeofGuard(astNode, _, "string") }

  predicate blocksExpr(boolean outcome, Expr e) {
    TaintTracking::isTypeofGuard(astNode, e, "string") and outcome = astNode.getPolarity()
  }
}
