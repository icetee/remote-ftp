var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	path = require('path'),
	Model = require('theorist').Model;

module.exports = File = (function (parent) {
	__extends(File, parent);

	File.properties({
		parent: null,
		name: '',
		client: null,
		status: 0,
		size: 0,
		date: null
	});

	File.prototype.accessor('local', function () {
		if (this.parent)
			return path.normalize(path.join(this.parent.local, this.name)).replace(/\\/g, '/');
		throw "File needs to be in a Directory";
	});

	File.prototype.accessor('remote', function () {
		if (this.parent)
			return path.normalize(path.join(this.parent.remote, this.name)).replace(/\\/g, '/');
		throw "File needs to be in a Directory";
	});

	File.prototype.accessor('root', function () {
		if (this.parent)
			return this.parent.root;
		return this;
	});

	function File () {
		File.__super__.constructor.apply(this, arguments);
	}

	File.prototype.open = function () {
		var self = this,
			client = self.root.client;

		client.download(self.remote, false, function (err) {
			if (err)
				return;
			atom.workspace.open(self.local);
		});
	}

	return File;

})(Model);
