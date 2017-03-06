'use strict';

//	var assert = require('chai').assert;
var assert = chai.assert;

describe('form', function() {
	it('"action" and "method" form attributes', function() {
		var f = $('#form1');
		assert.strictEqual(f.attr('action'), 'text.php', 'form "action"');
		assert.strictEqual(f.attr('method'), 'get', 'form "method"');
	});
});
