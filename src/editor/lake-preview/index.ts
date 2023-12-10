window.onload = function () {
  // @ts-ignore
  const { createOpenEditor } = window.Doc;
  // 创建编辑器
  const editor = createOpenEditor(document.getElementById('root'), {
    input: {},
    image: {
      isCaptureImageURL() {
        return false;
      },
    },
  });
  let ignoreChange = false;
  // 设置内容
  // editor.setDocument('text/lake', '<p><span style="color: rgb(255, 111, 4),rgb(243, 48, 171)">欢迎来到yuque编辑器</span></p>');
  // 监听内容变动
  editor.on('contentchange', () => {
    if(ignoreChange) {
      ignoreChange = false;
    };
    // @ts-expect-error not error
    vscode.postMessage({
      type: 'contentchange',
      data: editor.getDocument('text/lake'),
    });
    console.info('contentchange', editor.getDocument('text/lake'));
  });

  editor.on('save', () => {
    // @ts-expect-error not error
    vscode.postMessage({
      type: 'save',
      data: editor.getDocument('text/lake'),
    });
    console.info('save', editor.getDocument('text/lake'));
  });

  window.addEventListener('message', async e => {
    switch(e.data.type) {
      case 'undo': 
        editor.executeCommand('undo');
        // @ts-expect-error not error
        vscode.postMessage({ requestId: e.data.requestId, data: null });  
        break;
      case 'redo':
        editor.executeCommand('redo');
        // @ts-expect-error not error
        vscode.postMessage({ requestId: e.data.requestId, data: null });  
        break;
      case 'updateContent':
        console.info(e.data.data);
        ignoreChange = true;
        editor.setDocument('text/lake', new TextDecoder().decode(e.data.data));
        // @ts-expect-error not error
        vscode.postMessage({ requestId: e.data.requestId, data: null });  
        break;
      case 'getContent': 
        console.info('getContent', e.data);
        // @ts-expect-error not error
        vscode.postMessage({ requestId: e.data.requestId, data: new TextEncoder().encode(editor.getDocument('text/lake')) });  
        break;
    }
  });

  // @ts-expect-error not error
  vscode.postMessage({ type: 'ready' });
};
