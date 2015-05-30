var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	path = require('path'),
	$ = require('atom-space-pen-views').$,
	View = require('atom-space-pen-views').View,
	TextEditorView = require('atom-space-pen-views').TextEditorView;

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
			this.subview('miniEditor', new TextEditorView({
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
			this.text.addClass(this.iconClass);

		atom.commands.add(this.element, {
			'core:confirm': function () {
				self.onConfirm(self.miniEditor.getText());
			},
			'core:cancel': function () {
				self.cancel();
			}
		})

		this.miniEditor.on('blur', function () {
			this.close();
		}.bind(this));

		this.miniEditor.getModel().onDidChange(function () {
			this.showError();
		}.bind(this));
		if (this.initialPath)
		this.miniEditor.getModel().setText(this.initialPath);

		if (this.select) {
			var ext = path.extname(this.initialPath),
				name = path.basename(this.initialPath),
				selEnd;
			if (name === ext)
				selEnd = this.initialPath.length;
			else
				selEnd = this.initialPath.length - ext.length;
			var range = [[0, this.initialPath.length - name.length], [0, selEnd]];
			this.miniEditor.getModel().setSelectedBufferRange(range);
		}
	}

	Dialog.prototype.attach = function () {
		this.panel = atom.workspace.addModalPanel({item: this.element});
		this.miniEditor.focus();
		this.miniEditor.getModel().scrollToCursorPosition();
	}

	Dialog.prototype.close = function () {
		var destroyPanel = this.panel;

		this.panel = null;

		if (destroyPanel)
			destroyPanel.destroy();

		atom.workspace.getActivePane().activate();
	}

	Dialog.prototype.cancel = function () {
		this.close();
		$('.ftp-view').focus();
	}

	Dialog.prototype.showError = function (message) {
		this.error.text(message);
		if (message)
			this.flashError();
	}

	return Dialog;

})(View);
