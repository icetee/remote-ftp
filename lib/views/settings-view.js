'use babel';

import { CompositeDisposable, Emitter } from 'atom';
import { View } from 'atom-space-pen-views';
import SettingsViewInner from './settings-view-inner';

class SettingsView extends View {
  static content() {
    return this.div({
      class: 'ftp-settings-view',
      outlet: 'ftpSettingsView',
    }, () => {
      this.div({
        class: 'inset-panel padded',
      }, () => {
        this.div({
          class: 'body',
          outlet: 'ftpSettingsViewInner',
        });

        this.div({
          class: 'flex footer',
        }, () => {
          this.div({}, () => {
            this.button({
              class: 'btn icon icon icon-cloud-download inline-block-tight',
            }, () => {
              this.text('Download');
            });

            this.button({
              class: 'btn btn-primary icon icon-cloud-upload inline-block-tight',
            }, () => {
              this.text('Upload');
            });
          });

          this.div({
            class: 'right',
          }, () => {
            this.button({
              class: 'btn btn-primary icon icon-sync inline-block-tight',
            }, () => {
              this.text('Save');
            });

            this.button({
              class: 'btn icon icon-x inline-block-tight',
              outlet: 'cancel',
            }, () => {
              this.text('Cancel');
            });
          });
        });
      });
    });
  }

  initialize() {
    this.innerView = new SettingsViewInner();
    this.ftpSettingsViewInner.append(this.innerView);

    this.subscriptions = new CompositeDisposable();
    this.emitter = new Emitter();
  }

  attached() {
    this.events();
  }

  dispose() {
    this.subscriptions.dispose();
    this.remove();
  }


  /**
   * Events
   */
  events() {
    this.cancel.on('click', () => {
      this.emitter.emit('click-cancel');
    });
  }

  onDidClickCancel(callback) {
    this.subscriptions.add(
      this.emitter.on('click-cancel', callback),
    );
  }

}

export default SettingsView;
