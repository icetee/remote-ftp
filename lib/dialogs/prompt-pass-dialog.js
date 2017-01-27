'use babel';

import Dialog from './dialog';
import { TextBuffer } from 'atom';

const atom = global.atom;

export default class PromptPassDialog extends Dialog {

  constructor() {
    super({
      prompt: 'Enter password/passphrase only for this session:',
      select: false,
    });

    const self = this;
    const passwordModel = self.miniEditor.getModel();

    passwordModel.clearTextPassword = new TextBuffer('');

    let changing = false;
    passwordModel.buffer.onDidChange((obj) => {
      if (!changing) {
        changing = true;
        passwordModel.clearTextPassword.setTextInRange(obj.oldRange, obj.newText);
        passwordModel.buffer.setTextInRange(obj.newRange, '*'.repeat(obj.newText.length));
        changing = false;
      }
    });

    const coreConfirmListeners = atom.commands.inlineListenersByCommandName['core:confirm'].get(self.element);
    coreConfirmListeners.splice(0, coreConfirmListeners.length);

    atom.commands.add(self.element, {
      'core:confirm': () => {
        self.onConfirm(passwordModel.clearTextPassword.getText());
      },
    });
  }

  onConfirm(pass) {
    this.trigger('dialog-done', [pass]);
  }

}
