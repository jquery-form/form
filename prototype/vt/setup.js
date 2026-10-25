import jQuery from "jquery";
import { assert } from "vitest";
import { beforeAll } from "vitest";
import html from "../../test/test.html?raw";

window.$ = window.jQuery = jQuery;
window.chai = { assert };
globalThis.before = beforeAll;

const main = new DOMParser().parseFromString(html, "text/html").getElementById("main");
document.body.appendChild(document.importNode(main, true));

await import("../../src/jquery.form.js");
