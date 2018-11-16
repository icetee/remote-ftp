'use babel';

const init = () => {
  const contextMenu = {
    '.remote-ftp-view .entries.list-tree:not(.multi-select) .directory': {
      enabled: atom.config.get('remote-ftp.context.enableCopyFilename'),
      command: [{
        label: 'Copy name',
        command: 'remote-ftp:copy-name',
      }, {
        type: 'separator',
      }],
    },
    '.remote-ftp-view .entries.list-tree:not(.multi-select) .file': {
      enabled: atom.config.get('remote-ftp.context.enableCopyFilename'),
      command: [{
        label: 'Copy filename',
        command: 'remote-ftp:copy-name',
      }, {
        type: 'separator',
      }],
    },
  };
  return contextMenu;
};

export default init;
