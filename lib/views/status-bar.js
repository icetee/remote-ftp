'use babel';

import { CompositeDisposable, Emitter } from 'atom';
import { $, View } from 'atom-space-pen-views';
import StatusBarViewInner from './status-bar-inner';

class StatusBarView extends View {
  static content() {
    return this.div({
      class: 'ftp-statusbar-view inline-block',
    }, () => {
      this.span({
        class: 'icon icon-alignment-unalign',
        outlet: 'ftpStatusBarView',
      });
    });
  }

  initialize() {
    this.subscriptions = new CompositeDisposable();
    this.emitter = new Emitter();
    this.innerBar = new StatusBarViewInner();

    this.opt = {
      iconList: {
        CONNECTED: 'icon-server',
        NOT_CONNECTED: 'icon-alignment-unalign',
      },
    };

    this.status = {
      name: null,
      isConnected: false,
    };

    this.ftp = atom.project['remoteftp-main'];
    this.ftp.client.onDidChangeStatus((status) => {
      this.changeStatus(status);
    });
  }

  attached() {
    this.setToolTip();
    this.setEvents();
  }

  detached() {
    this.dispose();
  }

  dispose() {
    this.subscriptions.dispose();
    this.remove();
  }

  setEvents() {
    this.on('click', () => {
      $('.tooltip[role="tooltip"]').addClass('statusbar-view-tooltip remote-ftp');
    });

    this.onDidChangeStatus(() => {
      this.setIconHandler();
    });

    this.innerBar.onDidChangeAutoSave((newValue) => {
      this.ftp.storage.data.options.autosave = newValue;
    });

    this.innerBar.onDidOpenSettings(() => {
      atom.workspace.open('atom://config/packages/Remote-FTP');
    });
  }

  setIconHandler() {
    if (this.status.isConnected) {
      this.ftpStatusBarView
        .removeClass(this.opt.iconList.NOT_CONNECTED)
        .addClass(this.opt.iconList.CONNECTED);
    } else {
      this.ftpStatusBarView
        .removeClass(this.opt.iconList.CONNECTED)
        .addClass(this.opt.iconList.NOT_CONNECTED);
    }
  }

  changeStatus(status) {
    if (status === 'CONNECTED') {
      this.status.isConnected = true;
    } else {
      this.status.isConnected = false;
    }

    this.status.name = status;
    this.emitter.emit('change-status');
  }

  setToolTip() {
    this.subscriptions.add(
      atom.tooltips.add(this, {
        item: this.innerBar.element,
        class: 'RemoteFtpPopoverTooltip',
        trigger: 'click',
        placement: 'top',
      }),
    );
  }

  /**
   * Events
   */
  onDidClickIcon(callback) {
    this.subscriptions.add(
      this.emitter.on('click-icon', callback),
    );
  }

  onDidChangeStatus(callback) {
    this.subscriptions.add(
      this.emitter.on('change-status', callback),
    );
  }
}

export default StatusBarView;
