import MagicString from "magic-string";
import terser from "@rollup/plugin-terser";

// Published contract (ADR-0001): CommonJS gets a (root, jQuery) factory, AMD an anonymous module
// with no value, and script tags register on the global jQuery. Rollup's generic UMD differs.
const umdHeader = `(function (factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(['jquery'], factory);
	} else if (typeof module === 'object' && module.exports) {
		// Node/CommonJS
		module.exports = function( root, jQuery ) {
			if (typeof jQuery === 'undefined') {
				// require('jQuery') returns a factory that requires window to build a jQuery instance, we normalize how we use modules
				// that require this pattern but the window provided is a noop if it's defined (how jquery works)
				if (typeof window !== 'undefined') {
					jQuery = require('jquery');
				}
				else {
					jQuery = require('jquery')(root);
				}
			}
			factory(jQuery);
			return jQuery;
		};
	} else {
		// Browser globals
		factory(jQuery);
	}

}(function (jQuery) {
`;

const moduleLines =
  /^import jQuery from ['"]jquery['"];\nexport \{ default \} from ['"]jquery['"];\n\n/;
const preamble = /^\/\*![\s\S]*?\*\/\n\/\* global ActiveXObject \*\/\n\n?/m;
const bodyStart = "(function ($) {\n";

// Rollup places the license preamble after the imports; lift it back to the top of the file.
function splitPreamble(plugin, code) {
  const imports = code.match(moduleLines);
  const header = code.match(preamble);
  if (!imports || !header) {
    plugin.error("expected the jquery import, default re-export, and license preamble");
  }
  const chunk = new MagicString(code);
  chunk.remove(0, imports[0].length);
  chunk.remove(header.index, header.index + header[0].length);
  return { chunk, imports: imports[0], header: header[0] };
}

const moduleLayout = {
  name: "module-layout",
  renderChunk(code) {
    const { chunk, imports, header } = splitPreamble(this, code);
    chunk.prepend(header + imports);
    return { code: chunk.toString(), map: chunk.generateMap({ hires: true }) };
  },
};

const classicLayout = {
  name: "classic-layout",
  renderChunk(code) {
    const { chunk, header } = splitPreamble(this, code);
    const body = code.indexOf(bodyStart);
    if (body < 0) {
      this.error(`expected the plugin body to start with ${bodyStart.trim()}`);
    }
    // Rollup drops directives because modules are strict; a classic script is not.
    chunk.appendLeft(body + bodyStart.length, "\t'use strict';\n");
    chunk.prepend(header + umdHeader).append("\n}));\n");
    return { code: chunk.toString(), map: chunk.generateMap({ hires: true }) };
  },
};

export default {
  input: "src/jquery.form.js",
  external: ["jquery"],
  output: [
    { file: "dist/jquery.form.mjs", format: "es", plugins: [moduleLayout] },
    { file: "dist/jquery.form.js", format: "es", plugins: [classicLayout] },
    {
      file: "dist/jquery.form.min.js",
      format: "es",
      sourcemap: true,
      plugins: [classicLayout, terser({ module: false, format: { comments: /^!/ } })],
    },
  ],
};
