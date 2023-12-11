import type MessageClient from "../common/message-client";

declare global {
  interface Window {
    message: MessageClient;
  }
}
