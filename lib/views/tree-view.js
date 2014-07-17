var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	View = require('atom').ScrollView;


module.exports = TreeView = (function (parent) {
	__extends(TreeView, parent);

	function TreeView () {
		TreeView.__super__.constructor.apply(this, arguments);

	}

	TreeView.content = function () {
		return this.div({
			'class': 'ftp-view-scroller',
			'outlet': 'scroller'
		}, function () {
			return this.ol({
				'class': 'ftp-view full-menu list-tree has-collapsable-children focusable-panel',
				'tabindex': -1,
				'outlet': 'list'
			})
		}.bind(this));
	}

	TreeView.prototype.initialize = function (state) {
		RemoteFtpView.__super__.initialize.apply(this, arguments);

	};

})(View)
