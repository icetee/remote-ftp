var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	$ = require('atom-space-pen-views').$,
	getIconHandler = require('../helpers.js').getIconHandler,
	View = require('atom-space-pen-views').View;

module.exports = FileView = (function (parent) {

	__extends(FileView, parent);

	function FileView (file) {
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

	FileView.prototype.initialize = function (file) {
		//FileView.__super__.initialize.apply(this, arguments);

		var self = this;

		self.item = file;
		self.name.text(self.item.name);
		self.name.attr('data-name', self.item.name);
		self.name.attr('data-path', self.item.remote);

		var addIconToElement = getIconHandler();
		if(addIconToElement)
			this.iconDisposable = addIconToElement(self.item, self.item.remote);
		else
			switch (self.item.type) {
				case 'binary':		self.name.addClass('icon-file-binary'); break;
				case 'compressed':	self.name.addClass('icon-file-zip'); break;
				case 'image':		self.name.addClass('icon-file-media'); break;
				case 'pdf':			self.name.addClass('icon-file-pdf'); break;
				case 'readme':		self.name.addClass('icon-book'); break;
				case 'text':		self.name.addClass('icon-file-text'); break;
			}

		// Events
		self.on('mousedown', function (e) {
			e.stopPropagation();

			var view = $(this).view();
			var button = e.originalEvent ? e.originalEvent.button : 0;
			var selectKey = process.platform === "darwin" ? "metaKey" : "ctrlKey"; // on mac the select key for multiple files is the meta key
			var $selected = $('.remote-ftp-view .selected');

			if (!view) return;

			if ( (button === 0 || button === 2) && !(button === 2 && $selected.length > 1) ) {
				if ( !e[selectKey]) {
					$selected.removeClass('selected');
					$('.remote-ftp-view .entries.list-tree').removeClass('multi-select');
				} else {
					$('.remote-ftp-view .entries.list-tree').addClass('multi-select');
				}
				view.toggleClass('selected');

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

	FileView.prototype.destroy = function () {
		this.item = null;
		
		if(this.iconDisposable){
			this.iconDisposable.dispose();
			this.iconDisposable = null;
		}

		this.remove();
	};

	FileView.prototype.open = function () {
		this.item.open();
	};

	return FileView;

})(View);
