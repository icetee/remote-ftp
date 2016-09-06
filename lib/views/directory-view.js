var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	$ = require('atom-space-pen-views').$,
	FileView = require('./file-view'),
	View = require('atom-space-pen-views').View;

module.exports = DirectoryView = (function (parent) {

	__extends(DirectoryView, parent);

	function DirectoryView () {
		DirectoryView.__super__.constructor.apply(this, arguments);
	}

	DirectoryView.content = function () {
		return this.li({
			'class': 'directory entry list-nested-item collapsed'
		}, function () {
			this.div({
				'class': 'header list-item',
				'outlet': 'header'
			}, function () {
				return this.span({
					'class': 'name icon',
					'outlet': 'name'
				});
			}.bind(this));
			this.ol({
				'class': 'entries list-tree',
				'outlet': 'entries'
			});
		}.bind(this));
	};

	DirectoryView.prototype.initialize = function (directory) {
		//DirectoryView.__super__.initialize.apply(this, arguments);

		var self = this;

		self.item = directory;
		self.name.text(self.item.name);
		self.name.attr('data-name', self.item.name);
		self.name.attr('data-path', self.item.remote);
		self.name.addClass(self.item.type && self.item.type == 'l' ? 'icon-file-symlink-directory' : 'icon-file-directory');

		if (self.item.isExpanded || self.item.isRoot)
			self.expand();

		if (self.item.isRoot)
			self.addClass('project-root');

		// Trigger repaint
		self.item.$folders.onValue(function () { self.repaint(); });
		self.item.$files.onValue(function () { self.repaint(); });
		self.item.$isExpanded.onValue(function () { self.setClasses(); });
		self.item.on('destroyed', function () { self.destroy(); });
		self.repaint();

		// Events
		self.on('mousedown', function (e) {
			e.stopPropagation();

			var view = $(this).view(),
				button = e.originalEvent ? e.originalEvent.button : 0;

			if (!view)
				return;

			if (button === 0 || button == 2) {
				if (!e.ctrlKey) {
					$('.remote-ftp-view .selected').removeClass('selected');
					$('.remote-ftp-view .entries.list-tree').removeClass('multi-select');
				} else {
					$('.remote-ftp-view .entries.list-tree').addClass('multi-select');
				}
				view.toggleClass('selected');

				if (view.item.status === 0)
					view.open();

				if (button === 0)
					view.toggle();
			}
		});
		self.on('dblclick', function (e) {
			e.stopPropagation();

			var view = $(this).view();
			if (!view)
				return;

			view.open();
		});
	};

	DirectoryView.prototype.destroy = function () {
		this.item = null;

		this.remove();
	};

	DirectoryView.prototype.repaint = function (recursive) {
		var self = this,
			views = self.entries.children().map(function () { return $(this).view(); }).get(),
			folders = [],
			files = [];

		self.entries.children().detach();

		if (self.item) self.item.folders.forEach(function (item) {
			for (var a = 0, b = views.length; a < b; ++a)
				if (views[a] && views[a] instanceof DirectoryView && views[a].item == item) {
					folders.push(views[a]);
					return;
				}
			folders.push(new DirectoryView(item));
		});
		if (self.item) self.item.files.forEach(function (item) {
			for (var a = 0, b = views.length; a < b; ++a)
				if (views[a] && views[a] instanceof FileView && views[a].item == item) {
					files.push(views[a]);
					return;
				}
			files.push(new FileView(item));
		});

		// TODO Destroy left over...

		views = folders.concat(files);

		views.sort(function (a, b) {
			if (a.constructor != b.constructor)
				return a instanceof DirectoryView ? -1 : 1;
			if (a.item.name == b.item.name)
				return 0;

			return a.item.name.toLowerCase().localeCompare(b.item.name.toLowerCase());
		});

		views.forEach(function (view) {
			self.entries.append(view);
		});
	};

	DirectoryView.prototype.setClasses = function () {
		if (this.item.isExpanded) {
			this.addClass('expanded').removeClass('collapsed');
		} else {
			this.addClass('collapsed').removeClass('expanded');
		}
	};

	DirectoryView.prototype.expand = function (recursive) {
		this.item.isExpanded = true;

		if (recursive) {
			this.entries.children().each(function () {
				var view = $(this).view();
				if (view && view instanceof DirectoryView)
					view.expand(true);
			});
		}
	};

	DirectoryView.prototype.collapse = function (recursive) {
		this.item.isExpanded = false;

		if (recursive) {
			this.entries.children().each(function () {
				var view = $(this).view();
				if (view && view instanceof DirectoryView)
					view.collapse(true);
			});
		}
	};

	DirectoryView.prototype.toggle = function (recursive) {
		if (this.item.isExpanded)
			this.collapse(recursive);
		else
			this.expand(recursive);
	};

	DirectoryView.prototype.open = function () {
		this.item.open();
	};

	DirectoryView.prototype.refresh = function () {
		this.item.open();
	};

	return DirectoryView;

})(View);
