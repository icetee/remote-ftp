'use babel';

import { CompositeDisposable, Emitter } from 'atom';
import { View } from 'atom-space-pen-views';

export default class StatusBarViewInner extends View {
  static content() {
    return this.div({
      class: 'ftp-statusbar-view-inner',
    }, () => {
      this.div({
        class: 'StatusBarHeader',
      }, () => {
        this.div({}, () => {
          this.span({}, () => {
            this.text('Remote-FTP');
          });
        });

        this.span({
          class: 'icon-gear',
          outlet: 'settings',
        });
      });

      this.div({
        class: 'StatusBarInner',
      }, () => {
        this.div({
          class: 'inline-block-tight',
        }, () => {
          this.label({
            class: 'input-label',
          }, () => {
            this.input({
              class: 'input-toggle',
              type: 'checkbox',
              outlet: 'autoSave',
            });

            this.text(' Auto-save');
          });
        });
      });
    });
  }

  initialize() {
    this.subscriptions = new CompositeDisposable();
    this.emitter = new Emitter();
  }

  attached() {
    const autosave = atom.project.remoteftpMain.storage.data.options.autosave;

    this.autoSave.prop('checked', autosave);
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
    this.autoSave.on('click', (e) => {
      this.emitter.emit('change-auto-save', this.autoSave.prop('checked'), e);
    });

    this.settings.on('click', () => {
      this.emitter.emit('open-settings');
    });
  }

  onDidChangeAutoSave(callback) {
    this.subscriptions.add(
      this.emitter.on('change-auto-save', callback),
    );
  }

  onDidOpenSettings(callback) {
    this.subscriptions.add(
      this.emitter.on('open-settings', callback),
    );
  }
}
