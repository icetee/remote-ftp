var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	path = require('path'),
	File = require('./file'),
	Model = require('theorist').Model;

module.exports = Directory = (function (parent) {
	__extends(Directory, parent);

	Directory.properties({
		parent: null,
		name: '',
		path: '',
		ftp: null,
		isExpanded: false,
		status: 0,
		folders: [],
		files: []
	});

	Directory.prototype.accessor('isRoot', function () {
		return this.parent == null;
	})

	Directory.prototype.accessor('local', function () {
		if (this.parent)
			return path.normalize(path.join(this.parent.local, this.name)).replace(/\\/g, '/');
		return '/' + this.name;
	});

	Directory.prototype.accessor('remote', function () {
		if (this.parent)
			return path.normalize(path.join(this.parent.remote, this.name)).replace(/\\/g, '/');
		return this.path;
	});

	Directory.prototype.accessor('root', function () {
		if (this.parent)
			return this.parent.root;
		return this;
	});

	function Directory () {
		Directory.__super__.constructor.apply(this, arguments);
	}

	Directory.prototype.destroy = function () {

		this.folders.forEach(function (folder) {
			folder.destroy();
		});

		this.files.forEach(function (file) {
			file.destroy();
		});

		Directory.__super__.destroy.apply(this, arguments);
	}

	Directory.prototype.sort = function () {

		this.folders.sort(function (a, b) {
			if (a.name == b.name)
				return 0;
			return a.name > b.name ? 1 : 0;
		});

		this.files.sort(function (a, b) {
			if (a.name == b.name)
				return 0;
			return a.name > b.name ? 1 : 0;
		});

	}

	Directory.prototype.exists = function (name, isdir) {
		if (isdir) {
			for (var a = 0, b = this.folders.length; a < b; ++a)
				if (this.folders[a].name == name)
					return this.folders[a];
		} else {
			for (var a = 0, b = this.files.length; a < b; ++a)
				if (this.files[a].name == name)
					return this.files[a];
		}
		return null;
	}

	Directory.prototype.open = function () {
		var self = this,
			ftp = self.root.ftp;

		ftp.list(self.remote, false, function (err, list) {
			if (err)
				return;

			list.forEach(function (item) {
				if (item.type == 'd' || item.type == 'l') {
					if (item.name == '.' || item.name == '..')
						return;
					if ((entry = self.exists(item.name, true)) == null) {
						entry = new Directory({
							parent: self,
							name: item.name
						});
						self.folders.push(entry);
					}
				} else {
					if ((entry = self.exists(item.name, false)) == null) {
						entry = new File({
							parent: self,
							name: item.name,
						});
						self.files.push(entry);
					}

					entry.size = item.size;
					entry.date = item.date;
				}
			});

			self.sort();
		})
	}

	Directory.prototype.download = function (recursive) {
		var self = this,
			ftp = self.root.ftp;

		ftp.download(self.remote, recursive == true, function () {
			console.log('Downloaded !');
		})
	}

	return Directory;
})(Model);
