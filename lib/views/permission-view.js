'use babel';

import { View } from 'atom-space-pen-views';
import { CompositeDisposable } from 'atom';

class PermissionView extends View {
  static content() {
    return this.div({
      class: 'permission-view',
    }, () => {
      // Form
      this.form({
        class: 'permission',
      }, () => {
        this.fieldset({
          class: 'permission-owner',
        }, () => {
          this.legend({

          });
        });
        // fieldset
      });
    });
  }

  initialize() {
    this.disposables = new CompositeDisposable();
    this.disposables.add(atom.commands.add('atom-workspace', {
      'core:confirm': () => {
        this.confirm();
      },
      'core:cancel': (event) => {
        this.cancel();
        event.stopPropagation();
      },
    }));
  }

  show() {
    this.panel = atom.workspace.addModalPanel({ item: this });
    this.panel.show();
  }

  hide() {
    if (this.panel) {
      this.panel.hide();
    }
  }

  destroy() {
    this.remove();
  }
}

export default PermissionView;
