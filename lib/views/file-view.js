'use babel';

import { $, ScrollView } from 'atom-space-pen-views';
import { getIconHandler } from '../helpers';

class FileView extends ScrollView {

  static content() {
    return this.li({
      class: 'file entry list-item',
    }, () => this.span({
      class: 'name icon',
      outlet: 'name',
    }));
  }

  initialize(file) {
    super.initialize(file);

    this.item = file;
    this.name.text(this.item.name);
    this.name.attr('data-name', this.item.name);
    this.name.attr('data-path', this.item.remote);

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

    // Events
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
      }
    });

    this.on('dblclick', (e) => {
      e.stopPropagation();

      const view = $(this).view();

      if (!view) { return; }

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

  open() {
    this.item.open();
  }

}

export default FileView;
