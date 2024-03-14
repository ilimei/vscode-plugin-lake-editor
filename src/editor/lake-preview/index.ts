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

window.onload = async function () {
  const [baseURI, config] = await Promise.all([
    window.message.callServer('getExtensionResource', '/media/editor'),
    window.message.callServer('getConfig')
  ]);

  // @ts-ignore
  const { createOpenEditor, createOpenViewer } = window.Doc;

  // @ts-expect-error not error
  const isReadOnly = window.currentResourceURI.scheme === 'lake';

  if (isReadOnly) {
    document.body.style.cssText = 'padding: 24px;';
  }

  const disabledPlugins = ['save'];
  if (!config.showToolbar) {
    disabledPlugins.push('toolbar');
  }
  // 创建编辑器
  const editor = (isReadOnly ? createOpenViewer : createOpenEditor)(document.getElementById('root'), {
    disabledPlugins,
    defaultFontsize: config.defaultFontSize,
    typography: {
      typography: 'classic',
      paragraphSpacing: config.paragraphSpacing ? 'relax' : 'default',
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
    math: {
      KaTexURL: baseURI + '/katex.js',
    },
    image: {
      isCaptureImageURL() {
        return false;
      },
      async createUploadPromise(request) {
        const url = await toBase64URL(request.data);
        return {
          url,
          size: request.data.size,
          name: request.data.name,
        };
      },
    },
  });

  editor.on('visitLink', (href, external) => {
    window.message.callServer('visitLink', href, external);
  });

  let cancelChangeListener = () => { };
  window.addEventListener('message', async e => {
    switch (e.data.type) {
      case 'setActive':
        editor.execCommand('focus');
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
        editor.setDocument('text/lake', new TextDecoder().decode(e.data.data));
        // 监听内容变动
        cancelChangeListener = editor.on('contentchange', () => {
          window.message.callServer('contentchange', editor.getDocument('text/lake'));
        });
        // 获取焦点
        editor.execCommand('focus');
        window.message.replayServer(e.data.requestId);
        break;
      case 'getContent':
        window.message.replayServer(e.data.requestId, new TextEncoder().encode(editor.getDocument('text/lake')));
        break;
    }
  });

  window.message.callServer('ready');
};
