var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	path = require('path'),
	Model = window.top.require('theorist').Model,
	File = require('./file');


module.exports = Directory = (function (parent) {

	__extends(Directory, parent);

	Directory.properties({
		parent: null,
		name: '',
		isRoot: false,
		isExpanded: false,
		status: 0, // 0 = not discovered, 1 = discovered
		entries: {},
		expandedEntries: {}
	});

	Directory.prototype.accessor('path', function() {
		if (this.parent)
			return path.normalize(this.parent.path + '/' + this.name).replace(/\\/g, '/');
		return this.name;
	});

	function Directory () {
		Directory.__super__.constructor.apply(this, arguments);

	}

	Directory.prototype.createDirectory = function (dir) {
		dir.parent = this;
		dir.isExpanded = false;

		var entry = new Directory(dir);
		this.entries[dir.name] = entry;
		this.expandedEntries[dir.name] = entry;

		return entry;
	}

	Directory.prototype.createFile = function (file) {
		file.parent = this;
		var entry = new File(file)
		this.entries[file.name] = entry;

		return entry;
	}

	Directory.prototype.empty = function () {
		this.entries = {};
		this.expandedEntries = {};
	}

	return Directory;

})(Model)
