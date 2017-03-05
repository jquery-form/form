'use strict';

var assert = require('chai').assert;

describe('Array', function() {
	it('should start empty', function() {
		var arr = [];

		assert.equal(arr.length, 0);
	});

	it('stuff', function() {
		var foo = 'bar'
			,beverages = { tea: [ 'chai', 'matcha', 'oolong' ] };

		assert.typeOf(foo, 'string'); // without optional message
		assert.typeOf(foo, 'string', 'foo is a string'); // with optional message
		assert.equal(foo, 'bar', 'foo equal `bar`');
		assert.lengthOf(foo, 3, 'foo`s value has a length of 3');
		assert.lengthOf(beverages.tea, 3, 'beverages has 3 types of tea');
		assert.notEqual(1, 1, 'Math works');
	});
});




/*var foo = 'bar'
	,beverages = { tea: [ 'chai', 'matcha', 'oolong' ] };

assert.typeOf(foo, 'string'); // without optional message
assert.typeOf(foo, 'string', 'foo is a string'); // with optional message
assert.equal(foo, 'bar', 'foo equal `bar`');
assert.lengthOf(foo, 3, 'foo`s value has a length of 3');
assert.lengthOf(beverages.tea, 3, 'beverages has 3 types of tea');
assert.equal(1, 1, 'Math works');
*/
