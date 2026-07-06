/**
 * BizzDeal • Push Notification & FCM Test Center
 * Standalone Client Application Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- STATE ---
  const state = {
    apiUrl: localStorage.getItem('bizzdeal_fcm_api_url') || 'http://localhost:3000',
    jwtToken: localStorage.getItem('bizzdeal_fcm_jwt_token') || '',
    userProfile: null,
    devices: [],
    notifications: [],
    currentFilter: 'ALL',
    pollingInterval: null,
  };

  // --- DOM ELEMENTS ---
  const apiUrlInput = document.getElementById('apiUrl');
  const jwtTokenInput = document.getElementById('jwtToken');
  const toggleTokenBtn = document.getElementById('toggleTokenVisibility');
  const connectBtn = document.getElementById('connectBtn');
  const clearAuthBtn = document.getElementById('clearAuthBtn');
  
  const loginPhoneInput = document.getElementById('loginPhone');
  const loginPinInput = document.getElementById('loginPin');
  const phoneLoginBtn = document.getElementById('phoneLoginBtn');

  const apiStatusPill = document.getElementById('apiStatusPill');
  const apiStatusText = document.getElementById('apiStatusText');
  const authStatusPill = document.getElementById('authStatusPill');
  const authStatusText = document.getElementById('authStatusText');
  
  const userProfileCard = document.getElementById('userProfileCard');
  const displayUserId = document.getElementById('displayUserId');
  const displayUserRole = document.getElementById('displayUserRole');

  const deviceNameInput = document.getElementById('deviceName');
  const fcmTokenInput = document.getElementById('fcmToken');
  const generateTokenBtn = document.getElementById('generateTokenBtn');
  const pasteClipboardBtn = document.getElementById('pasteClipboardBtn');
  const registerDeviceBtn = document.getElementById('registerDeviceBtn');
  const refreshDevicesBtn = document.getElementById('refreshDevicesBtn');
  const devicesListEl = document.getElementById('devicesList');
  const deviceCountEl = document.getElementById('deviceCount');

  const targetUserIdInput = document.getElementById('targetUserId');
  const useMyIdBtn = document.getElementById('useMyIdBtn');
  const notificationTypeSelect = document.getElementById('notificationType');
  const notifTitleInput = document.getElementById('notifTitle');
  const notifMessageInput = document.getElementById('notifMessage');
  const notifDataInput = document.getElementById('notifData');
  const sendNotifBtn = document.getElementById('sendNotifBtn');

  const unreadBadgeEl = document.getElementById('unreadBadge');
  const refreshFeedBtn = document.getElementById('refreshFeedBtn');
  const notificationsListEl = document.getElementById('notificationsList');

  // --- INITIALIZATION ---
  apiUrlInput.value = state.apiUrl;
  jwtTokenInput.value = state.jwtToken;
  
  if (state.jwtToken) {
    verifyAndConnect();
  }

  // --- EVENT LISTENERS ---
  if (phoneLoginBtn) {
    phoneLoginBtn.addEventListener('click', async () => {
      const phone = loginPhoneInput.value.trim();
      const pin = loginPinInput.value.trim();
      state.apiUrl = apiUrlInput.value.trim().replace(/\/$/, '');
      localStorage.setItem('bizzdeal_fcm_api_url', state.apiUrl);

      if (!phone || !pin) {
        showToast('error', 'Validation Error', 'Please enter both phone number and PIN.');
        return;
      }

      phoneLoginBtn.disabled = true;
      phoneLoginBtn.innerHTML = '<span class="btn-icon">⏳</span> Logging in...';

      try {
        const response = await fetch(`${state.apiUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, pin }),
        });

        const data = await response.json();
        if (!response.ok) {
          const errorMsg = data?.message || data?.error || 'Login failed';
          throw new Error(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg);
        }

        state.jwtToken = data.accessToken || data.access_token;
        jwtTokenInput.value = state.jwtToken;
        localStorage.setItem('bizzdeal_fcm_jwt_token', state.jwtToken);

        showToast('success', 'Login Successful!', `Welcome back, ${data.user?.full_name || data.user?.phone || 'User'}!`);
        loginPinInput.value = ''; // Clear PIN for security
        verifyAndConnect();
      } catch (err) {
        showToast('error', 'Login Failed', err.message);
      } finally {
        phoneLoginBtn.disabled = false;
        phoneLoginBtn.innerHTML = '<span class="btn-icon">🚀</span> Login & Auto-Connect';
      }
    });
  }

  toggleTokenBtn.addEventListener('click', () => {
    if (jwtTokenInput.type === 'password') {
      jwtTokenInput.type = 'text';
      toggleTokenBtn.textContent = '🔒';
    } else {
      jwtTokenInput.type = 'password';
      toggleTokenBtn.textContent = '👁️';
    }
  });

  connectBtn.addEventListener('click', () => {
    state.apiUrl = apiUrlInput.value.trim().replace(/\/$/, '');
    state.jwtToken = jwtTokenInput.value.trim();
    localStorage.setItem('bizzdeal_fcm_api_url', state.apiUrl);
    localStorage.setItem('bizzdeal_fcm_jwt_token', state.jwtToken);
    verifyAndConnect();
  });

  clearAuthBtn.addEventListener('click', () => {
    state.jwtToken = '';
    state.userProfile = null;
    jwtTokenInput.value = '';
    localStorage.removeItem('bizzdeal_fcm_jwt_token');
    updateConnectionUI(false, false);
    userProfileCard.classList.add('hidden');
    clearInterval(state.pollingInterval);
    showToast('info', 'Logged Out', 'Authentication cleared.');
  });

  // Device Platform Radio Cards
  document.querySelectorAll('.platform-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.platform-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  generateTokenBtn.addEventListener('click', () => {
    const platform = document.querySelector('input[name="deviceType"]:checked')?.value || 'WEB';
    const randomHex = Math.random().toString(16).substring(2, 10) + Math.random().toString(16).substring(2, 10);
    const simToken = `fcm_sim_${platform.toLowerCase()}_${Date.now()}_${randomHex}`;
    fcmTokenInput.value = simToken;
    showToast('info', 'Token Generated', 'Simulated FCM registration token ready to register!');
  });

  pasteClipboardBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      fcmTokenInput.value = text;
      showToast('success', 'Pasted', 'Token pasted from clipboard.');
    } catch (err) {
      showToast('error', 'Paste Failed', 'Please paste manually into the textarea.');
    }
  });

  registerDeviceBtn.addEventListener('click', async () => {
    if (!state.jwtToken) {
      return showToast('error', 'Auth Required', 'Please connect with a JWT access token first.');
    }
    const fcm_token = fcmTokenInput.value.trim();
    if (!fcm_token) {
      return showToast('error', 'Validation Error', 'FCM Registration Token is required.');
    }
    const device_type = document.querySelector('input[name="deviceType"]:checked')?.value || 'WEB';
    const device_name = deviceNameInput.value.trim() || `${device_type} Simulator`;

    try {
      registerDeviceBtn.disabled = true;
      registerDeviceBtn.innerHTML = '<span class="btn-icon">⏳</span> Registering...';
      
      const res = await apiFetch('/notifications/devices', 'POST', {
        fcm_token,
        device_type,
        device_name
      });

      showToast('success', 'Device Registered!', `Successfully registered ${device_name} for push alerts.`);
      fetchDevices();
    } catch (err) {
      showToast('error', 'Registration Failed', err.message);
    } finally {
      registerDeviceBtn.disabled = false;
      registerDeviceBtn.innerHTML = '<span class="btn-icon">📲</span> Register Push Device';
    }
  });

  refreshDevicesBtn.addEventListener('click', fetchDevices);

  useMyIdBtn.addEventListener('click', () => {
    if (state.userProfile && state.userProfile.id) {
      targetUserIdInput.value = state.userProfile.id;
      showToast('info', 'Target Set', 'Set target recipient to your logged-in UUID.');
    } else {
      showToast('error', 'No User', 'User profile not loaded. Connect first.');
    }
  });

  // Preset Chips
  document.querySelectorAll('.chip[data-preset]').forEach(chip => {
    chip.addEventListener('click', () => {
      const preset = chip.getAttribute('data-preset');
      switch (preset) {
        case 'offer':
          notificationTypeSelect.value = 'OFFER';
          notifTitleInput.value = '🎁 50% Flash Sale Offer!';
          notifMessageInput.value = 'Hurry up! Use code FLASH50 to get 50% off on premium BizzDeal services today.';
          notifDataInput.value = JSON.stringify({ offer_id: '89a01234-b56c-78d9-e012-345678901234', discount: 50, code: 'FLASH50' }, null, 2);
          break;
        case 'wallet':
          notificationTypeSelect.value = 'WALLET';
          notifTitleInput.value = '💰 ₹1,000 Cashback Credited!';
          notifMessageInput.value = 'Your BizzDeal wallet has been credited with ₹1,000 reward bonus.';
          notifDataInput.value = JSON.stringify({ transaction_id: 'trans_9988776655', amount: 1000, type: 'CREDIT' }, null, 2);
          break;
        case 'meeting':
          notificationTypeSelect.value = 'MEETING';
          notifTitleInput.value = '📅 New Meeting Scheduled';
          notifMessageInput.value = 'You have been invited to a business negotiation meeting with TechStore on Friday at 3:00 PM.';
          notifDataInput.value = JSON.stringify({ meeting_id: 'meet_5544332211', date: '2026-07-10T15:00:00Z', link: 'https://meet.bizzdeal.com/demo' }, null, 2);
          break;
        case 'chat':
          notificationTypeSelect.value = 'CHAT';
          notifTitleInput.value = '💬 New Message from Rahul';
          notifMessageInput.value = 'Hey! Did you check out the latest bulk discount proposal I sent over?';
          notifDataInput.value = JSON.stringify({ sender_id: 'user_rahul_uuid', room_id: 'room_123', unread_count: 1 }, null, 2);
          break;
        case 'voucher':
          notificationTypeSelect.value = 'VOUCHER';
          notifTitleInput.value = '🎫 Voucher Redeemed Successfully';
          notifMessageInput.value = 'Your discount voucher BIZZ200 was successfully redeemed at checkout.';
          notifDataInput.value = JSON.stringify({ voucher_id: 'vouch_112233', status: 'REDEEMED', saving: 200 }, null, 2);
          break;
      }
      showToast('info', 'Preset Loaded', `Loaded preset for ${preset.toUpperCase()}`);
    });
  });

  sendNotifBtn.addEventListener('click', async () => {
    if (!state.jwtToken) {
      return showToast('error', 'Auth Required', 'Please connect with a JWT access token first.');
    }
    const user_id = targetUserIdInput.value.trim() || (state.userProfile?.id);
    if (!user_id) {
      return showToast('error', 'Validation Error', 'Target Recipient UUID is required.');
    }
    const title = notifTitleInput.value.trim();
    const message = notifMessageInput.value.trim();
    if (!title || !message) {
      return showToast('error', 'Validation Error', 'Title and Message are required.');
    }
    const type = notificationTypeSelect.value;
    
    let data = null;
    const rawData = notifDataInput.value.trim();
    if (rawData) {
      try {
        data = JSON.parse(rawData);
      } catch (e) {
        return showToast('error', 'JSON Error', 'Custom Metadata Payload must be valid JSON.');
      }
    }

    try {
      sendNotifBtn.disabled = true;
      sendNotifBtn.innerHTML = '<span class="btn-icon">🚀</span> Dispatching FCM Push...';

      const res = await apiFetch('/notifications', 'POST', {
        user_id,
        title,
        message,
        type,
        data
      });

      showToast('success', 'Push Dispatched!', 'Notification saved and FCM multicast broadcast initiated.');
      fetchNotifications();
    } catch (err) {
      showToast('error', 'Dispatch Failed', err.message);
    } finally {
      sendNotifBtn.disabled = false;
      sendNotifBtn.innerHTML = '<span class="btn-icon">🚀</span> Dispatch FCM Push Alert';
    }
  });

  refreshFeedBtn.addEventListener('click', fetchNotifications);

  document.querySelectorAll('.tab-btn[data-filter]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentFilter = tab.getAttribute('data-filter');
      renderNotifications();
    });
  });

  // --- API HELPER ---
  async function apiFetch(endpoint, method = 'GET', body = null) {
    const url = `${state.apiUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
    };
    if (state.jwtToken) {
      headers['Authorization'] = `Bearer ${state.jwtToken}`;
    }

    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg);
    }
    return data;
  }

  // --- CORE FUNCTIONS ---
  async function verifyAndConnect() {
    try {
      connectBtn.disabled = true;
      connectBtn.textContent = 'Connecting...';
      
      // Try fetching notifications to verify token & get connection status
      const notifs = await apiFetch('/notifications');
      
      // Try to get profile or extract user ID from first notification / JWT payload
      let userId = 'Authenticated User';
      let userRole = 'MEMBER';
      
      // Decode JWT token for UUID and Role display
      try {
        const payloadParts = state.jwtToken.split('.');
        if (payloadParts.length === 3) {
          const decoded = JSON.parse(atob(payloadParts[1]));
          if (decoded.sub || decoded.id || decoded.user_id) {
            userId = decoded.sub || decoded.id || decoded.user_id;
          }
          if (decoded.role) {
            userRole = decoded.role;
          }
        }
      } catch (e) {
        // Fallback if JWT decode fails
      }

      state.userProfile = { id: userId, role: userRole };
      displayUserId.textContent = `UUID: ${userId}`;
      displayUserRole.textContent = userRole;
      userProfileCard.classList.remove('hidden');
      if (!targetUserIdInput.value) {
        targetUserIdInput.value = userId;
      }

      updateConnectionUI(true, true);
      showToast('success', 'Connected & Authenticated', `Ready to test push notifications for ${userId}`);

      // Initial data fetch
      fetchDevices();
      fetchNotifications();

      // Start background polling for real-time notification feed
      clearInterval(state.pollingInterval);
      state.pollingInterval = setInterval(fetchNotificationsQuiet, 5000);

    } catch (err) {
      updateConnectionUI(true, false);
      showToast('error', 'Authentication Failed', err.message);
      userProfileCard.classList.add('hidden');
    } finally {
      connectBtn.disabled = false;
      connectBtn.innerHTML = '<span class="btn-icon">⚡</span> Connect & Verify';
    }
  }

  function updateConnectionUI(apiOk, authOk) {
    if (apiOk) {
      apiStatusPill.classList.add('connected');
      apiStatusText.textContent = 'API: Connected';
    } else {
      apiStatusPill.classList.remove('connected');
      apiStatusText.textContent = 'API: Disconnected';
    }

    if (authOk) {
      authStatusPill.classList.add('authenticated');
      authStatusText.textContent = 'Auth: Verified';
    } else {
      authStatusPill.classList.remove('authenticated');
      authStatusText.textContent = 'Auth: Guest';
    }
  }

  async function fetchDevices() {
    if (!state.jwtToken) return;
    try {
      const devices = await apiFetch('/notifications/devices');
      state.devices = devices || [];
      renderDevices();
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    }
  }

  function renderDevices() {
    deviceCountEl.textContent = state.devices.length;
    if (state.devices.length === 0) {
      devicesListEl.innerHTML = '<div class="empty-state">No devices registered yet. Register a token above!</div>';
      return;
    }

    devicesListEl.innerHTML = state.devices.map(d => {
      const platformIcon = d.device_type === 'IOS' ? '🍎' : (d.device_type === 'ANDROID' ? '🤖' : '🌐');
      const timeAgo = formatTimeAgo(new Date(d.last_used_at || d.created_at));
      return `
        <div class="device-item">
          <div class="device-info">
            <div class="device-title">
              <span>${platformIcon}</span>
              <span>${d.device_name || d.device_type}</span>
              <span class="badge badge-success" style="font-size: 9px; padding: 2px 6px;">Active</span>
            </div>
            <div class="device-token-snippet" title="${d.fcm_token}">${d.fcm_token}</div>
            <small style="font-size: 10px; color: var(--text-dim);">Last active: ${timeAgo}</small>
          </div>
          <button class="icon-btn-small" onclick="copyToken('${d.fcm_token}')" title="Copy Token">📋</button>
        </div>
      `;
    }).join('');
  }

  async function fetchNotifications() {
    if (!state.jwtToken) return;
    try {
      const notifs = await apiFetch('/notifications');
      state.notifications = notifs || [];
      renderNotifications();
      updateUnreadBadge();
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }

  async function fetchNotificationsQuiet() {
    if (!state.jwtToken) return;
    try {
      const notifs = await apiFetch('/notifications');
      if (JSON.stringify(notifs) !== JSON.stringify(state.notifications)) {
        state.notifications = notifs || [];
        renderNotifications();
        updateUnreadBadge();
      }
    } catch (err) {}
  }

  function updateUnreadBadge() {
    const unreadCount = state.notifications.filter(n => !n.is_read).length;
    unreadBadgeEl.textContent = `${unreadCount} Unread`;
    if (unreadCount > 0) {
      unreadBadgeEl.style.display = 'inline-block';
    } else {
      unreadBadgeEl.style.display = 'none';
    }
  }

  function renderNotifications() {
    let filtered = state.notifications;
    if (state.currentFilter === 'UNREAD') {
      filtered = filtered.filter(n => !n.is_read);
    } else if (state.currentFilter !== 'ALL') {
      filtered = filtered.filter(n => n.type === state.currentFilter);
    }

    if (filtered.length === 0) {
      notificationsListEl.innerHTML = `
        <div class="empty-state-container">
          <div class="empty-icon">🔔</div>
          <h3>No Notifications Found</h3>
          <p>No notifications match the selected filter "${state.currentFilter}".</p>
        </div>
      `;
      return;
    }

    notificationsListEl.innerHTML = filtered.map(n => {
      const typeBadge = getTypeBadge(n.type);
      const timeAgo = formatTimeAgo(new Date(n.created_at));
      const isUnread = !n.is_read;
      const dataStr = n.data ? JSON.stringify(n.data, null, 2) : null;

      return `
        <div class="notif-card ${isUnread ? 'unread' : ''}" id="notif-${n.id}">
          <div class="notif-header">
            ${typeBadge}
            <span class="notif-time">${timeAgo}</span>
          </div>
          <div class="notif-body">
            <h4>${escapeHtml(n.title)}</h4>
            <p>${escapeHtml(n.message)}</p>
            ${dataStr ? `<div class="notif-data-box">${escapeHtml(dataStr)}</div>` : ''}
          </div>
          <div class="notif-actions">
            ${isUnread ? `
              <button class="btn btn-xs btn-outline" onclick="markNotificationRead('${n.id}')">
                ✔️ Mark as Read
              </button>
            ` : `
              <span style="font-size: 11px; color: var(--text-dim); display: flex; align-items: center; gap: 4px;">
                ✔️ Read
              </span>
            `}
            <button class="btn btn-xs btn-outline" style="border-color: rgba(239, 68, 68, 0.4); color: #f87171;" onclick="deleteNotification('${n.id}')" title="Delete Notification">
              🗑️ Delete
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- GLOBAL HELPERS (for inline onClick) ---
  window.copyToken = async (token) => {
    try {
      await navigator.clipboard.writeText(token);
      showToast('success', 'Copied!', 'FCM token copied to clipboard.');
    } catch (err) {
      showToast('error', 'Copy Failed', 'Could not copy to clipboard.');
    }
  };

  window.markNotificationRead = async (id) => {
    try {
      await apiFetch(`/notifications/${id}/read`, 'PUT');
      const notif = state.notifications.find(n => n.id === id);
      if (notif) notif.is_read = true;
      renderNotifications();
      updateUnreadBadge();
      showToast('success', 'Read', 'Notification marked as read.');
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  };

  window.deleteNotification = async (id) => {
    if (!confirm('Are you sure you want to delete this notification?')) return;
    try {
      await apiFetch(`/notifications/${id}`, 'DELETE');
      state.notifications = state.notifications.filter(n => n.id !== id);
      renderNotifications();
      updateUnreadBadge();
      showToast('success', 'Deleted', 'Notification deleted successfully.');
    } catch (err) {
      showToast('error', 'Error', err.message);
    }
  };

  function getTypeBadge(type) {
    const map = {
      OFFER: { color: '#ec4899', bg: 'rgba(236, 72, 153, 0.2)', icon: '🎁' },
      VOUCHER: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)', icon: '🎫' },
      WALLET: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.2)', icon: '💰' },
      MEETING: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)', icon: '📅' },
      CHAT: { color: '#8a5cf6', bg: 'rgba(138, 92, 246, 0.2)', icon: '💬' },
      GENERAL: { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.2)', icon: '📢' },
    };
    const style = map[type] || map.GENERAL;
    return `<span class="notif-type-badge" style="color: ${style.color}; background: ${style.bg};">${style.icon} ${type}</span>`;
  }

  function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function showToast(type, title, message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <div class="toast-content">
        <span class="toast-title">${title}</span>
        <span class="toast-msg">${message}</span>
      </div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
});
