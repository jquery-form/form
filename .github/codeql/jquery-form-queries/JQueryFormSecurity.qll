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
 * An array tracked from where it is created, through helper parameters and returns and imports
 * or exports between modules.
 */
private DataFlow::SourceNode trackedArray(DataFlow::ArrayCreationNode a, DataFlow::TypeTracker t) {
  t.start() and result = a
  or
  exists(DataFlow::TypeTracker t2 | result = trackedArray(a, t2).track(t2, t))
}

/** Holds if `node` may hold the array created at `a`. */
private predicate isArray(DataFlow::ArrayCreationNode a, DataFlow::Node node) {
  trackedArray(a, DataFlow::TypeTracker::end()).flowsTo(node)
}

/** Holds if `callback` is pushed onto the array created at `list`, wherever either is used. */
private predicate pushedCallback(DataFlow::ArrayCreationNode list, DataFlow::FunctionNode callback) {
  exists(DataFlow::MethodCallNode push |
    push.getMethodName() = "push" and
    isArray(list, push.getReceiver()) and
    trackedFunction(callback, DataFlow::TypeTracker::end()).flowsTo(push.getAnArgument())
  )
}

/**
 * Holds if `list[i].apply(context, [a, b])` or `list[i].call(context, a, b)` passes `pred` to
 * `succ`, a parameter of a function pushed onto `list`. The list, the callbacks and the
 * arguments array may each come from another function or module.
 */
predicate callbackListStep(DataFlow::Node pred, DataFlow::Node succ) {
  exists(
    DataFlow::MethodCallNode invoke, DataFlow::ArrayCreationNode list,
    DataFlow::FunctionNode callback, int i
  |
    isArray(list, invoke.getReceiver().(DataFlow::PropRead).getBase()) and
    pushedCallback(list, callback) and
    succ = callback.getParameter(i)
  |
    invoke.getMethodName() = "apply" and
    exists(DataFlow::ArrayCreationNode args |
      isArray(args, invoke.getArgument(1)) and pred = args.getElement(i)
    )
    or
    invoke.getMethodName() = "call" and pred = invoke.getArgument(i + 1)
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
