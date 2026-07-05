/* ==========================================================================
   BIZZDEAL LIVE CHAT – JAVASCRIPT APPLICATION LOGIC
   ========================================================================== */

class BizzDealChatClient {
  constructor() {
    this.apiBaseUrl = 'http://localhost:3000/bizzdeal/api';
    this.token = null;
    this.currentUser = null;
    this.socket = null;
    
    this.conversations = [];
    this.activeConversation = null;
    this.messages = [];
    this.usersMap = new Map();
    this.onlineUsersSet = new Set();
    
    this.typingTimeout = null;
    this.isTyping = false;
    
    this.initDOM();
    this.initEventListeners();
    this.initAudio();
  }

  initDOM() {
    // Modals & Auth
    this.authModal = document.getElementById('auth-modal');
    this.newConvModal = document.getElementById('new-conv-modal');
    this.formLogin = document.getElementById('form-login');
    this.formToken = document.getElementById('form-token');
    this.authError = document.getElementById('auth-error');
    this.usersListContainer = document.getElementById('users-list-container');
    this.searchUsersInput = document.getElementById('search-users-input');
    
    // Sidebar
    this.mainApp = document.getElementById('main-app');
    this.currentUserAvatar = document.getElementById('current-user-avatar');
    this.currentUserName = document.getElementById('current-user-name');
    this.myStatusDot = document.getElementById('my-status-dot');
    this.socketStatusText = document.getElementById('socket-status-text');
    this.conversationsList = document.getElementById('conversations-list');
    this.searchConvs = document.getElementById('search-convs');
    
    // Chat Room
    this.noChatSelected = document.getElementById('no-chat-selected');
    this.activeChatRoom = document.getElementById('active-chat-room');
    this.partnerAvatar = document.getElementById('partner-avatar');
    this.partnerName = document.getElementById('partner-name');
    this.partnerStatusDot = document.getElementById('partner-status-dot');
    this.partnerStatusText = document.getElementById('partner-status-text');
    this.partnerTypingIndicator = document.getElementById('partner-typing-indicator');
    this.messagesContainer = document.getElementById('messages-container');
    
    // Form
    this.formSendMessage = document.getElementById('form-send-message');
    this.messageInput = document.getElementById('message-input');
    this.msgTypeSelect = document.getElementById('msg-type');
  }

  initEventListeners() {
    // Auth Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.tab === 'tab-login' ? 'form-login' : 'form-token').classList.add('active');
        this.hideError();
      });
    });

    // Login Form Submit
    this.formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = document.getElementById('login-phone').value.trim();
      const pin = document.getElementById('login-pin').value.trim();
      this.apiBaseUrl = document.getElementById('api-base-url-1').value.trim().replace(/\/$/, '');
      
      await this.loginWithPhoneAndPin(phone, pin);
    });

    // Token Form Submit
    this.formToken.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = document.getElementById('jwt-token').value.trim();
      const userId = document.getElementById('user-id-input').value.trim();
      this.apiBaseUrl = document.getElementById('api-base-url-2').value.trim().replace(/\/$/, '');
      
      if (!token) {
        return this.showError('Please provide a valid JWT access token.');
      }
      
      this.token = token;
      this.currentUser = { id: userId || 'custom-user-id', phone: 'Token User', full_name: 'Authenticated User' };
      this.onAuthSuccess();
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
      this.logout();
    });

    // New Conversation Modal
    document.getElementById('btn-new-conv').addEventListener('click', () => {
      this.newConvModal.classList.add('active');
      this.loadAllUsersForChat();
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        this.newConvModal.classList.remove('active');
      });
    });

    // Search Users in Modal
    this.searchUsersInput?.addEventListener('input', (e) => {
      this.renderUsersList(e.target.value.toLowerCase());
    });

    // Search Conversations
    this.searchConvs.addEventListener('input', (e) => {
      this.renderConversations(e.target.value.toLowerCase());
    });

    // Send Message
    this.formSendMessage.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.sendMessage();
    });

    // Typing Indicators
    this.messageInput.addEventListener('input', () => {
      this.handleTypingEvent();
    });

    // Mark as Read Button
    document.getElementById('btn-mark-read').addEventListener('click', async () => {
      if (this.activeConversation) {
        await this.markConversationAsRead(this.activeConversation.id);
      }
    });

    // Refresh Messages Button
    document.getElementById('btn-refresh-msgs').addEventListener('click', async () => {
      if (this.activeConversation) {
        await this.loadMessages(this.activeConversation.id);
      }
    });
  }

  initAudio() {
    // Generate a sleek synth beep using Web Audio API for incoming message alerts
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  playNotificationSound() {
    try {
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, this.audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, this.audioCtx.currentTime + 0.15); // A5
      
      gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.25);
      
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.25);
    } catch (e) {
      console.warn('Audio play blocked or unavailable:', e);
    }
  }

  showError(msg) {
    this.authError.textContent = msg;
    this.authError.classList.remove('hidden');
  }

  hideError() {
    this.authError.classList.add('hidden');
  }

  /* ==========================================================================
     REST API & AUTHENTICATION
     ========================================================================== */
  async loginWithPhoneAndPin(phone, pin) {
    try {
      this.hideError();
      const res = await fetch(`${this.apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login failed. Check phone and PIN.');
      }

      this.token = data.accessToken || data.access_token || data.token;
      this.currentUser = data.user || data.member || { id: 'user-' + Date.now(), phone, full_name: phone };
      
      if (!this.token) {
        throw new Error('No access token returned from server.');
      }

      this.onAuthSuccess();
    } catch (err) {
      this.showError(err.message);
    }
  }

  async onAuthSuccess() {
    this.authModal.classList.remove('active');
    this.mainApp.classList.remove('hidden');
    
    // Update User Profile UI
    const name = this.currentUser.full_name || this.currentUser.phone || 'User';
    this.currentUserName.textContent = name;
    this.currentUserAvatar.textContent = name.charAt(0).toUpperCase();
    
    // Connect WebSockets
    this.connectSocket();
    
    // Fetch All Users for Name Lookup
    await this.loadAllUsers();

    // Fetch Conversations
    await this.loadConversations();
  }

  async loadAllUsers() {
    try {
      const res = await this.fetchWithAuth('/users');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        this.allUsers = data;
        this.usersMap = new Map();
        data.forEach(u => {
          this.usersMap.set(u.id, u);
        });
      }
    } catch (err) {
      console.error('Error loading users for lookup:', err);
    }
  }

  getPartnerName(partnerId) {
    if (this.usersMap && this.usersMap.has(partnerId)) {
      const u = this.usersMap.get(partnerId);
      return u.full_name || u.phone || 'User';
    }
    return 'User (' + partnerId.slice(0, 6) + '...)';
  }

  updatePartnerPresenceUI(partnerId) {
    if (!partnerId && this.activeConversation) {
      partnerId = this.getPartnerId(this.activeConversation);
    }
    if (!partnerId || !this.activeConversation) return;

    const currentPartnerId = this.getPartnerId(this.activeConversation);
    if (partnerId !== currentPartnerId) return;

    if (this.onlineUsersSet && this.onlineUsersSet.has(partnerId)) {
      this.partnerStatusDot.className = 'status-dot online';
      this.partnerStatusText.textContent = 'Online';
      this.partnerStatusText.style.color = 'var(--success)';
    } else {
      this.partnerStatusDot.className = 'status-dot offline';
      this.partnerStatusText.textContent = 'Offline';
      this.partnerStatusText.style.color = 'var(--text-muted)';
    }
  }

  logout() {
    if (this.socket) {
      this.socket.disconnect();
    }
    this.token = null;
    this.currentUser = null;
    this.activeConversation = null;
    this.conversations = [];
    this.messages = [];
    
    this.mainApp.classList.add('hidden');
    this.authModal.classList.add('active');
  }

  async fetchWithAuth(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
      ...(options.headers || {})
    };

    const res = await fetch(`${this.apiBaseUrl}${endpoint}`, {
      ...options,
      headers
    });

    if (res.status === 401) {
      alert('Session expired or unauthorized. Please login again.');
      this.logout();
      throw new Error('Unauthorized');
    }

    return res;
  }

  /* ==========================================================================
     CONVERSATIONS & MESSAGES REST API
     ========================================================================== */
  async loadConversations() {
    try {
      const res = await this.fetchWithAuth('/chat/conversations');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        this.conversations = data;
        this.renderConversations();
      } else {
        console.warn('Failed to load conversations or not an array:', data);
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    }
  }

  async createConversation(targetUserId) {
    try {
      const res = await this.fetchWithAuth('/chat/conversations', {
        method: 'POST',
        body: JSON.stringify({ target_user_id: targetUserId })
      });
      const conv = await res.json();
      if (res.ok && conv.id) {
        await this.loadConversations();
        this.selectConversation(conv);
      } else {
        alert(conv.message || 'Failed to start conversation.');
      }
    } catch (err) {
      console.error('Error creating conversation:', err);
    }
  }

  async loadAllUsersForChat() {
    try {
      if (!this.usersListContainer) return;
      this.usersListContainer.innerHTML = `
        <div class="empty-state">
          <i class="ri-loader-4-line ri-spin"></i>
          <p>Loading platform users...</p>
        </div>
      `;
      const res = await this.fetchWithAuth('/users');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        if (!this.usersMap) this.usersMap = new Map();
        data.forEach(u => {
          this.usersMap.set(u.id, u);
        });
        // Filter out current user
        this.allUsers = data.filter(u => u.id !== this.currentUser.id);
        this.renderUsersList();
      } else {
        this.usersListContainer.innerHTML = `
          <div class="empty-state">
            <i class="ri-error-warning-line"></i>
            <p>Failed to load users.</p>
          </div>
        `;
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  }

  renderUsersList(filterText = '') {
    if (!this.usersListContainer) return;
    this.usersListContainer.innerHTML = '';
    
    const filtered = (this.allUsers || []).filter(u => {
      const name = (u.full_name || u.phone || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      return name.includes(filterText) || phone.includes(filterText) || role.includes(filterText) || u.id.toLowerCase().includes(filterText);
    });

    if (filtered.length === 0) {
      this.usersListContainer.innerHTML = `
        <div class="empty-state">
          <i class="ri-user-unfollow-line"></i>
          <p>No other users found.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(user => {
      const name = user.full_name || user.phone || 'User';
      const role = user.role || 'MEMBER';
      const initial = name.charAt(0).toUpperCase();

      const el = document.createElement('div');
      el.className = 'user-select-item';
      el.innerHTML = `
        <div class="user-select-info">
          <div class="avatar">${initial}</div>
          <div>
            <h4>${name}</h4>
            <p><i class="ri-phone-line"></i> ${user.phone || 'No phone'} &bull; <span class="role-badge">${role}</span></p>
          </div>
        </div>
        <button type="button" class="btn-start-chat">
          <span>Chat</span>
          <i class="ri-chat-1-line"></i>
        </button>
      `;

      el.addEventListener('click', async () => {
        this.newConvModal.classList.remove('active');
        await this.createConversation(user.id);
      });

      this.usersListContainer.appendChild(el);
    });
  }

  async loadMessages(conversationId) {
    try {
      const res = await this.fetchWithAuth(`/chat/conversations/${conversationId}/messages`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        this.messages = data;
        this.renderMessages();
        this.scrollToBottom();
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  }

  async markConversationAsRead(conversationId) {
    try {
      // Hit REST fallback API
      await this.fetchWithAuth(`/chat/conversations/${conversationId}/read`, {
        method: 'PUT'
      });
      
      // Also emit WebSocket mark_as_read
      if (this.socket && this.socket.connected) {
        this.socket.emit('mark_as_read', { conversation_id: conversationId });
      }

      // Update local unread count badge
      const conv = this.conversations.find(c => c.id === conversationId);
      if (conv) {
        conv.unread_count = 0;
        this.renderConversations(this.searchConvs.value.toLowerCase());
      }
    } catch (err) {
      console.error('Error marking read:', err);
    }
  }

  /* ==========================================================================
     SOCKET.IO REAL-TIME WEBSOCKET INTEGRATION
     ========================================================================== */
  connectSocket() {
    if (this.socket) {
      this.socket.disconnect();
    }

    // Connect to /chat namespace with JWT Bearer Token using server origin
    const origin = new URL(this.apiBaseUrl).origin;
    this.socket = io(`${origin}/chat`, {
      auth: { token: this.token },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to WebSocket /chat namespace:', this.socket.id);
      this.socketStatusText.innerHTML = '<i class="ri-pulse-line"></i> Connected';
      this.socketStatusText.style.color = 'var(--success)';
      this.myStatusDot.className = 'status-dot online';
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('⚠️ Disconnected from WebSocket:', reason);
      this.socketStatusText.innerHTML = '<i class="ri-error-warning-line"></i> Offline';
      this.socketStatusText.style.color = 'var(--danger)';
      this.myStatusDot.className = 'status-dot offline';
    });

    this.socket.on('connect_error', (err) => {
      console.error('❌ Socket Connection Error:', err.message);
      this.socketStatusText.innerHTML = '<i class="ri-error-warning-line"></i> Auth Error';
      this.socketStatusText.style.color = 'var(--warning)';
    });

    // Presence Events
    this.socket.on('online_users_list', (data) => {
      console.log('🟢 Online users list received:', data.user_ids);
      if (Array.isArray(data.user_ids)) {
        this.onlineUsersSet = new Set(data.user_ids);
        this.updatePartnerPresenceUI();
      }
    });

    this.socket.on('user_online', (data) => {
      console.log('🟢 User came online:', data.user_id);
      if (!this.onlineUsersSet) this.onlineUsersSet = new Set();
      this.onlineUsersSet.add(data.user_id);
      this.updatePartnerPresenceUI(data.user_id);
    });

    this.socket.on('user_offline', (data) => {
      console.log('⚪ User went offline:', data.user_id);
      if (this.onlineUsersSet) this.onlineUsersSet.delete(data.user_id);
      this.updatePartnerPresenceUI(data.user_id);
    });

    // Real-time Incoming Message
    this.socket.on('receive_message', (msg) => {
      console.log('💬 Received message via Socket:', msg);
      this.playNotificationSound();

      if (!this.onlineUsersSet) this.onlineUsersSet = new Set();
      this.onlineUsersSet.add(msg.sender_id);
      this.updatePartnerPresenceUI(msg.sender_id);

      // If this message belongs to the currently active conversation
      if (this.activeConversation && msg.conversation_id === this.activeConversation.id) {
        this.messages.push(msg);
        this.appendMessageBubble(msg);
        this.scrollToBottom();

        // Automatically emit message_delivered back to server (Double Tick!)
        this.socket.emit('message_delivered', {
          conversation_id: msg.conversation_id,
          message_id: msg.id
        });

        // If window is active, mark as read immediately
        if (!document.hidden) {
          this.markConversationAsRead(msg.conversation_id);
        }
      } else {
        // Increment unread count badge in sidebar
        const conv = this.conversations.find(c => c.id === msg.conversation_id);
        if (conv) {
          conv.unread_count = (conv.unread_count || 0) + 1;
          conv.last_message_at = new Date();
        } else {
          // New conversation created dynamically! reload list
          this.loadConversations();
        }
        this.renderConversations(this.searchConvs.value.toLowerCase());
      }
    });

    // Message Status Update (Sent -> Delivered Double Grey Ticks)
    this.socket.on('message_status_update', (data) => {
      console.log('✓✓ Message Status Updated:', data);
      if (this.activeConversation && data.conversation_id === this.activeConversation.id) {
        const msgObj = this.messages.find(m => m.id === data.message_id);
        if (msgObj) {
          msgObj.status = data.status;
          this.updateMessageTicksUI(data.message_id, 'DELIVERED');
        }
      }
    });

    // Messages Read (Double Blue Ticks!)
    this.socket.on('messages_read', (data) => {
      console.log('✓✓(Blue) Messages Read by Partner:', data);
      if (this.activeConversation && data.conversation_id === this.activeConversation.id) {
        this.messages.forEach(m => {
          if (m.sender_id === this.currentUser.id) {
            m.is_read = true;
          }
        });
        // Update all outgoing bubbles to Blue Ticks
        document.querySelectorAll('.message-bubble.outgoing .msg-ticks').forEach(el => {
          el.className = 'msg-ticks read';
          el.innerHTML = '<i class="ri-check-double-line"></i>';
          el.title = 'Read';
        });
      }
    });

    // Typing Indicators
    this.socket.on('user_typing', (data) => {
      if (this.activeConversation && data.conversation_id === this.activeConversation.id && data.sender_id !== this.currentUser.id) {
        this.partnerTypingIndicator.classList.remove('hidden');
      }
    });

    this.socket.on('user_stopped_typing', (data) => {
      if (this.activeConversation && data.conversation_id === this.activeConversation.id && data.sender_id !== this.currentUser.id) {
        this.partnerTypingIndicator.classList.add('hidden');
      }
    });
  }

  /* ==========================================================================
     SEND MESSAGE & TYPING LOGIC
     ========================================================================== */
  async sendMessage() {
    const text = this.messageInput.value.trim();
    const type = this.msgTypeSelect.value;
    
    if (!text && type === 'TEXT') return;
    if (!this.activeConversation) return;

    const payload = {
      conversation_id: this.activeConversation.id,
      message: text || `[${type} Message]`,
      message_type: type,
      media_file_id: null
    };

    // Emit send_message via WebSocket
    if (this.socket && this.socket.connected) {
      this.socket.emit('send_message', payload, (response) => {
        console.log('✉️ Sent message acknowledgment:', response);
      });

      // Optimistically append outgoing message to chat room
      const tempMsg = {
        id: 'temp-' + Date.now(),
        conversation_id: this.activeConversation.id,
        sender_id: this.currentUser.id,
        message: payload.message,
        message_type: type,
        created_at: new Date().toISOString(),
        is_read: false,
        status: 'SENT'
      };

      this.messages.push(tempMsg);
      this.appendMessageBubble(tempMsg);
      this.scrollToBottom();
      this.messageInput.value = '';
      this.stopTyping();
    } else {
      // Fallback: send via REST POST /chat/messages
      try {
        const res = await this.fetchWithAuth('/chat/messages', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        const savedMsg = await res.json();
        if (res.ok) {
          this.messages.push(savedMsg);
          this.appendMessageBubble(savedMsg);
          this.scrollToBottom();
          this.messageInput.value = '';
        }
      } catch (err) {
        console.error('Error sending message via REST:', err);
      }
    }
  }

  handleTypingEvent() {
    if (!this.socket || !this.socket.connected || !this.activeConversation) return;
    
    const partnerId = this.getPartnerId(this.activeConversation);

    if (!this.isTyping) {
      this.isTyping = true;
      this.socket.emit('typing_start', {
        conversation_id: this.activeConversation.id,
        receiver_id: partnerId
      });
    }

    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.stopTyping();
    }, 1500);
  }

  stopTyping() {
    if (this.isTyping && this.socket && this.socket.connected && this.activeConversation) {
      const partnerId = this.getPartnerId(this.activeConversation);
      this.socket.emit('typing_stop', {
        conversation_id: this.activeConversation.id,
        receiver_id: partnerId
      });
      this.isTyping = false;
    }
  }

  /* ==========================================================================
     UI RENDERING & DOM MANIPULATION
     ========================================================================== */
  getPartnerId(conv) {
    return conv.user_one_id === this.currentUser.id ? conv.user_two_id : conv.user_one_id;
  }

  renderConversations(filterText = '') {
    this.conversationsList.innerHTML = '';
    
    const filtered = this.conversations.filter(c => {
      const partnerId = this.getPartnerId(c);
      return partnerId.toLowerCase().includes(filterText) || c.id.toLowerCase().includes(filterText);
    });

    if (filtered.length === 0) {
      this.conversationsList.innerHTML = `
        <div class="empty-state">
          <i class="ri-chat-off-line"></i>
          <p>No conversations found.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(conv => {
      const partnerId = this.getPartnerId(conv);
      const partnerName = this.getPartnerName(partnerId);
      const isActive = this.activeConversation && this.activeConversation.id === conv.id;
      
      const el = document.createElement('div');
      el.className = `conv-item ${isActive ? 'active' : ''}`;
      el.dataset.id = conv.id;
      
      const unreadBadge = conv.unread_count > 0 ? `<span class="unread-badge">${conv.unread_count}</span>` : '';
      const timeStr = conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'New';

      el.innerHTML = `
        <div class="avatar-wrapper">
          <div class="avatar">${partnerName.charAt(0).toUpperCase()}</div>
        </div>
        <div class="conv-details">
          <div class="conv-top">
            <span class="conv-name">${partnerName}</span>
            <span class="conv-time">${timeStr}</span>
          </div>
          <div class="conv-bottom">
            <span class="conv-last-msg">${partnerId === this.currentUser.id ? 'Note to self' : 'Tap to open chat'}</span>
            ${unreadBadge}
          </div>
        </div>
      `;

      el.addEventListener('click', () => {
        this.selectConversation(conv);
      });

      this.conversationsList.appendChild(el);
    });
  }

  selectConversation(conv) {
    this.activeConversation = conv;
    this.noChatSelected.classList.remove('active');
    this.activeChatRoom.classList.remove('hidden');
    
    const partnerId = this.getPartnerId(conv);
    const partnerName = this.getPartnerName(partnerId);
    this.partnerName.textContent = partnerName;
    this.partnerAvatar.textContent = partnerName.charAt(0).toUpperCase();
    
    this.updatePartnerPresenceUI(partnerId);
    
    // Highlight sidebar item
    document.querySelectorAll('.conv-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === conv.id);
    });

    // Load Messages
    this.loadMessages(conv.id);
    
    // Mark as read immediately when selected
    if (conv.unread_count > 0) {
      this.markConversationAsRead(conv.id);
    }
  }

  renderMessages() {
    this.messagesContainer.innerHTML = '';
    this.messages.forEach(msg => {
      this.appendMessageBubble(msg);
    });
  }

  appendMessageBubble(msg) {
    const isOutgoing = msg.sender_id === this.currentUser.id;
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`;
    bubble.dataset.msgId = msg.id;

    // Format type icon
    let typeIcon = '';
    if (msg.message_type === 'IMAGE') typeIcon = '<span class="msg-type-badge"><i class="ri-image-line"></i> Image</span>';
    else if (msg.message_type === 'VOICE') typeIcon = '<span class="msg-type-badge"><i class="ri-mic-line"></i> Voice Note</span>';
    else if (msg.message_type === 'FILE') typeIcon = '<span class="msg-type-badge"><i class="ri-attachment-line"></i> File</span>';

    // Format time
    const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';

    // Ticks formatting for outgoing messages
    let ticksHtml = '';
    if (isOutgoing) {
      if (msg.is_read || msg.status === 'READ') {
        ticksHtml = `<span class="msg-ticks read" title="Read"><i class="ri-check-double-line"></i></span>`;
      } else if (msg.status === 'DELIVERED') {
        ticksHtml = `<span class="msg-ticks delivered" title="Delivered"><i class="ri-check-double-line"></i></span>`;
      } else {
        ticksHtml = `<span class="msg-ticks sent" title="Sent"><i class="ri-check-line"></i></span>`;
      }
    }

    bubble.innerHTML = `
      ${typeIcon}
      <div class="msg-text">${this.escapeHTML(msg.message || '')}</div>
      <div class="msg-meta">
        <span>${timeStr}</span>
        ${ticksHtml}
      </div>
    `;

    this.messagesContainer.appendChild(bubble);
  }

  updateMessageTicksUI(messageId, status) {
    const bubble = document.querySelector(`.message-bubble[data-msg-id="${messageId}"]`);
    if (bubble) {
      const ticksEl = bubble.querySelector('.msg-ticks');
      if (ticksEl) {
        if (status === 'DELIVERED' && !ticksEl.classList.contains('read')) {
          ticksEl.className = 'msg-ticks delivered';
          ticksEl.innerHTML = '<i class="ri-check-double-line"></i>';
          ticksEl.title = 'Delivered';
        } else if (status === 'READ') {
          ticksEl.className = 'msg-ticks read';
          ticksEl.innerHTML = '<i class="ri-check-double-line"></i>';
          ticksEl.title = 'Read';
        }
      }
    }
  }

  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  escapeHTML(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
  }
}

// Initialize Application on Window Load
window.addEventListener('DOMContentLoaded', () => {
  window.chatClient = new BizzDealChatClient();
});
