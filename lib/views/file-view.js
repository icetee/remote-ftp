'use babel';

import { CompositeDisposable } from 'atom';
import { $, ScrollView } from 'atom-space-pen-views';
import { getIconHandler } from '../helpers';

class FileView extends ScrollView {
  static content() {
    return this.li({
      class: 'file entry list-item',
      is: 'tree-view-file',
    }, () => this.span({
      class: 'name icon',
      outlet: 'name',
    }));
  }

  initialize(file) {
    super.initialize(file);

    this.subscriptions = new CompositeDisposable();

    this.item = file;
    this.name.text(this.item.name);
    this.name.attr('data-name', this.item.name);
    this.name.attr('data-path', this.item.remote);

    if (atom.project.remoteftp.checkIgnore(this.item.remote)) {
      this.addClass('status-ignored');
    }

    const addIconToElement = getIconHandler();

    if (addIconToElement) {
      const element = this.name[0] || this.name;
      const path = this.item && this.item.local;

      this.iconDisposable = addIconToElement(element, path);
    } else {
      switch (this.item.type) {
        case 'binary':
          this.name.addClass('icon-file-binary');
          break;
        case 'compressed':
          this.name.addClass('icon-file-zip');
          break;
        case 'image':
          this.name.addClass('icon-file-media');
          break;
        case 'pdf':
          this.name.addClass('icon-file-pdf');
          break;
        case 'readme':
          this.name.addClass('icon-book');
          break;
        case 'text':
          this.name.addClass('icon-file-text');
          break;
        default:
          break;
      }
    }

    this.triggers();
    this.events();
  }

  triggers() {
    this.item.onChangeSelect(() => {
      let lastSelected = atom.project.remoteftpMain.treeView.lastSelected;

      if (this.item.isSelected) {
        lastSelected.push(this);
        lastSelected = lastSelected.reverse().slice(0, 2).reverse();
      }
    });
  }

  events() {
    this.on('mousedown', (e) => {
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

        this.item.setIsSelected = view.hasClass('selected');
      }
    });

    this.on('dblclick', (e) => {
      e.stopPropagation();

      const view = $(this).view();

      if (!view) { return; }

      view.open();
    });

    if (atom.config.get('Remote-FTP.tree.enableDragAndDrop')) {
      this.setDraggable(true);
    }

    this.subscriptions.add(
      atom.config.onDidChange('Remote-FTP.tree.enableDragAndDrop', (values) => {
        this.setDraggable(values.newValue);
      }),
    );
  }

  setDraggable(bool) {
    this.attr('draggable', bool);
  }

  dispose() {
    this.subscriptions.dispose();
  }

  destroy() {
    this.item = null;

    if (this.iconDisposable) {
      this.iconDisposable.dispose();
      this.iconDisposable = null;
    }

    this.remove();
  }

  open() {
    this.item.open();
  }

}

export default FileView;
