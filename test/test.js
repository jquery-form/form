'use strict';

// helper method
var arrayCount = function(arr, key) {
	var count = 0;
	for (var i=0; i < arr.length; i++) {
		if (arr[i].name === key) {
			count++;
		}
	}
	return count;
};


//	var assert = require('chai').assert;
var assert = chai.assert;

describe('form', function() {
	it('"action" and "method" form attributes', function() {
		var f = $('#form1');
		assert.strictEqual(f.attr('action'), 'text.php', 'form "action"');
		assert.strictEqual(f.attr('method'), 'get', 'form "method"');
	});

	it('formToArray: multi-select', function() {
		var a = $('#form1').formToArray();
		assert.strictEqual(a.constructor, Array, 'type check');
		assert.strictEqual(a.length, 13, 'array length');
		assert.strictEqual(arrayCount(a, 'Multiple'), 3, 'multi-select');
	});
});
