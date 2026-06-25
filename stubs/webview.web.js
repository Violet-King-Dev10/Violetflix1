/**
 * Web stub for react-native-webview
 * On web we use a native iframe instead
 */
import React from 'react';

const WebView = React.forwardRef(function WebView(props, ref) {
  const {
    source, style, onLoadEnd, onLoadStart, onError,
    onMessage, injectedJavaScript, allowsFullscreenVideo,
    javaScriptEnabled, onShouldStartLoadWithRequest,
    startInLoadingState, renderLoading,
    ...rest
  } = props;

  const uri = source?.uri || '';

  return React.createElement('iframe', {
    ref,
    src: uri,
    style: {
      width: '100%',
      height: '100%',
      border: 'none',
      backgroundColor: '#000',
      ...(Array.isArray(style) ? Object.assign({}, ...style) : style),
    },
    allow: 'autoplay; fullscreen; encrypted-media; picture-in-picture',
    allowFullScreen: true,
    onLoad: onLoadEnd,
    onError: onError,
  });
});

WebView.displayName = 'WebView';
export { WebView };
export default WebView;
