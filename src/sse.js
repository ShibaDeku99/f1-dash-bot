/**
 * Compatibility layer redirecting to direct F1 SignalR Client
 */
export {
  connectF1 as connectSSE,
  getConnectionStatus,
  connectF1,
} from './f1Client.js';
