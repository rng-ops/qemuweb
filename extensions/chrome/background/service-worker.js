// QemuWeb Background Service Worker

let vmState = {
  running: false,
  profile: null,
  startTime: null,
};

// Handle messages from popup and panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_STATUS':
      sendResponse({
        running: vmState.running,
        profile: vmState.profile,
        startTime: vmState.startTime,
      });
      break;

    case 'START_VM':
      handleStartVM(message.payload)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true; // Indicates async response

    case 'STOP_VM':
      handleStopVM()
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

async function handleStartVM(payload) {
  console.log('Starting VM with profile:', payload.profile);

  // TODO: Initialize QEMU worker and load disk image
  // For now, just update state
  vmState = {
    running: true,
    profile: payload.profile,
    startTime: Date.now(),
  };

  // In a real implementation, we would:
  // 1. Create an offscreen document for QEMU worker
  // 2. Load the disk image into IndexedDB
  // 3. Start the QEMU emulation
  // 4. Set up serial I/O channels

  console.log('VM started successfully');
}

async function handleStopVM() {
  console.log('Stopping VM');

  // TODO: Stop QEMU worker
  vmState = {
    running: false,
    profile: null,
    startTime: null,
  };

  console.log('VM stopped');
}

// Log when service worker starts
console.log('QemuWeb service worker initialized');
