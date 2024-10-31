async function toBase64URL(file: File) {
  const reader = new FileReader();
  return new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function Title(props: {
  onChange?: (value: string) => void;
  onChangeEnd?: () => void;
}) {
  // @ts-expect-error not error
  return React.createElement('input', {
    className: 'lake-title',
    placeholder: '请输入标题',
    onChange: (e: any) => {
      props.onChange?.(e.target.value);
    },
    onKeyDown: (e: any) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        props.onChangeEnd?.();
      }
    },
  });
}

function formatLake(xml: string, config: any) {
  if (!config.formatLake) {
    return xml;
  }
  const PADDING = ' '.repeat(2); // 缩进空格数
  const reg = /(>)(<)(\/*)/g;
  let formatted = '';
  let pad = 0;

  // 将XML字符串中的所有">"和"<"之间添加换行符
  xml = xml.replace(reg, '$1\r\n$2$3');

  // 按行分割XML字符串
  xml.split('\r\n').forEach((node) => {
    let indent = 0;
    if (node.match(/.+<\/\w[^>]*>$/)) {
      indent = 0;
    } else if (node.match(/^<\/\w/)) {
      if (pad !== 0) {
        pad -= 1;
      }
    } else if (node.match(/^<\w([^>]*[^\/])?>.*$/)) {
      indent = 1;
    } else {
      indent = 0;
    }

    formatted += PADDING.repeat(pad) + node + '\r\n';
    pad += indent;
  });

  return formatted.trim();
}

window.onload = async function () {
  const [baseURI, config] = await Promise.all([
    window.message.callServer('getExtensionResource', '/media/editor'),
    window.message.callServer('getConfig')
  ]);

  // @ts-ignore
  const { createOpenEditor, createOpenViewer } = window.Doc;

  // @ts-expect-error not error
  const isReadOnly = window.currentResourceURI.scheme === 'lake';
  // @ts-expect-error not error
  const fileName = window.currentResourceURI.path.split('/').pop() as string;

  const isMarkdown = fileName.toLowerCase().endsWith('.md');

  if (isReadOnly) {
    document.body.style.cssText = 'padding: 24px;';
  }

  const ctx = {
    title: fileName.replace('.lake', ''),
  };

  const disabledPlugins = ['save'];
  if (!config.showToolbar) {
    disabledPlugins.push('toolbar');
  }
  // 创建编辑器
  const editor = (isReadOnly ? createOpenViewer : createOpenEditor)(document.getElementById('root'), {
    disabledPlugins,
    defaultFontsize: config.defaultFontSize,
    // @ts-expect-error not error
    header: !isReadOnly && !isMarkdown && config.showTitle ? React.createElement(Title, {
      onChange(title: string) {
        ctx.title = title;
        let lake = editor.getDocument(docScheme, { includeMeta: true });
        lake = lake.replace(/<!doctype lake>/, '<!doctype lake><title>' + title + '</title>');
        window.message.callServer('contentchange', lake);
      },
      onChangeEnd() {
        editor.execCommand('focus', 'start');
      },
    }) : null,
    bookmark: {
      recognizeYuque: true,
      fetchDetailHandler: async (url: string) => {
        return Promise.resolve({
          url,
          title: '无标题',
        });
      },
    },
    typography: {
      typography: 'classic',
      paragraphSpacing: config.paragraphSpacing ? 'relax' : 'default',
    },
    toc: {
      enable: config.showToc,
    },
    // @ts-expect-error not error
    darkMode: window.isDarkMode,
    placeholder: {
      tip: '开始编辑',
      emptyParagraphTip: '输入 / 唤起更多',
    },
    input: {
      autoSpacing: true,
    },
    link: {
      isValidURL() {
        return true;
      },
      sanitizeURL(url: string) {
        return url;
      }
    },
    codeblock: {
      codemirrorURL: baseURI + '/CodeMirror.js',
      supportCustomStyle: true,
    },
    thirdparty: {
      recognizeYuque: true,
    },
    math: {
      KaTexURL: baseURI + '/katex.js',
    },
    image: {
      isCaptureImageURL() {
        return false;
      },
      async createUploadPromise(request) {
        if (request.type === 'base64') {
          return {
            url: request.data,
            size: request.data.length * 0.75,
            name: 'image.png',
          }
        }
        const url = await toBase64URL(request.data);
        return {
          url,
          size: request.data.size,
          name: request.data.name,
        };
      },
    },
  });

  // @ts-expect-error not error
  window.editor = editor;

  editor.on('visitLink', (href, external) => {
    window.message.callServer('visitLink', href, external);
  });

  const docScheme = isMarkdown ? 'text/markdown' : 'text/lake';

  let cancelChangeListener = () => { };
  window.addEventListener('message', async e => {
    switch (e.data.type) {
      case 'setActive':
        editor.execCommand('focus');
        break;
      case 'switchTheme':
        // @ts-expect-error not error
        window.isDarkMode = e.data.data.isDark;
        editor.theme.setActiveTheme(
          e.data.data.isDark
            ? 'dark-mode'
            : 'default',
        );
        break;
      case 'windowStateChange':
        if (e.data.data.active) {
          editor?.execCommand('focus');
        }
        break;
      case 'undo':
        editor.execCommand('undo');
        window.message.replayServer(e.data.requestId);
        break;
      case 'redo':
        editor.execCommand('redo');
        window.message.replayServer(e.data.requestId);
        break;
      case 'updateContent':
        cancelChangeListener();
        let lake = new TextDecoder().decode(e.data.data);
        if (!isReadOnly && !isMarkdown && config.showTitle) {
          const m = lake.match(/<title>([\s\S]+?)<\/title>/);
          if (m) {
            ctx.title = m[1];
          }
          document.querySelector('.lake-title').setAttribute('value', ctx.title);
        }
        lake = lake.replace(/<title>[\s\S]+?<\/title>/g, '');
        editor.setDocument(docScheme, lake);
        // 监听内容变动
        cancelChangeListener = editor.on('contentchange', () => {
          let lake = editor.getDocument(docScheme, { includeMeta: true });
          if (!isMarkdown && config.showTitle) {
            lake = lake.replace(/<!doctype lake>/, '<!doctype lake><title>' + ctx.title + '</title>');
          }
          window.message.callServer('contentchange', formatLake(lake, config));
        });
        // 获取焦点
        editor.execCommand('focus');
        window.message.replayServer(e.data.requestId);
        console.info('updateContent');
        break;
      case 'getContent': {
        let lake = editor.getDocument(e.data.data || docScheme, { includeMeta: true });
        if (!isMarkdown && config.showTitle && e.data.data !== 'text/markdown') {
          // 以文件名作为标题
          lake = lake.replace('<!doctype lake>', '<!doctype lake><title>' + ctx.title + '</title>');
        }
        window.message.replayServer(e.data.requestId, new TextEncoder().encode(formatLake(lake, config)));
        break;
      }
    }
  });

  window.message.callServer('ready');
};
