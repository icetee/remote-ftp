'use babel';

import { CompositeDisposable } from 'event-kit';
import { $, ScrollView } from 'atom-space-pen-views';
import {
  elapsedTime,
  resolveTree,
  getSelectedTree,
} from '../helpers';
import DirectoryView from './directory-view';

class TreeView extends ScrollView {
  static content() {
    return this.div({
      class: 'remote-ftp-view tool-panel',
    }, () => {
      this.ol({
        class: 'ftptree-view full-menu list-tree has-collapsable-children focusable-panel',
        tabindex: -1,
        outlet: 'list',
      });

      this.div({
        class: 'queue tool-panel panel-bottom',
        tabindex: -1,
        outlet: 'queue',
      }, () => {
        this.ul({
          class: 'progress tool-panel panel-top',
          tabindex: -1,
          outlet: 'progress',
        });

        this.ul({
          class: 'list',
          tabindex: -1,
          outlet: 'debug',
        });

        this.span({
          class: 'remote-ftp-info icon icon-unfold',
          tabindex: -1,
          outlet: 'info',
        });
      });

      this.div({
        class: 'offline',
        tabindex: -1,
        outlet: 'offline',
      });
    });
  }

  initialize(storage) {
    super.initialize(storage);

    this.subscriptions = new CompositeDisposable();
    this.storage = storage;

    // Supported for old API
    this.getSelected = getSelectedTree;
    this.resolve = resolveTree;

    const html = `
    <div class="remote-ftp-offline-inner">
    <div class="remote-ftp-picto"><span class="icon icon-shield"></span></div>
    <ul>
      <li><a role="connect" class="btn btn-default icon">Connect</a><br /></li>
      <li><a role="configure" class="btn btn-default icon">Edit Configuration</a><br /></li>
      <li><a role="configure_ignored" class="btn btn-default icon">Edit Ignore Configuration</a><br /></li>
      <li><a role="toggle" class="btn btn-default icon">Close Panel</a></li>
    </ul>
    </div>`;

    this.offline.html(html);

    if (atom.project.remoteftp.isConnected()) {
      this.showOnline();
    } else {
      this.showOffline();
    }

    this.root = new DirectoryView(atom.project.remoteftp.root);
    this.root.expand();
    this.list.append(this.root);
    this.lastSelected = [];

    // Events
    this.subscriptions.add(
      atom.config.onDidChange('remote-ftp.tree.enableDragAndDrop', (value) => {
        if (value.newValue) {
          this.createDragAndDrops();
        } else {
          this.disposeDragAndDrops();
        }
      }),
    );

    atom.project.remoteftp.onDidDebug((msg) => {
      this.debug.prepend(`<li>${msg}</li>`);
      const children = this.debug.children();

      if (children.length > 20) {
        children.last().remove();
      }
    });

    atom.project.remoteftp.onDidQueueChanged(() => {
      this.progress.empty();

      const queues = [];
      if (atom.project.remoteftp.current) {
        queues.push(atom.project.remoteftp.current);
      }

      atom.project.remoteftp.queue.forEach((queueElem) => {
        queues.push(queueElem);
      });

      if (queues.length === 0) {
        this.progress.hide();
      } else {
        this.progress.show();

        queues.forEach((queue) => {
          const $li = $(`<li><progress class="inline-block" /><div class="name">${queue[0]}</div><div class="eta">-</div></li>`);
          const $progress = $li.children('progress');
          const $eta = $li.children('.eta');
          const progress = queue[2];

          this.progress.append($li);

          progress.on('progress', (percent) => {
            if (percent === -1) {
              $progress.removeAttr('max').removeAttr('value');
              $eta.text('-');
            } else {
              $progress.attr('max', 100).attr('value', parseInt(percent * 100, 10));
              const eta = progress.getEta();

              $eta.text(elapsedTime(eta));
            }
          });

          progress.once('done', () => {
            progress.removeAllListeners('progress');
          });
        });
      }
    });

    this.offline.on('click', '[role="connect"]', () => {
      atom.project.remoteftp.readConfig(() => {
        atom.project.remoteftp.connect();
      });
    });

    this.offline.on('click', '[role="configure"]', () => {
      atom.workspace.open(atom.project.remoteftp.getConfigPath());
    });

    this.offline.on('click', '[role="configure_ignored"]', () => {
      atom.workspace.open(atom.project.getDirectories()[0].resolve('.ftpignore'));
    });

    this.offline.on('click', '[role="toggle"]', () => {
      this.toggle();
    });

    this.info.on('click', (e) => { this.toggleInfo(e); });

    this.list.on('keydown', (e) => { this.remoteKeyboardNavigation(e); });

    this.root.entries.on('click', 'li.entry', (e) => {
      e.stopPropagation();
      e.preventDefault();

      let elem = e.target;
      const $this = $(elem);

      if (!$this.hasClass('entry list-item')) {
        if (!$this.hasClass('name') && !$this.hasClass('header')) {
          return true;
        }
        elem = $this.parent()[0];
      }

      this.remoteMultiSelect(e, elem);
      return true;
    });

    atom.project.remoteftp.onDidConnected(() => {
      this.showOnline();
    });

    atom.project.remoteftp.onDidDisconnected(() => {
      this.showOffline();
    });

    this.getTitle = () => 'Remote';

    if (this.storage.data.options.treeViewShow) {
      this.attach();
    }
  }

  serialize() {
    return this.storage.data;
  }

  toggleInfo() {
    this.queue.toggleClass('active');

    if (this.queue.hasClass('active')) {
      this.info.removeClass('icon-unfold').addClass('icon-fold');
    } else {
      this.info.removeClass('icon-fold').addClass('icon-unfold');
    }
  }

  getDockElems() {
    const currentSide = this.storage.data.options.treeViewSide.toLowerCase();
    const currentDock = atom.workspace.paneContainers[currentSide];

    if (typeof currentDock !== 'object') return false;

    const activePane = currentDock.getPanes()[0];

    return {
      currentSide,
      currentDock,
      activePane,
    };
  }

  onDidCloseItem() {
    this.detach();
  }

  attach() {
    const dockElems = this.getDockElems();

    if (!dockElems.activePane) return;

    this.panel = dockElems.activePane.addItem(this);

    if (!dockElems.currentDock.isVisible() && this.storage.data.options.treeViewShow) {
      dockElems.currentDock.toggle();
    }

    atom.workspace.onDidDestroyPaneItem(({ item }) => {
      if (item === this.panel) {
        this.onDidCloseItem(this.panel);
      }
    });
  }

  attached() {
    this.storage.data.options.treeViewShow = true;
  }

  detach(...args) {
    super.detach(...args);

    if (this.panel) {
      if (typeof this.panel.destroy === 'function') {
        this.panel.destroy();
      } else if (typeof atom.workspace.paneForItem === 'function') {
        if (typeof atom.workspace.paneForItem(this.panel) !== 'undefined') {
          atom.workspace.paneForItem(this.panel).destroyItem(this.panel, true);
        }
      }

      this.panel = null;
    }

    this.storage.data.options.treeViewShow = false;
  }

  dispose() {
    this.subscriptions.dispose();
  }

  createDragAndDrops() {
    this.root.getViews().forEach((view) => {
      if (typeof view.dragEventsDestroy === 'function') {
        view.dragEventsActivate();
      }
    });
  }

  disposeDragAndDrops() {
    this.root.getViews().forEach((view) => {
      if (typeof view.dragEventsDestroy === 'function') {
        view.dragEventsDestroy();
      }
    });
  }

  toggle() {
    if (typeof this.panel !== 'undefined' && this.panel !== null) {
      this.detach();
    } else {
      this.attach();
    }
  }

  showOffline() {
    this.list.hide();
    this.queue.hide();
    this.offline.css('display', 'flex');
  }

  showOnline() {
    this.list.show();
    this.queue.show();
    this.offline.hide();

    if (!atom.project.remoteftp.connector.ftp) {
      this.info.hide();
    }
  }

  remoteMultiSelect(e, current) {
    const treeView = atom.project.remoteftpMain.treeView;
    const lastSelected = treeView.lastSelected[treeView.lastSelected.length - 1][0];

    const keyCode = e.keyCode || e.which;
    if (keyCode !== 1 || !e.shiftKey) {
      this.list.removeClass('multi-select');
      return true;
    }

    if (lastSelected === current) return true;

    const entries = this.list.find('li.entry:not(.project-root)');

    this.list.addClass('multi-select');

    const lastIndex = entries.index(lastSelected);
    const currIndex = entries.index(current);

    if (lastIndex === -1 || currIndex === -1) return true;

    const entryMin = Math.min(lastIndex, currIndex);
    const entryMax = Math.max(lastIndex, currIndex);

    for (let i = entryMin; i <= entryMax; i++) {
      $(entries[i]).addClass('selected');
    }

    return true;
  }

  remoteKeyboardNavigation(e) {
    const arrows = { left: 37, up: 38, right: 39, down: 40 };
    const keyCode = e.keyCode || e.which;

    if (Object.values(arrows).indexOf(keyCode) > -1 && e.shiftKey) {
      this.list.addClass('multi-select');
    } else {
      this.list.removeClass('multi-select');
    }

    switch (keyCode) {
      case arrows.up:
        this.remoteKeyboardNavigationUp();
        break;
      case arrows.down:
        this.remoteKeyboardNavigationDown();
        break;
      case arrows.left:
        this.remoteKeyboardNavigationLeft();
        break;
      case arrows.right:
        this.remoteKeyboardNavigationRight();
        break;
      default:
        return;
    }

    e.preventDefault();
    e.stopPropagation();

    this.remoteKeyboardNavigationMovePage();
  }

  remoteKeyboardNavigationUp() {
    const current = this.list.find('.selected');
    const isMulti = this.list.hasClass('multi-select');

    let next = current.prev('.entry:visible');

    if (next.length >= 1) {
      while (next.is('.expanded') && next.find('.entries .entry:visible').length) {
        next = next.find('.entries .entry:visible');
      }
    } else {
      next = current.closest('.entries').closest('.entry:visible');
    }

    if (next.length >= 1) {
      if (!isMulti) current.removeClass('selected');

      next.last().addClass('selected');
    }
  }

  remoteKeyboardNavigationDown() {
    const current = this.list.find('.selected');
    const isMulti = this.list.hasClass('multi-select');

    let next = current.find('.entries .entry:visible');
    let tmp = null;

    if (!next.length) {
      tmp = current;

      do {
        next = tmp.next('.entry:visible');

        if (!next.length) {
          tmp = tmp.closest('.entries').closest('.entry:visible');
        }
      } while (!next.length && !tmp.is('.project-root'));
    }

    if (next.length >= 1) {
      if (!isMulti) current.removeClass('selected');

      next.first().addClass('selected');
    }
  }

  remoteKeyboardNavigationLeft() {
    const current = this.list.find('.selected');

    let next = null;

    if (!current.is('.directory')) {
      next = current.closest('.directory');
      next.view().collapse();

      current.removeClass('selected');
      next.first().addClass('selected');
    } else {
      current.view().collapse();
    }
  }

  remoteKeyboardNavigationRight() {
    const current = this.list.find('.selected');

    if (current.is('.directory')) {
      const view = current.view();

      view.open();
      view.expand();
    }
  }

  remoteKeyboardNavigationMovePage() {
    const current = this.list.find('.selected');

    if (current.length) {
      const scrollerTop = this.scrollTop();
      const selectedTop = current.position().top;

      if (selectedTop < scrollerTop - 10) {
        this.pageUp();
      } else if (selectedTop > scrollerTop + (this.height() - 10)) {
        this.pageDown();
      }
    }
  }
}

export default TreeView;
