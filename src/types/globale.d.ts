import type MessageClient from "../common/message-client";


interface ToolbarOptionHelper {
  start(): {
    insertBefore(items: any[], item: any): this;
  };
}

declare global {
  interface Window {
    message: MessageClient;
    Doc: {
      createOpenEditor: (container: HTMLElement, options: any) => any;
      createOpenViewer: (container: HTMLElement, options: any) => any;
      ToolbarOptionHelper: ToolbarOptionHelper;
      Plugins: {
        Toolbar: {
          ToolbarUIDescriptor: any;
        };
      };
    };
  }
}
