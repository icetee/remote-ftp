'use babel';

let __hasProp = {}.hasOwnProperty,
  __extends = function (child, parent) { for (const key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  $ = require('atom-space-pen-views').$,
  FileView = require('./file-view'),
  getIconHandler = require('../helpers.js').getIconHandler,
  View = require('atom-space-pen-views').View;

module.exports = DirectoryView = (function (parent) {
  __extends(DirectoryView, parent);

  function DirectoryView() {
    DirectoryView.__super__.constructor.apply(this, arguments);
  }

  DirectoryView.content = function () {
    return this.li({
      class: 'directory entry list-nested-item collapsed',
    }, () => {
      this.div({
        class: 'header list-item',
        outlet: 'header',
      }, () => this.span({
        class: 'name icon',
        outlet: 'name',
      }));
      this.ol({
        class: 'entries list-tree',
        outlet: 'entries',
      });
    });
  };

  DirectoryView.prototype.initialize = function (directory) {
		// DirectoryView.__super__.initialize.apply(this, arguments);

    const self = this;

    self.item = directory;
    self.name.text(self.item.name);
    self.name.attr('data-name', self.item.name);
    self.name.attr('data-path', self.item.remote);

    const addIconToElement = getIconHandler();
    if (addIconToElement) {
      const element = self.name[0] || self.name;
      const path = self.item && self.item.local;
      this.iconDisposable = addIconToElement(element, path, { isDirectory: true });
    } else			{ self.name.addClass(self.item.type && self.item.type == 'l' ? 'icon-file-symlink-directory' : 'icon-file-directory'); }

    if (self.item.isExpanded || self.item.isRoot)			{ self.expand(); }

    if (self.item.isRoot)			{ self.addClass('project-root'); }

		// Trigger repaint
    self.item.$folders.onValue(() => { self.repaint(); });
    self.item.$files.onValue(() => { self.repaint(); });
    self.item.$isExpanded.onValue(() => { self.setClasses(); });
    self.item.on('destroyed', () => { self.destroy(); });
    self.repaint();

		// Events
    self.on('mousedown', function (e) {
      e.stopPropagation();

      const view = $(this).view();
      const button = e.originalEvent ? e.originalEvent.button : 0;
      const selectKey = process.platform === 'darwin' ? 'metaKey' : 'ctrlKey'; // on mac the select key for multiple files is the meta key
      const $selected = $('.remote-ftp-view .selected');

      if (!view) return;

      if ((button === 0 || button === 2) && !(button === 2 && $selected.length > 1)) {
        if (!e[selectKey]) {
          $selected.removeClass('selected');
          $('.remote-ftp-view .entries.list-tree').removeClass('multi-select');
        } else {
          $('.remote-ftp-view .entries.list-tree').addClass('multi-select');
        }
        view.toggleClass('selected');

        if (button === 0 && !e[selectKey]) {
          if (view.item.status === 0) view.open();
          view.toggle();
        }
      }
    });

    self.on('dblclick', function (e) {
      e.stopPropagation();

      const view = $(this).view();
      if (!view) return;

      view.open();
    });
  };

  DirectoryView.prototype.destroy = function () {
    this.item = null;

    if (this.iconDisposable) {
      this.iconDisposable.dispose();
      this.iconDisposable = null;
    }

    this.remove();
  };

  DirectoryView.prototype.repaint = function (recursive) {
    let self = this,
      views = self.entries.children().map(function () { return $(this).view(); }).get(),
      folders = [],
      files = [];

    self.entries.children().detach();

    if (self.item) {
      self.item.folders.forEach((item) => {
        for (let a = 0, b = views.length; a < b; ++a)				{
          if (views[a] && views[a] instanceof DirectoryView && views[a].item == item) {
            folders.push(views[a]);
            return;
          }
        }
        folders.push(new DirectoryView(item));
      });
    }
    if (self.item) {
      self.item.files.forEach((item) => {
        for (let a = 0, b = views.length; a < b; ++a)				{
          if (views[a] && views[a] instanceof FileView && views[a].item == item) {
            files.push(views[a]);
            return;
          }
        }
        files.push(new FileView(item));
      });
    }

		// TODO Destroy left over...

    views = folders.concat(files);

    views.sort((a, b) => {
      if (a.constructor != b.constructor)				{ return a instanceof DirectoryView ? -1 : 1; }
      if (a.item.name == b.item.name)				{ return 0; }

      return a.item.name.toLowerCase().localeCompare(b.item.name.toLowerCase());
    });

    views.forEach((view) => {
      self.entries.append(view);
    });
  };

  DirectoryView.prototype.setClasses = function () {
    if (this.item.isExpanded) {
      this.addClass('expanded').removeClass('collapsed');
    } else {
      this.addClass('collapsed').removeClass('expanded');
    }
  };

  DirectoryView.prototype.expand = function (recursive) {
    this.item.isExpanded = true;

    if (recursive) {
      this.entries.children().each(function () {
        const view = $(this).view();
        if (view && view instanceof DirectoryView)					{ view.expand(true); }
      });
    }
  };

  DirectoryView.prototype.collapse = function (recursive) {
    this.item.isExpanded = false;

    if (recursive) {
      this.entries.children().each(function () {
        const view = $(this).view();
        if (view && view instanceof DirectoryView)					{ view.collapse(true); }
      });
    }
  };

  DirectoryView.prototype.toggle = function (recursive) {
    if (this.item.isExpanded) {
      this.collapse(recursive);
    } else {
      this.expand(recursive);
    }
  };

  DirectoryView.prototype.open = function () {
    this.item.open();
  };

  DirectoryView.prototype.refresh = function () {
    this.item.open();
  };

  return DirectoryView;
}(View));
