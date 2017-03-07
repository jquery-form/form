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

	it('formToArray: semantic test', function() {
		var formData = $('#form2').formToArray(true);
		var testData = ['a','b','c','d','e','f'];
		for (var i=0; i < 6; i++) {
			assert.strictEqual(formData[i].name, testData[i], 'match value at index=' + i);
		}
	});

	it('formToArray: text promotion for missing value attributes', function() {
		var expected = [
			{ name: 'A', value: ''},
			{ name: 'B', value: 'MISSING_ATTR'},
			{ name: 'C', value: ''},
			{ name: 'C', value: 'MISSING_ATTR'}
		];
		var a = $('#form6').formToArray(true);

		// verify all the option values
		for (var i=0; i < a.length; i++) {
			assert.strictEqual(a[i].name, expected[i].name, 'Name: '  + a[i].name  + ' = ' + expected[i].name);
			assert.strictEqual(a[i].value, expected[i].value, 'Value: ' + a[i].value + ' = ' + expected[i].value);
		}
	});
});
