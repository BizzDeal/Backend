export const SWAGGER_AUTH_SCRIPT = `
(function() {
  const initAuthHelper = () => {
    // Hide the default green Authorize button if rendered dynamically
    const defaultAuthBtn = document.querySelector('.swagger-ui .auth-wrapper');
    if (defaultAuthBtn) {
      defaultAuthBtn.style.display = 'none';
    }

    // Target the info section where title and description live
    const infoSection = document.querySelector('.swagger-ui .info');
    if (!infoSection) return false;

    if (document.getElementById('swagger-auth-helper')) return true;

    // Wrap existing info elements so they stay neatly on the left side
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

    // Create the login container box
    const container = document.createElement('div');
    container.id = 'swagger-auth-helper';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '10px';
    container.style.background = '#222222';
    container.style.padding = '12px 18px';
    container.style.borderRadius = '8px';
    container.style.border = '1px solid #333333';
    container.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';

    // Helper to create clean, styled input fields
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
          alert('Logged in successfully!');
          pinInput.value = '';
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

    infoSection.appendChild(container);
    return true;
  };

  const timer = setInterval(() => {
    initAuthHelper();
  }, 300);
})();
`;
