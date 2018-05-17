'use babel';

const version = 0x003;

export default class RemoteStorage {
  constructor(state) {
    this.data = state && state.version === version ? state : RemoteStorage.createBlankCache();
  }

  static createBlankCache() {
    return {
      options: {
        autosave: true,
        treeViewSide: 'left',
        treeViewShow: false,
      },
      version,
    };
  }

  get version() {
    return this.data.version;
  }
}
