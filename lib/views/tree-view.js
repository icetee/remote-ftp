'use babel';

import { $, ScrollView } from 'atom-space-pen-views';
import {
  getObject,
  resizeCursor,
  elapsedTime,
  resolveTree,
  getSelectedTree,
} from '../helpers';
import DirectoryView from './directory-view';

let hideLocalTreeError = false;

function hideLocalTree() {
  const treeView = getObject({
    obj: atom.packages.loadedPackages,
    keys: ['tree-view', 'mainModule', 'treeView'],
  });

  if (treeView && typeof treeView.detach === 'function') { // Fix for Issue 433 ( workaround to stop throwing error)
    try {
      treeView.detach();
    } catch (e) {
      if (hideLocalTreeError === false) {
        atom.notifications.addWarning('Remote FTP: See issue #433', {
          dismissable: false,
        });
        hideLocalTreeError = true;
      }
    }
  }
}

function showLocalTree() {
  const treeView = getObject({
    obj: atom.packages.loadedPackages,
    keys: ['tree-view', 'mainModule', 'treeView'],
  });
  if (treeView && typeof treeView.detach === 'function') treeView.attach();
}

class TreeView extends ScrollView {

  static content() {
    return this.div({
      class: 'remote-ftp-view ftptree-view-resizer tool-panel',
      'data-show-on-right-side': atom.config.get('tree-view.showOnRightSide'),
      'data-use-dock-integration': atom.config.get('Remote-FTP.tree.useDockIntegration'),
    }, () => {
      this.div({
        class: 'scroller',
        outlet: 'scroller',
      }, () => {
        this.ol({
          class: 'ftptree-view full-menu list-tree has-collapsable-children focusable-panel',
          tabindex: -1,
          outlet: 'list',
        });
      });
      this.div({
        class: 'resize-handle',
        outlet: 'horizontalResize',
        style: `cursor:${resizeCursor}`, // platform specific cursor
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
        return this.div({
          class: 'resize-handle',
          outlet: 'verticalResize',
        });
      });
      this.div({
        class: 'offline',
        tabindex: -1,
        outlet: 'offline',
      });
    });
  }

  initialize(...args) {
    super.initialize(...args);

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

    // Events
    atom.config.onDidChange('tree-view.showOnRightSide', () => {
      if (this.isVisible()) {
        setTimeout(() => {
          this.detach();
          this.attach();
        }, 1);
      }
    });

    atom.config.onDidChange('Remote-FTP.tree.hideLocalWhenDisplayed', (values) => {
      if (values.newValue) {
        if (this.isVisible()) {
          hideLocalTree();
        }
      } else if (this.isVisible()) {
        this.detach();
        showLocalTree();
        this.attach();
      } else {
        showLocalTree();
      }
    });

    atom.config.onDidChange('Remote-FTP.tree.useDockIntegration', () => {
      if (typeof atom.workspace.getRightDock === 'undefined') {
        atom.notifications.addWarning('Your editor is <b>deprecated</b>.<br />This option is available only >=1.17.0 version.');
        atom.config.set('Remote-FTP.tree.useDockIntegration', 'false');
      } else if (this.isVisible()) {
        setTimeout(() => {
          this.detach();
          this.attach();
        }, 1);
      }
    });

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

    this.horizontalResize.on('dblclick', (e) => { this.resizeToFitContent(e); });
    this.horizontalResize.on('mousedown', (e) => { this.resizeHorizontalStarted(e); });
    this.verticalResize.on('mousedown', (e) => { this.resizeVerticalStarted(e); });
    this.list.on('keydown', (e) => { this.remoteKeyboardNavigation(e); });

    atom.project.remoteftp.onDidConnected(() => {
      this.showOnline();
    });

    atom.project.remoteftp.onDidDisconnected(() => {
      this.showOffline();
    });

    this.getTitle = () => 'Remote-FTP';
  }

  attach() {
    const enableDock = atom.config.get('Remote-FTP.tree.useDockIntegration');
    const showOnRightSide = atom.config.get('tree-view.showOnRightSide');
    const hideLocalDisplay = atom.config.get('Remote-FTP.tree.hideLocalWhenDisplayed');

    if (showOnRightSide && enableDock) {
      // if show on right side && use new integration
      const activePane = atom.workspace.getRightDock().paneContainer.getActivePane();

      this.panel = activePane.addItem(this);
      activePane.activateItemforURI(this.getTitle());
    } else if (!showOnRightSide && enableDock) {
      // if not show on right side && use new integration
      const activePane = atom.workspace.getLeftDock().paneContainer.getActivePane();

      this.panel = activePane.addItem(this);
      activePane.activateItem(this.panel);
    } else if (showOnRightSide && !enableDock) {
      // if show on right side && not use new integration
      this.panel = atom.workspace.addRightPanel({ item: this });
    } else if (!showOnRightSide && !enableDock) {
      // if not show on right side && not use new integration
      this.panel = atom.workspace.addLeftPanel({ item: this });
    }

    if (hideLocalDisplay) {
      hideLocalTree();
    } else {
      showLocalTree();
    }
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
  }

  resizeVerticalStarted(e) {
    e.preventDefault();

    const $doc = $(document);

    this.resizeHeightStart = this.queue.height();
    this.resizeMouseStart = e.pageY;

    $doc.on('mousemove', this.resizeVerticalView.bind(this));
    $doc.on('mouseup', this.resizeVerticalStopped);
  }

  resizeVerticalStopped() {
    delete this.resizeHeightStart;
    delete this.resizeMouseStart;

    const $doc = $(document);

    $doc.off('mousemove', this.resizeVerticalView);
    $doc.off('mouseup', this.resizeVerticalStopped);
  }

  resizeVerticalView(e) {
    if (e.which !== 1) { return this.resizeVerticalStopped(); }

    const delta = e.pageY - this.resizeMouseStart;
    const height = Math.max(26, this.resizeHeightStart - delta);

    this.queue.height(height);
    this.scroller.css('bottom', `${height}px`);

    return true;
  }

  resizeHorizontalStarted(e) {
    e.preventDefault();

    this.resizeWidthStart = this.width();
    this.resizeMouseStart = e.pageX;

    const $doc = $(document);

    $doc.on('mousemove', this.resizeHorizontalView.bind(this));
    $doc.on('mouseup', this.resizeHorizontalStopped);
  }

  resizeHorizontalStopped() {
    delete this.resizeWidthStart;
    delete this.resizeMouseStart;

    const $doc = $(document);

    $doc.off('mousemove', this.resizeHorizontalView);
    $doc.off('mouseup', this.resizeHorizontalStopped);
  }

  resizeHorizontalView(e) {
    if (e.which !== 1) { return this.resizeHorizontalStopped(); }

    const delta = e.pageX - this.resizeMouseStart;
    const width = Math.max(50, this.resizeWidthStart + delta);

    this.width(width);

    return true;
  }

  resizeToFitContent(e) {
    e.preventDefault();

    this.width(1);
    this.width(this.list.outerWidth());
  }

  remoteKeyboardNavigation(e) {
    const arrows = { left: 37, up: 38, right: 39, down: 40 };
    const keyCode = e.keyCode || e.which;

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

    let next = current.prev('.entry:visible');

    if (next.length) {
      while (next.is('.expanded') && next.find('.entries .entry:visible').length) {
        next = next.find('.entries .entry:visible');
      }
    } else {
      next = current.closest('.entries').closest('.entry:visible');
    }

    if (next.length) {
      current.removeClass('selected');
      next.last().addClass('selected');
    }
  }

  remoteKeyboardNavigationDown() {
    const current = this.list.find('.selected');

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
    if (next.length) {
      current.removeClass('selected');
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
      const scrollerTop = this.scroller.scrollTop();
      const selectedTop = current.position().top;

      if (selectedTop < scrollerTop - 10) {
        this.scroller.pageUp();
      } else if (selectedTop > scrollerTop + (this.scroller.height() - 10)) {
        this.scroller.pageDown();
      }
    }
  }
}

export default TreeView;
