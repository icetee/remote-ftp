var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	$ = require('atom-space-pen-views').$,
	DirectoryView = require('./directory-view'),
	ScrollView = require('atom-space-pen-views').ScrollView;

function hideLocalTree () {
	if (atom.packages.loadedPackages['tree-view'] && atom.packages.loadedPackages['tree-view'].mainModule && atom.packages.loadedPackages['tree-view'].mainModule.treeView)
		atom.packages.loadedPackages['tree-view'].mainModule.treeView.detach();
}

function showLocalTree () {
	if (atom.packages.loadedPackages['tree-view'] && atom.packages.loadedPackages['tree-view'].mainModule && atom.packages.loadedPackages['tree-view'].mainModule.treeView)
		atom.packages.loadedPackages['tree-view'].mainModule.treeView.attach();
}

module.exports = TreeView = (function (parent) {
	__extends(TreeView, parent);

	function TreeView () {
		TreeView.__super__.constructor.apply(this, arguments);

	}

	TreeView.content = function () {
		return this.div({
			'class': 'remote-ftp-view ftptree-view-resizer tool-panel',
			'data-show-on-right-side': atom.config.get('tree-view.showOnRightSide')
		}, function () {
			this.div({
				'class': 'scroller',
				'outlet': 'scroller'
			}, function () {
				this.ol({
					'class': 'ftptree-view full-menu list-tree has-collapsable-children focusable-panel',
					'tabindex': -1,
					'outlet': 'list'
				});
			}.bind(this));
			this.div({
				'class': 'resize-handle',
				'outlet': 'horizontalResize'
			});
			this.div({
				'class': 'queue tool-panel panel-bottom',
				'tabindex': -1,
				'outlet': 'queue'
			}, function () {
				this.ul({
					'class': 'progress tool-panel panel-top',
					'tabindex': -1,
					'outlet': 'progress'
				});
				this.ul({
					'class': 'list',
					'tabindex': -1,
					'outlet': 'debug'
				});
				return this.div({
					'class': 'resize-handle',
					'outlet': 'verticalResize'
				});
			}.bind(this));
			this.div({
				'class': 'offline',
				'tabindex': -1,
				'outlet': 'offline'
			});
		}.bind(this));
	};

	var elapsedTime = function (ms) {
		var days = Math.floor(ms / 86400000);
		ms %= 86400000;
		var hours = Math.floor(ms / 3600000);
		ms %= 3600000;
		var mins = Math.floor(ms / 60000);
		ms %= 60000;
		var secs = Math.floor(ms / 1000);
		ms %= 1000;

		return ((days ? days + 'd ' : '') +
				(hours ? ((days) && hours < 10 ? '0' : '') + hours + 'h ' : '') +
				(mins ? ((days || hours) && mins < 10 ? '0' : '') + mins + 'm ' : '') +
				(secs ? ((days || hours || mins) && secs < 10 ? '0' : '') + secs + 's ' : '')).replace(/^[dhms]\s+/, '').replace(/[dhms]\s+[dhms]/g, '').replace(/^\s+/, '').replace(/\s+$/, '') || '0s';
	};

	TreeView.prototype.initialize = function (state) {
		TreeView.__super__.initialize.apply(this, arguments);

		var self = this;

		//self.addClass(atom.config.get('tree-view.showOnRightSide') ? 'panel-right' : 'panel-left');
		var html = '<ul>';
		html += '<li><a role="connect" class="btn btn-default icon">Connect</a><br /></li>';
		html += '<li><a role="configure" class="btn btn-default icon">Edit Configuration</a><br /></li>';
		html += '<li><a role="configure_ignored">Edit Ignore Configuration</a><br /></li>';
		html += '<li><a role="toggle" class="btn btn-default icon">Close Panel</a></li>';
		html += '</ul>';
		self.offline.html(html);
		if (atom.project.remoteftp.isConnected())
			self.showOnline();
		else
			self.showOffline();

		self.root = new DirectoryView(atom.project.remoteftp.root);
		self.root.expand();
		self.list.append(self.root);

		//self.attach();

		// Events
		atom.config.onDidChange('tree-view.showOnRightSide', function () {
			if (self.isVisible()) {
				setTimeout(function () {
					self.detach();
					self.attach();
				}, 1);
			}
		});
		atom.config.onDidChange('Remote-FTP.hideLocalWhenDisplayed', function (values) {
			if (values.newValue) {
				if (self.isVisible()) {
					hideLocalTree();
				}
			} else {
				if (self.isVisible()) {
					self.detach();
					showLocalTree();
					self.attach();
				} else {
					showLocalTree();
				}
			}
		});

		atom.project.remoteftp.on('debug', function (msg) {
			self.debug.prepend('<li>'+msg+'</li>');
			var children = self.debug.children();
			if (children.length > 20)
				children.last().remove();
		});
		atom.project.remoteftp.on('queue-changed', function () {
			self.progress.empty();

			var queue = [];
			if (atom.project.remoteftp._current)
				queue.push(atom.project.remoteftp._current);
			for (var i = 0, l = atom.project.remoteftp._queue.length; i < l; ++i)
				queue.push(atom.project.remoteftp._queue[i]);

			if (queue.length === 0)
				self.progress.hide();
			else {
				self.progress.show();

				queue.forEach(function (queue) {
					var $li = $('<li><progress class="inline-block" /><div class="name">'+ queue[0] +'</div><div class="eta">-</div></li>'),
						$progress = $li.children('progress'),
						$eta = $li.children('.eta'),
						progress = queue[2];
					self.progress.append($li);

					progress.on('progress', function (percent) {
						if (percent == -1) {
							$progress.removeAttr('max').removeAttr('value');
							$eta.text('-');
						} else {
							$progress.attr('max', 100).attr('value', parseInt(percent * 100, 10));
							var eta = progress.getEta();
							$eta.text(elapsedTime(eta));
						}
					});
					progress.once('done', function () {
						progress.removeAllListeners('progress');
					});
				});
			}
		});

		self.offline.on('click', '[role="connect"]', function (e) {
			atom.project.remoteftp.readConfig(function () {
				atom.project.remoteftp.connect();
			});
		});
		self.offline.on('click', '[role="configure"]', function (e) {
			atom.workspace.open(atom.project.getDirectories()[0].resolve('.ftpconfig'));
		});
		self.offline.on('click', '[role="configure_ignored"]', function (e) {
			atom.workspace.open(atom.project.getDirectories()[0].resolve('.ftpignore'));
		});
		self.offline.on('click', '[role="toggle"]', function (e) {
			self.toggle();
		});
		self.horizontalResize.on('dblclick', function (e) { self.resizeToFitContent(e); });
		self.horizontalResize.on('mousedown', function (e) { self.resizeHorizontalStarted(e); });
		self.verticalResize.on('mousedown', function (e) { self.resizeVerticalStarted(e); });
		self.list.on('keydown', function (e) { self.remoteKeyboardNavigation(e); });

		atom.project.remoteftp.on('connected', function () {
			self.showOnline();
		});
		//atom.project.remoteftp.on('closed', function () {
		atom.project.remoteftp.on('disconnected', function () {
			self.showOffline();
		});
	};

	TreeView.prototype.attach = function () {
		if (atom.config.get('tree-view.showOnRightSide')) {
			this.panel = atom.workspace.addRightPanel({item: this});
		} else {
			this.panel = atom.workspace.addLeftPanel({item: this});
		}

		if (atom.config.get('Remote-FTP.hideLocalWhenDisplayed'))
			hideLocalTree();
		else
			showLocalTree();
	};

	TreeView.prototype.detach = function () {
		TreeView.__super__.detach.apply(this, arguments);

		if (this.panel) {
			this.panel.destroy();
			this.panel = null;
		}

		showLocalTree();
	};

	TreeView.prototype.toggle = function () {
		if (this.isVisible()) {
			this.detach();
		} else {
			this.attach();
		}
	};

	TreeView.prototype.showOffline = function () {
		this.list.hide();
		this.queue.hide();
		this.offline.css('display', 'flex');
	};

	TreeView.prototype.showOnline = function () {
		this.list.show();
		this.queue.show();
		this.offline.hide();
	};

	TreeView.prototype.resolve = function (path) {
		var view = $('.remote-ftp-view [data-path="'+ path +'"]').map(function () {
				var v = $(this).view();
				return v ? v : null;
			}).get(0);

		return view;
	};

	TreeView.prototype.getSelected = function () {
		var views = $('.remote-ftp-view .selected').map(function () {
				var v = $(this).view();
				return v ? v : null;
			}).get();

		return views;
	};

	TreeView.prototype.resizeVerticalStarted = function (e) {
		e.preventDefault();

		this.resizeHeightStart = this.queue.height();
		this.resizeMouseStart = e.pageY;
		$(document).on('mousemove', this.resizeVerticalView.bind(this));
		$(document).on('mouseup', this.resizeVerticalStopped);
	};

	TreeView.prototype.resizeVerticalStopped = function () {
		delete this.resizeHeightStart;
		delete this.resizeMouseStart;
		$(document).off('mousemove', this.resizeVerticalView);
		$(document).off('mouseup', this.resizeVerticalStopped);
	};

	TreeView.prototype.resizeVerticalView = function (e) {
		if (e.which !== 1)
			return this.resizeVerticalStopped();

		var delta = e.pageY - this.resizeMouseStart,
			height = Math.max(26, this.resizeHeightStart - delta);

		this.queue.height(height);
		this.scroller.css('bottom', height + 'px');
	};

	TreeView.prototype.resizeHorizontalStarted = function (e) {
		e.preventDefault();

		this.resizeWidthStart = this.width();
		this.resizeMouseStart = e.pageX;
		$(document).on('mousemove', this.resizeHorizontalView.bind(this));
		$(document).on('mouseup', this.resizeHorizontalStopped);
	};

	TreeView.prototype.resizeHorizontalStopped = function () {
		delete this.resizeWidthStart;
		delete this.resizeMouseStart;
		$(document).off('mousemove', this.resizeHorizontalView);
		$(document).off('mouseup', this.resizeHorizontalStopped);
	};

	TreeView.prototype.resizeHorizontalView = function (e) {
		if (e.which !== 1)
			return this.resizeHorizontalStopped();

		var delta = e.pageX - this.resizeMouseStart,
			width = Math.max(50, this.resizeWidthStart + delta);

		this.width(width);
	};

	TreeView.prototype.resizeToFitContent = function (e) {
		e.preventDefault();

		this.width(1);
		this.width(this.list.outerWidth());
	};

	TreeView.prototype.remoteKeyboardNavigation = function (e) {
		var arrows = {left: 37, up: 38, right: 39, down: 40 },
			keyCode = e.keyCode || e.which;

		switch (keyCode) {
			case arrows.up:
				this.remoteKeyboardNavigationUp();
				break;
			case arrows.down:
				this.remoteKeyboardNavigationDown();
				break;
			case arrows.left:
				this.remoteKeyboardNavigationLeft();
				break;
			case arrows.right:
				this.remoteKeyboardNavigationRight();
				break;
			default:
				return;
		}

		e.preventDefault();
		e.stopPropagation();
		this.remoteKeyboardNavigationMovePage();
	};

	TreeView.prototype.remoteKeyboardNavigationUp = function () {
		var current = this.list.find('.selected'),
			next = current.prev('.entry:visible');
		if (next.length) {
			while (next.is('.expanded') && next.find('.entries .entry:visible').length) {
				next = next.find('.entries .entry:visible');
			}
		} else {
			next = current.closest('.entries').closest('.entry:visible');
		}
		if (next.length) {
			current.removeClass('selected');
			next.last().addClass('selected');
		}
	};

	TreeView.prototype.remoteKeyboardNavigationDown = function () {
		var current = this.list.find('.selected'),
			next = current.find('.entries .entry:visible');
		if (!next.length) {
			tmp = current;
			do {
				next = tmp.next('.entry:visible');
				if (!next.length) {
					tmp = tmp.closest('.entries').closest('.entry:visible');
				}
			} while (!next.length && !tmp.is('.project-root'));
		}
		if (next.length) {
			current.removeClass('selected');
			next.first().addClass('selected');
		}
	};

	TreeView.prototype.remoteKeyboardNavigationLeft = function () {
		var current = this.list.find('.selected');
		if (!current.is('.directory')) {
			next = current.closest('.directory');
			next.view().collapse();
			current.removeClass('selected');
			next.first().addClass('selected');
		} else {
			current.view().collapse();
		}
	};

	TreeView.prototype.remoteKeyboardNavigationRight = function () {
		var current = this.list.find('.selected');
		if (current.is('.directory')) {
			var view = current.view();
			view.open();
			view.expand();
		}
	};

	TreeView.prototype.remoteKeyboardNavigationMovePage = function () {
		var current = this.list.find('.selected');
		if (current.length) {
			var scrollerTop = this.scroller.scrollTop(),
				selectedTop = current.position().top;
			if (selectedTop < scrollerTop - 10) {
				this.scroller.pageUp();
			} else if (selectedTop > scrollerTop + this.scroller.height() - 10) {
				this.scroller.pageDown();
			}
		}
	};

	return TreeView;

})(ScrollView);
