const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy only the transcribe route to the backend with debug logging
  app.use(
    '/transcribe',
    createProxyMiddleware({
      target: 'http://127.0.0.1:5000',
      changeOrigin: true,
      logLevel: 'debug',
      onProxyReq(proxyReq, req, res) {
        // Log minimal info to help diagnose proxied requests
        console.debug('[proxy] forward', req.method, req.url, '->', proxyReq.getHeader('host'));
      },
    })
  );
};
