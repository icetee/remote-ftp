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
		client: null,
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

		return atom.project.getPaths()[0];
		//return atom.project.path;
		//return atom.project.resolve('/' + this.name);
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
		this.folders = [];

		this.files.forEach(function (file) {
			file.destroy();
		});
		this.files = [];

		if (!this.isRoot)
			Directory.__super__.destroy.apply(this, arguments);
	}

	Directory.prototype.sort = function () {

		this.folders.sort(function (a, b) {
			if (a.name == b.name)
				return 0;
			return a.name > b.name ? 1 : -1;
		});

		this.files.sort(function (a, b) {
			if (a.name == b.name)
				return 0;
			return a.name > b.name ? 1 : -1;
		});

	}

	Directory.prototype.exists = function (name, isdir) {
		if (isdir) {
			for (var a = 0, b = this.folders.length; a < b; ++a)
				if (this.folders[a].name == name)
					return a;
		} else {
			for (var a = 0, b = this.files.length; a < b; ++a)
				if (this.files[a].name == name)
					return a;
		}
		return null;
	}

	Directory.prototype.open = function (recursive) {
		var self = this,
			client = self.root.client;

		client.list(self.remote, false, function (err, list) {
			if (err)
				return;

			self.status = 1;

			var folders = [],
				files = [];

			list.forEach(function (item) {
				var index,
					name = path.basename(item.name),
					entry;
				if (item.type == 'd' || item.type == 'l') {
					if (name == '.' || name == '..')
						return;
					if ((index = self.exists(name, true)) === null) {
						entry = new Directory({
							parent: self,
							name: name
						});
					} else {
						entry = self.folders[index];
						self.folders.splice(index, 1);
					}
					folders.push(entry);
				} else {
					if ((index = self.exists(name, false)) === null) {
						entry = new File({
							parent: self,
							name: name
						});
					} else {
						entry = self.files[index];
						self.files.splice(index, 1);
					}
					entry.size = item.size;
					entry.date = item.date;
					files.push(entry);
				}
			});

			self.folders.forEach(function (folder) { folder.destroy(); });
			self.folders = folders;

			self.files.forEach(function (file) { file.destroy(); });
			self.files = files;

			if (recursive) {
				self.folders.forEach(function (folder) {
					if (folder.status == 0)
						return;

					folder.open(true);
				})
			}
		});
	}



	return Directory;
})(Model);
