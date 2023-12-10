window.onload = function () {
  // @ts-ignore
  const { createOpenEditor } = window.Doc;
  // 创建编辑器
  const editor = createOpenEditor(document.getElementById('root'), {
    disabledPlugins: ['save'],
    input: {},
    image: {
      isCaptureImageURL() {
        return false;
      },
    },
  });

  let cancelChangeListener = () => {};
  window.addEventListener('message', async e => {
    switch(e.data.type) {
      case 'setActive':
        editor.execCommand('focus');
        break;
      case 'undo': 
        editor.execCommand('undo');
        // @ts-expect-error not error
        vscode.postMessage({ requestId: e.data.requestId, data: null });  
        break;
      case 'redo':
        editor.execCommand('redo');
        // @ts-expect-error not error
        vscode.postMessage({ requestId: e.data.requestId, data: null });  
        break;
      case 'updateContent':
        cancelChangeListener();
        editor.setDocument('text/lake', new TextDecoder().decode(e.data.data));
        // 监听内容变动
        cancelChangeListener = editor.on('contentchange', () => {
          // @ts-expect-error not error
          vscode.postMessage({
            type: 'contentchange',
            data: editor.getDocument('text/lake'),
          });
          console.info('contentchange', editor.getDocument('text/lake'));
        });
        // 获取焦点
        editor.execCommand('focus');
        // @ts-expect-error not error
        vscode.postMessage({ requestId: e.data.requestId, data: null });  
        break;
      case 'getContent':
        // @ts-expect-error not error
        vscode.postMessage({ requestId: e.data.requestId, data: new TextEncoder().encode(editor.getDocument('text/lake')) });  
        break;
    }
  });

  // @ts-expect-error not error
  vscode.postMessage({ type: 'ready' });
};
