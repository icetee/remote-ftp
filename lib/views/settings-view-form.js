'use babel';

import { CompositeDisposable, Emitter } from 'atom';
import { View } from 'atom-space-pen-views';

class SettingsViewForm extends View {
  static content() {
    return this.div({
      class: 'block',
    }, () => {
      this.div({
        class: 'input-row',
      }, () => {
        this.div({
          class: 'input-wrapper',
        }, () => {
          this.label({
            class: 'input-label',
            for: 'hostname',
          }, () => {
            this.text('Hostname');
          });

          this.input({
            id: 'hostname',
            outlet: 'ftp[]',
            class: 'input-text',
            type: 'text',
          });
        });

        this.div({
          class: 'input-wrapper',
        }, () => {
          this.label({
            class: 'input-label',
            for: 'port',
          }, () => {
            this.text('Port');
          });

          this.input({
            id: 'port',
            outlet: 'ftp[]',
            class: 'input-text',
            type: 'text',
            placeholder: '21',
          });
        });
      });

      this.div({
        class: 'input-row',
      }, () => {
        this.div({
          class: 'input-wrapper',
        }, () => {
          this.label({
            class: 'input-label',
            for: 'username',
          }, () => {
            this.text('Username');
          });

          this.input({
            name: 'username',
            outlet: 'ftp[]',
            class: 'input-text',
            type: 'text',
          });
        });

        this.div({
          class: 'input-wrapper',
        }, () => {
          this.label({
            class: 'input-label',
            for: 'password',
          }, () => {
            this.text('Password');
          });

          this.input({
            id: 'password',
            outlet: 'ftp[]',
            class: 'input-text',
            type: 'password',
          });
        });
      });

      this.div({
        class: 'input-row',
      }, () => {
        this.div({
          class: 'input-wrapper',
        }, () => {
          this.label({
            class: 'input-label',
            for: 'secure',
          }, () => {
            this.text('Secure');
          });

          this.input({
            id: 'secure',
            outlet: 'ftp[]',
            class: 'input-text',
            type: 'text',
          });
        });

        this.div({
          class: 'input-wrapper',
        }, () => {
          this.label({
            class: 'input-label',
            for: 'secureOptions',
          }, () => {
            this.text('Secure Options');
          });

          this.input({
            id: 'secureOptions',
            outlet: 'ftp[]',
            class: 'input-text',
            type: 'text',
          });
        });
      });

      this.div({
        class: 'input-row',
      }, () => {
        this.div({
          class: 'input-wrapper',
        }, () => {
          this.label({
            class: 'input-label',
            for: 'connTimeout',
          }, () => {
            this.text('Connection Timeout');
          });

          this.input({
            id: 'connTimeout',
            outlet: 'ftp[]',
            class: 'input-text',
            type: 'text',
          });
        });

        this.div({
          class: 'input-wrapper',
        }, () => {
          this.label({
            class: 'input-label',
            for: 'pasvTimeout',
          }, () => {
            this.text('Passive Timeout');
          });

          this.input({
            id: 'pasvTimeout',
            outlet: 'ftp[]',
            class: 'input-text',
            type: 'text',
          });
        });
      });

      this.div({
        class: 'input-row',
      }, () => {
        this.div({
          class: 'input-wrapper',
        }, () => {
          this.label({
            class: 'input-label',
            for: 'keepalive',
          }, () => {
            this.text('Keepalive');
          });

          this.input({
            id: 'keepalive',
            outlet: 'ftp[]',
            class: 'input-text',
            type: 'text',
          });
        });
      });

      this.div({
        class: 'input-row',
      }, () => {
        this.div({
          class: 'input-wrapper',
        }, () => {
          this.label({
            class: 'input-label',
            id: 'forcePasv',
          }, () => {
            this.input({
              id: 'forcePasv',
              outlet: 'ftp[]',
              class: 'input-toggle',
              type: 'checkbox',
              checked: true,
            });

            this.text('Forced Pasv');
          });
        });
      });
    });
  }

  initialize() {
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

export default SettingsViewForm;
