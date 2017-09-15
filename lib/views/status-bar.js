'use babel';

import { CompositeDisposable } from 'atom';
import { View } from 'atom-space-pen-views';

class StatusBarView extends View {
  static content() {
    return this.div({
      class: 'ftp-statusbar-view inline-block',
    }, () => {
      this.span({
        class: 'icon icon-server',
        outlet: 'ftpStatusBarView',
      });
    });
  }

  initialize() {
    this.status = {
      isConnected: false,
    };
    this.ftp = atom.project['remoteftp-main'];
    this.ftp.client.onDidChangeStatus(this.changeStatus);

    this.subscriptions = new CompositeDisposable();
  }

  attached() {
    this.addToolTip();
    console.log('attached', this);
  }

  detached() {
    this.dispose();
  }

  dispose() {
    this.subscriptions.dispose();
    this.remove();
  }

  changeStatus(status) {
    console.log(status);
  }

  addToolTip() {
    this.subscriptions.add(
      atom.tooltips.add(this.ftpStatusBarView, { title: 'Remote-FTP' }),
    );
  }
}

export default StatusBarView;
