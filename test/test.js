/* global chai, scriptCount */

'use strict';

// helper method
const arrayCount = function(arr, key) {
	let count = 0;

	for (let i = 0; i < arr.length; i++) {
		if (arr[i].name === key) {
			count++;
		}
	}

	return count;
};

// helper method
const arrayValue = function(arr, key) {
	for (let i = 0; i < arr.length; i++) {
		if (arr[i].name === key) {
			return arr[i].value;
		}
	}

	return undefined;
};


const {assert} = chai;
let fixture;

// eslint-disable-next-line max-statements
describe('form', function() {
	before(function() {
		fixture = $('#main').html();
	});

	beforeEach(function() {
		$('#main').html(fixture);
	});


	it('"action" and "method" form attributes', function() {
		const form = $('#form1');

		assert.strictEqual(form.attr('action'), 'ajax/text.html', 'form "action"');
		assert.strictEqual(form.attr('method'), 'get', 'form "method"');
	});

	it('formToArray: multi-select', function() {
		const arr = $('#form1').formToArray();
		const expectedLength = 13;
		const expectedMultipleCount = 3;

		assert.instanceOf(arr, Array, 'type check');
		assert.strictEqual(arr.length, expectedLength, 'array length');
		assert.strictEqual(arrayCount(arr, 'Multiple'), expectedMultipleCount, 'multi-select');
	});

	it('formToArray: "action" and "method" inputs', function() {
		const arr = $('#form1').formToArray();

		assert.instanceOf(arr, Array, 'type check');
		assert.strictEqual(arrayValue(arr, 'action'), '1', 'input name=action');
		assert.strictEqual(arrayValue(arr, 'method'), '2', 'input name=method');
	});

	it('formToArray: semantic test', function() {
		const formData = $('#form2').formToArray(true);
		const testData = ['a', 'b', 'c', 'd', 'e', 'f'];

		for (let i = 0; i < testData.length; i++) {
			assert.strictEqual(formData[i].name, testData[i], 'match value at index=' + i);
		}
	});

	it('formToArray: text promotion for missing value attributes', function() {
		const expected = [
			{name: 'A', value: ''},
			{name: 'B', value: 'MISSING_ATTR'},
			{name: 'C', value: ''},
			{name: 'C', value: 'MISSING_ATTR'}
		];
		const arr = $('#form6').formToArray(true);

		// verify all the option values
		for (let i = 0; i < arr.length; i++) {
			assert.strictEqual(arr[i].name, expected[i].name, 'Name: ' + arr[i].name + ' = ' + expected[i].name);
			assert.strictEqual(arr[i].value, expected[i].value, 'Value: ' + arr[i].value + ' = ' + expected[i].value);
		}
	});

	it('formToArray: outside fields', function() {
		const formData = $('#form10').formToArray();
		const expectedLength = 2;

		assert.strictEqual(formData.length, expectedLength, 'There are two "successful" elements of the form');
	});

	// test string serialization
	it('serialize: param count', function() {
		const ser = $('#form1').formSerialize();
		const expectedStringArrayLength = 13;

		assert.instanceOf(ser, String, 'type check');
		assert.ok(ser.split('&').length === expectedStringArrayLength, 'string array length');
	});

	// test support for input elements not contained within a form
	it('serialize: pseudo form', function() {
		const ser = $('#pseudo *').fieldSerialize();
		const expectedStringArrayLength = 3;

		assert.instanceOf(ser, String, 'type check');
		assert.ok(ser.split('&').length === expectedStringArrayLength, 'string array length');
	});


	// test resetForm
	it('resetForm (text input)', function() {
		const $el = $('#form1 input[name=Name]');
		let val = $el.val();

		assert.ok(val === 'MyName1', 'beforeSubmit: ' + val);
		$el.val('test');
		val = $el.val();
		assert.ok($el.val() === 'test', 'update: ' + val);
		$('#form1').resetForm();
		val = $el.val();
		assert.ok(val === 'MyName1', 'success: ' + val);
	});

	// test resetForm
	it('resetForm (select)', function() {
		const $el = $('#form1 select[name=Single]');
		let val = $el.val();

		assert.ok(val === 'one', 'beforeSubmit: ' + val);
		$el.val('two');
		val = $el.val();
		assert.ok($el.val() === 'two', 'update: ' + val);
		$('#form1').resetForm();
		val = $el.val();
		assert.ok(val === 'one', 'success: ' + val);
	});

	// test resetForm
	it('resetForm (textarea)', function() {
		const $el = $('#form1 textarea');
		let val = $el.val();

		assert.ok(val === 'This is Form1', 'beforeSubmit: ' + val);
		$el.val('test');
		val = $el.val();
		assert.ok(val === 'test', 'udpate: ' + val);
		$('#form1').resetForm();
		val = $el.val();
		assert.ok(val === 'This is Form1', 'success: ' + val);
	});

	// test resetForm
	it('resetForm (checkbox)', function() {
		const el = $('#form1 input:checkbox:checked')[0];
		// const val = el.value;

		assert.ok(el.checked, 'beforeSubmit: ' + el.checked);
		el.checked = false;
		assert.ok(!el.checked, 'update: ' + el.checked);
		$('#form1').resetForm();
		assert.ok(el.checked, 'success: ' + el.checked);
	});

	// test resetForm
	it('resetForm (radio)', function() {
		const el = $('#form1 input:radio:checked')[0];
		// const val = el.value;

		assert.ok(el.checked, 'beforeSubmit: ' + el.checked);
		el.checked = false;
		assert.ok(!el.checked, 'update: ' + el.checked);
		$('#form1').resetForm();
		assert.ok(el.checked, 'success: ' + el.checked);
	});


	// test clearForm
	it('clearForm (text input)', function() {
		const $el = $('#form1 input[name=Name]');
		let val = $el.val();

		assert.ok(val === 'MyName1', 'beforeSubmit: ' + val);
		$('#form1').clearForm();
		val = $el.val();
		assert.ok(val === '', 'success: ' + val);
	});

	// test clearForm
	it('clearForm (select)', function() {
		const $el = $('#form1 select[name=Single]');
		let val = $el.val();

		assert.ok(val === 'one', 'beforeSubmit: ' + val);
		$('#form1').clearForm();
		val = $el.val();
		assert.ok(!val, 'success: ' + val);
	});

	// test clearForm; here we're testing that a hidden field is NOT cleared
	it('clearForm: (hidden input)', function() {
		const $el = $('#form1 input:hidden');
		let val = $el.val();

		assert.ok(val === 'hiddenValue', 'beforeSubmit: ' + val);
		$('#form1').clearForm();
		val = $el.val();
		assert.ok(val === 'hiddenValue', 'success: ' + val);
	});


	// test clearForm; here we're testing that a submit element is NOT cleared
	it('clearForm: (submit input)', function() {
		const $el = $('#form1 input:submit');
		let val = $el.val();

		assert.ok(val === 'Submit1', 'beforeSubmit: ' + val);
		$('#form1').clearForm();
		val = $el.val();
		assert.ok(val === 'Submit1', 'success: ' + val);
	});

	// test clearForm
	it('clearForm (checkbox)', function() {
		const el = $('#form1 input:checkbox:checked')[0];

		assert.ok(el.checked, 'beforeSubmit: ' + el.checked);
		$('#form1').clearForm();
		assert.ok(!el.checked, 'success: ' + el.checked);
	});

	// test clearForm
	it('clearForm (radio)', function() {
		const el = $('#form1 input:radio:checked')[0];

		assert.ok(el.checked, 'beforeSubmit: ' + el.checked);
		$('#form1').clearForm();
		assert.ok(!el.checked, 'success: ' + el.checked);
	});

	// test ajaxSubmit target update
	it('ajaxSubmit: target == String', function() {
		$('#targetDiv').empty();
		// stop();
		const opts = {
			success : function() { // post-callback
				assert.ok(true, 'post-callback');
				assert.ok($('#targetDiv').text().match('Lorem ipsum'), 'targetDiv updated');
				// start();
			},
			target : '#targetDiv'
		};

		// expect(2);
		$('#form3').ajaxSubmit(opts);
	});

	// test passing jQuery object as the target
	it('ajaxSubmit: target == jQuery object', function() {
		// stop();
		const target = $('#targetDiv');

		target.empty();

		const opts = {
			success : function(responseText) { // post-callback
				assert.ok(true, 'post-callback');
				assert.ok($('#targetDiv').text().match('Lorem ipsum'), 'targetDiv updated');
				// start();
			},
			target : target
		};

		// expect(2);
		$('#form2').ajaxSubmit(opts);
	});

	// test passing DOM element as the target
	it('ajaxSubmit: target == DOM element', function() {
		// stop();
		$('#targetDiv').empty();
		// const el = $('#targetDiv')[0];

		const opts = {
			success : function(responseText) { // post-callback
				assert.ok(true, 'post-callback');
				assert.ok($('#targetDiv').text().match('Lorem ipsum'), 'targetDiv updated');
				// start();
			},
			target : '#targetDiv'
		};

		// expect(2);
		$('#form2').ajaxSubmit(opts);
	});

	// test simulated $.load behavior
	it('ajaxSubmit: load target with scripts', function() {
		// stop();
		$('#targetDiv').empty();

		const opts = {
			success : function(responseText) { // post-callback
				assert.ok(true, 'success-callback');
				assert.ok($('#targetDiv').text().match('Lorem ipsum'), 'targetDiv updated');
				assert.ok(typeof unitTestVariable1 !== 'undefined', 'first script block executed');
				assert.ok(typeof unitTestVariable2 !== 'undefined', 'second script block executed');
				assert.ok(typeof scriptCount !== 'undefined', 'third script block executed');
				assert.ok(scriptCount === 1, 'scripts executed once: ' + scriptCount);
				// start();
			},
			target : '#targetDiv',
			url    : 'ajax/doc-with-scripts.html?' + new Date().getTime()
		};

		// expect(6);
		$('#form2').ajaxSubmit(opts);
	});

	// test ajaxSubmit pre-submit callback
	it('ajaxSubmit: pre-submit callback', function() {
		const opts = {
			beforeSubmit : function(arr, jq) { // pre-submit callback
				assert.ok(true, 'pre-submit callback');
				assert.instanceOf(arr, Array, 'type check array');
				assert.ok(jq.jquery, 'type check jQuery');
				assert.ok(jq[0].tagName.toLowerCase() === 'form', 'jQuery arg == "form": ' + jq[0].tagName.toLowerCase());
			}
		};

		// expect(4);
		$('#form3').ajaxSubmit(opts);
	});

	// test ajaxSubmit post-submit callback for response and status text
	it('ajaxSubmit: post-submit callback', function() {
		// stop();

		const opts = {
			success : function(responseText, statusText) { // post-submit callback
				assert.ok(true, 'post-submit callback');
				assert.ok(responseText.match('Lorem ipsum'), 'responseText');
				assert.ok(statusText === 'success', 'statusText');
				// start();
			}
		};

		// expect(3);
		$('#form3').ajaxSubmit(opts);
	});

	// test ajaxSubmit with function argument
	it('ajaxSubmit: function arg', function() {
		// stop();

		// expect(1);
		$('#form3').ajaxSubmit(function() {
			assert.ok(true, 'callback hit');
			// start();
		});
	});

	// test semantic support via ajaxSubmit's pre-submit callback
	it('ajaxSubmit: semantic test', function() {
		const testData = ['a', 'b', 'c', 'd', 'e', 'f'];

		const opts = {
			beforeSubmit : function(arr, jq) { // pre-submit callback
				assert.ok(true, 'pre-submit callback');
				assert.instanceOf(arr, Array, 'type check');
				assert.ok(jq.jquery, 'type check jQuery');
				for (let i = 0; i < arr.length; i++) {
					assert.ok(arr[i].name === testData[i], 'match value at index=' + i);
				}
			},
			semantic : true
		};

		// expect(9);
		$('#form2').ajaxSubmit(opts);
	});

	// test json datatype
	it('ajaxSubmit: dataType == json', function() {
		// stop();

		const opts = {
			dataType : 'json',
			success  : function(data, statusText) { // post-submit callback
				// assert that the json data was evaluated
				assert.ok(typeof data === 'object', 'json data type');
				assert.ok(data.name === 'jquery-test', 'json data contents');
				// start();
			},
			url : 'ajax/json.json'
		};

		// expect(2);
		$('#form2').ajaxSubmit(opts);
	});


	// test script datatype
	it('ajaxSubmit: dataType == script', function() {
		// stop();

		const opts = {
			dataType : 'script',
			success  : function(responseText, statusText) { // post-submit callback
				assert.ok(typeof formScriptTest === 'function', 'script evaluated');
				assert.ok(responseText.match('formScriptTest'), 'script returned');
				// start();
			},
			url : 'ajax/script.txt?' + new Date().getTime() // don't let ie cache it
		};

		// expect(2);
		$('#form2').ajaxSubmit(opts);
	});

	// test xml datatype
	it('ajaxSubmit: dataType == xml', function() {
		// stop();

		const opts = {
			dataType : 'xml',
			success  : function(responseXML, statusText) { // post-submit callback
				const expectedLength = 3;

				assert.ok(typeof responseXML === 'object', 'data type xml');
				assert.ok($('test', responseXML).length === expectedLength, 'xml data query');
				// start();
			},
			url : 'ajax/test.xml'
		};

		// expect(2);
		$('#form2').ajaxSubmit(opts);
	});


	// test that args embedded in the action are honored; no real way
	// to assert this so successful callback is used to signal success
	it('ajaxSubmit: existing args in action attr', function() {
		// stop();

		const opts = {
			success : function() { // post-submit callback
				assert.ok(true, 'post callback');
				// start();
			}
		};

		// expect(1);
		$('#form5').ajaxSubmit(opts);
	});

	// test ajaxSubmit using pre-submit callback to cancel submit
	it('ajaxSubmit: cancel submit', function() {

		const opts = {
			beforeSubmit : function(arr, jq) {		// pre-submit callback
				assert.ok(true, 'pre-submit callback');
				assert.instanceOf(arr, Array, 'type check');
				assert.ok(jq.jquery, 'type check jQuery');

				return false;		// return false to abort submit
			},
			success : function() {	// post-submit callback
				assert.ok(false, 'should not hit this post-submit callback');
			}
		};

		// expect(3);
		$('#form3').ajaxSubmit(opts);
	});

	// test submitting a pseudo-form
	it('ajaxSubmit: pseudo-form', function() {
		// stop();

		const opts = {
			beforeSubmit : function(arr, jq) { // pre-submit callback
				assert.ok(true, 'pre-submit callback');
				assert.instanceOf(arr, Array, 'type check');
				assert.ok(jq.jquery, 'type check jQuery');
				assert.ok(jq[0].tagName.toLowerCase() === 'div', 'jQuery arg == "div"');
			},
			success : function() { // post-submit callback
				assert.ok(true, 'post-submit callback');
				// start();
			},
			type : 'post',
			// url and method must be provided for a pseudo form since they can
			// not be extracted from the markup
			url  : 'ajax/text.html'
		};

		// expect(5);
		$('#pseudo').ajaxSubmit(opts);
	});

	// test eval of json response
	it('ajaxSubmit: evaluate response', function() {
		// stop();

		const opts = {
			success : function(responseText) { // post-callback
				assert.ok(true, 'post-callback');
				const data = eval.call(window, '(' + responseText + ')');

				assert.ok(data.name === 'jquery-test', 'evaled response');
				// start();
			},
			url : 'ajax/json.txt'
		};

		// expect(2);
		$('#form2').ajaxSubmit(opts);
	});


	// test pre and post callbacks for ajaxForm
	it('ajaxForm: pre and post callbacks', function() {
		// stop();

		const opts = {
			beforeSubmit : function(arr, jq) {	// pre-submit callback
				assert.ok(true, 'pre-submit callback');
				assert.instanceOf(arr, Array, 'type check');
				assert.ok(jq.jquery, 'type check jQuery');
			},
			success : function() {			// post-submit callback
				assert.ok(true, 'post-submit callback');
				// start();
			}
		};

		// expect(4);
		$('#form4').ajaxForm(opts);
		$('#submitForm4')[0].click();		// trigger the submit button
	});

	// test that the value of the submit button is captured
	it('ajaxForm: capture submit element', function() {

		const opts = {
			beforeSubmit : function(arr, jq) { // pre-callback
				assert.ok(true, 'pre-callback');
				assert.instanceOf(arr, Array, 'type check');
				assert.ok(jq.jquery, 'type check jQuery');
				assert.ok(arrayValue(arr, 'form4inputName') !== null, 'submit button');
			}
		};

		// expect(4);
		$('#form4').ajaxForm(opts);
		$('#submitForm4withName')[0].click();
	});

	// test image submit support
	it('ajaxForm: capture submit image coordinates', function() {

		const opts = {
			beforeSubmit : function(arr, jq) { // pre-callback
				assert.ok(true, 'pre-callback');
				assert.instanceOf(arr, Array, 'type check');
				assert.ok(jq.jquery, 'type check jQuery');
				assert.ok(arrayValue(arr, 'myImage.x') !== null, 'x coord');
				assert.ok(arrayValue(arr, 'myImage.y') !== null, 'y coord');
			}
		};

		// expect(5);
		$('#form4').ajaxForm(opts);
		$('#form4imageSubmit')[0].click();
	});

	// test image submit support
	it('ajaxForm: capture submit image coordinates (semantic=true)', function() {

		const opts = {
			beforeSubmit : function(arr, jq) { // pre-callback
				assert.ok(true, 'pre-callback');
				assert.instanceOf(arr, Array, 'type check');
				assert.ok(jq.jquery, 'type check jQuery');
				assert.ok(arrayValue(arr, 'myImage.x') !== null, 'x coord');
				assert.ok(arrayValue(arr, 'myImage.y') !== null, 'y coord');
			},
			semantic : true
		};

		// expect(5);
		$('#form4').ajaxForm(opts);
		$('#form4imageSubmit')[0].click();
	});

	// test that the targetDiv gets updated
	it('ajaxForm: update target div', function() {
		$('#targetDiv').empty();
		// stop();

		const opts = {
			beforeSubmit : function(arr, jq) { // pre-callback
				assert.ok(true, 'pre-callback');
				assert.instanceOf(arr, Array, 'type check');
				assert.ok(jq.jquery, 'type check jQuery');
			},
			success : function() {
				assert.ok(true, 'post-callback');
				assert.ok($('#targetDiv').text().match('Lorem ipsum'), 'targetDiv updated');
				// start();
			},
			target : '#targetDiv'
		};

		// expect(5);
		$('#form4').ajaxForm(opts);
		$('#submitForm4')[0].click();
	});

	it('"success" callback', function() {
		$('#targetDiv').empty();
		// stop();

		const opts = {
			success : function() {
				assert.ok(true, 'post-callback');
				// start();
			}
		};

		// expect(1);
		$('#form3').ajaxSubmit(opts);
	});

	it('"error" callback', function() {
		$('#targetDiv').empty();
		// stop();

		const opts = {
			error : function() {
				assert.ok(true, 'error-callback');
				// start();
			},
			success : function() { // post-submit callback
				assert.ok(false, 'should not hit post-submit callback');
			},
			url : 'ajax/404.html'
		};

		// expect(1);
		$('#form3').ajaxSubmit(opts);
	});


	it('fieldValue(true)', function() {
		let i;

		assert.ok($('#fieldTest input').fieldValue(true)[0] === '5', 'input');
		assert.ok($('#fieldTest :input').fieldValue(true)[0] === '1', ':input');
		assert.ok($('#fieldTest input:hidden').fieldValue(true)[0] === '5', ':hidden');
		assert.ok($('#fieldTest :password').fieldValue(true)[0] === '14', ':password');
		assert.ok($('#fieldTest :radio').fieldValue(true)[0] === '12', ':radio');
		assert.ok($('#fieldTest select').fieldValue(true)[0] === '1', 'select');

		let expected = ['8', '10'];
		let result = $('#fieldTest :checkbox').fieldValue(true);

		assert.ok(result.length === expected.length, 'result size check (checkbox): ' + result.length + '=' + expected.length);
		for (i = 0; i < result.length; i++) {
			assert.ok(result[i] === expected[i], expected[i]);
		}

		expected = ['3', '4'];
		result = $('#fieldTest [name=B]').fieldValue(true);
		assert.ok(result.length === expected.length, 'result size check (select-multiple): ' + result.length + '=' + expected.length);
		for (i = 0; i < result.length; i++) {
			assert.ok(result[i] === expected[i], expected[i]);
		}
	});

	// eslint-disable-next-line max-statements
	it('fieldValue(false)', function() {
		let i;

		assert.ok($('#fieldTest input').fieldValue(false)[0] === '5', 'input');
		assert.ok($('#fieldTest :input').fieldValue(false)[0] === '1', ':input');
		assert.ok($('#fieldTest input:hidden').fieldValue(false)[0] === '5', ':hidden');
		assert.ok($('#fieldTest :password').fieldValue(false)[0] === '14', ':password');
		assert.ok($('#fieldTest select').fieldValue(false)[0] === '1', 'select');

		let expected = ['8', '9', '10'];
		let result = $('#fieldTest :checkbox').fieldValue(false);

		assert.ok(result.length === expected.length, 'result size check (checkbox): ' + result.length + '=' + expected.length);
		for (i = 0; i < result.length; i++) {
			assert.ok(result[i] === expected[i], expected[i]);
		}

		expected = ['11', '12', '13'];
		result = $('#fieldTest :radio').fieldValue(false);
		assert.ok(result.length === expected.length, 'result size check (radio): ' + result.length + '=' + expected.length);
		for (i = 0; i < result.length; i++) {
			assert.ok(result[i] === expected[i], expected[i]);
		}

		expected = ['3', '4'];
		result = $('#fieldTest [name=B]').fieldValue(false);
		assert.ok(result.length === expected.length, 'result size check (select-multiple): ' + result.length + '=' + expected.length);
		for (i = 0; i < result.length; i++) {
			assert.ok(result[i] === expected[i], expected[i]);
		}
	});

	it('fieldSerialize(true) input', function() {
		const expected = ['C=5', 'D=6', 'F=8', 'F=10', 'G=12', 'H=14'];

		let result = $('#fieldTest input').fieldSerialize(true);

		result = result.split('&');

		assert.ok(result.length === expected.length, 'result size check: ' + result.length + '=' + expected.length);
		for (let i = 0; i < result.length; i++) {
			assert.ok(result[i] === expected[i], expected[i] + ' = ' + result[i]);
		}
	});

	it('fieldSerialize(true) :input', function() {
		const expected = ['A=1', 'B=3', 'B=4', 'C=5', 'D=6', 'E=7', 'F=8', 'F=10', 'G=12', 'H=14'];

		let result = $('#fieldTest :input').fieldSerialize(true);

		result = result.split('&');

		assert.ok(result.length === expected.length, 'result size check: ' + result.length + '=' + expected.length);
		for (let i = 0; i < result.length; i++) {
			assert.ok(result[i] === expected[i], expected[i] + ' = ' + result[i]);
		}
	});

	it('fieldSerialize(false) :input', function() {
		const expected = ['A=1', 'B=3', 'B=4', 'C=5', 'D=6', 'E=7', 'F=8', 'F=9', 'F=10', 'G=11', 'G=12', 'G=13', 'H=14', 'I=15', 'J=16'];

		let result = $('#fieldTest :input').fieldSerialize(false);

		result = result.split('&');

		assert.ok(result.length === expected.length, 'result size check: ' + result.length + '=' + expected.length);
		for (let i = 0; i < result.length; i++) {
			assert.ok(result[i] === expected[i], expected[i] + ' = ' + result[i]);
		}
	});

	it('fieldSerialize(true) select-mulitple', function() {
		const expected = ['B=3', 'B=4'];

		let result = $('#fieldTest [name=B]').fieldSerialize(true);

		result = result.split('&');

		assert.ok(result.length === expected.length, 'result size check: ' + result.length + '=' + expected.length);
		for (let i = 0; i < result.length; i++) {
			assert.ok(result[i] === expected[i], expected[i] + ' = ' + result[i]);
		}
	});

	it('fieldSerialize(true) :checkbox', function() {
		const expected = ['F=8', 'F=10'];

		let result = $('#fieldTest :checkbox').fieldSerialize(true);

		result = result.split('&');

		assert.ok(result.length === expected.length, 'result size check: ' + result.length + '=' + expected.length);
		for (let i = 0; i < result.length; i++) {
			assert.ok(result[i] === expected[i], expected[i] + ' = ' + result[i]);
		}
	});

	it('fieldSerialize(false) :checkbox', function() {
		const expected = ['F=8', 'F=9', 'F=10'];

		let result = $('#fieldTest :checkbox').fieldSerialize(false);

		result = result.split('&');

		assert.ok(result.length === expected.length, 'result size check: ' + result.length + '=' + expected.length);
		for (let i = 0; i < result.length; i++) {
			assert.ok(result[i] === expected[i], expected[i] + ' = ' + result[i]);
		}
	});

	it('fieldSerialize(true) :radio', function() {
		const expected = ['G=12'];

		let result = $('#fieldTest :radio').fieldSerialize(true);

		result = result.split('&');

		assert.ok(result.length === expected.length, 'result size check: ' + result.length + '=' + expected.length);
		for (let i = 0; i < result.length; i++) {
			assert.ok(result[i] === expected[i], expected[i] + ' = ' + result[i]);
		}
	});

	it('fieldSerialize(false) :radio', function() {
		const expected = ['G=11', 'G=12', 'G=13'];

		let result = $('#fieldTest :radio').fieldSerialize(false);

		result = result.split('&');

		assert.ok(result.length === expected.length, 'result size check: ' + result.length + '=' + expected.length);
		for (let i = 0; i < result.length; i++) {
			assert.ok(result[i] === expected[i], expected[i] + ' = ' + result[i]);
		}
	});

	it('ajaxForm - auto unbind', function() {
		$('#targetDiv').empty();
		// stop();

		const opts = {
			beforeSubmit : function(arr, jq) { // pre-callback
				assert.ok(true, 'pre-callback');
			},
			success : function() {
				assert.ok(true, 'post-callback');
				// start();
			},
			target : '#targetDiv'
		};

		// expect(2);
		// multiple binds
		$('#form8').ajaxForm(opts).ajaxForm(opts)
			.ajaxForm(opts);
		$('#submitForm8')[0].click();
	});

	it('ajaxFormUnbind', function() {
		$('#targetDiv').empty();
		// stop();

		const opts = {
			beforeSubmit : function(arr, jq) { // pre-callback
				assert.ok(true, 'pre-callback');
			},
			success : function() {
				assert.ok(true, 'post-callback');
				// start();
			},
			target : '#targetDiv'
		};

		// expect(0);
		// multiple binds
		$('#form9').ajaxForm(opts).submit(function() {
			return false;
		});
		$('#form9').ajaxFormUnbind(opts);
		$('#submitForm9')[0].click();

		// setTimeout(start, 500);
	});

	it('naked hash', function() {
		$('#actionTest1').ajaxSubmit({
			beforeSerialize : function($f, opts) {
				assert.ok(true, 'url=' + opts.url);
			}
		});
		assert.ok(true, 'ajaxSubmit passed');
	});
	it('hash only', function() {
		$('#actionTest2').ajaxSubmit({
			beforeSerialize : function($f, opts) {
				assert.ok(true, 'url=' + opts.url);
			}
		});
		assert.ok(true, 'ajaxSubmit passed');
	});
	it('empty action', function() {
		$('#actionTest3').ajaxSubmit({
			beforeSerialize : function($f, opts) {
				assert.ok(true, 'url=' + opts.url);
			}
		});
		assert.ok(true, 'ajaxSubmit passed');
	});
	it('missing action', function() {
		$('#actionTest4').ajaxSubmit({
			beforeSerialize : function($f, opts) {
				assert.ok(true, 'url=' + opts.url);
			}
		});
		assert.ok(true, 'ajaxSubmit passed');
	});

	it('success callback params', function() {
		let $testForm;

		$('#targetDiv').empty();
		// stop();

		if (/^1\.3/.test($.fn.jquery)) {
			// expect(3);
			$testForm = $('#form3').ajaxSubmit({
				success : function(data, status, $form) { // jQuery 1.4+ signature
					assert.ok(true, 'success callback invoked');
					assert.ok(status === 'success', 'status === success');
					assert.ok($form === $testForm, '$form param is valid');
					// start();
				}
			});

		} else {	// if (/^1\.4/.test($.fn.jquery)) {
			// expect(6);
			$testForm = $('#form3').ajaxSubmit({
				success : function(data, status, xhr, $form) { // jQuery 1.4+ signature
					assert.ok(true, 'success callback invoked');
					assert.ok(status === 'success', 'status === success');
					assert.ok(true, 'third arg: ' + xhr !== undefined);
					assert.ok(Boolean(xhr) !== false, 'xhr != false');
					assert.ok(xhr.status, 'xhr.status == ' + xhr.status);
					assert.ok($form === $testForm, '$form param is valid');
					// start();
				}
			});
		}
	});

	it('forceSync', function() {
		$('#targetDiv').empty();
		// stop();

		// expect(2);
		/* const $testForm = */ $('#form3').ajaxSubmit({
			forceSync : true,
			success   : function(data, status, $form) { // jQuery 1.4+ signature
				assert.ok(true, 'success callback invoked');
				assert.ok(status === 'success', 'status === success');
				// start();
			}
		});
	});

});
