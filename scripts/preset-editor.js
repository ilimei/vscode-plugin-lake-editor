'use strict';

const path = require('path');
const chalk = require('chalk');
const urllib = require('urllib');

const {
  promises: fs,
  mkdirSync,
  readFileSync,
  writeFileSync,
  createWriteStream,
} = require('fs');

const distFolder = path.resolve(__dirname, '../media/editor');

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const LAKE_EDITOR_VERSION = '1.42.0';

const lakeIconURL = 'https://mdn.alipayobjects.com/design_kitchencore/afts/file/iUdbR5U1XK4AAAAAAAAAAAAADhulAQBr';

const remoteAssetsUrls = {
  lakeJS: {
    src: `https://gw.alipayobjects.com/render/p/yuyan_npm/@alipay_lakex-doc/${LAKE_EDITOR_VERSION}/umd/doc.umd.js`,
    after: (content) => {
      return content.replace(lakeIconURL, './lake-editor-icon.js');
    },
  },
  lakeCSS: `https://gw.alipayobjects.com/render/p/yuyan_npm/@alipay_lakex-doc/${LAKE_EDITOR_VERSION}/umd/doc.css`,
  antdCSS: {
    src: 'https://gw.alipayobjects.com/os/lib/antd/4.24.13/dist/antd.css',
    name: 'antd.4.24.13.css',
  },
  lakeIcon: {
    src: lakeIconURL,
    name: 'lake-editor-icon.js',
  },
  codemirror: 'https://gw.alipayobjects.com/render/p/yuyan_v/180020010000005484/7.1.23/CodeMirror.js',
  react: 'https://unpkg.com/react@18/umd/react.production.min.js',
  reactDom: 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  katex: 'https://unpkg.com/katex@0.16.9/dist/katex.js',
};

async function downloadFile(remoteURL, localFilename, afterLoad) {
  console.log(`# downaload file to ${chalk.cyan(localFilename)} from ${remoteURL}`);
  const fd = await fs.open(localFilename, 'w', 0o644);
  await sleep(100);
  await urllib.request(remoteURL, {
    timeout: 10 * 1000,
    writeStream: createWriteStream(localFilename, {
      fd,
    }),
  });
  if(afterLoad) {
    const data = readFileSync(localFilename, 'utf-8');
    const newData = afterLoad(data);
    writeFileSync(localFilename, newData);
  }
}

async function main() {
  console.log('start preset editor ...');

  const urls = Object.values(remoteAssetsUrls);
  for (let i = 0; i < urls.length; i++) {
    const asset = urls[i];
    const url = typeof asset === 'string' ? asset : asset.src;
    const afterLoad = typeof asset === 'string' ? null : asset.after;
    const fileName = asset.name || url.split('/').pop();
    const localFilename = path.resolve(distFolder, fileName);
    mkdirSync(distFolder, { recursive: true });
    await downloadFile(url, localFilename, afterLoad);
  }

  console.log('\n✅ preset editor success ...\n');
};

main();
