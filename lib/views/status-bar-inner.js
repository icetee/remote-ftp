'use babel';

import { CompositeDisposable, Emitter } from 'atom';
import { View } from 'atom-space-pen-views';

export default class StatusBarViewInner extends View {
  static content() {
    return this.div({
      class: 'ftp-statusbar-view-inner inner padded',
    }, () => {
      this.div({
        class: 'block',
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
              checked: 'checked',
              outlet: 'autoSave',
            });

            this.text(' Auto-save');
          });
        });

        this.div({
          class: 'inline-block-tight',
        }, () => {
          this.hr({ class: 'vh' });
        });

        this.button({
          class: 'btn icon icon-gear inline-block-tight',
          outlet: 'settings',
        }, () => {
          this.text('Settings');
        });
      });
    });
  }

  initialize() {
    this.subscriptions = new CompositeDisposable();
    this.emitter = new Emitter();

    this.autoSave.on('click', () => {
      this.emitter.emit('change-auto-save');
    });

    this.settings.on('click', () => {
      this.emitter.emit('open-settings');
    });
  }

  dispose() {
    this.subscriptions.dispose();
    this.remove();
  }

  /**
   * Events
   */
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
