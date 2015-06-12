var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	$ = require('atom-space-pen-views').$,
	Dialog = require('./dialog');

module.exports = PromptPassDialog = (function (parent) {

	__extends(PromptPassDialog, parent);

	function PromptPassDialog () {
		PromptPassDialog.__super__.constructor.call(this, {
			'prompt': "Enter password only for this session:",
			'select': false
		});
	}

	PromptPassDialog.prototype.onConfirm = function ( pass ) {
		this.trigger('dialog-done', [pass]);
	}

	return PromptPassDialog;

})(Dialog);
