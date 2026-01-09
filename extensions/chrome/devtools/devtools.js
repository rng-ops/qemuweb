// Create a new DevTools panel for QemuWeb
chrome.devtools.panels.create(
  'QEMU',
  '/icons/icon48.png',
  '/panel/panel.html',
  (panel) => {
    console.log('QemuWeb DevTools panel created');

    panel.onShown.addListener((window) => {
      // Panel is shown
      console.log('Panel shown');
    });

    panel.onHidden.addListener(() => {
      // Panel is hidden
      console.log('Panel hidden');
    });
  }
);
