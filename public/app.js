'use strict';

// ── Theme ──────────────────────────────────────────────────────────────────
var RUDRA_THEME = {
  background:          '#0d0d14',
  foreground:          '#e2e2f0',
  cursor:              '#a78bfa',
  cursorAccent:        '#0d0d14',
  selectionBackground: 'rgba(124, 58, 237, 0.2)',
  selectionForeground: '#e2e2f0',
  black:         '#1a1a2e',
  red:           '#ff6b6b',
  green:         '#4ade80',
  yellow:        '#facc15',
  blue:          '#60a5fa',
  magenta:       '#c084fc',
  cyan:          '#22d3ee',
  white:         '#e2e2f0',
  brightBlack:   '#44445a',
  brightRed:     '#fca5a5',
  brightGreen:   '#86efac',
  brightYellow:  '#fde68a',
  brightBlue:    '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan:    '#67e8f9',
  brightWhite:   '#f8fafc',
};

// ── About panel ────────────────────────────────────────────────────────────
var aboutPanel    = document.getElementById('about-panel');
var aboutBackdrop = document.getElementById('about-backdrop');

function openAbout() {
  aboutPanel.hidden    = false;
  aboutBackdrop.hidden = false;
}
function closeAbout() {
  aboutPanel.hidden    = true;
  aboutBackdrop.hidden = true;
}

document.getElementById('rudra-identity').addEventListener('click', openAbout);
// Prevent caption link click from bubbling up to identity → About panel
document.getElementById('rudra-caption').addEventListener('click', function(e) {
  e.stopPropagation();
});
aboutBackdrop.addEventListener('click', closeAbout);
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && !aboutPanel.hidden) { closeAbout(); }
});

// ── Status bar ─────────────────────────────────────────────────────────────
var statusDot        = document.getElementById('status-dot');
var statusConnection = document.getElementById('status-connection');
var statusShell      = document.getElementById('status-shell');
var statusTabname    = document.getElementById('status-tabname');
var statusDims       = document.getElementById('status-dims');
var rudraStatusDot   = document.getElementById('rudra-status-dot');

function updateStatusBar(tab) {
  if (!tab) {
    statusDot.className          = 'status-dot dead';
    statusConnection.textContent = 'No terminal';
    statusShell.textContent      = '—';
    statusTabname.textContent    = '—';
    rudraStatusDot.className     = 'dead';
    document.title               = 'RUDRA';
    return;
  }
  if (tab.dead) {
    statusDot.className          = 'status-dot dead';
    statusConnection.textContent = 'Disconnected';
    rudraStatusDot.className     = 'dead';
  } else {
    statusDot.className          = 'status-dot connected';
    statusConnection.textContent = 'Connected';
    rudraStatusDot.className     = '';
  }
  statusShell.textContent   = tab.shell === 'claude' ? 'Claude Code' : 'CMD';
  statusTabname.textContent = tab.label;
  document.title            = tab.label + ' — RUDRA';
}

function updateTermDims(tab) {
  if (!tab || !tab.term) { statusDims.textContent = '—'; return; }
  statusDims.textContent = tab.term.cols + ' \xd7 ' + tab.term.rows;
}

// ── Tab label inline rename ────────────────────────────────────────────────
function makeTabLabelEditable(labelEl, tab) {
  var input = document.createElement('input');
  input.className = 'tab-rename-input';
  input.value     = tab.label;
  labelEl.replaceWith(input);
  input.focus();
  input.select();

  function commit() {
    var val = input.value.trim();
    if (val) { tab.label = val; }
    var newLabel = document.createElement('span');
    newLabel.className   = 'tab-label';
    newLabel.textContent = tab.label;
    newLabel.addEventListener('dblclick', function() {
      makeTabLabelEditable(newLabel, tab);
    });
    input.replaceWith(newLabel);
    updateStatusBar(tab);
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter')  { input.blur(); }
    if (e.key === 'Escape') { input.value = tab.label; input.blur(); }
    e.stopPropagation();
  });
}

// ── Tab ────────────────────────────────────────────────────────────────────
var tabCounter = 0;

function Tab(shell) {
  this.id    = ++tabCounter;
  this.shell = shell;
  this.label = shell === 'claude' ? 'Claude Code' : 'CMD';
  this.dead  = false;
  this.ws    = null;

  this.term = new Terminal({
    theme:            RUDRA_THEME,
    fontFamily:       "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
    fontSize:         13,
    lineHeight:       1.4,
    letterSpacing:    0,
    cursorBlink:      true,
    cursorStyle:      'block',
    scrollback:       5000,
    allowProposedApi: true,
    convertEol:       false,
  });

  this.fitAddon = new FitAddon.FitAddon();
  this.term.loadAddon(this.fitAddon);

  var WLA = (typeof WebLinksAddon !== 'undefined')
    ? (WebLinksAddon.WebLinksAddon || WebLinksAddon)
    : null;
  if (WLA) { this.term.loadAddon(new WLA()); }

  // Tab element
  var tabEl = document.createElement('div');
  tabEl.className  = 'tab ' + shell;
  tabEl.dataset.id = this.id;

  var icon = document.createElement('span');
  icon.className   = 'tab-icon';
  icon.textContent = shell === 'claude' ? '◆' : '▣';

  var labelEl = document.createElement('span');
  labelEl.className   = 'tab-label';
  labelEl.textContent = this.label;

  var closeBtn = document.createElement('button');
  closeBtn.className   = 'tab-close';
  closeBtn.textContent = '✕';
  closeBtn.title       = 'Close tab';
  closeBtn.setAttribute('aria-label', 'Close ' + this.label);

  tabEl.appendChild(icon);
  tabEl.appendChild(labelEl);
  tabEl.appendChild(closeBtn);
  this.tabEl = tabEl;

  // Pane container
  var paneEl = document.createElement('div');
  paneEl.className     = 'term-pane';
  paneEl.style.display = 'none';
  paneEl.tabIndex      = 0;
  this.containerEl     = paneEl;

  // Events
  var self = this;

  labelEl.addEventListener('dblclick', function() {
    makeTabLabelEditable(labelEl, self);
  });
  closeBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    tabManager.closeTab(self.id);
  });
  tabEl.addEventListener('click', function() {
    tabManager.activateTab(self.id);
  });
  paneEl.addEventListener('click', function() {
    if (splitManager.isActive) {
      splitManager.focusPane(self);
      self.term.focus();
    }
  });
}

Tab.prototype.connect = function() {
  var container = document.getElementById('term-container');
  container.appendChild(this.containerEl);
  this.term.open(this.containerEl);
  this._openWS();
};

Tab.prototype._openWS = function() {
  var self     = this;
  var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  this.ws = new WebSocket(protocol + '//' + location.host + '/pty?shell=' + this.shell);

  this.ws.addEventListener('open', function() {
    self.sendResize();
  });

  this.ws.addEventListener('message', function(evt) {
    self.term.write(evt.data);
  });

  this.ws.addEventListener('close', function() {
    self.dead = true;
    self.tabEl.classList.add('dead');
    self.term.write('\r\n\x1b[31m[Process exited]\x1b[0m\r\n');
    if (tabManager.activeTab === self) {
      updateStatusBar(self);
    }
  });
};

Tab.prototype.sendResize = function() {
  if (this.ws && this.ws.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify({ type: 'resize', cols: this.term.cols, rows: this.term.rows }));
  }
};

Tab.prototype.fit = function() {
  if (this.containerEl.style.display === 'none') { return; }
  this.fitAddon.fit();
  this.sendResize();
  updateTermDims(this);
};

Tab.prototype.destroy = function() {
  if (this.ws) { this.ws.close(); this.ws = null; }
  this.term.dispose();
  if (this.containerEl.parentNode) { this.containerEl.parentNode.removeChild(this.containerEl); }
  if (this.tabEl.parentNode)       { this.tabEl.parentNode.removeChild(this.tabEl); }
};

// ── TabManager ─────────────────────────────────────────────────────────────
function TabManager() {
  this.tabs      = [];
  this.activeTab = null;
  this.tabList   = document.getElementById('tab-list');
}

TabManager.prototype.createTab = function(shell) {
  var tab = new Tab(shell);
  this.tabs.push(tab);
  this.tabList.appendChild(tab.tabEl);
  tab.connect();
  this.activateTab(tab.id);
  return tab;
};

TabManager.prototype.activateTab = function(id) {
  var tab = this.tabs.find(function(t) { return t.id === id; });
  if (!tab) { return; }

  var prev = this.activeTab;
  if (prev && prev.id !== id) {
    prev.tabEl.classList.remove('active');
    if (!splitManager.isActive ||
        (splitManager.primary !== prev && splitManager.secondary !== prev)) {
      prev.containerEl.style.display = 'none';
    }
  }

  this.activeTab = tab;
  tab.tabEl.classList.add('active');
  tab.containerEl.style.display = 'flex';

  requestAnimationFrame(function() {
    tab.fit();
    tab.term.focus();
  });

  updateStatusBar(tab);
  updateTermDims(tab);
};

TabManager.prototype.closeTab = function(id) {
  var idx = this.tabs.findIndex(function(t) { return t.id === id; });
  if (idx === -1) { return; }

  var tab       = this.tabs[idx];
  var wasActive = this.activeTab && this.activeTab.id === id;

  if (splitManager.isActive &&
      (splitManager.primary === tab || splitManager.secondary === tab)) {
    splitManager.deactivate();
  }

  tab.destroy();
  this.tabs.splice(idx, 1);

  if (wasActive) {
    this.activeTab = null;
    if (this.tabs.length > 0) {
      var next = this.tabs[Math.min(idx, this.tabs.length - 1)];
      this.activateTab(next.id);
    } else {
      updateStatusBar(null);
      updateTermDims(null);
    }
  }
};

TabManager.prototype.activateNextTab = function() {
  if (!this.activeTab || this.tabs.length < 2) { return; }
  var idx  = this.tabs.findIndex(function(t) { return t.id === tabManager.activeTab.id; });
  var next = this.tabs[(idx + 1) % this.tabs.length];
  this.activateTab(next.id);
};

TabManager.prototype.activatePrevTab = function() {
  if (!this.activeTab || this.tabs.length < 2) { return; }
  var idx  = this.tabs.findIndex(function(t) { return t.id === tabManager.activeTab.id; });
  var prev = this.tabs[(idx - 1 + this.tabs.length) % this.tabs.length];
  this.activateTab(prev.id);
};

// ── SplitManager ───────────────────────────────────────────────────────────
function SplitManager() {
  this.isActive    = false;
  this.direction   = null;
  this.primary     = null;
  this.secondary   = null;
  this.ratio       = 0.5;
  this.dividerEl   = document.getElementById('pane-divider');
  this._onMouseMove = null;
  this._onMouseUp   = null;
}

SplitManager.prototype.splitRight = function() { this._split('horizontal'); };
SplitManager.prototype.splitDown  = function() { this._split('vertical');   };

SplitManager.prototype._split = function(direction) {
  if (this.isActive) { this.deactivate(); }
  var active = tabManager.activeTab;
  if (!active) { return; }

  var secondary = new Tab(active.shell);
  tabManager.tabs.push(secondary);
  tabManager.tabList.appendChild(secondary.tabEl);
  secondary.connect();
  secondary.tabEl.classList.add('active');

  this.activate(active, secondary, direction);
  this._updateUnsplitBtn(true);
};

SplitManager.prototype.activate = function(primary, secondary, direction) {
  this.primary   = primary;
  this.secondary = secondary;
  this.direction = direction;
  this.isActive  = true;
  this.ratio     = 0.5;

  var container = document.getElementById('term-container');
  var divider   = this.dividerEl;

  divider.hidden    = false;
  divider.className = 'pane-divider' + (direction === 'vertical' ? ' horizontal' : '');

  container.classList.add('split-' + direction);

  // Enforce DOM order: primary → divider → secondary
  container.appendChild(primary.containerEl);
  container.appendChild(divider);
  container.appendChild(secondary.containerEl);

  primary.containerEl.style.display   = 'flex';
  secondary.containerEl.style.display = 'flex';
  primary.containerEl.classList.add('focused');

  this._applyRatio();
  this._bindDividerDrag();

  requestAnimationFrame(function() {
    primary.fit();
    secondary.fit();
  });
};

SplitManager.prototype.deactivate = function() {
  if (!this.isActive) { return; }

  var container = document.getElementById('term-container');
  container.classList.remove('split-horizontal', 'split-vertical');

  this.dividerEl.hidden = true;
  this.primary.containerEl.style.flex   = '';
  this.secondary.containerEl.style.flex = '';
  this.primary.containerEl.classList.remove('focused');
  this.secondary.containerEl.classList.remove('focused');
  this.secondary.containerEl.style.display = 'none';

  if (this._onMouseMove) {
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup',   this._onMouseUp);
    this._onMouseMove = null;
    this._onMouseUp   = null;
  }

  this.isActive  = false;
  this.primary   = null;
  this.secondary = null;
  this.direction = null;

  this._updateUnsplitBtn(false);

  var active = tabManager.activeTab;
  if (active) { requestAnimationFrame(function() { active.fit(); }); }
};

SplitManager.prototype.focusPane = function(tab) {
  if (!this.isActive) { return; }
  this.primary.containerEl.classList.toggle('focused',   this.primary   === tab);
  this.secondary.containerEl.classList.toggle('focused', this.secondary === tab);
  updateStatusBar(tab);
  updateTermDims(tab);
};

SplitManager.prototype._applyRatio = function() {
  var pct = (this.ratio * 100).toFixed(2) + '%';
  var rem = ((1 - this.ratio) * 100).toFixed(2) + '%';
  this.primary.containerEl.style.flex   = '0 0 ' + pct;
  this.secondary.containerEl.style.flex = '0 0 ' + rem;
};

SplitManager.prototype.refitBoth = function() {
  if (!this.isActive) { return; }
  this.primary.fit();
  this.secondary.fit();
};

SplitManager.prototype._bindDividerDrag = function() {
  var self    = this;
  var divider = this.dividerEl;

  // Use onmousedown to replace any prior handler (idempotent across re-splits)
  divider.onmousedown = function(e) {
    e.preventDefault();
    divider.classList.add('dragging');

    var container     = document.getElementById('term-container');
    var containerRect = container.getBoundingClientRect();

    self._onMouseMove = function(e) {
      var ratio = self.direction === 'horizontal'
        ? (e.clientX - containerRect.left) / containerRect.width
        : (e.clientY - containerRect.top)  / containerRect.height;
      self.ratio = Math.max(0.2, Math.min(0.8, ratio));
      self._applyRatio();
    };

    self._onMouseUp = function() {
      divider.classList.remove('dragging');
      document.removeEventListener('mousemove', self._onMouseMove);
      document.removeEventListener('mouseup',   self._onMouseUp);
      self._onMouseMove = null;
      self._onMouseUp   = null;
      self.refitBoth();
    };

    document.addEventListener('mousemove', self._onMouseMove);
    document.addEventListener('mouseup',   self._onMouseUp);
  };
};

SplitManager.prototype._updateUnsplitBtn = function(show) {
  document.getElementById('unsplit').hidden         = !show;
  document.getElementById('unsplit-divider').hidden = !show;
};

// ── Init managers ──────────────────────────────────────────────────────────
var tabManager   = new TabManager();
var splitManager = new SplitManager();

// ── Dropdown helper ────────────────────────────────────────────────────────
function setupDropdown(btnId, dropdownId) {
  var btn      = document.getElementById(btnId);
  var dropdown = document.getElementById(dropdownId);

  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    var wasVisible = dropdown.classList.contains('visible');
    document.querySelectorAll('.dropdown.visible').forEach(function(d) {
      d.classList.remove('visible');
      d.hidden = true;
    });
    if (!wasVisible) {
      dropdown.hidden = false;
      requestAnimationFrame(function() { dropdown.classList.add('visible'); });
    }
  });

  document.addEventListener('click', function() {
    if (dropdown.classList.contains('visible')) {
      dropdown.classList.remove('visible');
      dropdown.hidden = true;
    }
  });
}

setupDropdown('btn-new',   'dropdown-new');
setupDropdown('btn-split', 'dropdown-split');

// ── New terminal dropdown ──────────────────────────────────────────────────
document.querySelectorAll('#dropdown-new .dropdown-item[data-shell]').forEach(function(item) {
  item.addEventListener('click', function() {
    tabManager.createTab(item.dataset.shell);
    document.getElementById('dropdown-new').classList.remove('visible');
    document.getElementById('dropdown-new').hidden = true;
  });
});

// ── Split dropdown ─────────────────────────────────────────────────────────
function closeDropdownSplit() {
  var d = document.getElementById('dropdown-split');
  d.classList.remove('visible');
  d.hidden = true;
}

document.getElementById('split-right').addEventListener('click', function() {
  if (tabManager.activeTab) { splitManager.splitRight(); }
  closeDropdownSplit();
});

document.getElementById('split-down').addEventListener('click', function() {
  if (tabManager.activeTab) { splitManager.splitDown(); }
  closeDropdownSplit();
});

document.getElementById('unsplit').addEventListener('click', function() {
  splitManager.deactivate();
  closeDropdownSplit();
});

// ── Keyboard shortcuts ─────────────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.shiftKey) {
    if (e.key === 'T') {
      e.preventDefault();
      tabManager.createTab('cmd');
    } else if (e.key === 'C') {
      e.preventDefault();
      tabManager.createTab('claude');
    } else if (e.key === 'W') {
      e.preventDefault();
      if (tabManager.activeTab) { tabManager.closeTab(tabManager.activeTab.id); }
    }
  } else if (e.ctrlKey && !e.shiftKey && e.key === 'Tab') {
    e.preventDefault();
    tabManager.activateNextTab();
  } else if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
    e.preventDefault();
    tabManager.activatePrevTab();
  } else if (e.ctrlKey && e.key === '\\') {
    e.preventDefault();
    if (tabManager.activeTab) { splitManager.splitRight(); }
  }
});

// ── Window resize ──────────────────────────────────────────────────────────
var resizeTimer = null;
window.addEventListener('resize', function() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function() {
    if (splitManager.isActive)       { splitManager.refitBoth(); }
    else if (tabManager.activeTab)   { tabManager.activeTab.fit(); }
  }, 100);
});

// ── Boot ───────────────────────────────────────────────────────────────────
tabManager.createTab('claude');
