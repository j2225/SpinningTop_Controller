const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const CHARACTERISTIC_UUID_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

let bluetoothDevice = null;
let txCharacteristic = null;
let currentCommand = 0; // 0: Stop, 1: Forward, 2: Backward

// UI Elements
const connectBtn = document.getElementById('connectBtn');
const connectBtnText = connectBtn.querySelector('.text');
const statusOverlay = document.getElementById('statusOverlay');
const statusText = document.getElementById('statusText');
const actionBtns = document.querySelectorAll('.action-btn');

// --- BLE Connection Logic ---

async function connectBLE() {
    try {
        showStatus('Searching for device...');
        
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: [SERVICE_UUID] }]
        });
        
        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);
        
        showStatus('Connecting to GATT Server...');
        const server = await bluetoothDevice.gatt.connect();
        
        showStatus('Getting Service...');
        const service = await server.getPrimaryService(SERVICE_UUID);
        
        showStatus('Getting Characteristic...');
        txCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID_RX);
        
        hideStatus();
        updateUIConnected(true);
        console.log('BLE Connected');
        
    } catch (error) {
        console.error('BLE Connection Error:', error);
        hideStatus();
        alert('Connection failed: ' + error);
    }
}

function onDisconnected() {
    console.log('BLE Disconnected');
    updateUIConnected(false);
    txCharacteristic = null;
    bluetoothDevice = null;
}

async function disconnectBLE() {
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
        bluetoothDevice.gatt.disconnect();
    }
}

function updateUIConnected(isConnected) {
    if (isConnected) {
        connectBtn.classList.add('connected');
        connectBtnText.textContent = 'Disconnect';
    } else {
        connectBtn.classList.remove('connected');
        connectBtnText.textContent = 'Connect';
    }
}

connectBtn.addEventListener('click', () => {
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
        disconnectBLE();
    } else {
        connectBLE();
    }
});

// --- UI Overlay Utilities ---
function showStatus(msg) {
    statusText.textContent = msg;
    statusOverlay.classList.remove('hidden');
}
function hideStatus() {
    statusOverlay.classList.add('hidden');
}


// --- Control Logic ---

async function sendCommand(val) {
    // Only send if command changed, to prevent spamming 0 on mouseleave/mouseup combos
    if (val === currentCommand && val === 0) {
        return; 
    }
    
    currentCommand = val;
    console.log('Sending command:', val);
    
    if (!txCharacteristic) {
        console.warn('BLE not connected. Mock sending:', val);
        return;
    }
    
    try {
        // マイコン側が文字（'0', '1', '2'）として判定しているため、文字列に変換してUTF-8として送信
        const encoder = new TextEncoder();
        const data = encoder.encode(val.toString());
        await txCharacteristic.writeValue(data);
    } catch (error) {
        console.error('Send Error:', error);
    }
}

function handlePress(btn, val) {
    btn.classList.add('active');
    sendCommand(val);
}

function handleRelease(btn) {
    btn.classList.remove('active');
    sendCommand(0); // Send stop command
}

// --- Event Listeners (Chattering & Duplicate Prevention) ---

actionBtns.forEach(btn => {
    const val = parseInt(btn.getAttribute('data-val'), 10);
    
    // Touch Events
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevents simulated mousedown
        handlePress(btn, val);
    }, { passive: false });
    
    btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        handleRelease(btn);
    }, { passive: false });
    
    btn.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        handleRelease(btn);
    }, { passive: false });

    // Mouse Events
    btn.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only left click
        handlePress(btn, val);
    });
    
    btn.addEventListener('mouseup', () => {
        handleRelease(btn);
    });
    
    btn.addEventListener('mouseleave', () => {
        // Only release if it was currently active
        if (btn.classList.contains('active')) {
            handleRelease(btn);
        }
    });
});
