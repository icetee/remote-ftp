'use babel';

import { $, View } from 'atom-space-pen-views';
import { getIconHandler } from '../helpers';
import FileView from './file-view';

class DirectoryView extends View {

  static content() {
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
  }

  initialize(directory) {
    // super.initialize(directory);

    this.item = directory;
    this.name.text(this.item.name);
    this.name.attr('data-name', this.item.name);
    this.name.attr('data-path', this.item.remote);

    const addIconToElement = getIconHandler();
    if (addIconToElement) {
      const element = this.name[0] || this.name;
      const path = this.item && this.item.local;
      this.iconDisposable = addIconToElement(element, path, { isDirectory: true });
    } else {
      this.name.addClass(this.item.type && this.item.type === 'l' ? 'icon-file-symlink-directory' : 'icon-file-directory');
    }

    if (this.item.isExpanded || this.item.isRoot) { this.expand(); }

    if (this.item.isRoot) { this.addClass('project-root'); }

    // Trigger repaint
    this.item.onChangeItems(() => {
      this.repaint();
    });

    this.item.onChangeExpanded(() => {
      this.setClasses();
    });

    this.item.onDestroyed(() => {
      this.destroy();
    });

    this.repaint();

    // Events
    this.on('mousedown', (e) => {
      const self = e.currentTarget;
      e.stopPropagation();

      const view = $(self).view();
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

    this.on('dblclick', (e) => {
      const self = e.currentTarget;
      e.stopPropagation();

      const view = $(self).view();

      if (!view) return;

      view.open();
    });
  }

  destroy() {
    this.item = null;

    if (this.iconDisposable) {
      this.iconDisposable.dispose();
      this.iconDisposable = null;
    }

    this.remove();
  }

  repaint() {
    let views = this.entries.children().map((err, item) => $(item).view()).get();
    const folders = [];
    const files = [];

    this.entries.children().detach();

    if (this.item) {
      this.item.folders.forEach((item) => {
        for (let a = 0, b = views.length; a < b; ++a) {
          if (views[a] && views[a] instanceof DirectoryView && views[a].item === item) {
            folders.push(views[a]);
            return;
          }
        }
        folders.push(new DirectoryView(item));
      });

      this.item.files.forEach((item) => {
        for (let a = 0, b = views.length; a < b; ++a) {
          if (views[a] && views[a] instanceof FileView && views[a].item === item) {
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
      if (a.constructor !== b.constructor) { return a instanceof DirectoryView ? -1 : 1; }
      if (a.item.name === b.item.name) { return 0; }

      return a.item.name.toLowerCase()
        .localeCompare(b.item.name.toLowerCase());
    });

    views.forEach((view) => {
      this.entries.append(view);
    });
  }

  setClasses() {
    if (this.item.isExpanded) {
      this.addClass('expanded').removeClass('collapsed');
    } else {
      this.addClass('collapsed').removeClass('expanded');
    }
  }

  expand(recursive) {
    this.item.setIsExpanded = true;

    if (recursive) {
      this.entries.children().each((e, item) => {
        const view = $(item).view();
        if (view && view instanceof DirectoryView) { view.expand(true); }
      });
    }
  }

  collapse(recursive) {
    this.item.setIsExpanded = false;

    if (recursive) {
      this.entries.children().each((e, item) => {
        const view = $(item).view();
        if (view && view instanceof DirectoryView) { view.collapse(true); }
      });
    }
  }

  toggle(recursive) {
    if (this.item.isExpanded) {
      this.collapse(recursive);
    } else {
      this.expand(recursive);
    }
  }

  open() {
    this.item.open();
  }

  refresh() {
    this.item.open();
  }
}

export default DirectoryView;
