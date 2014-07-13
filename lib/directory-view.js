var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	_ = require('underscore'),
	File = require('./file'),
	FileView = require('./file-view'),
	Directory = require('./directory'),
	View = require('atom').View;

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
				})
			}.bind(this));
			this.ol({
				'class': 'entries list-tree',
				'outlet': 'entries'
			});
		}.bind(this));
	};

	DirectoryView.prototype.initialize = function (ftp, directory) {
		this.ftp = ftp;
		this.directory = directory;

		this.name.addClass('icon-file-directory');
		this.name.text(directory.name);
		this.attr('data-path', this.directory.path);

		if (this.directory.isRoot || this.directory.isExpanded)
			this.expand();
	}

	DirectoryView.prototype.createEntry = function (isdir, name) {
		var view = isdir ?
			new DirectoryView(this.ftp, this.directory.createDirectory(name)) :
			new FileView(this.ftp, this.directory.createFile(name));

		this.entries.append(view);
	}

	DirectoryView.prototype.refresh = function () {
		var self = this,
			path = self.directory.path.replace(/\\/g, '/').replace(/^\/+$/, '');

		self.directory.empty();
		self.entries.html('');

		self.ftp.list(path, function (error, list) {
			if (error)
				return;

			self.directory.status = 1;
			_.forEach(list, function (item) {
				if (item.name == '.' || item.name == '..')
					return;

				self.createEntry(
					item.type == 'd' || item.type == 'l',
					item);
			});
		})
	}

	DirectoryView.prototype.delete = function () {

	}

	DirectoryView.prototype.toggle = function () {
		if (this.directory.isExpanded)
			this.collapse();
		else
			this.expand();
	}

	DirectoryView.prototype.expand = function (recursive) {
		if (!this.directory.isExpanded) {
			this.addClass('expanded').removeClass('collapsed');
			this.directory.isExpanded = true;

			if (this.directory.status == 0)
				this.refresh();
		}

		if (recursive) {
			this.entries.children().each(function () {
				var view = $(this).view();
				if (view instanceof DirectoryView)
					view.expand(true);
			})
		}
	}

	DirectoryView.prototype.collapse = function (recursive) {
		if (recursive) {
			this.entries.children().each(function () {
				var view = $(this).view();
				if (view instanceof DirectoryView && view.directory.isExpanded)
					view.expand(true);
			})
		}

		this.removeClass('expanded').addClass('collapsed');
		this.directory.isExpanded = false;
	}

	DirectoryView.prototype.getPath = function () {
		return this.directory.path;
	}

	DirectoryView.prototype.getParent = function () {
		var parent = this.parents('.entry:first').view();

		return parent || null;
	}

	return DirectoryView;

})(View);
