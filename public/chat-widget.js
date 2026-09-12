/**
 * AI Chatbot - Embeddable Chat Widget
 * High-performance, luxury, fully responsive, modern & accessible client.
 */

(function() {
  'use strict';

  // Default configuration
  const DEFAULT_CONFIG = {
    apiUrl: window.location.origin,
    position: 'bottom-right',
    title: 'Habibi Arts & Crafts',
    subtitle: 'Online • Instant Support',
    placeholder: 'Prints, prices ya order ke mutabiq poochen...',
    theme: 'light',
    width: '385px',
    height: '580px',
    strategyType: 'ecommerce',
    userId: null,
    quickReplies: null,
    enableTeaser: true,
    teaserMessage: '👋 Assalam-o-Alaikum! Need help with products or tracking your order?',
  };

  const SESSION_ID_KEY = 'ai-chatbot-session-id';

  // Modern Luxury SVG Icons
  const ICON_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden="true"><path d="M16 3C9.37 3 4 7.7 4 13.5c0 2.5.98 4.8 2.65 6.64L5.2 25.5a.8.8 0 0 0 1.02 1.02l5.4-1.54C13.15 25.64 14.55 26 16 26c6.63 0 12-4.7 12-10.5S22.63 3 16 3z" fill="#18120c"/><circle cx="11" cy="14" r="1.6" fill="#ffffff"/><circle cx="16" cy="14" r="1.6" fill="#ffffff"/><circle cx="21" cy="14" r="1.6" fill="#ffffff"/><path d="M24 2.2l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" fill="#ffffff"/></svg>`;

  const ICON_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#18120c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" width="22" height="22" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  const ICON_HEADER_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  const ICON_HEADER_CLEAR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;

  const ICON_BOT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" fill="currentColor" fill-opacity="0.3"/></svg>`;

  const ICON_SEND = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;

  const ICON_SPINNER = `<svg class="ai-spin" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" width="15" height="15" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>`;

  const ICON_REFRESH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`;

  const ICON_COPY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

  const ICON_CHECK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" width="12" height="12" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

  const ICON_ARROW_DOWN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;

  const ICON_SPARKLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="13" height="13" aria-hidden="true"><path d="m12 1 2.5 6.5L21 10l-5 4.5 1.5 7L12 18l-5.5 3.5 1.5-7L3 10l6.5-2.5L12 1z"/></svg>`;

  let chatWidget = null;
  let messages = [];

  /**
   * Session ID for Langfuse attribution & continuity
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
   * Initialize widget
   */
  async function init(config = {}) {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    // Load fonts (Cinzel + Plus Jakarta Sans) once
    if (!document.getElementById('ai-chatbot-fonts')) {
      const fontLink = document.createElement('link');
      fontLink.id = 'ai-chatbot-fonts';
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
      document.head.appendChild(fontLink);
    }

    await createWidget(finalConfig);
    console.log('[AIChatbot] Widget initialized with modern UI', finalConfig);
  }

  /**
   * Create the chat widget DOM (instant, non-blocking)
   */
  function createWidget(config) {
    let greeting = 'Assalam-o-Alaikum! Main Habibi Arts & Crafts assistant hoon. Main aap ki kya madad kar sakta hoon?';
    let suggestedQuestions = Array.isArray(config.quickReplies) && config.quickReplies.length > 0 
      ? config.quickReplies 
      : [
          '🛍️ Products dikhao',
          '📦 Mera order track karo',
          '🎨 Custom Calligraphy Frames',
          '🚚 Delivery time & charges'
        ];

    // 1. Floating Action Button (FAB)
    const fab = document.createElement('button');
    fab.id = 'ai-chatbot-fab';
    fab.className = config.position;
    fab.setAttribute('aria-label', 'Open chat assistance');
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

    fab.onclick = () => toggleWidget();

    // 2. Proactive Teaser Balloon
    let teaserEl = null;
    const isDismissed = sessionStorage.getItem('ai-teaser-dismissed');
    if (config.enableTeaser && !isDismissed && localStorage.getItem('ai-chatbot-state') !== 'open') {
      teaserEl = document.createElement('div');
      teaserEl.className = `ai-chatbot-teaser ${config.position}`;
      teaserEl.innerHTML = `
        <span>${escapeHtml(config.teaserMessage)}</span>
        <button type="button" class="ai-teaser-close" aria-label="Dismiss">&times;</button>
      `;

      teaserEl.onclick = (e) => {
        if (e.target.closest('.ai-teaser-close')) {
          e.stopPropagation();
          dismissTeaser();
          return;
        }
        dismissTeaser();
        openWidget();
      };

      // Delay showing teaser slightly for natural feel
      setTimeout(() => {
        if (!chatWidget || chatWidget.isOpen) return;
        document.body.appendChild(teaserEl);
      }, 1400);
    }

    function dismissTeaser() {
      if (teaserEl) {
        sessionStorage.setItem('ai-teaser-dismissed', 'true');
        teaserEl.remove();
        teaserEl = null;
      }
    }

    // 3. Widget Container
    const container = document.createElement('div');
    container.id = 'ai-chatbot-widget';
    container.className = `ai-chatbot ${config.position} ${config.theme}`;
    container.style.width = config.width;
    container.style.height = config.height;

    // 4. Header Component
    const header = document.createElement('div');
    header.className = 'ai-chatbot-header';

    const headerInfo = document.createElement('div');
    headerInfo.className = 'ai-header-info';

    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'ai-header-avatar-wrap';
    const avatar = document.createElement('div');
    avatar.className = 'ai-header-avatar';
    avatar.innerHTML = ICON_BOT;
    const onlineDot = document.createElement('div');
    onlineDot.className = 'ai-online-indicator';
    avatarWrap.appendChild(avatar);
    avatarWrap.appendChild(onlineDot);

    const textGroup = document.createElement('div');
    textGroup.className = 'ai-header-text-group';
    const titleEl = document.createElement('h3');
    titleEl.className = 'ai-header-title';
    titleEl.textContent = config.title;
    const subtitleEl = document.createElement('div');
    subtitleEl.className = 'ai-header-subtitle';
    subtitleEl.textContent = config.subtitle || 'Online • Instant Shopping Assistant';
    textGroup.appendChild(titleEl);
    textGroup.appendChild(subtitleEl);

    headerInfo.appendChild(avatarWrap);
    headerInfo.appendChild(textGroup);

    const headerActions = document.createElement('div');
    headerActions.className = 'ai-header-actions';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'ai-header-btn ai-header-btn-clear';
    resetBtn.setAttribute('title', 'Clear Chat');
    resetBtn.setAttribute('aria-label', 'Clear Chat');
    resetBtn.innerHTML = ICON_HEADER_CLEAR;
    resetBtn.onclick = () => {
      if (confirm('Are you sure you want to clear this conversation?')) {
        clearHistory();
      }
    };

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'ai-header-btn ai-header-btn-close';
    closeBtn.setAttribute('title', 'Close Chat');
    closeBtn.setAttribute('aria-label', 'Close Chat');
    closeBtn.innerHTML = ICON_HEADER_CLOSE;
    closeBtn.onclick = () => toggleWidget();

    headerActions.appendChild(resetBtn);
    headerActions.appendChild(closeBtn);

    header.appendChild(headerInfo);
    header.appendChild(headerActions);

    // 5. Messages Container
    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'ai-chatbot-messages';

    // Jump to latest button
    const jumpBtn = document.createElement('button');
    jumpBtn.type = 'button';
    jumpBtn.className = 'ai-chatbot-scroll-btn';
    jumpBtn.innerHTML = ICON_ARROW_DOWN;
    jumpBtn.setAttribute('aria-label', 'Scroll to latest message');
    jumpBtn.addEventListener('click', () => smartScrollToBottom(true));
    messagesContainer.appendChild(jumpBtn);

    messagesContainer.addEventListener('scroll', () => {
      if (!chatWidget || !chatWidget.isOpen) return;
      const nearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 70;
      jumpBtn.classList.toggle('visible', !nearBottom);
    });

    // 6. Input Form Area
    const formContainer = document.createElement('div');
    formContainer.className = 'ai-chatbot-form-container';

    const form = document.createElement('form');
    form.className = 'ai-chatbot-input-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = config.placeholder;
    input.setAttribute('aria-label', 'Type your message');
    input.autocomplete = 'off';

    const sendBtn = document.createElement('button');
    sendBtn.type = 'submit';
    sendBtn.className = 'ai-chatbot-send-btn';
    sendBtn.innerHTML = ICON_SEND;
    sendBtn.setAttribute('aria-label', 'Send message');
    sendBtn.disabled = true;

    input.addEventListener('input', () => {
      sendBtn.disabled = !input.value.trim();
    });

    form.appendChild(input);
    form.appendChild(sendBtn);

    const footerNote = document.createElement('div');
    footerNote.className = 'ai-chatbot-footer-note';
    footerNote.innerHTML = '⚡ Powered by AI Assistant';

    formContainer.appendChild(form);
    formContainer.appendChild(footerNote);

    // Send logic
    const sendMessage = async (text) => {
      const message = String(text || '').trim();
      if (!message) return;

      if (chatWidget && chatWidget.chipsEl) {
        chatWidget.chipsEl.remove();
        chatWidget.chipsEl = null;
      }

      addMessage('user', message);
      input.value = '';
      sendBtn.disabled = true;
      showTyping();

      try {
        sendBtn.innerHTML = ICON_SPINNER;
        sendBtn.disabled = true;

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
          throw new Error(`API response error (${response.status})`);
        }

        const data = await response.json();

        hideTyping();
        if (data.success && data.data) {
          addMessage('assistant', data.data.message, { products: data.data.products });
          if (!chatWidget.isOpen) setUnread(chatWidget.unreadCount + 1);
        } else {
          addMessage('assistant', 'Sorry, could not generate a response. Please try again.');
        }
      } catch (error) {
        hideTyping();
        addMessage('error', `Connection error: ${error.message}`);
      } finally {
        sendBtn.innerHTML = ICON_SEND;
        sendBtn.disabled = !input.value.trim();
      }
    };

    form.onsubmit = (e) => {
      e.preventDefault();
      sendMessage(input.value);
    };

    // Assemble DOM
    container.appendChild(header);
    container.appendChild(messagesContainer);
    container.appendChild(formContainer);

    document.body.appendChild(fab);
    document.body.appendChild(container);

    chatWidget = {
      container,
      messagesContainer,
      input,
      sendBtn,
      config,
      fab,
      fabBadge,
      jumpBtn,
      dismissTeaser,
      chipsEl: null,
      isOpen: false,
      unreadCount: 0,
      sessionId: getOrCreateSessionId(),
    };

    // Check saved state
    if (localStorage.getItem('ai-chatbot-state') === 'open') {
      openWidget();
    } else {
      container.style.display = 'none';
    }

    // Initial greeting
    addMessage('assistant', greeting);

    // Quick-reply suggestions
    if (suggestedQuestions.length > 0) {
      renderQuickReplies(suggestedQuestions, sendMessage);
    }
  }

  function renderQuickReplies(questions, onSend) {
    if (!chatWidget) return;
    const chipsRow = document.createElement('div');
    chipsRow.className = 'ai-chatbot-quick-replies';

    for (const q of questions) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ai-chatbot-chip';
      chip.innerHTML = `<span class="ai-chip-sparkle">${ICON_SPARKLE}</span><span>${escapeHtml(q)}</span>`;
      chip.setAttribute('aria-label', q);
      chip.addEventListener('click', () => onSend(q));
      chipsRow.appendChild(chip);
    }

    chatWidget.chipsEl = chipsRow;
    chatWidget.messagesContainer.appendChild(chipsRow);
  }

  const MIN_TYPING_MS = 400;

  function showTyping() {
    if (!chatWidget || chatWidget.typingEl) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'ai-chatbot-message ai-chatbot-assistant';

    const avatar = document.createElement('div');
    avatar.className = 'ai-bot-avatar-mini';
    avatar.innerHTML = ICON_BOT;

    const contentWrap = document.createElement('div');
    contentWrap.className = 'ai-message-content-wrap';

    const indicator = document.createElement('div');
    indicator.className = 'ai-typing-indicator';
    indicator.setAttribute('aria-label', 'Assistant is typing');
    indicator.appendChild(document.createElement('span'));
    indicator.appendChild(document.createElement('span'));
    indicator.appendChild(document.createElement('span'));

    contentWrap.appendChild(indicator);
    wrapper.appendChild(avatar);
    wrapper.appendChild(contentWrap);

    chatWidget.typingEl = wrapper;
    chatWidget.typingStartedAt = Date.now();
    chatWidget.messagesContainer.appendChild(wrapper);

    smartScrollToBottom(true);
  }

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

  function smartScrollToBottom(force) {
    if (!chatWidget || !chatWidget.messagesContainer) return;
    const el = chatWidget.messagesContainer;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (force || nearBottom) {
      el.scrollTop = el.scrollHeight;
      if (chatWidget.jumpBtn) chatWidget.jumpBtn.classList.remove('visible');
    }
  }

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

    // Autolink bare URLs
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

  function renderMessage(content) {
    const source = String(content || '');
    const codeBlocks = [];

    let text = source.replace(/```([\s\S]*?)```/g, (_, code) => {
      const token = `@@AI_CODE_${codeBlocks.length}@@`;
      codeBlocks.push(stripCodeLang(code));
      return token;
    });

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
        if (/^@@AI_CODE_\d+@@$/.test(trimmed)) {
          html += trimmed;
        } else {
          html += `<p>${renderInline(trimmed)}</p>`;
        }
      }
    }
    flushList();

    html = html.replace(/@@AI_CODE_(\d+)@@/g, (_, i) => `<pre><code>${escapeHtml(codeBlocks[Number(i)])}</code></pre>`);
    return html;
  }

  /**
   * Add message to conversation
   */
  function addMessage(role, content, extra) {
    if (!chatWidget) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-chatbot-message ai-chatbot-${role}`;

    // Mini Bot Avatar for assistant
    if (role === 'assistant') {
      const botAvatar = document.createElement('div');
      botAvatar.className = 'ai-bot-avatar-mini';
      botAvatar.innerHTML = ICON_BOT;
      messageDiv.appendChild(botAvatar);
    }

    const contentWrap = document.createElement('div');
    contentWrap.className = 'ai-message-content-wrap';

    const bubble = document.createElement('div');
    bubble.className = 'ai-message-bubble';

    if (role === 'assistant') {
      bubble.innerHTML = renderMessage(content);
    } else {
      bubble.textContent = content;
    }

    contentWrap.appendChild(bubble);

    // Meta bar (timestamps, copy button, status)
    if (role === 'assistant') {
      const actionRow = document.createElement('div');
      actionRow.className = 'ai-bubble-actions';

      const timeSpan = document.createElement('span');
      timeSpan.className = 'ai-chatbot-meta';
      timeSpan.textContent = formatTime(new Date());

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'ai-copy-btn';
      copyBtn.innerHTML = `${ICON_COPY}<span>Copy</span>`;
      copyBtn.setAttribute('aria-label', 'Copy response text');

      copyBtn.onclick = () => {
        const plainText = bubble.innerText || bubble.textContent;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(plainText).then(() => {
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = `${ICON_CHECK}<span>Copied!</span>`;
            setTimeout(() => {
              copyBtn.classList.remove('copied');
              copyBtn.innerHTML = `${ICON_COPY}<span>Copy</span>`;
            }, 2000);
          });
        }
      };

      actionRow.appendChild(timeSpan);
      actionRow.appendChild(copyBtn);
      contentWrap.appendChild(actionRow);
    } else if (role === 'user') {
      const metaSpan = document.createElement('div');
      metaSpan.className = 'ai-chatbot-meta';
      metaSpan.innerHTML = `<span>${formatTime(new Date())}</span><span class="ai-check-icon">${ICON_CHECK}</span>`;
      contentWrap.appendChild(metaSpan);
    }

    messageDiv.appendChild(contentWrap);
    chatWidget.messagesContainer.appendChild(messageDiv);

    // Render structured product cards
    if (role === 'assistant' && extra && extra.products && extra.products.length > 0) {
      const productList = document.createElement('div');
      productList.className = 'ai-chatbot-product-list';

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
          const imgWrap = document.createElement('div');
          imgWrap.className = 'ai-product-img-wrap';
          const img = document.createElement('img');
          img.src = p.image;
          img.alt = p.title || 'Product';
          img.loading = 'lazy';
          imgWrap.appendChild(img);
          card.appendChild(imgWrap);
        }

        const label = document.createElement('div');
        label.className = 'ai-chatbot-product-card-label';

        const titleEl = document.createElement('div');
        titleEl.className = 'ai-chatbot-product-card-title';
        titleEl.textContent = p.title || '';

        const priceEl = document.createElement('div');
        priceEl.className = 'ai-chatbot-product-card-price';
        priceEl.textContent = `${p.currency || 'PKR'} ${p.price || ''}`.trim();

        label.appendChild(titleEl);
        label.appendChild(priceEl);

        if (hasUrl) {
          const actionLink = document.createElement('div');
          actionLink.className = 'ai-product-action-link';
          actionLink.innerHTML = `<span>View Details</span><span>&rarr;</span>`;
          label.appendChild(actionLink);
        }

        card.appendChild(label);
        productList.appendChild(card);
      }

      chatWidget.messagesContainer.appendChild(productList);
    }

    smartScrollToBottom(false);
    messages.push({ role, content, timestamp: new Date() });
  }

  /**
   * Open widget
   */
  function openWidget() {
    if (!chatWidget) return;

    chatWidget.isOpen = true;
    clearUnread();
    if (typeof chatWidget.dismissTeaser === 'function') {
      chatWidget.dismissTeaser();
    }

    chatWidget.container.style.display = 'flex';
    chatWidget.container.classList.add('open');
    chatWidget.fab.classList.add('ai-chatbot-fab-open');
    chatWidget.fab.setAttribute('aria-expanded', 'true');
    chatWidget.fab.setAttribute('aria-label', 'Close chat assistance');
    localStorage.setItem('ai-chatbot-state', 'open');

    // Prevent body scroll on mobile
    if (window.innerWidth <= 640) {
      document.body.style.overflow = 'hidden';
    }

    setTimeout(() => {
      chatWidget.input.focus();
      smartScrollToBottom(true);
    }, 120);
  }

  /**
   * Toggle widget
   */
  function toggleWidget() {
    if (!chatWidget) return;

    const isVisible = chatWidget.container.style.display !== 'none';
    if (isVisible) {
      chatWidget.isOpen = false;
      chatWidget.container.style.display = 'none';
      chatWidget.container.classList.remove('open');
      chatWidget.fab.classList.remove('ai-chatbot-fab-open');
      chatWidget.fab.setAttribute('aria-expanded', 'false');
      chatWidget.fab.setAttribute('aria-label', 'Open chat assistance');
      localStorage.setItem('ai-chatbot-state', 'closed');
      document.body.style.overflow = '';
    } else {
      openWidget();
    }
  }

  function getHistory() {
    return messages;
  }

  function clearHistory() {
    messages = [];
    if (chatWidget) {
      try {
        localStorage.removeItem(SESSION_ID_KEY);
      } catch (_) {}
      chatWidget.sessionId = getOrCreateSessionId();
      chatWidget.messagesContainer.innerHTML = '';
      chatWidget.messagesContainer.appendChild(chatWidget.jumpBtn);
      addMessage('assistant', 'Chat conversation cleared. How can I help you today?');
    }
  }

  // Expose API
  window.AIChatbot = {
    init,
    toggle: toggleWidget,
    open: openWidget,
    getHistory,
    clearHistory,
    version: '1.2.0',
  };

  document.addEventListener('DOMContentLoaded', () => {
    const scripts = document.querySelectorAll('script[data-ai-chatbot]');
    if (scripts.length > 0) {
      init();
    }
  });
})();
