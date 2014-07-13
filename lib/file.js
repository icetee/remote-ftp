var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	path = require('path'),
	Model = window.top.require('theorist').Model;


module.exports = File = (function (parent) {

	__extends(File, parent);

	File.properties({
		parent: null,
		name: null,
		status: null
	});

	File.prototype.accessor('path', function() {
		if (this.parent)
			return path.normalize(this.parent.path + '/' + this.name).replace(/\\/g, '/');
		return this.name;
	});

	function File () {
		Directory.__super__.constructor.apply(this, arguments);

	}

	return File;

})(Model)
