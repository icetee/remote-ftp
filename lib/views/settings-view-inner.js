'use babel';

import { CompositeDisposable, Emitter } from 'atom';
import { View } from 'atom-space-pen-views';
import SettingsViewForm from './settings-view-form';

class SettingsViewInner extends View {
  static content() {
    return this.div({
      class: 'block',
    }, () => {
      this.div({
        class: 'block',
      }, () => {
        this.span({}, () => {
          this.text('Load config');
        });

        this.select({
          class: 'input-select',
        }, () => {
          this.option({}, () => {
            this.text('icetee.hu');
          });
        });
      });

      this.div({
        class: 'flex',
      }, () => {
        this.div({
          class: 'sidebar',
        }, () => {
          this.div({
            class: 'select-list',
          }, () => {
            this.ol({
              class: 'list-group',
            }, () => {
              this.li({
                class: 'selected',
              }, () => {
                this.text('FTP');
              });

              this.li({}, () => {
                this.text('FTPS');
              });

              this.li({}, () => {
                this.text('SFTP');
              });
            });
          });
        });

        this.div({
          class: 'form',
          outlet: 'ftpConfigForm',
        });
      });
    });
  }

  initialize() {
    this.formView = new SettingsViewForm();
    this.ftpConfigForm.append(this.formView);

    this.subscriptions = new CompositeDisposable();
    this.emitter = new Emitter();
  }

  // attached() {
  //   // this.events();
  // }

  dispose() {
    this.subscriptions.dispose();
    this.remove();
  }
}

export default SettingsViewInner;
