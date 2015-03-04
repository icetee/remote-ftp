var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	$ = require('atom').$,
	Dialog = require('./dialog');

module.exports = NavigateTo = (function (parent) {

	__extends(NavigateTo, parent);

	function NavigateTo () {
		NavigateTo.__super__.constructor.call(this, {
			'prompt': "Enter the path to navigate to.",
			'initialPath': '/',
			'select': false,
			'iconClass': 'icon-file-directory'
		});
	}

	NavigateTo.prototype.onConfirm = function (path) {
		this.trigger('navigate-to', path);
	}

	return NavigateTo;

})(Dialog);
