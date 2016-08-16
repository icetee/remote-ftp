var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	$ = require('atom-space-pen-views').$,
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

			var view = $(this).view(),
				button = e.originalEvent ? e.originalEvent.button : 0;

			if (!view)
				return;

			switch (button) {
				case 2:
					if (view.is('.selected'))
						return;

				default:
					if (!e.ctrlKey) {
						$('.remote-ftp-view .selected').removeClass('selected');
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

		this.remove();
	};

	FileView.prototype.open = function () {
		this.item.open();
	};

	return FileView;

})(View);
