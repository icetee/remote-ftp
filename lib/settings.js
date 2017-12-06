'use babel';

import { CompositeDisposable } from 'atom';
import SettingsView from './views/settings-view';

export default class Settings {
  constructor() {
    this.settingsView = new SettingsView();
    this.settingsPanel = atom.workspace.addModalPanel({
      item: this.settingsView,
      visible: false,
    });

    // this.subscriptions = new CompositeDisposable();
    this.setEvents();
  }

  setEvents() {
    // this.subscriptions.add(
    this.settingsView.onDidClickCancel(() => {
      this.toggle();
    });
    // );
  }

  destroy() {
    this.settingsView.destroy();
    this.settingsPanel.destroy();

    this.dispose();
  }

  dispose() {
    // this.subscriptions.dispose();
    this.remove();
  }

  toggle() {
    return (
      this.settingsPanel.isVisible() ?
      this.settingsPanel.hide() :
      this.settingsPanel.show()
    );
  }
}
