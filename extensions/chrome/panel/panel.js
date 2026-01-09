// Panel script for QemuWeb DevTools panel

const statusEl = document.getElementById('status');
const profileSelect = document.getElementById('profile');
const diskInput = document.getElementById('disk');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');

let isRunning = false;
let selectedDisk = null;

// Initialize
function init() {
  statusEl.textContent = 'Ready';
  statusEl.className = 'status';

  // Enable start button when profile and disk are selected
  profileSelect.addEventListener('change', updateButtons);
  diskInput.addEventListener('change', (e) => {
    selectedDisk = e.target.files[0] || null;
    updateButtons();
  });

  startBtn.addEventListener('click', startVM);
  stopBtn.addEventListener('click', stopVM);
}

function updateButtons() {
  const hasProfile = profileSelect.value !== '';
  const hasDisk = selectedDisk !== null;

  startBtn.disabled = isRunning || !hasProfile || !hasDisk;
  stopBtn.disabled = !isRunning;
}

async function startVM() {
  const profile = profileSelect.value;
  if (!profile || !selectedDisk) return;

  isRunning = true;
  statusEl.textContent = 'Starting...';
  statusEl.className = 'status';
  updateButtons();

  try {
    // Send message to background service worker
    const response = await chrome.runtime.sendMessage({
      type: 'START_VM',
      payload: {
        profile,
        diskName: selectedDisk.name,
        diskSize: selectedDisk.size,
      },
    });

    if (response.success) {
      statusEl.textContent = 'Running';
      statusEl.className = 'status running';
    } else {
      throw new Error(response.error || 'Failed to start VM');
    }
  } catch (error) {
    console.error('Failed to start VM:', error);
    statusEl.textContent = `Error: ${error.message}`;
    statusEl.className = 'status error';
    isRunning = false;
  }

  updateButtons();
}

async function stopVM() {
  try {
    await chrome.runtime.sendMessage({
      type: 'STOP_VM',
    });

    statusEl.textContent = 'Stopped';
    statusEl.className = 'status';
    isRunning = false;
  } catch (error) {
    console.error('Failed to stop VM:', error);
    statusEl.textContent = `Error: ${error.message}`;
    statusEl.className = 'status error';
  }

  updateButtons();
}

// Initialize on load
init();
