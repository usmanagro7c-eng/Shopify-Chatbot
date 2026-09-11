/**
 * AI Chatbot - Embeddable Chat Widget
 * 
 * Usage:
 * <script src="https://your-domain.com/chat-widget.js"></script>
 * <script>
 *   AIChatbot.init({
 *     apiUrl: 'https://your-api.com',
 *     position: 'bottom-right',
 *     theme: 'light'
 *   });
 * </script>
 */

(function() {
  'use strict';

  // Default configuration
  const DEFAULT_CONFIG = {
    apiUrl: window.location.origin,
    position: 'bottom-right',
    title: 'Chat Assistant',
    placeholder: 'Type your message...',
    theme: 'light',
    width: '400px',
    height: '500px',
    strategyType: 'default', // NEW: Strategy type
    userId: null, // Optional: host page can pass a stable user id (e.g. Shopify customer id) for Langfuse attribution
    quickReplies: null, // Optional: override suggested questions (array of strings). Falls back to server strategy.
  };

  // localStorage key for the per-browser session id used to correlate Langfuse traces
  const SESSION_ID_KEY = 'ai-chatbot-session-id';

  // Launcher icons (inline SVG — crisp at any size, no emoji rendering variance)
  const ICON_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="28" height="28" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" fill="currentColor" fill-opacity="0.18"/><path d="M17.2 2.6l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" fill="currentColor" stroke="none"/></svg>`;
  const ICON_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" width="24" height="24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

  // Chat widget instance
  let chatWidget = null;
  let messages = [];
  // True when chat-widget.css wasn't detected, so bubbles paint their own colors.
  let addMessageFallback = false;

  /**
   * Get or create a stable per-browser session id. Persisted in localStorage so
   * refreshes/tab-switches stay in the same Langfuse session; regenerated only
   * if the user clears storage. Falls back to a per-load random id in browsers
   * where localStorage is disabled (private mode / cookie-blocked embeds).
   */
  function getOrCreateSessionId() {
    try {
      const existing = localStorage.getItem(SESSION_ID_KEY);
      if (existing) return existing;
      const fresh = generateId();
      localStorage.setItem(SESSION_ID_KEY, fresh);
      return fresh;
    } catch (_) {
      return generateId();
    }
  }

  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'sess-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
  }

  /**
   * Initialize the chat widget
   */
  async function init(config = {}) {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    
    // Load brand fonts (Cinzel + Plus Jakarta Sans) once, so the widget matches
    // the site's typography even when the host page doesn't ship them.
    if (!document.getElementById('ai-chatbot-fonts')) {
      const fontLink = document.createElement('link');
      fontLink.id = 'ai-chatbot-fonts';
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
      document.head.appendChild(fontLink);
    }

    // Create and inject widget
    await createWidget(finalConfig);
    
    console.log('[AIChatbot] Widget initialized', finalConfig);
  }

  /**
   * Create the chat widget DOM
   */
  async function createWidget(config) {
    // Fetch strategy greeting
    let greeting = 'Hello! How can I help you today?';
    let suggestedQuestions = [];
    try {
      const strategyResponse = await fetch(`${config.apiUrl}/api/strategy/${config.strategyType}`, {headers: { 'ngrok-skip-browser-warning': 'true' },});
      if (strategyResponse.ok) {
        const strategyData = await strategyResponse.json();
        if (strategyData.success && strategyData.data.greeting) {
          greeting = strategyData.data.greeting;
        }
        if (Array.isArray(strategyData.data.suggestedQuestions)) {
          suggestedQuestions = strategyData.data.suggestedQuestions.filter((q) => typeof q === 'string' && q.trim());
        }
      }
    } catch (error) {
      console.warn('[AIChatbot] Could not fetch strategy greeting, using default');
    }

    // Owner override via AIChatbot.init({ quickReplies: [...] })
    if (Array.isArray(config.quickReplies)) {
      suggestedQuestions = config.quickReplies.filter((q) => typeof q === 'string' && q.trim());
    }

    // Create launcher button (always visible — chat window opens on click)
    const fab = document.createElement('button');
    fab.id = 'ai-chatbot-fab';
    fab.className = config.position;
    fab.setAttribute('aria-label', 'Open chat');
    fab.setAttribute('aria-expanded', 'false');

    const iconOpen = document.createElement('span');
    iconOpen.className = 'ai-chatbot-fab-icon-open';
    iconOpen.innerHTML = ICON_OPEN;

    const iconClose = document.createElement('span');
    iconClose.className = 'ai-chatbot-fab-icon-close';
    iconClose.innerHTML = ICON_CLOSE;

    fab.appendChild(iconOpen);
    fab.appendChild(iconClose);

    const fabBadge = document.createElement('span');
    fabBadge.className = 'ai-chatbot-fab-badge';
    fabBadge.style.display = 'none';
    fab.appendChild(fabBadge);
    fabBadge.onclick = () => { fabBadge.style.display = 'none'; };

    fab.onclick = () => toggleWidget();

    // Create container
    const container = document.createElement('div');
    container.id = 'ai-chatbot-widget';
    container.className = `ai-chatbot ${config.position} ${config.theme}`;
    container.style.cssText = `
      position: fixed;
      ${config.position.includes('right') ? 'right' : 'left'}: 20px;
      ${config.position.includes('bottom') ? 'bottom' : 'top'}: 88px;
      width: ${config.width};
      height: ${config.height};
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      font-family: 'Plus Jakarta Sans', 'Assistant', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      z-index: 999999;
    `;

    // Header
    const header = document.createElement('div');
    header.className = 'ai-chatbot-header';
    header.style.cssText = `
      padding: 10px 14px;
      border-radius: 12px 12px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const title = document.createElement('h3');
    title.textContent = config.title;
    title.style.cssText = 'margin: 0; font-size: 14px; font-weight: 600; font-family: \'Cinzel\', serif; letter-spacing: 0.02em;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeBtn.onclick = () => toggleWidget();

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Messages container
    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'ai-chatbot-messages';
    messagesContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    // "Jump to latest" pill — pinned while scrolled up, click scrolls to bottom.
    const jumpBtn = document.createElement('button');
    jumpBtn.type = 'button';
    jumpBtn.className = 'ai-chatbot-scroll-btn';
    jumpBtn.textContent = '\u2193';
    jumpBtn.setAttribute('aria-label', 'Scroll to latest message');
    jumpBtn.addEventListener('click', () => smartScrollToBottom(true));
    messagesContainer.appendChild(jumpBtn);

    messagesContainer.addEventListener('scroll', () => {
      if (!chatWidget || !chatWidget.isOpen) return;
      const nearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 80;
      jumpBtn.classList.toggle('visible', !nearBottom);
    });

    // Input form
    const form = document.createElement('form');
    form.style.cssText = `
      padding: 12px;
      display: flex;
      gap: 8px;
    `;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = config.placeholder;
    input.style.cssText = `
      flex: 1;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 14px;
      font-family: inherit;
    `;

    const sendBtn = document.createElement('button');
    sendBtn.type = 'submit';
    sendBtn.textContent = 'Send';
    sendBtn.style.cssText = `
      border: none;
      border-radius: 6px;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    `;

    form.appendChild(input);
    form.appendChild(sendBtn);

    // Shared send path: quick-reply chips and the form both funnel here.
    const sendMessage = async (text) => {
      const message = String(text || '').trim();
      if (!message) return;

      // Hide quick-reply chips after the first user turn
      if (chatWidget && chatWidget.chipsEl) {
        chatWidget.chipsEl.remove();
        chatWidget.chipsEl = null;
      }

      // Add user message
      addMessage('user', message);
      input.value = '';
      showTyping();

      // Send to API
      try {
        sendBtn.disabled = true;
        // Compact prior turns into the shape the OpenAI messages array expects.
        // We exclude the message the user just typed (server appends it) and any
        // 'error' rows (those are widget-side render markers, not real assistant turns).
        const conversationHistory = messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .slice(0, -1)
          .map((m) => ({ role: m.role, content: m.content }));

        const body = {
          message,
          strategyType: config.strategyType,
          sessionId: chatWidget.sessionId,
          conversationHistory,
        };
        if (config.userId) body.userId = config.userId;

        const response = await fetch(`${config.apiUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Handle API response format
        if (data.success && data.data) {
          hideTyping();
          addMessage('assistant', data.data.message, { products: data.data.products });
          // Notify the visitor when a reply lands while the window is closed
          if (!chatWidget.isOpen) setUnread(chatWidget.unreadCount + 1);
        } else {
          hideTyping();
          addMessage('assistant', 'I could not generate a response.');
        }
      } catch (error) {
        hideTyping();
        addMessage('error', `Error: ${error.message}`);
      } finally {
        sendBtn.disabled = false;
      }
    };

    form.onsubmit = (e) => {
      e.preventDefault();
      sendMessage(input.value);
    };

    // Assemble widget
    container.appendChild(header);
    container.appendChild(messagesContainer);
    container.appendChild(form);

    // Inject into DOM
    document.body.appendChild(fab);
    document.body.appendChild(container);

    // If chat-widget.css isn't loaded/effective on the host page, the container
    // stays transparent and the website shows through. Paint the core surfaces
    // inline (theme-aware) as a fallback so the window is always opaque.
    const THEME_FALLBACK = {
      light: {
        containerBg: '#fcfaf5', text: '#1e1613',
        headerBg: 'linear-gradient(135deg, #261d18 0%, #1e1613 100%)', headerText: '#faf6ee',
        userBg: '#1e1613', userText: '#faf6ee',
        sendBg: '#d4af37', sendText: '#1e1613',
      },
      dark: {
        containerBg: '#1a1612', text: '#f8f3ea',
        headerBg: 'linear-gradient(135deg, #261d18 0%, #1e1613 100%)', headerText: '#faf6ee',
        userBg: '#d4af37', userText: '#1e1613',
        sendBg: '#d4af37', sendText: '#1e1613',
      },
    };

    const computedBg = getComputedStyle(container).backgroundColor;
    const cssMissing = !computedBg || computedBg === 'transparent' || computedBg === 'rgba(0, 0, 0, 0)';
    if (cssMissing) {
      const fb = THEME_FALLBACK[config.theme] || THEME_FALLBACK.light;
      container.style.backgroundColor = fb.containerBg;
      container.style.color = fb.text;
      header.style.background = fb.headerBg;
      header.style.color = fb.headerText;
      closeBtn.style.color = fb.headerText;
      input.style.backgroundColor = config.theme === 'dark' ? '#221b15' : '#fffdf8';
      sendBtn.style.backgroundColor = fb.sendBg;
      sendBtn.style.color = fb.sendText;
      fab.style.background = 'linear-gradient(135deg, #3a2d22 0%, #1e1613 100%)';
      fab.style.color = '#d4af37';
      addMessageFallback = true;
      console.warn('[AIChatbot] chat-widget.css not detected — applied inline fallback styles');
    }

    // Store references
    chatWidget = {
      container,
      messagesContainer,
      input,
      sendBtn,
      config,
      fab,
      fabBadge,
      jumpBtn,
      chipsEl: null,
      isOpen: false,
      unreadCount: 0,
      sessionId: getOrCreateSessionId(),
    };

    // Launcher-first: the chat window starts closed and the launcher stays
    // visible. Respect a persisted "open" state from a previous visit.
    if (localStorage.getItem('ai-chatbot-state') === 'open') {
      openWidget();
    } else {
      container.style.display = 'none';
    }

    // Add initial message from strategy
    addMessage('assistant', greeting);

    // Quick-reply chips (from server strategy or config override)
    if (suggestedQuestions.length > 0) {
      const chipsRow = document.createElement('div');
      chipsRow.className = 'ai-chatbot-quick-replies';
      for (const q of suggestedQuestions) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'ai-chatbot-chip';
        chip.textContent = q;
        chip.setAttribute('aria-label', q);
        chip.addEventListener('click', () => sendMessage(q));
        chipsRow.appendChild(chip);
      }
      chatWidget.chipsEl = chipsRow;
      chatWidget.messagesContainer.appendChild(chipsRow);
    }
  }

  const MIN_TYPING_MS = 400;

  /**
   * Show the "typing…" dots (assistant bubble style). No-op if one is already shown.
   */
  function showTyping() {
    if (!chatWidget || chatWidget.typingEl) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'ai-chatbot-message ai-chatbot-assistant';

    const indicator = document.createElement('div');
    indicator.className = 'ai-typing-indicator';
    indicator.setAttribute('aria-label', 'Assistant is typing');
    indicator.appendChild(document.createElement('span'));
    indicator.appendChild(document.createElement('span'));
    indicator.appendChild(document.createElement('span'));
    wrapper.appendChild(indicator);

    chatWidget.typingEl = wrapper;
    chatWidget.typingStartedAt = Date.now();
    chatWidget.messagesContainer.appendChild(wrapper);

    if (addMessageFallback) {
      const isDark = chatWidget.config && chatWidget.config.theme === 'dark';
      indicator.style.backgroundColor = isDark ? '#2a201a' : '#f5efe6';
      indicator.style.padding = '10px 14px';
      indicator.style.borderRadius = '8px';
      indicator.querySelectorAll('span').forEach((d) => {
        d.style.width = '8px';
        d.style.height = '8px';
        d.style.backgroundColor = '#d4af37';
        d.style.borderRadius = '50%';
      });
    }

    chatWidget.messagesContainer.scrollTop = chatWidget.messagesContainer.scrollHeight;
    smartScrollToBottom(true);
  }

  /**
   * Remove the typing indicator, keeping it visible for at least MIN_TYPING_MS
   * so fast responses don't make it flicker.
   */
  function hideTyping() {
    if (!chatWidget || !chatWidget.typingEl) return;

    const elapsed = Date.now() - (chatWidget.typingStartedAt || 0);
    const delay = Math.max(0, MIN_TYPING_MS - elapsed);

    setTimeout(() => {
      if (!chatWidget || !chatWidget.typingEl) return;
      chatWidget.typingEl.remove();
      chatWidget.typingEl = null;
      chatWidget.typingStartedAt = null;
      smartScrollToBottom(true);
    }, delay);
  }

  /**
   * Scroll to the bottom unless the visitor has scrolled up to read history.
   * `force` (new user turn / typing / programmatic) always jumps to bottom.
   */
  function smartScrollToBottom(force) {
    if (!chatWidget || !chatWidget.messagesContainer) return;
    const el = chatWidget.messagesContainer;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (force || nearBottom) {
      el.scrollTop = el.scrollHeight;
      if (chatWidget.jumpBtn) chatWidget.jumpBtn.classList.remove('visible');
    }
  }

  /**
   * Show/hide the "N unread" badge on the launcher. Only populated while the
   * chat window is closed; cleared on open.
   */
  function setUnread(count) {
    if (!chatWidget || !chatWidget.fabBadge) return;
    chatWidget.unreadCount = Math.max(0, count);
    if (chatWidget.unreadCount > 0) {
      chatWidget.fabBadge.textContent = chatWidget.unreadCount > 9 ? '9+' : String(chatWidget.unreadCount);
      chatWidget.fabBadge.style.display = 'flex';
    } else {
      chatWidget.fabBadge.style.display = 'none';
      chatWidget.fabBadge.textContent = '';
    }
  }

  function clearUnread() {
    setUnread(0);
  }

  /**
   * Local 12-hour time for a message bubble, e.g. "3:04 PM".
   */
  function formatTime(date) {
    try {
      let hours = date.getHours();
      const mins = date.getMinutes();
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${hours}:${String(mins).padStart(2, '0')} ${period}`;
    } catch (_) {
      return '';
    }
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderInline(text) {
    let out = escapeHtml(text);

    // Tokenize markdown images/links so bare-URL auto-linking never touches them.
    const images = [];
    out = out.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_, alt, url) => {
      const token = `@@AI_IMG_${images.length}@@`;
      images.push({ alt, url });
      return token;
    });

    const links = [];
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
      const token = `@@AI_LINK_${links.length}@@`;
      links.push({ label, url });
      return token;
    });

    out = out
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\s][^*]*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bare URLs (e.g. "Product Link: https://...") become clickable links.
    out = out.replace(/https?:\/\/[^\s<>"')]+/g, (url) => {
      const punct = /[.,;:!]+$/.exec(url);
      const clean = punct ? url.slice(0, punct.index) : url;
      const tail = punct ? punct[0] : '';
      return `<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>${tail}`;
    });

    out = out.replace(/@@AI_IMG_(\d+)@@/g, (_, i) => {
      const img = images[Number(i)];
      return `<a class="ai-inline-image" href="${img.url}" target="_blank" rel="noopener noreferrer"><img src="${img.url}" alt="${img.alt || 'product image'}" loading="lazy"></a>`;
    });
    out = out.replace(/@@AI_LINK_(\d+)@@/g, (_, i) => {
      const link = links[Number(i)];
      return `<a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.label}</a>`;
    });

    return out;
  }

  function stripCodeLang(code) {
    const trimmed = code.trim();
    const lines = trimmed.split(/\r?\n/);
    if (lines.length > 1 && /^[a-zA-Z0-9_+-]+$/.test(lines[0].trim())) {
      return lines.slice(1).join('\n').trim();
    }
    return trimmed;
  }

  /**
   * Render an assistant response as safe HTML: fenced code blocks, paragraphs,
   * bullet/numbered lists, bold/italic/inline-code/links. Input is HTML-escaped
   * first, so only the tags generated here can appear in the output.
   */
  function renderMessage(content) {
    const source = String(content || '');

    // Pull out fenced code blocks first (they may contain list markers / blank lines).
    const codeBlocks = [];
    let text = source.replace(/```([\s\S]*?)```/g, (_, code) => {
      const token = `@@AI_CODE_${codeBlocks.length}@@`;
      codeBlocks.push(stripCodeLang(code));
      return token;
    });

    // Group consecutive lines into paragraphs and lists.
    let html = '';
    let listType = null;
    const flushList = () => {
      if (listType) {
        html += `</${listType}>`;
        listType = null;
      }
    };

    const lines = text.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const bullet = /^[-*+]\s+(.*)$/.exec(line);
      const numbered = /^\d+[.)]\s+(.*)$/.exec(line);

      if (bullet || numbered) {
        const type = bullet ? 'ul' : 'ol';
        if (listType !== type) {
          flushList();
          listType = type;
          html += `<${type}>`;
        }
        const item = bullet ? bullet[1] : numbered[1];
        html += `<li>${renderInline(item)}</li>`;
      } else {
        flushList();
        const trimmed = line.trim();
        if (trimmed === '') continue;
        // Standalone code-block tokens render as block <pre>, not inside a <p>.
        if (/^@@AI_CODE_\d+@@$/.test(trimmed)) {
          html += trimmed;
        } else {
          html += `<p>${renderInline(trimmed)}</p>`;
        }
      }
    }
    flushList();

    // Restore code blocks as <pre><code>.
    html = html.replace(/@@AI_CODE_(\d+)@@/g, (_, i) => `<pre><code>${escapeHtml(codeBlocks[Number(i)])}</code></pre>`);

    return html;
  }

  /**
   * Add a message to the chat. `extra.products` renders a clickable image-card
   * grid below the assistant message (image + title + price → product page).
   */
  function addMessage(role, content, extra) {
    if (!chatWidget) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-chatbot-message ai-chatbot-${role}`;
    messageDiv.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: ${role === 'user' ? 'flex-end' : 'flex-start'};
      margin-bottom: 8px;
    `;

    const messageBubble = document.createElement('div');
    messageBubble.className = 'ai-message-bubble';
    messageBubble.style.cssText = `
      max-width: 75%;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 14px;
      word-wrap: break-word;
    `;
    if (role === 'assistant') {
      messageBubble.innerHTML = renderMessage(content);
    } else {
      messageBubble.textContent = content;
    }

    if (addMessageFallback) {
      const isDark = chatWidget.config && chatWidget.config.theme === 'dark';
      if (role === 'error') {
        messageBubble.style.backgroundColor = '#c26144';
        messageBubble.style.color = '#ffffff';
      } else if (role === 'user') {
        messageBubble.style.backgroundColor = isDark ? '#d4af37' : '#1e1613';
        messageBubble.style.color = isDark ? '#1e1613' : '#faf6ee';
      } else {
        messageBubble.style.backgroundColor = isDark ? '#2a201a' : '#f5efe6';
        messageBubble.style.color = isDark ? '#f8f3ea' : '#1e1613';
      }
    }

    messageDiv.appendChild(messageBubble);

    if (role === 'user' || role === 'assistant') {
      const timeEl = document.createElement('span');
      timeEl.className = 'ai-chatbot-msg-time';
      timeEl.textContent = formatTime(new Date());
      messageDiv.appendChild(timeEl);
    }

    chatWidget.messagesContainer.appendChild(messageDiv);

    if (role === 'assistant' && extra && extra.products && extra.products.length > 0) {
      const list = document.createElement('div');
      list.className = 'ai-chatbot-product-list';

      for (const p of extra.products) {
        const hasUrl = Boolean(p.url);
        const card = document.createElement(hasUrl ? 'a' : 'div');
        card.className = 'ai-chatbot-product-card' + (hasUrl ? '' : ' ai-chatbot-product-card-static');
        if (hasUrl) {
          card.href = p.url;
          card.target = '_blank';
          card.rel = 'noopener noreferrer';
          card.setAttribute('aria-label', p.title || 'Product');
        }

        if (p.image) {
          const img = document.createElement('img');
          img.src = p.image;
          img.alt = p.title || 'Product';
          img.loading = 'lazy';
          card.appendChild(img);
        }

        const label = document.createElement('div');
        label.className = 'ai-chatbot-product-card-label';

        const titleEl = document.createElement('div');
        titleEl.className = 'ai-chatbot-product-card-title';
        titleEl.textContent = p.title || '';

        const priceEl = document.createElement('div');
        priceEl.className = 'ai-chatbot-product-card-price';
        priceEl.textContent = `${p.currency || ''} ${p.price || ''}`.trim();

        label.appendChild(titleEl);
        label.appendChild(priceEl);
        card.appendChild(label);
        list.appendChild(card);
      }

      chatWidget.messagesContainer.appendChild(list);
    }

    // Auto-scroll to bottom (skipped when the visitor has scrolled up)
    smartScrollToBottom(false);

    // Store message
    messages.push({ role, content, timestamp: new Date() });
  }

  /**
   * Open the widget (for mobile FAB button)
   */
  function openWidget() {
    if (!chatWidget) return;

    chatWidget.isOpen = true;
    clearUnread();
    chatWidget.container.style.display = 'flex';
    chatWidget.container.classList.add('open'); // Add class for mobile CSS
    chatWidget.fab.classList.add('ai-chatbot-fab-open');
    chatWidget.fab.setAttribute('aria-expanded', 'true');
    chatWidget.fab.setAttribute('aria-label', 'Close chat');
    localStorage.setItem('ai-chatbot-state', 'open');

    // Focus input
    setTimeout(() => chatWidget.input.focus(), 100);
  }

  /**
   * Toggle widget visibility
   */
  function toggleWidget() {
    if (!chatWidget) return;

    const isVisible = chatWidget.container.style.display !== 'none';
    
    if (isVisible) {
      // Close widget
      chatWidget.isOpen = false;
      chatWidget.container.style.display = 'none';
      chatWidget.container.classList.remove('open'); // Remove class for mobile CSS
      chatWidget.fab.classList.remove('ai-chatbot-fab-open');
      chatWidget.fab.setAttribute('aria-expanded', 'false');
      chatWidget.fab.setAttribute('aria-label', 'Open chat');
      localStorage.setItem('ai-chatbot-state', 'closed');
    } else {
      // Open widget
      openWidget();
    }
  }

  /**
   * Get conversation history
   */
  function getHistory() {
    return messages;
  }

  /**
   * Clear chat history. Rotates the sessionId so the next turn starts a fresh
   * Langfuse session — otherwise old + new turns coalesce into one session with
   * a hole where the cleared messages used to be.
   */
  function clearHistory() {
    messages = [];
    if (chatWidget) {
      try {
        localStorage.removeItem(SESSION_ID_KEY);
      } catch (_) {}
      chatWidget.sessionId = getOrCreateSessionId();
      chatWidget.messagesContainer.innerHTML = '';
      addMessage('assistant', 'Chat cleared. How can I help?');
    }
  }

  // Expose API
  window.AIChatbot = {
    init,
    toggle: toggleWidget,
    open: openWidget,
    getHistory,
    clearHistory,
    version: '1.0.0', // Updated for strategy pattern
  };

  // Auto-initialize if data attribute is present
  document.addEventListener('DOMContentLoaded', () => {
    const scripts = document.querySelectorAll('script[data-ai-chatbot]');
    if (scripts.length > 0) {
      init();
    }
  });
})();
