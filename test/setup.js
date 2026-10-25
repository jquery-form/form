import jQuery from "jquery";
import html from "./test.html?raw";

window.$ = window.jQuery = jQuery;

const main = new DOMParser().parseFromString(html, "text/html").getElementById("main");
document.body.appendChild(document.importNode(main, true));

await import("../src/jquery.form.js");
