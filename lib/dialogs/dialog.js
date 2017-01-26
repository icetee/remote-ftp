'use babel';

import path from 'path';
import { $, View, TextEditorView } from 'atom-space-pen-views';

const atom = global.atom;

export default class Dialog extends View {

  static content(opts) {
    const options = opts || {};
    return this.div(
      {
        class: 'tree-view-dialog overlay from-top',
      }, () => {
      this.label(options.prompt, {
        class: 'icon',
        outlet: 'text',
      });
      this.subview('miniEditor', new TextEditorView({
        mini: true,
      }));
      this.div({
        class: 'error-message',
        outlet: 'error',
      });
    });
  }

  constructor(opts) {
    const options = opts || {};
    super(options);
    const self = this;

    this.prompt = options.prompt || '';
    this.initialPath = options.initialPath || '';
    this.select = options.select || false;
    this.iconClass = options.iconClass || '';

    if (this.iconClass) { this.text.addClass(this.iconClass); }

    atom.commands.add(this.element, {
      'core:confirm': () => {
        self.onConfirm(self.miniEditor.getText());
      },
      'core:cancel': () => {
        self.cancel();
      },
    });

    this.miniEditor.on('blur', () => {
      this.close();
    });

    this.miniEditor.getModel().onDidChange(() => {
      this.showError();
    });

    if (this.initialPath) {
      this.miniEditor.getModel().setText(this.initialPath);
    }

    if (this.select) {
      const ext = path.extname(this.initialPath);
      const name = path.basename(this.initialPath);
      let selEnd;
      if (name === ext) {
        selEnd = this.initialPath.length;
      } else {
        selEnd = this.initialPath.length - ext.length;
      }
      const range = [[0, this.initialPath.length - name.length], [0, selEnd]];
      this.miniEditor.getModel().setSelectedBufferRange(range);
    }
  }

  attach() {
    this.panel = atom.workspace.addModalPanel({ item: this.element });
    this.miniEditor.focus();
    this.miniEditor.getModel().scrollToCursorPosition();
  }

  close() {
    const destroyPanel = this.panel;
    this.panel = null;
    if (destroyPanel) {
      destroyPanel.destroy();
    }

    atom.workspace.getActivePane().activate();
  }

  cancel() {
    this.close();
    $('.ftp-view').focus();
  }

  showError(message) {
    this.error.text(message);
    if (message) { this.flashError(); }
  }

}
