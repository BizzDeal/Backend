export const SWAGGER_AUTH_SCRIPT = `
(function() {
  const getLoggedInUser = () => {
    let token = null;
    if (window.ui && window.ui.getState) {
      token = window.ui.getState().getIn(['auth', 'authorized', 'bearer', 'value']);
    }
    if (!token) {
      token = localStorage.getItem('swagger_jwt_token');
    }
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const decoded = JSON.parse(jsonPayload);
      let userInfo = {};
      try {
        const stored = localStorage.getItem('swagger_user_info');
        if (stored) userInfo = JSON.parse(stored);
      } catch(e) {}
      return {
        phone: decoded.phone || userInfo.phone || 'Unknown',
        role: decoded.role || userInfo.role || 'USER',
        name: decoded.name || decoded.full_name || userInfo.full_name || userInfo.name || ''
      };
    } catch (e) {
      return null;
    }
  };

  const renderAuthBox = (container) => {
    const user = getLoggedInUser();
    const currentState = user ? (user.phone + '_' + user.role + '_' + user.name) : 'logged_out';

    if (container.dataset.state === currentState) {
      return;
    }
    container.dataset.state = currentState;
    container.innerHTML = '';

    if (user) {
      const statusText = document.createElement('div');
      statusText.style.display = 'flex';
      statusText.style.alignItems = 'center';
      statusText.style.gap = '8px';
      statusText.style.color = '#49cc90';
      statusText.style.fontWeight = '600';
      statusText.style.fontSize = '13px';
      statusText.style.background = '#181818';
      statusText.style.padding = '6px 12px';
      statusText.style.borderRadius = '6px';
      statusText.style.border = '1px solid #333333';
      const displayName = user.name ? (user.name + ' (' + (user.phone || 'Unknown') + ')') : (user.phone || 'Unknown');
      statusText.innerHTML = '<span style="font-size: 10px;">🟢</span> Logged in as: <span style="color: #ffffff;">' + displayName + '</span> <span style="background: #333; color: #49cc90; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 4px;">' + (user.role || 'USER') + '</span>';

      const logoutBtn = document.createElement('button');
      logoutBtn.innerText = 'Logout';
      logoutBtn.type = 'button';
      logoutBtn.style.padding = '6px 16px';
      logoutBtn.style.borderRadius = '6px';
      logoutBtn.style.border = '1px solid #555';
      logoutBtn.style.backgroundColor = '#333333';
      logoutBtn.style.color = '#ff6b6b';
      logoutBtn.style.cursor = 'pointer';
      logoutBtn.style.fontWeight = '600';
      logoutBtn.style.fontSize = '12px';
      logoutBtn.style.transition = 'background-color 0.2s, transform 0.1s';

      logoutBtn.onmouseover = () => {
        logoutBtn.style.backgroundColor = '#444444';
      };
      logoutBtn.onmouseout = () => {
        logoutBtn.style.backgroundColor = '#333333';
      };
      logoutBtn.onclick = () => {
        localStorage.removeItem('swagger_jwt_token');
        localStorage.removeItem('swagger_user_info');
        if (window.ui && window.ui.authActions && window.ui.authActions.logout) {
          window.ui.authActions.logout(['bearer']);
        }
        renderAuthBox(container);
      };

      container.appendChild(statusText);
      container.appendChild(logoutBtn);
    } else {
      const createInput = (placeholder, isPassword = false, width = '140px') => {
        const input = document.createElement('input');
        input.placeholder = placeholder;
        if (isPassword) input.type = 'password';
        input.style.padding = '8px 12px';
        input.style.borderRadius = '6px';
        input.style.border = '1px solid #444';
        input.style.background = '#181818';
        input.style.color = '#eeeeee';
        input.style.fontSize = '13px';
        input.style.width = width;
        input.style.outline = 'none';
        input.style.transition = 'border-color 0.2s, box-shadow 0.2s';

        input.onfocus = () => {
          input.style.borderColor = '#49cc90';
          input.style.boxShadow = '0 0 0 2px rgba(73, 204, 144, 0.2)';
        };
        input.onblur = () => {
          input.style.borderColor = '#444';
          input.style.boxShadow = 'none';
        };
        return input;
      };

      const phoneInput = createInput('Phone number', false, '150px');
      const pinInput = createInput('PIN', true, '90px');

      const loginBtn = document.createElement('button');
      loginBtn.innerText = 'Login';
      loginBtn.type = 'button';
      loginBtn.style.padding = '8px 22px';
      loginBtn.style.borderRadius = '6px';
      loginBtn.style.border = 'none';
      loginBtn.style.backgroundColor = '#49cc90';
      loginBtn.style.color = '#ffffff';
      loginBtn.style.cursor = 'pointer';
      loginBtn.style.fontWeight = '600';
      loginBtn.style.fontSize = '13px';
      loginBtn.style.transition = 'background-color 0.2s, transform 0.1s';

      loginBtn.onmouseover = () => {
        loginBtn.style.backgroundColor = '#3cb878';
      };
      loginBtn.onmouseout = () => {
        loginBtn.style.backgroundColor = '#49cc90';
      };
      loginBtn.onmousedown = () => {
        loginBtn.style.transform = 'scale(0.98)';
      };
      loginBtn.onmouseup = () => {
        loginBtn.style.transform = 'scale(1)';
      };

      loginBtn.onclick = async () => {
        const phone = phoneInput.value;
        const pin = pinInput.value;
        if (!phone || !pin) {
          alert('Please enter both phone and PIN');
          return;
        }

        try {
          loginBtn.innerText = 'Logging in...';
          loginBtn.disabled = true;

          const response = await fetch('/bizzdeal/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phone, pin }),
          });

          const data = await response.json();
          if (response.ok && data.accessToken) {
            const token = data.accessToken;
            localStorage.setItem('swagger_jwt_token', token);
            if (data.user) {
              localStorage.setItem('swagger_user_info', JSON.stringify(data.user));
            }
            if (window.ui && window.ui.authActions && window.ui.authActions.authorize) {
              window.ui.authActions.authorize({
                bearer: {
                  name: 'bearer',
                  schema: {
                    type: 'http',
                    in: 'header',
                    scheme: 'bearer',
                    description: ''
                  },
                  value: token
                }
              });
            }
            if (window.ui && typeof window.ui.preauthorizeApiKey === 'function') {
              window.ui.preauthorizeApiKey('bearer', token);
            }
            renderAuthBox(container);
          } else {
            alert('Login failed: ' + (data.message || 'Unknown error'));
          }
        } catch (err) {
          alert('Network error: ' + err.message);
        } finally {
          loginBtn.innerText = 'Login';
          loginBtn.disabled = false;
        }
      };

      container.appendChild(phoneInput);
      container.appendChild(pinInput);
      container.appendChild(loginBtn);
    }
  };

  const initAuthHelper = () => {
    const defaultAuthBtn = document.querySelector('.swagger-ui .auth-wrapper');
    if (defaultAuthBtn) {
      defaultAuthBtn.style.display = 'none';
    }

    const infoSection = document.querySelector('.swagger-ui .info');
    if (!infoSection) return false;

    let container = document.getElementById('swagger-auth-helper');
    if (!container) {
      if (!infoSection.querySelector('.info-left-content')) {
        const leftWrapper = document.createElement('div');
        leftWrapper.className = 'info-left-content';
        while (infoSection.firstChild) {
          leftWrapper.appendChild(infoSection.firstChild);
        }
        infoSection.style.display = 'flex';
        infoSection.style.justifyContent = 'space-between';
        infoSection.style.alignItems = 'flex-end';
        infoSection.style.flexWrap = 'wrap';
        infoSection.style.gap = '20px';
        infoSection.appendChild(leftWrapper);
      }

      container = document.createElement('div');
      container.id = 'swagger-auth-helper';
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.gap = '10px';
      container.style.background = '#222222';
      container.style.padding = '12px 18px';
      container.style.borderRadius = '8px';
      container.style.border = '1px solid #333333';
      container.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';

      infoSection.appendChild(container);
    }

    renderAuthBox(container);
    return true;
  };

  const timer = setInterval(() => {
    initAuthHelper();
  }, 300);
})();
`;
