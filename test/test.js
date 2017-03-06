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

// helper method
var arrayValue = function(arr, key) {
	for (var i=0; i < arr.length; i++) {
		if (arr[i].name === key) {
			return arr[i].value;
		}
	}
}


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

	it('formToArray: "action" and "method" inputs', function() {
		var a = $('#form1').formToArray();
		assert.strictEqual(a.constructor, Array, 'type check');
		assert.strictEqual(arrayValue(a, 'action'), '1', 'input name=action');
		assert.strictEqual(arrayValue(a, 'method'), '2', 'input name=method');
	});
});
