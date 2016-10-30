'use babel';

import contextMenu from './contextMenu';
import commands from './commands';

export default function INITCOMMANDS() {
  const atom = global.atom;
  const add = function ADD({
    location,
    obj,
    target = false,
  }) {
    const enabledCommands = Object.keys(obj)
    .reduce((ret, key) => { // key == command user types in or is called with context menu
      const {
        enabled,
        command,
      } = obj[key];
      const object = Object.assign({}, ret);
      if (enabled === true) {
        object[key] = command;
      }
      return object;
    }, {});

    if (target === false) {
      atom[location].add(enabledCommands);
    } else {
      atom[location].add(target, enabledCommands);
    }
  };

  add({
    location: 'contextMenu',
    obj: contextMenu(),
  });
  add({
    location: 'commands',
    obj: commands(),
    target: 'atom-workspace',
  });
}
