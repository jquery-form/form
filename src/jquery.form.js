/*!
 * jQuery Form Plugin
 * version: 4.3.0
 * Requires jQuery v1.7.2 or later
 * Project repository: https://github.com/jquery-form/form

 * Copyright 2017 Kevin Morris
 * Copyright 2006 M. Alsup

 * Dual licensed under the LGPL-2.1+ or MIT licenses
 * https://github.com/jquery-form/form#license

 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 */
/* global ActiveXObject */

/* eslint-disable strict, max-statements */
(function (factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(['jquery'], factory);
	} else if (typeof module === 'object' && module.exports) {
		// Node/CommonJS
		module.exports = function(root, jQuery) {
			if (typeof jQuery === 'undefined') {
				// require('jQuery') returns a factory that requires window to build a jQuery instance, we normalize how we use modules
				// that require this pattern but the window provided is a noop if it's defined (how jquery works)
				if (typeof window === 'undefined') {
					jQuery = require('jquery')(root);
				} else {
					jQuery = require('jquery');
				}
			}
			factory(jQuery);

			return jQuery;
		};
	} else {
		// Browser globals
		factory(jQuery);
	}

}(function ($) {
	/* eslint-enable strict, max-statements */
	'use strict';

	/*
		Usage Note:
		-----------
		Do not use both ajaxSubmit and ajaxForm on the same form. These
		functions are mutually exclusive. Use ajaxSubmit if you want
		to bind your own submit handler to the form. For example,

		$(document).ready(function() {
			$('#myForm').on('submit', function(e) {
				e.preventDefault(); // <-- important
				$(this).ajaxSubmit({
					target: '#output'
				});
			});
		});

		Use ajaxForm when you want the plugin to manage all the event binding
		for you. For example,

		$(document).ready(function() {
			$('#myForm').ajaxForm({
				target: '#output'
			});
		});

		You can also use ajaxForm with delegation (requires jQuery v1.7+), so the
		form does not have to exist when you invoke ajaxForm:

		$('#myForm').ajaxForm({
			delegation: true,
			target: '#output'
		});

		When using ajaxForm, the ajaxSubmit function will be invoked for you
		at the appropriate time.
	*/

	const rCRLF = /\r?\n/g;

	const SUCCESS = 200;
	const REDIRECT = 300;
	const NOT_MODIFIED = 304;

	const MULTIPART = 'multipart/form-data';

	const hasOwn = function (obj, prop) {
		return {}.hasOwnProperty.call(obj, prop);
	};

	/**
	 * Feature detection
	 */
	const feature = {};

	feature.fileapi = $('<input type="file">').get(0).files !== undefined;
	feature.formdata = typeof window.FormData !== 'undefined';

	const hasProp = !!$.fn.prop;

	// attr2 uses prop when it can but checks the return type for
	// an expected string. This accounts for the case where a form
	// contains inputs with names like "action" or "method"; in those
	// cases "prop" returns the element
	$.fn.attr2 = function() {
		if (!hasProp) {
			return this.attr.apply(this, arguments);
		}

		const val = this.prop.apply(this, arguments);

		if ((val && val.jquery) || typeof val === 'string') {
			return val;
		}

		return this.attr.apply(this, arguments);
	};

	/* eslint-disable complexity, max-statements */
	/**
	 * ajaxSubmit() provides a mechanism for immediately submitting
	 * an HTML form using AJAX.
	 *
	 * @param	{object|string}	options		jquery.form.js parameters or custom url for submission
	 * @param	{object}		data		extraData
	 * @param	{string}		dataType	ajax dataType
	 * @param	{function}		onSuccess	ajax success callback function
	 */
	$.fn.ajaxSubmit = function(options, data, dataType, onSuccess) {
		// fast fail if nothing selected (http://dev.jquery.com/ticket/2752)
		if (!this.length) {
			log('ajaxSubmit: skipping submit process - no element selected');

			return this;
		}

		/* eslint consistent-this: ["error", "$form"] */
		let url;
		const $form = this;

		if (typeof options === 'function') {
			options = {success: options};

		} else if (typeof options === 'string' || (options === false && arguments.length > 0)) {
			options = {
				data     : data,
				dataType : dataType,
				url      : options
			};

			if (typeof onSuccess === 'function') {
				options.success = onSuccess;
			}

		} else if (typeof options === 'undefined') {
			options = {};
		}

		const method = options.method || options.type || this.attr2('method');
		const action = options.url || this.attr2('action');

		url = typeof action === 'string' ? $.trim(action) : '';
		url = url || window.location.href || '';
		if (url) {
			// clean url (don't include hash vaue)
			url = (url.match(/^([^#]+)/) || [])[1];
		}
		// IE requires javascript:false in https, but this breaks chrome >83 and goes against spec.
		// Instead of using javascript:false always, let's only apply it for IE.
		const isMsie = /(MSIE|Trident)/.test(navigator.userAgent || '');
		const iframeSrc = isMsie && /^https/i.test(window.location.href || '') ? 'javascript:false' : 'about:blank'; // eslint-disable-line no-script-url

		options = $.extend(true, {
			iframeSrc : iframeSrc,
			success   : $.ajaxSettings.success,
			type      : method || $.ajaxSettings.type,
			url       : url
		}, options);

		// hook for manipulating the form data before it is extracted;
		// convenient for use with rich editors like tinyMCE or FCKEditor
		const veto = {};

		this.trigger('form-pre-serialize', [this, options, veto]);

		if (veto.veto) {
			log('ajaxSubmit: submit vetoed via form-pre-serialize trigger');

			return this;
		}

		// provide opportunity to alter form data before it is serialized
		if (options.beforeSerialize && options.beforeSerialize(this, options) === false) {
			log('ajaxSubmit: submit aborted via beforeSerialize callback');

			return this;
		}

		let traditional = options.traditional;

		if (typeof traditional === 'undefined') {
			traditional = $.ajaxSettings.traditional;
		}

		const elements = [];
		let qx;
		const arr = this.formToArray(options.semantic, elements, options.filtering);

		if (options.data) {
			const optionsData = $.isFunction(options.data) ? options.data(arr) : options.data;

			options.extraData = optionsData;
			qx = $.param(optionsData, traditional);
		}

		// give pre-submit callback an opportunity to abort the submit
		if (options.beforeSubmit && options.beforeSubmit(arr, this, options) === false) {
			log('ajaxSubmit: submit aborted via beforeSubmit callback');

			return this;
		}

		// fire vetoable 'validate' event
		this.trigger('form-submit-validate', [arr, this, options, veto]);
		if (veto.veto) {
			log('ajaxSubmit: submit vetoed via form-submit-validate trigger');

			return this;
		}

		let queryStr = $.param(arr, traditional);

		if (qx) {
			queryStr = queryStr ? queryStr + '&' + qx : qx;
		}

		if (options.type.toUpperCase() === 'GET') {
			options.url += (options.url.indexOf('?') >= 0 ? '&' : '?') + queryStr;
			options.data = null;	// data is null for 'get'
		} else {
			options.data = queryStr;		// data is the query string for 'post'
		}

		const callbacks = [];

		if (options.resetForm) {
			callbacks.push(function() {
				$form.resetForm();
			});
		}

		if (options.clearForm) {
			callbacks.push(function() {
				$form.clearForm(options.includeHidden);
			});
		}

		// perform a load on the target only if dataType is not provided
		if (!options.dataType && options.target) {
			const oldSuccess = options.success || function() {};

			callbacks.push(function(dta, textStatus, jqXHR) {
				const fn = options.replaceTarget ? 'replaceWith' : 'html',
					successArguments = arguments;

				$(options.target)[fn](dta).each(function() {
					oldSuccess.apply(this, successArguments);
				});
			});

		} else if (options.success) {
			if ($.isArray(options.success)) {
				$.merge(callbacks, options.success);
			} else {
				callbacks.push(options.success);
			}
		}

		options.success = function(dta, status, xhr) { // jQuery 1.4+ passes xhr as 3rd arg
			const context = options.context || this;		// jQuery 1.4+ supports scope context

			for (let i = 0, max = callbacks.length; i < max; i++) {
				callbacks[i].apply(context, [dta, status, xhr || $form, $form]);
			}
		};

		if (options.error) {
			const oldError = options.error;

			options.error = function(xhr, status, error) {
				const context = options.context || this;

				oldError.apply(context, [xhr, status, error, $form]);
			};
		}

		if (options.complete) {
			const oldComplete = options.complete;

			options.complete = function(xhr, status) {
				const context = options.context || this;

				oldComplete.apply(context, [xhr, status, $form]);
			};
		}

		// are there files to upload?

		// [value] (issue #113), also see comment:
		// https://github.com/malsup/form/commit/588306aedba1de01388032d5f42a60159eea9228#commitcomment-2180219
		const fileInputs = $('input[type=file]:enabled', this).filter(function() {
			return $(this).val() !== '';
		});
		const hasFileInputs = fileInputs.length > 0;
		const multipart = $form.attr('enctype') === MULTIPART || $form.attr('encoding') === MULTIPART;
		const fileAPI = feature.fileapi && feature.formdata;

		log('fileAPI :' + fileAPI);

		const shouldUseFrame = (hasFileInputs || multipart) && !fileAPI;
		let jqxhr;

		// options.iframe allows user to force iframe mode
		// 06-NOV-09: now defaulting to iframe mode if file input is detected
		if (options.iframe !== false && (options.iframe || shouldUseFrame)) {
			// hack to fix Safari hang (thanks to Tim Molendijk for this)
			// see: http://groups.google.com/group/jquery-dev/browse_thread/thread/36395b7ab510dd5d
			if (options.closeKeepAlive) {
				$.get(options.closeKeepAlive, function() {
					jqxhr = fileUploadIframe(arr);
				});

			} else {
				jqxhr = fileUploadIframe(arr);
			}

		} else if ((hasFileInputs || multipart) && fileAPI) {
			jqxhr = fileUploadXhr(arr);

		} else {
			jqxhr = $.ajax(options);
		}

		$form.removeData('jqxhr').data('jqxhr', jqxhr);

		// clear element array
		for (let i = 0; i < elements.length; i++) {
			elements[i] = null;
		}

		// fire 'notify' event
		this.trigger('form-submit-notify', [this, options]);

		return this;

		// utility fn for deep serialization
		function deepSerialize(extraData) {
			const serialized = $.param(extraData, options.traditional).split('&');
			const len = serialized.length;
			const result = [];
			let i, part;

			for (i = 0; i < len; i++) {
				// #252; undo param space replacement
				serialized[i] = serialized[i].replace(/\+/g, ' ');
				part = serialized[i].split('=');
				// #278; use array instead of object storage, favoring array serializations
				result.push([decodeURIComponent(part[0]), decodeURIComponent(part[1])]);
			}

			return result;
		}

		// XMLHttpRequest Level 2 file uploads (big hat tip to francois2metz)
		function fileUploadXhr(array) {
			const formdata = new FormData();

			for (let i = 0; i < array.length; i++) {
				formdata.append(array[i].name, array[i].value);
			}

			if (options.extraData) {
				const serializedData = deepSerialize(options.extraData);

				for (let i = 0; i < serializedData.length; i++) {
					if (serializedData[i]) {
						formdata.append(serializedData[i][0], serializedData[i][1]);
					}
				}
			}

			options.data = null;

			const settings = $.extend(true, {}, $.ajaxSettings, options, {
				cache       : false,
				contentType : false,
				processData : false,
				type        : method || 'POST'
			});

			if (options.uploadProgress) {
				// workaround because jqXHR does not expose upload property
				settings.xhr = function() {
					const xhr = $.ajaxSettings.xhr();

					if (xhr.upload) {
						xhr.upload.addEventListener('progress', function(event) {
							let percent = 0;
							const position = event.loaded || event.position;			/* event.position is deprecated */
							const total = event.total;

							if (event.lengthComputable) {
								const pct = 100;

								percent = Math.ceil(position / total * pct);
							}

							options.uploadProgress(event, position, total, percent);
						}, false);
					}

					return xhr;
				};
			}

			settings.data = null;

			const beforeSend = settings.beforeSend;

			settings.beforeSend = function(xhr, optns) {
				// Send FormData() provided by user
				if (options.formData) {
					optns.data = options.formData;
				} else {
					optns.data = formdata;
				}

				if (beforeSend) {
					beforeSend.call(this, xhr, optns);
				}
			};

			return $.ajax(settings);
		}

		// private function for handling file uploads (hat tip to YAHOO!)
		function fileUploadIframe(array) {
			const form = $form[0];
			let $io, el, id, timedOut, timeoutHandle;

			if (array) {
				// ensure that every serialized input is still enabled
				for (let i = 0; i < elements.length; i++) {
					el = $(elements[i]);
					if (hasProp) {
						el.prop('disabled', false);
					} else {
						el.removeAttr('disabled');
					}
				}
			}

			const settings = $.extend(true, {}, $.ajaxSettings, options);

			settings.context = settings.context || settings;
			id = 'jqFormIO' + new Date().getTime();
			const ownerDocument = form.ownerDocument;
			const $body = $form.closest('body');

			let name;

			if (settings.iframeTarget) {
				$io = $(settings.iframeTarget, ownerDocument);
				name = $io.attr2('name');
				if (name) {
					id = name;
				} else {
					$io.attr2('name', id);
				}

			} else {
				$io = $('<iframe name="' + id + '" src="' + settings.iframeSrc + '" />', ownerDocument);
				$io.css({left: '-1000px', position: 'absolute', top: '-1000px'});
			}
			const io = $io[0];

			const glbl = settings.global;

			const xhr = { // mock object
				abort : function(status) {
					const e = status === 'timeout' ? 'timeout' : 'aborted';

					log('aborting upload... ' + e);
					this.aborted = 1;

					try { // #214, #257
						if (io.contentWindow.document.execCommand) {
							io.contentWindow.document.execCommand('Stop');
						}
					} catch (ignore) {}

					$io.attr('src', settings.iframeSrc); // abort op in progress
					xhr.error = e;
					if (settings.error) {
						settings.error.call(settings.context, xhr, e, status);
					}

					if (glbl) {
						$.event.trigger('ajaxError', [xhr, settings, e]);
					}

					if (settings.complete) {
						settings.complete.call(settings.context, xhr, e);
					}
				},
				aborted               : 0,
				getAllResponseHeaders : function() {},
				getResponseHeader     : function() {},
				responseText          : null,
				responseXML           : null,
				setRequestHeader      : function() {},
				status                : 0,
				statusText            : 'n/a'
			};

			// trigger ajax global events so that activity/block indicators work like normal
			if (glbl && $.active++ === 0) {
				$.event.trigger('ajaxStart');
			}
			if (glbl) {
				$.event.trigger('ajaxSend', [xhr, settings]);
			}

			const deferred = $.Deferred();

			// #341
			deferred.abort = function(status) {
				xhr.abort(status);
			};

			if (settings.beforeSend && settings.beforeSend.call(settings.context, xhr, settings) === false) {
				if (settings.global) {
					$.active--;
				}
				deferred.reject();

				return deferred;
			}

			if (xhr.aborted) {
				deferred.reject();

				return deferred;
			}

			// add submitting element to data if we know it
			const sub = form.clk;

			if (sub) {
				name = sub.name;
				if (name && !sub.disabled) {
					settings.extraData = settings.extraData || {};
					settings.extraData[name] = sub.value;
					if (sub.type === 'image') {
						settings.extraData[name + '.x'] = form.clk_x;
						settings.extraData[name + '.y'] = form.clk_y;
					}
				}
			}

			const CLIENT_TIMEOUT_ABORT = 1;
			const SERVER_ABORT = 2;

			function getDoc(frame) {
				/* it looks like contentWindow or contentDocument do not
				 * carry the protocol property in ie8, when running under ssl
				 * frame.document is the only valid response document, since
				 * the protocol is know but not on the other two objects. strange?
				 * "Same origin policy" http://en.wikipedia.org/wiki/Same_origin_policy
				 */

				let doc = null;

				// IE8 cascading access check
				try {
					if (frame.contentWindow) {
						doc = frame.contentWindow.document;
					}
				} catch (err) {
					// IE8 access denied under ssl & missing protocol
					log('cannot get iframe.contentWindow document: ' + err);
				}

				if (doc) { // successful getting content
					return doc;
				}

				try { // simply checking may throw in ie8 under ssl or mismatched protocol
					doc = frame.contentDocument ? frame.contentDocument : frame.document;
				} catch (err) {
					// last attempt
					log('cannot get iframe.contentDocument: ' + err);
					doc = frame.document;
				}

				return doc;
			}

			// Rails CSRF hack (thanks to Yvan Barthelemy)
			const csrfToken = $('meta[name=csrf-token]').attr('content');
			const csrfParam = $('meta[name=csrf-param]').attr('content');

			if (csrfParam && csrfToken) {
				settings.extraData = settings.extraData || {};
				settings.extraData[csrfParam] = csrfToken;
			}

			// take a breath so that pending repaints get some cpu time before the upload starts
			function doSubmit() {
				// make sure form attrs are set
				const actn = $form.attr2('action'),
					et = $form.attr('enctype') || $form.attr('encoding') || MULTIPART,
					target = $form.attr2('target');

				// update form attrs in IE friendly way
				form.setAttribute('target', id);
				if (!method || /post/i.test(method)) {
					form.setAttribute('method', 'POST');
				}
				if (actn !== settings.url) {
					form.setAttribute('action', settings.url);
				}

				// ie borks in some cases when setting encoding
				if (!settings.skipEncodingOverride && (!method || /post/i.test(method))) {
					$form.attr({
						encoding : 'multipart/form-data',
						enctype  : 'multipart/form-data'
					});
				}

				// support timout
				if (settings.timeout) {
					timeoutHandle = setTimeout(function() {
						timedOut = true; cb(CLIENT_TIMEOUT_ABORT);
					}, settings.timeout);
				}

				// look for server aborts
				function checkState() {
					try {
						const state = getDoc(io).readyState;

						log('state = ' + state);
						if (state && state.toLowerCase() === 'uninitialized') {
							const timeout = 50;

							setTimeout(checkState, timeout);
						}

					} catch (e) {
						log('Server abort: ', e, ' (', e.name, ')');
						cb(SERVER_ABORT);				// eslint-disable-line callback-return
						if (timeoutHandle) {
							clearTimeout(timeoutHandle);
						}
						timeoutHandle = undefined;
					}
				}

				// add "extra" data to form if provided in options
				const extraInputs = [];

				try {
					if (settings.extraData) {
						for (const nExtraData of Object.values(settings.extraData)) {
							// if using the $.param format that allows for multiple values with the same name
							if ($.isPlainObject(nExtraData) && hasOwn(nExtraData, 'name') && hasOwn(nExtraData, 'value')) {
								extraInputs.push(
									$('<input type="hidden" name="' + nExtraData.name + '">', ownerDocument).val(nExtraData.value)
										.appendTo(form)[0]);
							} else {
								extraInputs.push(
									$('<input type="hidden" name="' + name + '">', ownerDocument).val(nExtraData)
										.appendTo(form)[0]);
							}
						}
					}

					if (!settings.iframeTarget) {
						// add iframe to doc and submit the form
						$io.appendTo($body);
					}

					if (io.attachEvent) {
						io.attachEvent('onload', cb);
					} else {
						io.addEventListener('load', cb, false);
					}

					const timeout = 15;

					setTimeout(checkState, timeout);

					try {
						form.submit();

					} catch (err) {
						// just in case form has element with name/id of 'submit'
						const submitFn = document.createElement('form').submit;

						submitFn.apply(form);
					}

				} finally {
					// reset attrs and remove "extra" input elements
					form.setAttribute('action', actn);
					form.setAttribute('enctype', et); // #380
					if (target) {
						form.setAttribute('target', target);
					} else {
						$form.removeAttr('target');
					}
					$(extraInputs).remove();
				}
			}

			// eslint-disable-next-line no-sync
			if (settings.forceSync) {
				doSubmit();
			} else {
				const timeout = 10;

				setTimeout(doSubmit, timeout); // this lets dom updates render
			}

			let callbackProcessed, doc, domCheckCount = 50;

			// eslint-disable-next-line prefer-const
			let httpData;

			const toXml = $.parseXML || function(str, docum) { // use parseXML if available (jQuery 1.5+)
				if (window.ActiveXObject) {
					docum = new ActiveXObject('Microsoft.XMLDOM');
					docum.async = 'false';
					docum.loadXML(str);

				} else {
					docum = new DOMParser().parseFromString(str, 'text/xml');
				}

				return docum && docum.documentElement && docum.documentElement.nodeName !== 'parsererror' ? docum : null;
			};

			function cb(e) {
				if (xhr.aborted || callbackProcessed) {
					return;
				}

				doc = getDoc(io);
				if (!doc) {
					log('cannot access response document');
					e = SERVER_ABORT;
				}
				if (e === CLIENT_TIMEOUT_ABORT && xhr) {
					xhr.abort('timeout');
					deferred.reject(xhr, 'timeout');

					return;

				}
				if (e === SERVER_ABORT && xhr) {
					xhr.abort('server abort');
					deferred.reject(xhr, 'error', 'server abort');

					return;
				}

				if (!doc || doc.location.href === settings.iframeSrc) {
					// response not received yet
					if (!timedOut) {
						return;
					}
				}

				if (io.detachEvent) {
					io.detachEvent('onload', cb);
				} else {
					io.removeEventListener('load', cb, false);
				}

				let errMsg, status = 'success';

				let dta;

				try {
					if (timedOut) {
						throw new Error('timeout');
					}

					const isXml = settings.dataType === 'xml' || doc.XMLDocument || $.isXMLDoc(doc);

					log('isXml=' + isXml);

					if (!isXml && window.opera && (doc.body === null || !doc.body.innerHTML)) {
						if (--domCheckCount) {
							// in some browsers (Opera) the iframe DOM is not always traversable when
							// the onload callback fires, so we loop a bit to accommodate
							log('requeing onLoad callback, DOM not available');

							const timeout = 250;

							setTimeout(cb, timeout);

							return;
						}
						// let this fall through because server response could be an empty document
						// log('Could not access iframe DOM after mutiple tries.');
						// throw 'DOMException: not available';
					}

					// log('response detected');
					const docRoot = doc.body ? doc.body : doc.documentElement;

					xhr.responseText = docRoot ? docRoot.innerHTML : null;
					xhr.responseXML = doc.XMLDocument ? doc.XMLDocument : doc;
					if (isXml) {
						settings.dataType = 'xml';
					}
					xhr.getResponseHeader = function(header) {
						const headers = {'content-type': settings.dataType};

						return headers[header.toLowerCase()];
					};
					// support for XHR 'status' & 'statusText' emulation :
					if (docRoot) {
						xhr.status = Number(docRoot.getAttribute('status')) || xhr.status;
						xhr.statusText = docRoot.getAttribute('statusText') || xhr.statusText;
					}

					const dt = (settings.dataType || '').toLowerCase();
					const scr = /(json|script|text)/.test(dt);

					if (scr || settings.textarea) {
						// see if user embedded response in textarea
						const ta = doc.getElementsByTagName('textarea')[0];

						if (ta) {
							xhr.responseText = ta.value;
							// support for XHR 'status' & 'statusText' emulation :
							xhr.status = Number(ta.getAttribute('status')) || xhr.status;
							xhr.statusText = ta.getAttribute('statusText') || xhr.statusText;

						} else if (scr) {
							// account for browsers injecting pre around json response
							const pre = doc.getElementsByTagName('pre')[0];
							const body = doc.getElementsByTagName('body')[0];

							if (pre) {
								xhr.responseText = pre.textContent ? pre.textContent : pre.innerText;
							} else if (body) {
								xhr.responseText = body.textContent ? body.textContent : body.innerText;
							}
						}

					} else if (dt === 'xml' && !xhr.responseXML && xhr.responseText) {
						xhr.responseXML = toXml(xhr.responseText);
					}

					try {
						dta = httpData(xhr, dt, settings);
					} catch (err) {
						status = 'parsererror';
						errMsg = err || status;
						xhr.error = errMsg;
					}

				} catch (err) {
					log('error caught: ', err);
					status = 'error';
					errMsg = err || status;
					xhr.error = errMsg;
				}

				if (xhr.aborted) {
					log('upload aborted');
					status = null;
				}

				if (xhr.status) { // we've set xhr.status
					status = (xhr.status >= SUCCESS && xhr.status < REDIRECT) || xhr.status === NOT_MODIFIED ? 'success' : 'error';
				}

				// ordering of these callbacks/triggers is odd, but that's how $.ajax does it
				if (status === 'success') {
					if (settings.success) {
						settings.success.call(settings.context, dta, 'success', xhr);
					}

					deferred.resolve(xhr.responseText, 'success', xhr);

					if (glbl) {
						$.event.trigger('ajaxSuccess', [xhr, settings]);
					}

				} else if (status) {
					if (typeof errMsg === 'undefined') {
						errMsg = xhr.statusText;
					}
					if (settings.error) {
						settings.error.call(settings.context, xhr, status, errMsg);
					}
					deferred.reject(xhr, 'error', errMsg);
					if (glbl) {
						$.event.trigger('ajaxError', [xhr, settings, errMsg]);
					}
				}

				if (glbl) {
					$.event.trigger('ajaxComplete', [xhr, settings]);
				}

				if (glbl && !--$.active) {
					$.event.trigger('ajaxStop');
				}

				if (settings.complete) {
					settings.complete.call(settings.context, xhr, status);
				}

				callbackProcessed = true;
				if (settings.timeout) {
					clearTimeout(timeoutHandle);
				}

				// clean up
				const timeout = 100;

				setTimeout(function() {
					if (settings.iframeTarget) {
						$io.attr('src', settings.iframeSrc);
					} else { // adding else to clean up existing iframe response.
						$io.remove();
					}
					xhr.responseXML = null;
				}, timeout);
			}

			const parseJSON = $.parseJSON || function(str) {
				return window['eval']('(' + str + ')');			// eslint-disable-line dot-notation
			};

			httpData = function(xhr$, type, settngs) { // mostly lifted from jq1.4.4

				const ct = xhr$.getResponseHeader('content-type') || '',
					xml = (type === 'xml' || !type) && ct.indexOf('xml') >= 0;
				let dta = xml ? xhr$.responseXML : xhr$.responseText;

				if (xml && dta.documentElement.nodeName === 'parsererror') {
					if ($.error) {
						$.error('parsererror');
					}
				}
				if (settngs && settngs.dataFilter) {
					dta = settngs.dataFilter(dta, type);
				}
				if (typeof dta === 'string') {
					if ((type === 'json' || !type) && ct.indexOf('json') >= 0) {
						dta = parseJSON(dta);
					} else if ((type === 'script' || !type) && ct.indexOf('javascript') >= 0) {
						$.globalEval(dta);
					}
				}

				return dta;
			};

			return deferred;
		}
	};
	/* eslint-enable complexity, max-statements */

	/**
	 * ajaxForm() provides a mechanism for fully automating form submission.
	 *
	 * The advantages of using this method instead of ajaxSubmit() are:
	 *
	 * 1: This method will include coordinates for <input type="image"> elements (if the element
	 *	is used to submit the form).
	 * 2. This method will include the submit element's name/value data (for the element that was
	 *	used to submit the form).
	 * 3. This method binds the submit() method to the form for you.
	 *
	 * The options argument for ajaxForm works exactly as it does for ajaxSubmit. ajaxForm merely
	 * passes the options argument along after properly binding events for submit elements and
	 * the form itself.
	 */
	$.fn.ajaxForm = function(options, data, dataType, onSuccess) {
		if (typeof options === 'string' || (options === false && arguments.length > 0)) {
			options = {
				data     : data,
				dataType : dataType,
				url      : options
			};

			if (typeof onSuccess === 'function') {
				options.success = onSuccess;
			}
		}

		options = options || {};
		options.delegation = options.delegation && $.isFunction($.fn.on);

		// in jQuery 1.3+ we can fix mistakes with the ready state
		if (!options.delegation && this.length === 0) {
			const ctxt = this.context, sel = this.selector;

			if (!$.isReady && sel) {
				log('DOM not ready, queuing ajaxForm');
				$(function() {
					$(sel, ctxt).ajaxForm(options);
				});

				return this;
			}

			// is your DOM ready?  http://docs.jquery.com/Tutorials:Introducing_$(document).ready()
			log('terminating; zero elements found by selector' + ($.isReady ? '' : ' (DOM not ready)'));

			return this;
		}

		if (options.delegation) {
			$(document)
				.off('submit.form-plugin', this.selector, doAjaxSubmit)
				.off('click.form-plugin', this.selector, captureSubmittingElement)
				.on('submit.form-plugin', this.selector, options, doAjaxSubmit)
				.on('click.form-plugin', this.selector, options, captureSubmittingElement);

			return this;
		}

		if (options.beforeFormUnbind) {
			options.beforeFormUnbind(this, options);
		}

		return this.ajaxFormUnbind()
			.on('submit.form-plugin', options, doAjaxSubmit)
			.on('click.form-plugin', options, captureSubmittingElement);
	};

	// private event handlers
	function doAjaxSubmit(e) {
		const options = e.data;

		if (!e.isDefaultPrevented()) { // if event has been canceled, don't proceed
			e.preventDefault();
			$(e.target).closest('form').ajaxSubmit(options); // #365
		}
	}

	function captureSubmittingElement(e) {
		let target = e.target;
		const $el = $(target);

		if (!$el.is('[type=submit],[type=image]')) {
			// is this a child element of the submit el?  (ex: a span within a button)
			const submit = $el.closest('[type=submit]');

			if (submit.length === 0) {
				return;
			}
			target = submit[0];
		}

		const form = target.form;

		form.clk = target;

		if (target.type === 'image') {
			if (typeof e.offsetX !== 'undefined') {
				form.clk_x = e.offsetX;
				form.clk_y = e.offsetY;

			} else if (typeof $.fn.offset === 'function') {
				const offset = $el.offset();

				form.clk_x = e.pageX - offset.left;
				form.clk_y = e.pageY - offset.top;

			} else {
				form.clk_x = e.pageX - target.offsetLeft;
				form.clk_y = e.pageY - target.offsetTop;
			}
		}
		// clear form vars
		const timeout = 100;

		setTimeout(function() {
			form.clk = null;
			form.clk_x = null;
			form.clk_y = null;
		}, timeout);
	}


	// ajaxFormUnbind unbinds the event handlers that were bound by ajaxForm
	$.fn.ajaxFormUnbind = function() {
		return this.off('submit.form-plugin click.form-plugin');
	};

	/* eslint-disable complexity, max-statements */
	/**
	 * formToArray() gathers form element data into an array of objects that can
	 * be passed to any of the following ajax functions: $.get, $.post, or load.
	 * Each object in the array has both a 'name' and 'value' property. An example of
	 * an array for a simple login form might be:
	 *
	 * [ { name: 'username', value: 'jresig' }, { name: 'password', value: 'secret' } ]
	 *
	 * It is this array that is passed to pre-submit callback functions provided to the
	 * ajaxSubmit() and ajaxForm() methods.
	 */
	$.fn.formToArray = function(semantic, elements, filtering) {
		const arr = [];

		if (this.length === 0) {
			return arr;
		}

		const form = this[0];
		const formId = this.attr('id');
		let els = semantic || typeof form.elements === 'undefined' ? form.getElementsByTagName('*') : form.elements;
		let els2;

		if (els) {
			els = $.makeArray(els); // convert to standard array
		}

		// #386; account for inputs outside the form which use the 'form' attribute
		// FinesseRus: in non-IE browsers outside fields are already included in form.elements.
		if (formId && (semantic || /(Edge|Trident)\//.test(navigator.userAgent))) {
			els2 = $(':input[form="' + formId + '"]').get(); // hat tip @thet
			if (els2.length) {
				els = (els || []).concat(els2);
			}
		}

		if (!els || !els.length) {
			return arr;
		}

		if ($.isFunction(filtering)) {
			els = $.map(els, filtering);
		}

		let el, i, j, jmax, max, name;

		for (i = 0, max = els.length; i < max; i++) {
			el = els[i];
			name = el.name;
			if (!name || el.disabled) {
				// eslint-disable-next-line no-continue
				continue;
			}

			if (semantic && form.clk && el.type === 'image') {
				// handle image inputs on the fly when semantic == true
				if (form.clk === el) {
					arr.push({name: name, type: el.type, value: $(el).val()});
					arr.push({name: name + '.x', value: form.clk_x}, {name: name + '.y', value: form.clk_y});
				}
				// eslint-disable-next-line no-continue
				continue;
			}

			const val = $.fieldValue(el, true);

			if (val && val.constructor === Array) {
				if (elements) {
					elements.push(el);
				}
				for (j = 0, jmax = val.length; j < jmax; j++) {
					arr.push({name: name, value: val[j]});
				}

			} else if (feature.fileapi && el.type === 'file') {
				if (elements) {
					elements.push(el);
				}

				const files = el.files;

				if (files.length) {
					for (j = 0; j < files.length; j++) {
						arr.push({name: name, type: el.type, value: files[j]});
					}
				} else {
					// #180
					arr.push({name: name, type: el.type, value: ''});
				}

			} else if (val !== null && typeof v !== 'undefined') {
				if (elements) {
					elements.push(el);
				}
				arr.push({name: name, required: el.required, type: el.type, value: val});
			}
		}

		if (!semantic && form.clk) {
			// input type=='image' are not found in elements array! handle it here
			const $input = $(form.clk), input = $input[0];

			name = input.name;

			if (name && !input.disabled && input.type === 'image') {
				arr.push({name: name, value: $input.val()});
				arr.push({name: name + '.x', value: form.clk_x}, {name: name + '.y', value: form.clk_y});
			}
		}

		return arr;
	};
	/* eslint-enable complexity, max-statements */

	/**
	 * Serializes form data into a 'submittable' string. This method will return a string
	 * in the format: name1=value1&amp;name2=value2
	 */
	$.fn.formSerialize = function(semantic) {
		// hand off to jQuery.param for proper encoding
		return $.param(this.formToArray(semantic));
	};

	/**
	 * Serializes all field elements in the jQuery object into a query string.
	 * This method will return a string in the format: name1=value1&amp;name2=value2
	 */
	$.fn.fieldSerialize = function(successful) {
		const arr = [];

		this.each(function() {
			const {name} = this;

			if (!name) {
				return;
			}

			const val = $.fieldValue(this, successful);

			if (val && val.constructor === Array) {
				for (let i = 0, max = val.length; i < max; i++) {
					arr.push({name: name, value: val[i]});
				}

			} else if (val !== null && typeof val !== 'undefined') {
				arr.push({name: name, value: val});
			}
		});

		// hand off to jQuery.param for proper encoding
		return $.param(arr);
	};

	/**
	 * Returns the value(s) of the element in the matched set. For example, consider the following form:
	 *
	 *	<form><fieldset>
	 *		<input name="A" type="text">
	 *		<input name="A" type="text">
	 *		<input name="B" type="checkbox" value="B1">
	 *		<input name="B" type="checkbox" value="B2">
	 *		<input name="C" type="radio" value="C1">
	 *		<input name="C" type="radio" value="C2">
	 *	</fieldset></form>
	 *
	 *	var v = $('input[type=text]').fieldValue();
	 *	// if no values are entered into the text inputs
	 *	v === ['','']
	 *	// if values entered into the text inputs are 'foo' and 'bar'
	 *	v === ['foo','bar']
	 *
	 *	var v = $('input[type=checkbox]').fieldValue();
	 *	// if neither checkbox is checked
	 *	v === undefined
	 *	// if both checkboxes are checked
	 *	v === ['B1', 'B2']
	 *
	 *	var v = $('input[type=radio]').fieldValue();
	 *	// if neither radio is checked
	 *	v === undefined
	 *	// if first radio is checked
	 *	v === ['C1']
	 *
	 * The successful argument controls whether or not the field element must be 'successful'
	 * (per http://www.w3.org/TR/html4/interact/forms.html#successful-controls).
	 * The default value of the successful argument is true. If this value is false the value(s)
	 * for each element is returned.
	 *
	 * Note: This method *always* returns an array. If no valid value can be determined the
	 *	array will be empty, otherwise it will contain one or more values.
	 */
	$.fn.fieldValue = function(successful) {
		const val = [];

		for (let i = 0, max = this.length; i < max; i++) {
			const el = this[i];
			const value = $.fieldValue(el, successful);

			if (value === null || typeof value === 'undefined' || (value.constructor === Array && !value.length)) {
				// eslint-disable-next-line no-continue
				continue;
			}

			if (value.constructor === Array) {
				$.merge(val, value);
			} else {
				val.push(value);
			}
		}

		return val;
	};

	/* eslint-disable complexity, max-statements */
	/**
	 * Returns the value of the field element.
	 */
	$.fieldValue = function(el, successful) {
		const {name} = el, {type} = el, tag = el.tagName.toLowerCase();

		if (typeof successful === 'undefined') {
			successful = true;
		}

		if (successful && (
			!name || el.disabled || type === 'reset' || type === 'button' ||
			((type === 'checkbox' || type === 'radio') && !el.checked) ||
			((type === 'submit' || type === 'image') && el.form && el.form.clk !== el) ||
			(tag === 'select' && el.selectedIndex < 0)
		)) {
			return null;
		}

		if (tag === 'select') {
			const index = el.selectedIndex;

			if (index < 0) {
				return null;
			}

			const arr = [], ops = el.options;
			const one = type === 'select-one';
			const max = one ? index + 1 : ops.length;

			for (let i = one ? index : 0; i < max; i++) {
				const op = ops[i];

				if (op.selected && !op.disabled) {
					let val = op.value;

					if (!val) { // extra pain for IE...
						val = op.attributes && op.attributes.value && !op.attributes.value.specified ? op.text : op.value;
					}

					if (one) {
						return val;
					}

					arr.push(val);
				}
			}

			return arr;
		}

		return $(el).val().replace(rCRLF, '\r\n');
	};
	/* eslint-enable complexity, max-statements */

	/**
	 * Clears the form data. Takes the following actions on the form's input fields:
	 *  - input text fields will have their 'value' property set to the empty string
	 *  - select elements will have their 'selectedIndex' property set to -1
	 *  - checkbox and radio inputs will have their 'checked' property set to false
	 *  - inputs of type submit, button, reset, and hidden will *not* be effected
	 *  - button elements will *not* be effected
	 */
	$.fn.clearForm = function(includeHidden) {
		return this.each(function() {
			$('input,select,textarea', this).clearFields(includeHidden);
		});
	};

	/* eslint-disable no-multi-assign */
	/**
	 * Clears the selected form elements.
	 */
	$.fn.clearFields = $.fn.clearInputs = function(includeHidden) {
		/* eslint-enable no-multi-assign */
		const re = /^(?:color|date|datetime|email|month|number|password|range|search|tel|text|time|url|week)$/i; // 'hidden' is not in this list

		return this.each(function() {
			const {type} = this, tag = this.tagName.toLowerCase();

			if (re.test(type) || tag === 'textarea') {
				this.value = '';

			} else if (type === 'checkbox' || type === 'radio') {
				this.checked = false;

			} else if (tag === 'select') {
				this.selectedIndex = -1;

			} else if (type === 'file') {
				if (/MSIE/.test(navigator.userAgent)) {
					$(this).replaceWith($(this).clone(true));
				} else {
					$(this).val('');
				}

			} else if (includeHidden) {
				// includeHidden can be the value true, or it can be a selector string
				// indicating a special test; for example:
				// $('#myForm').clearForm('.special:hidden')
				// the above would clean hidden inputs that have the class of 'special'
				if ((includeHidden === true && /hidden/.test(type)) ||
					(typeof includeHidden === 'string' && $(this).is(includeHidden))) {
					this.value = '';
				}
			}
		});
	};


	/**
	 * Resets the form data or individual elements. Takes the following actions
	 * on the selected tags:
	 * - all fields within form elements will be reset to their original value
	 * - input / textarea / select fields will be reset to their original value
	 * - option / optgroup fields (for multi-selects) will defaulted individually
	 * - non-multiple options will find the right select to default
	 * - label elements will be searched against its 'for' attribute
	 * - all others will be searched for appropriate children to default
	 */
	$.fn.resetForm = function() {
		return this.each(function() {
			const el = $(this);
			const tag = this.tagName.toLowerCase();

			switch (tag) {
			case 'input':
				this.checked = this.defaultChecked;
				// fall through

			case 'textarea':
				this.value = this.defaultValue;

				return true;

			case 'option':
			case 'optgroup': {
				const select = el.parents('select');

				if (select.length && select[0].multiple) {
					if (tag === 'option') {
						this.selected = this.defaultSelected;
					} else {
						el.find('option').resetForm();
					}
				} else {
					select.resetForm();
				}

				return true;
			}
			case 'select':
				el.find('option').each(function(i) {				// eslint-disable-line consistent-return
					this.selected = this.defaultSelected;
					if (this.defaultSelected && !el[0].multiple) {
						el[0].selectedIndex = i;

						return false;
					}
				});

				return true;

			case 'label': {
				const forEl = $(el.attr('for'));
				const list = el.find('input,select,textarea');

				if (forEl[0]) {
					list.unshift(forEl[0]);
				}

				list.resetForm();

				return true;
			}
			case 'form':
				// guard against an input with the name of 'reset'
				// note that IE reports the reset function as an 'object'
				if (typeof this.reset === 'function' || (typeof this.reset === 'object' && !this.reset.nodeType)) {
					this.reset();
				}

				return true;

			default:
				el.find('form,input,label,select,textarea').resetForm();

				return true;
			}
		});
	};

	/**
	 * Enables or disables any matching elements.
	 */
	$.fn.enable = function(elem) {
		if (typeof elem === 'undefined') {
			elem = true;
		}

		return this.each(function() {
			this.disabled = !elem;
		});
	};

	/**
	 * Checks/unchecks any matching checkboxes or radio buttons and
	 * selects/deselects and matching option elements.
	 */
	$.fn.selected = function(select) {
		if (typeof select === 'undefined') {
			select = true;
		}

		return this.each(function() {
			const {type} = this;

			if (type === 'checkbox' || type === 'radio') {
				this.checked = select;

			} else if (this.tagName.toLowerCase() === 'option') {
				const $sel = $(this).parent('select');

				if (select && $sel[0] && $sel[0].type === 'select-one') {
					// deselect all other options
					$sel.find('option').selected(false);
				}

				this.selected = select;
			}
		});
	};

	// expose debug var
	$.fn.ajaxSubmit.debug = false;

	// helper fn for console logging
	function log() {
		if (!$.fn.ajaxSubmit.debug) {
			return;
		}

		const msg = '[jquery.form] ' + Array.prototype.join.call(arguments, '');

		if (window.console && window.console.log) {
			window.console.log(msg);

		} else if (window.opera && window.opera.postError) {
			window.opera.postError(msg);
		}
	}
}));
