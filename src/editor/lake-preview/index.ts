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
  const fileName = window.currentResourceURI.path.split('/').pop();

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
    header: !isReadOnly && config.showTitle ? React.createElement(Title, {
      onChange(title: string) {
        ctx.title = title;
        let lake = editor.getDocument('text/lake', { includeMeta: true });
        lake = lake.replace(/<!doctype lake>/, '<!doctype lake><title>' + title + '</title>');
        window.message.callServer('contentchange', lake);
      },
      onChangeEnd() {
        editor.execCommand('focus', 'start');
      },
    }) : null,
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
        let lake = new TextDecoder().decode(e.data.data);
        if (!isReadOnly && config.showTitle) {
          const m = lake.match(/<title>([\s\S]+?)<\/title>/);
          if (m) {
            ctx.title = m[1];
          }
          document.querySelector('.lake-title').setAttribute('value', ctx.title);
        }
        lake = lake.replace(/<title>[\s\S]+?<\/title>/g, '');
        editor.setDocument('text/lake', lake);
        // 监听内容变动
        cancelChangeListener = editor.on('contentchange', () => {
          let lake = editor.getDocument('text/lake', { includeMeta: true });
          if (config.showTitle) {
            lake = lake.replace(/<!doctype lake>/, '<!doctype lake><title>' + ctx.title + '</title>');
          }
          window.message.callServer('contentchange', lake);
        });
        // 获取焦点
        editor.execCommand('focus');
        window.message.replayServer(e.data.requestId);
        break;
      case 'getContent': {
        let lake = editor.getDocument('text/lake', { includeMeta: true });
        if (config.showTitle) {
          // 以文件名作为标题
          lake = lake.replace('<!doctype lake>', '<!doctype lake><title>' + ctx.title + '</title>');
        }
        window.message.replayServer(e.data.requestId, new TextEncoder().encode(lake));
        break;
      }
    }
  });

  window.message.callServer('ready');
};
