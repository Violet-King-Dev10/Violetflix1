/**
 * Web stub for @react-native-community/netinfo
 */
const NetInfo = {
  addEventListener: (handler) => {
    const cb = () => handler({
      isConnected: navigator.onLine,
      isInternetReachable: navigator.onLine,
      type: navigator.onLine ? 'wifi' : 'none',
    });
    window.addEventListener('online', cb);
    window.addEventListener('offline', cb);
    return () => {
      window.removeEventListener('online', cb);
      window.removeEventListener('offline', cb);
    };
  },
  fetch: () => Promise.resolve({
    isConnected: navigator.onLine,
    isInternetReachable: navigator.onLine,
    type: navigator.onLine ? 'wifi' : 'none',
  }),
  useNetInfo: () => ({
    isConnected: navigator.onLine,
    isInternetReachable: navigator.onLine,
  }),
};

export default NetInfo;
module.exports = NetInfo;
