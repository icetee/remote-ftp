'use babel';

import { EventEmitter } from 'events';

export default class Progress extends EventEmitter {
  constructor() {
    super();
    this.progress = -1;
    this.start = 0;
  }

  setProgress(res) {
    const progress = parseFloat(res) || -1;

    if (this.progress === -1 && progress > -1) this.start = Date.now();
    this.progress = progress;
    this.emit('progress', this.progress);
    if (this.progress === 1) this.emit('done');
  }

  isDone() { return this.progress >= 1; }

  getEta() {
    if (this.progress === -1) return Infinity;

    const now = Date.now();
    const elapse = now - this.start;
    const remaining = (elapse * 1) / this.progress;

    return remaining - elapse;
  }
}
