var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	fs = require('fs'),
	path = require('path'),
	File = require('./file'),
	FileView = require('./file-view'),
	Directory = require('./directory'),
	DirectoryView = require('./directory-view'),
	AddDialog,
	MoveDialog,
	FTP = require('ftp'),
	Buffer = require('buffer').Buffer,
	EventEmitter = require('events').EventEmitter,
	$ = require('atom').$,
	View = require('atom').ScrollView;//window.top.require('ftp-view/lib/ftp-view')

module.exports = RemoteFtpView = (function (parent) {

	__extends(RemoteFtpView, parent);

	function RemoteFtpView () {
		RemoteFtpView.__super__.constructor.apply(this, arguments);

	}

	RemoteFtpView.content = function () {
		return this.div({
			'class': 'ftp-view-resizer tool-panel',
			'data-show-on-right-side': atom.config.get('ftp-view.showOnRightSide')
		}, function () {
			this.div({
				'class': 'ftp-view-scroller',
				'outlet': 'scroller'
			}, function () {
				return this.ol({
					'class': 'ftp-view full-menu list-tree has-collapsable-children focusable-panel',
					'tabindex': -1,
					'outlet': 'list'
				})
			}.bind(this));
			this.div({
				'class': 'ftp-view-resize-handle',
				'outlet': 'resizeHandle'
			});
			this.div({
				'class': 'ftp-view-offline',
				'outlet': 'offline'
			});
			this.div({
				'class': 'ftp-view-status status-bar tool-panel panel-bottom',
			}, function () {
				return this.div({
					'class': 'flexbox-repaint-hack',
					'outlet': 'status'
				})
			}.bind(this))
		}.bind(this));
	};

	RemoteFtpView.prototype.initialize = function (state) {
		RemoteFtpView.__super__.initialize.apply(this, arguments);

		var self = this;

		atom.workspace.eachEditor(function (editor) {
			var buffer = editor.buffer;

			// Try to upload file if connected
			buffer.on('saved', function (text) {
				var local = text.file.path.replace(/^[a-z]:\\/i, function (m, l) {
						return m.toUpperCase();
					});
				self.tryUpload(local);
			});
		})

		self.on('dblclick', '.ftp-view-resize-handle', function () { self.resizeToFitContent(); });
		self.on('mousedown', '.ftp-view-resize-handle', function (e) { self.resizeStarted(e); });
		self.on('mousedown', '.entry', function (e) {
			e.stopPropagation();

			if (e.shiftKey || e.ctrlKey || e.metaKey)
				return;

			var view = $(e.currentTarget).view(),
				button = e.originalEvent ? e.originalEvent.button : 0;

			if (!view)
				return;

			switch (button) {
				case 0:
					self.selectEntry(view);
					if (view instanceof DirectoryView)
						view.toggle();
					break;
				case 2:
					self.selectEntry(view);
					break;
			}
		});
		self.on('dblclick', '.entry', function (e) {
			e.stopPropagation();

			var view = $(e.currentTarget).view(),
				detail = e.originalEvent ? e.originalEvent.detail : 1;

			self.selectEntry(view);

			if (view instanceof FileView)
				self.openSelectedEntry();
			else if (view instanceof DirectoryView)
				view.toggle();
		});

		self.info = null;
		self.ftp = null;
		self.event = new EventEmitter();

		// Connected
		self.event.on('ftp-ready', function () {
			self.scroller.css('display', 'block');
			self.offline.css('display', 'none');
			self.list.empty();

			self.root = new DirectoryView(self.ftp, new Directory({
				name: self.info.remote,
				isExpanded: false,
				isRoot: true
			}));
			self.list.append(self.root);
		});

		// Disconnected
		self.event.on('ftp-close', function () {
			self.scroller.css('display', 'none');
			self.offline.css('display', 'flex');

			// TODO Destroy everything...
			/*if (self.root) {
				self.root.destroy();
			}*/
		});
		self.event.emit('ftp-close');

		self.offline.on('click', '[role="configure"]', function (e) {
			e.preventDefault();
			e.stopPropagation();

			atom.workspace.open(path.join(atom.project.path, '.ftpconfig'));
		});
		self.offline.on('click', '[role="close"]', function (e) {
			e.preventDefault();
			e.stopPropagation();

			self.toggle();
		});
		self.offline.on('click', '[role="connect"]', function (e) {
			e.preventDefault();
			e.stopPropagation();

			self.tryConnect();
		});

		self.offline.html('<p><a role="connect">Connect</a>, <br /><a role="configure">edit configuration</a> or <br /><a role="close">close panel<a></p>')
	}

	RemoteFtpView.prototype.setConnectionInfo = function (info) {
		this.info = info;
		this.tryConnect();
	}

	RemoteFtpView.prototype.tryConnect = function () {
		var self = this;

		if (self.ftp) {
			self.ftp.destroy();
			self.ftp = null;
		}

		var info = self.info;
		info.debug = function (str) {
			var log = str.match(/^\[connection\] (>|<) '(.*?)(\\r\\n)?'$/);
			if (log) {
				console.debug(log[1] + ' ' + log[2]);
				self.status.html(log[1] + ' ' + log[2]);
			}
		}

		self.ftp = new FTP();
		self.ftp.on('ready', function () {
			self.event.emit('ftp-ready');
		});
		self.ftp.on('close', function () {
			self.event.emit('ftp-close');
		});
		self.ftp.on('end', function () {
			self.event.emit('ftp-end');
		});
		self.ftp.on('error', function () {
			self.event.emit('ftp-error');
		});
		self.ftp.connect(info);
	}

	RemoteFtpView.prototype.tryUpload = function (local) {
		var self =  this,
			relative = atom.project.relativize(local);

		if (relative != local && self.ftp) {
			var remote = path.normalize(self.info.remote + '/' + relative.replace(/\\/g, '/')).replace(/\\/g, '/');

			self.ftp.put(local, remote);
		}
	}

	RemoteFtpView.prototype.selectEntry = function (view) {
		this.deselect();
		view.addClass('selected');
	}

	RemoteFtpView.prototype.deselect = function () {
		this.list.find('.selected').removeClass('selected');
	}

	RemoteFtpView.prototype.getSelectedEntry = function () {
		var selected = this.list.find('.selected').first();
		if (selected.length == 0)
			return null;
		var view = selected.view();
		if (!view)
			return null;

		return view;
	}

	RemoteFtpView.prototype.openSelectedEntry = function () {
		var view = this.getSelectedEntry();
		if (!view)
			return;

		if (view instanceof FileView) {
			var dest = path.normalize(atom.project.path + '/' + view.getPath().replace(this.info.remote, '')).replace(/\\/g, '/');
			view.open(dest);
		} else if (view instanceof DirectoryView)
			view.toggle();
	}

	RemoteFtpView.prototype.refreshSelectedEntry = function () {
		var view = this.getSelectedEntry();
		if (!view)
			return;

		if (view instanceof FileView)
			this.openSelectedEntry();
		else if (view instanceof DirectoryView)
			view.refresh();
	}

	RemoteFtpView.prototype.moveSelectedEntry = function () {
		var self = this,
			view = self.getSelectedEntry();

		if (!view)
			return;

		var remote = view.getPath(),
			parent = view.getParent();

		if (!MoveDialog)
			MoveDialog = require('./move-dialog');

		var dialog = new MoveDialog(remote);
		dialog.on('path-changed', function (e, newremote) {
			self.ftp.rename(remote, newremote, function (error) {
				if (error)
					return;
				dialog.close();
				parent.refresh();
			});
		});
		dialog.attach();
	}

	RemoteFtpView.prototype.deleteSelectedEntry = function () {
		var self = this,
			view = self.getSelectedEntry();
		if (!view)
			return;

		if (view === self.root) {
			atom.confirm({
				message: "The root directory can't be removed.",
				buttons: ['Ok']
			})
			return;
		}

		var parent = view.getParent(),
			remote = view.getPath(),
			isFile = view instanceof FileView;

		atom.confirm({
			message: "Are you sure you want to delete the selected item?",
			detailedMessage: "You are deleting:\n"+ remote,
			buttons: {
				"Move to Trash": function () {
					self.ftp[isFile ? 'delete' : 'rmdir'](remote, function (error) {
						if (error)
							return;
						if (parent && parent instanceof DirectoryView)
							parent.refresh();
					});
				},
				"Cancel": null
			}
		})
	}

	RemoteFtpView.prototype.promptAddEntry = function (isfolder) {
		var self = this,
			view = self.getSelectedEntry() || self.root,
			folder = view.getPath();

		if (view instanceof FileView)
			return;

		if (!AddDialog)
			AddDialog = require('./add-dialog');

		var dialog = new AddDialog('', !isfolder);
		dialog.on('directory-created', function (e, name) {
			var remote = path.normalize(folder + '/' + name).replace(/\\/g, '/');

			self.ftp.mkdir(remote, function (error) {
				if (error)
					return;
				dialog.close();
				view.refresh();
			});
		});
		dialog.on('file-created', function (e, name) {
			var empty = new Buffer('', 'utf8'),
				remote = path.normalize(folder + '/' + name).replace(/\\/g, '/');

			self.ftp.put(empty, remote, function (error) {
				if (error)
					return;
				dialog.close();
				view.refresh();
			});
		});
		dialog.attach();
	}

	RemoteFtpView.prototype.toggle = function () {
		if (this.hasParent())
			this.detach();
		else
			this.attach();
		return this;
	}

	RemoteFtpView.prototype.attach = function () {
		if (!atom.project.getPath())
			return false;
		if (atom.config.get('ftp-view.showOnRightSide')) {
			this.removeClass('panel-left');
			this.addClass('panel-right');
			atom.workspaceView.appendToRight(this);
		} else {
			this.removeClass('panel-right');
			this.addClass('panel-left');
			atom.workspaceView.appendToLeft(this);
		}

		this.focus();
		atom.workspaceView.find('.tree-view-resizer')
			.hide();
	}

	RemoteFtpView.prototype.detach = function () {
		RemoteFtpView.__super__.detach.apply(this, arguments);

		atom.workspaceView.find('.tree-view-resizer')
			.show()
			.view()
				.focus();

		return this.unfocus();
	}

	RemoteFtpView.prototype.focus = function () {
		this.list.focus();
	}

	RemoteFtpView.prototype.unfocus = function () {
		return atom.workspaceView.focus();
	}

	RemoteFtpView.prototype.hasFocus = function () {
		return this.list.is(':focus') || document.activeElement === this.list[0];
	}

	RemoteFtpView.prototype.resizeToFitContent = function () {
		this.width(1);
		this.width(this.list.outerWidth());
	}

	RemoteFtpView.prototype.resizeStarted = function (e) {
		this.resizeWidthStart = this.width();
		this.resizeMouseStart = e.pageX;
		$(document).on('mousemove', this.resizeView.bind(this));
		$(document).on('mouseup', this.resizeStopped);
	}

	RemoteFtpView.prototype.resizeStopped = function () {
		delete this.resizeWidthStart;
		delete this.resizeMouseStart;
		$(document).off('mousemove', this.resizeView);
		$(document).off('mouseup', this.resizeStopped);
	}

	RemoteFtpView.prototype.resizeView = function (e) {
		if (e.which !== 1)
			return this.resizeStopped();

		var delta = e.pageX - this.resizeMouseStart;

		return this.width(this.resizeWidthStart + delta);
	}

	return RemoteFtpView;

})(View);
