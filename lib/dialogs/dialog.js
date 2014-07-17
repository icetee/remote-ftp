var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	path = require('path'),
	$ = require('atom').$,
	View = require('atom').View,
	EditorView = require('atom').EditorView;

module.exports = Dialog = (function (parent) {

	__extends(Dialog, parent);

	function Dialog () {

		Dialog.__super__.constructor.apply(this, arguments);

	}

	Dialog.content = function (opts) {
		opts = opts || {};
		return this.div({
			'class': 'tree-view-dialog overlay from-top'
		}, function () {
			this.label(opts.prompt, {
				'class': 'icon',
				'outlet': 'text'
			});
			this.subview('miniEditor', new EditorView({
				mini: true
			}));
			this.div({
				'class': 'error-message',
				'outlet': 'error'
			});
		}.bind(this));
	}

	Dialog.prototype.initialize = function (opts) {
		var self = this;

		opts = opts || {};
		this.prompt = opts.prompt || '';
		this.initialPath = opts.initialPath || '';
		this.select = opts.select || false;
		this.iconClass = opts.iconClass || '';

		if (this.iconClass)
			self.text.addClass(this.iconClass);
		self.on('core:confirm', function () {
			self.onConfirm(self.miniEditor.getText());
		});
		self.on('core:cancel', function () {
			self.cancel();
		});
		self.miniEditor.hiddenInput.on('focusout', function () {
			self.remove();
		});
		self.miniEditor.getEditor().getBuffer().on('changed', function () {
			self.showError();
		});
		if (this.initialPath)
			self.miniEditor.setText(this.initialPath);

		if (this.select) {
			var ext = path.extname(this.initialPath),
				name = path.basename(this.initialPath),
				selEnd;
			if (name === ext)
				selEnd = this.initialPath.length;
			else
				selEnd = this.initialPath.length - ext.length;
			var range = [[0, this.initialPath.length - name.length], [0, selEnd]];
			self.miniEditor.getEditor().setSelectedBufferRange(range);
		}
	}

	Dialog.prototype.attach = function () {
		atom.workspaceView.append(this);
		this.miniEditor.focus();
		this.miniEditor.scrollToCursorPosition();
	}

	Dialog.prototype.close = function () {
		this.remove();
		atom.workspaceView.focus();
	}

	Dialog.prototype.cancel = function () {
		this.remove();
		$('.ftp-view').focus();
	}

	Dialog.prototype.showError = function (message) {
		this.error.text(message);
		if (message)
			this.flashError();
	}

	return Dialog;

})(View);
