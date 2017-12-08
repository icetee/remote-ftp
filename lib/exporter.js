'use babel';

const os = require('os');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const access = promisify(fs.access);
const readFile = promisify(fs.readFile);
const appendFile = promisify(fs.appendFile);

const uniq = a => [...new Set(a)];

class Exporter {
  constructor(options) {
    this.opt = Object.assign({
      globalConfigPath: '~/.ftpconfigs',
      forceCreate: true,
    }, options);

    this.files = null;
    this.globalConfig = [];
    this.globalConfigStream = null;
    this.globalConfigPath = Exporter.normalizePath(this.opt.globalConfigPath);
  }

  static normalizePath(location) {
    return path.normalize(location.replace('~', os.homedir()));
  }

  async writeGlobalConfig() {
    const hasAccess = await Exporter.checkPath(this.globalConfigPath);

    if (hasAccess) {
      if (appendFile(this.globalConfigPath, this.globalConfig)) {
        console.log('Success!');
      }
    }
  }

  async readGlobalConfig() {
    const hasAccess = await Exporter.checkPath(this.globalConfigPath);

    if (hasAccess) {
      const contents = await Exporter.readAllFile(this.globalConfigPath);
      const content = contents[0];
      let rtn = [];

      if (!Array.isArray(content)) {
        rtn.push(content);
      } else {
        rtn = content;
      }

      this.globalConfig = rtn;
      // this.globalConfigStream = fs.createReadStream(this.globalConfigPath);
      // let buffer = '';
      //
      // this.globalConfigStream.on('data', (d) => {
      //   buffer += d.toString();
      // });
      //
      // this.globalConfigStream.on('end', () => {
      //   if (buffer) {
      //     const buff = JSON.parse(buffer);
      //     let rtn = [];
      //
      //     if (!Array.isArray(buff)) {
      //       rtn.push(buff);
      //     } else {
      //       rtn = buff;
      //     }
      //
      //     this.globalConfig = rtn;
      //   }
      // });
    }
  }

  static async checkPath(localPath) {
    try {
      /* eslint no-bitwise: 0 */
      await access(localPath, fs.constants.R_OK | fs.constants.W_OK);
      return true;
    } catch (err) {
      return err;
      // if (err.code === 'ENOENT' && this.opt.forceCreate) {
      //   fs.createWriteStream(this.globalConfigPath, {
      //     mode: 0o600,
      //   });
      //
      //   return true;
      // }
    }
  }

  static async readAllFile(files) {
    const filesArray = (Array.isArray(files)) ? files : [files];

    return Promise.all(filesArray.map(async (file) => {
      const f = Exporter.normalizePath(file);
      const contents = await readFile(f, 'utf8');

      return JSON.parse(contents);
    }));
  }

  async merge(files) {
    if (!files || files.length === 0) throw Error('Don\'t match file patch');

    await this.readGlobalConfig();
    const contents = await Exporter.readAllFile(files);

    this.globalConfig = uniq(this.globalConfig.concat(contents));

    const set = new Set();
    const t = [{name: 't'}, {name: 't'}, 2, 2, 3, null].forEach((d) => {
      set.add(d);
    });
    console.log(set);
    // console.log(this.globalConfig);
    // if (await this.readGlobalConfig()) {
    //   console.log('global', this.globalConfig);
    // }
    // this.writeGlobalConfig();
  }
}

const exporter = new Exporter();

exporter.merge([
  '~/.ftpconfig',
  '~/.ftpconfig',
]);

/**
 * For [DEP0018] DeprecationWarning
 */
process.on('unhandledRejection', (error) => {
  console.log(error.message);
  process.exit(1);
});
