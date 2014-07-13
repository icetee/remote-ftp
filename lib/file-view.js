var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	fs = require('fs'),
	path = require('path'),
	mkdirp = require('mkdirp'),
	File = require('./file'),
	View = require('atom').View;

fs.mkdirr = function (dir, mode, callback) {
	fs.mkdir(dir, mode, function (error) {
		if (error && error.errno === 34) {

		}
		callback && callback(error);
	});
}

module.exports = FileView = (function (parent) {

	__extends(FileView, parent);

	function FileView () {

		FileView.__super__.constructor.apply(this, arguments);
	}

	FileView.content = function () {
		return this.li({
			'class': 'file entry list-item'
		}, function () {
			return this.span({
				'class': 'name icon',
				'outlet': 'name'
			});
		}.bind(this));
	};

	FileView.prototype.initialize = function (ftp, file) {
		this.ftp = ftp;
		this.file = file;

		this.name.text(this.file.name)
		this.attr('data-path', this.file.path);
	}

	FileView.prototype.open = function (local) {
		var self = this,
			remote = self.getPath();

		mkdirp(path.dirname(local), function (error) {
			if (error)
				return;

			self.ftp.get(remote, function (error, stream) {
				if (error)
					return;

				var dest = fs.createWriteStream(local);
				dest.on('unpipe', function () {
					atom.workspace.open(local);
				})
				stream.pipe(dest);
			});
		});
	}

	FileView.prototype.delete = function (remote) {
		var self = this;

		self.ftp.delete(remote, function (error) {
			if (error)
				return;

			self.remove();
			// TODO Remove local copy ?
		})
	}

	FileView.prototype.getPath = function () {
		return this.file.path;
	}

	FileView.prototype.getParent = function () {
		var parent = this.parents('.entry:first').view();

		return parent || null;
	}

	return FileView;

})(View);
