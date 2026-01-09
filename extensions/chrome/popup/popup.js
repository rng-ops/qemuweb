document.getElementById('open-panel-btn').addEventListener('click', () => {
  // Open DevTools if not already open
  // Note: Extensions cannot programmatically open DevTools,
  // but we can provide instructions
  alert('Press F12 or Cmd+Opt+I to open DevTools, then click the "QEMU" panel tab.');
});

// Check VM status
async function checkStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    const statusEl = document.getElementById('status');

    if (response.running) {
      statusEl.textContent = `Running: ${response.profile}`;
      statusEl.className = 'status-value running';
    } else {
      statusEl.textContent = 'No VM running';
      statusEl.className = 'status-value';
    }
  } catch (error) {
    console.error('Failed to get status:', error);
  }
}

// Check status on popup open
checkStatus();
