(function () {
    'use strict';

    const APP_ID = 'RedacaoBypass';
    const COOKIE_NAME = 'rb_gemini_key_v2';
    const REQUIRED_PATH = '/student-write-essay'; 

    // =================================================================
    // 1. UTILITÁRIOS
    // =================================================================
    const Utils = {
        setCookie: (name, value, days = 365) => {
            const d = new Date();
            d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
            document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
        },
        getCookie: (name) => {
            const v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
            return v ? v[2] : null;
        },
        loadScript: (src, id) => {
            return new Promise((resolve, reject) => {
                if (document.getElementById(id)) return resolve();
                const s = document.createElement('script');
                s.id = id; s.src = src; s.onload = resolve; s.onerror = reject;
                document.head.appendChild(s);
            });
        },
        isTitleField: (element) => {
            if (!element) return false;
            if (element.tagName === 'INPUT' && element.type === 'text') {
                const parent = element.closest('.MuiFormControl-root');
                if (parent && parent.querySelector('label')?.textContent.includes('Título')) return true;
                if (element.getAttribute('maxlength') === '100') return true;
            }
            return false;
        },
        scrapeAssignmentData: () => {
            const getTextByLabel = (lbl) => {
                const all = Array.from(document.querySelectorAll('p.MuiTypography-root'));
                const node = all.find(p => p.textContent.trim() === lbl);
                if (node && node.nextElementSibling) return node.nextElementSibling.textContent.trim();
                if (node && node.parentElement) {
                     const siblings = Array.from(node.parentElement.children);
                     const idx = siblings.indexOf(node);
                     if (siblings[idx + 1]) return siblings[idx + 1].textContent.trim();
                }
                return null;
            };
            const getSection = (txt) => {
                const all = Array.from(document.querySelectorAll('p.MuiTypography-root'));
                const head = all.find(p => p.textContent.trim().includes(txt));
                if (!head) return '';
                let container = head.closest('.MuiBox-root');
                if (container && container.nextElementSibling) {
                    let next = container.nextElementSibling;
                    while(next && next.textContent.trim() === '') next = next.nextElementSibling;
                    if (next) return next.textContent.trim();
                }
                return '';
            };
            return {
                tema: getTextByLabel('Tema:') || 'Tema Livre',
                genero: getTextByLabel('Gênero:') || 'Dissertação',
                palavras: getTextByLabel('Número de palavras:') || '20 linhas',
                textoApoio: getSection('ENUNCIADO') + ' ' + getSection('TEXTO DE APOIO')
            };
        }
    };

    // =================================================================
    // 2. LIMPEZA
    // =================================================================
    if (window[APP_ID]) {
        window[APP_ID].destroy();
        delete window[APP_ID];
    }

    // =================================================================
    // 3. ESTILOS
    // =================================================================
    const styleId = `${APP_ID}_styles`;
    document.getElementById(styleId)?.remove();

    const css = `
        :root {
            --rb-bg: #09090b; --rb-surface: #18181b; --rb-border: #27272a;
            --rb-primary: #3b82f6; --rb-primary-hover: #2563eb;
            --rb-text: #e4e4e7; --rb-muted: #a1a1aa; --rb-danger: #ef4444;
            --rb-font: 'Inter', sans-serif;
            --rb-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
        }

        #${APP_ID}_overlay {
            position: fixed; top: 60px; left: 20px; z-index: 999999;
            font-family: var(--rb-font);
        }

        .rb-panel {
            background: var(--rb-bg); color: var(--rb-text);
            padding: 16px; border-radius: 12px; width: 320px;
            box-shadow: var(--rb-shadow); border: 1px solid var(--rb-border);
            display: flex; flex-direction: column; gap: 12px;
            animation: rbFadeIn 0.2s ease-out;
        }

        .rb-minimized-bubble {
            width: 50px; height: 50px;
            background: var(--rb-bg); border: 2px solid var(--rb-primary);
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            cursor: pointer; box-shadow: 0 0 15px rgba(59, 130, 246, 0.4);
            font-size: 24px; animation: rbPopIn 0.3s;
            user-select: none; z-index: 1000000;
        }

        .rb-header { 
            display: flex; justify-content: space-between; align-items: center; 
            padding: 6px; background: rgba(255,255,255,0.03); border-radius: 6px;
            cursor: move; user-select: none;
        }

        .rb-header-controls { display: flex; gap: 12px; align-items: center; }
        
        .rb-win-btn { 
            cursor: pointer; font-size: 18px; width: 30px; height: 30px;
            display: flex; align-items: center; justify-content: center;
            border-radius: 6px; font-weight: bold; position: relative; z-index: 1000;
        }
        .rb-btn-min { color: var(--rb-muted); background: rgba(255,255,255,0.08); }
        .rb-btn-min:hover { background: rgba(255,255,255,0.2); color: #fff; }
        .rb-btn-close { color: var(--rb-danger); background: rgba(239, 68, 68, 0.15); }
        .rb-btn-close:hover { background: rgba(239, 68, 68, 0.3); }

        .rb-error-modal {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: var(--rb-bg); color: var(--rb-text);
            padding: 24px; border-radius: 16px; width: 300px; text-align: center;
            border: 1px solid var(--rb-danger);
            z-index: 10000000;
        }
        .rb-title { font-size: 14px; font-weight: 700; color: var(--rb-primary); text-transform: uppercase; }
        .rb-field-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 700; margin-left: 8px; }
        .rb-badge-title { background: #f59e0b; color: #000; }
        .rb-badge-body { background: var(--rb-primary); color: #fff; }
        .rb-textarea, .rb-input {
            background: var(--rb-surface); border: 1px solid var(--rb-border); color: #fff;
            border-radius: 6px; font-size: 13px; font-family: inherit; outline: none;
            width: 100%; box-sizing: border-box;
        }
        .rb-textarea { padding: 10px; height: 90px; resize: none; }
        .rb-input { padding: 8px; margin-bottom: 8px; }
        .rb-chips-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 4px; }
        .rb-chip {
            background: var(--rb-surface); border: 1px solid var(--rb-border); color: var(--rb-muted);
            padding: 6px 0; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; text-align: center;
        }
        .rb-chip.active { background: var(--rb-primary); color: white; border-color: var(--rb-primary); }
        .rb-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; }
        .rb-btn {
            border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px;
            display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .rb-btn-primary { background: var(--rb-primary); color: white; }
        .rb-btn-ai { width: 100%; background: #1e3a8a; color: #bfdbfe; border: 1px solid #1e40af; margin-bottom: 4px; }
        .rb-btn-action { background: var(--rb-surface); color: var(--rb-text); border: 1px solid var(--rb-border); }
        .rb-progress-bar { height: 3px; background: var(--rb-primary); width: 0%; transition: width 0.1s linear; }
        .rb-toast {
            position: fixed; top: 10%; left: 50%; transform: translateX(-50%);
            background: #09090b; color: #fff; padding: 8px 16px; border-radius: 20px;
            z-index: 1000000; border: 1px solid var(--rb-border); display: flex; gap: 8px; pointer-events: none;
        }
        .rb-highlighter {
            position: absolute; pointer-events: none; border: 2px dashed var(--rb-primary);
            background: rgba(59, 130, 246, 0.1); z-index: 999990;
        }
        @keyframes rbFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rbPopIn { from { transform: scale(0); } to { transform: scale(1); } }
    `;

    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    class RedacaoBypassEngine {
        constructor() {
            this.state = {
                target: null, isTargetTitle: false, text: '', speed: 40,
                isPaused: false, isTyping: false, index: 0, 
                apiKey: Utils.getCookie(COOKIE_NAME) || '',
                isMinimized: false
            };
            this.ui = null; this.toastEl = null; this.highlighter = null;
            this.dragState = { isDragging: false };
            this.handleSelection = this.handleSelection.bind(this);
            this.init();
        }

        async init() {
            if (!window.location.href.includes(REQUIRED_PATH)) {
                this.showErrorModal(); return;
            }
            try {
                await Utils.loadScript("https://cdn.jsdelivr.net/npm/darkreader@4.9.92/darkreader.min.js", "dr").then(() => {
                    if (window.DarkReader) {
                        window.DarkReader.setFetchMethod(window.fetch);
                        window.DarkReader.enable({ brightness: 100, contrast: 90, sepia: 10 });
                    }
                });
            } catch (_) {}

            this.createOverlay();
            this.enableSelectionMode();
            this.showToast('👆 Selecione o campo...');
        }

        showErrorModal() {
            const modal = document.createElement('div');
            modal.className = 'rb-error-modal';
            modal.innerHTML = `<h3 style="color:#ef4444">Local Inválido</h3><p>Use na página de redação.</p><button id="rb-err-close" class="rb-btn rb-btn-action" style="margin:0 auto">OK</button>`;
            document.body.appendChild(modal);
            document.getElementById('rb-err-close').onclick = () => { modal.remove(); this.destroy(); };
        }

        createOverlay() {
            const el = document.createElement('div');
            el.id = `${APP_ID}_overlay`;
            document.body.appendChild(el);
            this.ui = el;
        }

        showToast(msg) {
            if (this.toastEl) this.toastEl.remove();
            this.toastEl = document.createElement('div');
            this.toastEl.className = 'rb-toast';
            this.toastEl.innerHTML = `<span>⚡</span> <span>${msg}</span>`;
            document.body.appendChild(this.toastEl);
            setTimeout(() => { if(this.toastEl) this.toastEl.remove(); }, 3000);
        }

        applyDrag(handle, container) {
            let startX, startY, initialLeft, initialTop;
            
            const onDown = (e) => {
                if (e.target.closest('.rb-win-btn')) return;
                if(e.type === 'touchstart') document.body.style.overflow = 'hidden';

                this.dragState.isDragging = true;
                const clientX = e.clientX || e.touches[0].clientX;
                const clientY = e.clientY || e.touches[0].clientY;
                startX = clientX;
                startY = clientY;

                const rect = container.getBoundingClientRect();
                initialLeft = rect.left;
                initialTop = rect.top;
                
                container.style.right = 'auto';
                container.style.bottom = 'auto';
            };

            const onMove = (e) => {
                if (!this.dragState.isDragging) return;
                e.preventDefault();
                const clientX = e.clientX || e.touches[0].clientX;
                const clientY = e.clientY || e.touches[0].clientY;
                const dx = clientX - startX;
                const dy = clientY - startY;
                container.style.left = `${initialLeft + dx}px`;
                container.style.top = `${initialTop + dy}px`;
            };

            const onUp = () => {
                this.dragState.isDragging = false;
                document.body.style.overflow = '';
            };

            handle.addEventListener('mousedown', onDown);
            handle.addEventListener('touchstart', onDown, {passive: false});
            document.addEventListener('mousemove', onMove);
            document.addEventListener('touchmove', onMove, {passive: false});
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchend', onUp);
        }

        toggleMinimize() {
            this.state.isMinimized = !this.state.isMinimized;
            if (this.state.isMinimized) this.renderMinimizedView();
            else this.renderConfigPanel();
        }

        renderMinimizedView() {
            if (!this.ui) return;
            this.ui.className = 'rb-minimized-bubble';
            this.ui.innerHTML = `⚡`;
            
            this.applyDrag(this.ui, this.ui);
            
            let startPos = {x:0, y:0};
            this.ui.onmousedown = (e) => { startPos = {x: e.clientX, y: e.clientY}; };
            this.ui.onclick = (e) => {
                if (Math.abs(e.clientX - startPos.x) < 5 && Math.abs(e.clientY - startPos.y) < 5) {
                    this.toggleMinimize();
                }
            };
        }

        renderConfigPanel() {
            if (!this.ui) return;
            this.ui.className = 'rb-panel';
            const oldClone = this.ui.cloneNode(false);
            this.ui.parentNode.replaceChild(oldClone, this.ui);
            this.ui = oldClone;

            const fieldBadge = this.state.isTargetTitle ? 
                `<span class="rb-field-badge rb-badge-title">TÍTULO</span>` : 
                `<span class="rb-field-badge rb-badge-body">REDAÇÃO</span>`;

            this.ui.innerHTML = `
                <div class="rb-header">
                    <div style="display:flex; align-items:center; pointer-events:none;">
                        <span class="rb-title">BYPASS</span> ${fieldBadge}
                    </div>
                    <div class="rb-header-controls">
                        <div id="rb-minimize" class="rb-win-btn rb-btn-min">−</div>
                        <div id="rb-close" class="rb-win-btn rb-btn-close">✕</div>
                    </div>
                </div>

                <div style="border-bottom:1px solid var(--rb-border); padding-bottom:8px">
                    <input type="password" id="rb-api-key" class="rb-input" placeholder="Gemini API Key" value="${this.state.apiKey}">
                    <button id="rb-generate-ai" class="rb-btn rb-btn-ai">Gerar com IA</button>
                </div>

                <textarea id="rb-input" class="rb-textarea" placeholder="Texto...">${this.state.text}</textarea>

                <div class="rb-chips-grid">
                    <div class="rb-chip" data-val="60">Lento</div>
                    <div class="rb-chip active" data-val="40">Normal</div>
                    <div class="rb-chip" data-val="10">Flash</div>
                </div>

                <div class="rb-controls">
                    <button id="rb-start" class="rb-btn rb-btn-primary">DIGITAR</button>
                    <button id="rb-select-new" class="rb-btn rb-btn-action">Trocar</button>
                </div>

                <div id="rb-running-controls" style="display:none; grid-template-columns: 1fr 1fr; gap:8px">
                    <button id="rb-pause" class="rb-btn rb-btn-action">Pausar</button>
                    <button id="rb-stop" class="rb-btn rb-btn-action" style="color:#ef4444">Parar</button>
                </div>

                <div style="height:3px; background:#27272a; margin-top:4px"><div id="rb-bar" class="rb-progress-bar"></div></div>
                <div class="rb-footer">feito por <a href="https://instagram.com/ryanzinn_nyc">@ryanzinn_nyc</a></div>
            `;

            const header = this.ui.querySelector('.rb-header');
            this.applyDrag(header, this.ui);

            const qs = (s) => this.ui.querySelector(s);
            
            const minBtn = qs('#rb-minimize');
            const closeBtn = qs('#rb-close');
            const killEvent = (e) => { e.stopPropagation(); e.preventDefault(); };

            minBtn.addEventListener('mousedown', (e) => e.stopPropagation());
            minBtn.addEventListener('touchstart', (e) => e.stopPropagation());
            minBtn.onclick = (e) => { killEvent(e); this.toggleMinimize(); };
            
            closeBtn.addEventListener('mousedown', (e) => e.stopPropagation());
            closeBtn.addEventListener('touchstart', (e) => e.stopPropagation());
            closeBtn.onclick = (e) => { killEvent(e); this.destroy(); };

            qs('#rb-select-new').onclick = () => { this.ui.innerHTML=''; this.enableSelectionMode(); };
            qs('#rb-api-key').onchange = (e) => { this.state.apiKey = e.target.value.trim(); Utils.setCookie(COOKIE_NAME, this.state.apiKey); };
            qs('#rb-input').oninput = (e) => this.state.text = e.target.value;
            
            qs('#rb-generate-ai').onclick = async () => {
                if(!this.state.apiKey) return alert('API Key?');
                qs('#rb-generate-ai').innerText = '...';
                try {
                    const data = Utils.scrapeAssignmentData();
                    const txt = await this.fetchGemini(data, this.state.isTargetTitle);
                    this.state.text = txt; qs('#rb-input').value = txt;
                } catch(e) { alert(e.message); }
                qs('#rb-generate-ai').innerText = 'Gerar com IA';
            };
            
            qs('#rb-start').onclick = () => {
                const t = qs('#rb-input').value; 
                if(!t) return;
                this.state.text = t;
                qs('.rb-controls').style.display='none';
                qs('#rb-running-controls').style.display='grid';
                this.runTyping(t);
            };

            const chips = this.ui.querySelectorAll('.rb-chip');
            chips.forEach(c => c.onclick = () => {
                chips.forEach(x => x.classList.remove('active')); c.classList.add('active');
                this.state.speed = parseInt(c.dataset.val);
            });
            qs('#rb-pause').onclick = () => { this.state.isPaused = !this.state.isPaused; };
            qs('#rb-stop').onclick = () => this.destroy();
        }

        async fetchGemini(data, isTitle) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.state.apiKey}`;
            
            let prompt = '';
            
            if (isTitle) {
                prompt = `
                    O usuário precisa de um TÍTULO para uma redação escolar.
                    Tema: ${data.tema}.
                    Gênero: ${data.genero}.
                    Gere APENAS um título criativo, curto e impactante.
                    NÃO coloque aspas, NÃO coloque a palavra "Título:". Apenas o texto do título.
                `;
            } else {
                prompt = `
                    Escreva uma redação escolar completa.
                    Gênero Textual: ${data.genero}.
                    Tema: ${data.tema}.
                    Requisitos de tamanho: ${data.palavras}.
                    Contexto/Instruções: ${data.textoApoio}.

                    IMPORTANTE:
                    1. NÃO COLOQUE O TÍTULO NO TEXTO.
                    2. Comece direto no primeiro parágrafo.
                    3. Sem markdown (negrito, itálico). Texto cru.
                    4. Linguagem natural de estudante.
                `;
            }

            const r = await fetch(url, {
                method:'POST', 
                headers:{'Content-Type':'application/json'}, 
                body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})
            });
            
            if(!r.ok) { const err = await r.json(); throw new Error(err.error?.message || 'Erro API'); }
            const j = await r.json(); 
            return j.candidates[0].content.parts[0].text.trim();
        }

        enableSelectionMode() {
            document.body.style.cursor = 'crosshair';
            document.addEventListener('click', this.handleSelection, true);
            document.addEventListener('mouseover', this.handleHover, true);
        }

        disableSelectionMode() {
            document.body.style.cursor = '';
            document.removeEventListener('click', this.handleSelection, true);
            document.removeEventListener('mouseover', this.handleHover, true);
            if(this.highlighter) this.highlighter.remove();
        }

        handleHover = (e) => {
            if(this.ui?.contains(e.target)) return;
            if(!this.highlighter) {
                this.highlighter = document.createElement('div');
                this.highlighter.className = 'rb-highlighter';
                document.body.appendChild(this.highlighter);
            }
            const r = e.target.getBoundingClientRect();
            Object.assign(this.highlighter.style, {top:(r.top+scrollY)+'px', left:(r.left+scrollX)+'px', width:r.width+'px', height:r.height+'px'});
        }

        handleSelection(e) {
            e.preventDefault(); e.stopPropagation();
            const t = e.target;
            if(!t.isContentEditable && t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA') return;
            this.state.target = t;
            this.state.isTargetTitle = Utils.isTitleField(t);
            this.disableSelectionMode();
            this.renderConfigPanel();
        }

        forceReactChange(el, val) {
            const proto = (el.tagName === 'TEXTAREA') ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if(setter) setter.call(el, val); else el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }

        async runTyping(text) {
            this.state.isTyping = true; this.state.index = 0;
            const tgt = this.state.target; tgt.focus();
            if(tgt.value !== undefined) this.forceReactChange(tgt, '');
            
            while(this.state.index < text.length && this.state.isTyping) {
                if(this.state.isPaused) { await new Promise(r=>setTimeout(r,200)); continue; }
                const c = text[this.state.index];
                if(tgt.value !== undefined) {
                    const s = tgt.selectionStart;
                    const v = tgt.value;
                    this.forceReactChange(tgt, v.slice(0,s)+c+v.slice(tgt.selectionEnd));
                    tgt.selectionStart = tgt.selectionEnd = s+1;
                } else document.execCommand('insertText', false, c);
                
                this.state.index++;
                const bar = this.ui.querySelector('#rb-bar');
                if(bar) bar.style.width = (this.state.index/text.length*100)+'%';
                await new Promise(r=>setTimeout(r, this.state.speed + Math.random()*10));
            }
            if(this.state.isTyping) this.finish();
        }

        async finish() {
            this.state.isTyping = false;
            this.showToast('💾 Salvando...');
            const tgt = this.state.target;
            if(tgt && tgt.value !== undefined) {
                const v = tgt.value;
                this.forceReactChange(tgt, v+' ');
                await new Promise(r=>setTimeout(r,100));
                this.forceReactChange(tgt, v);
            }
            await new Promise(r=>setTimeout(r, 500));
            
            let btn = document.querySelector('button[aria-label="SALVAR RASCUNHO"]');
            if(!btn) btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes("SALVAR RASCUNHO"));
            if(btn) {
                if(btn.disabled) { btn.disabled = false; btn.removeAttribute('disabled'); }
                btn.click(); this.showToast('✅ Salvo!');
            }
            
            const bCtrl = this.ui.querySelector('#rb-running-controls');
            if(bCtrl) bCtrl.style.display='none';
            const bStart = this.ui.querySelector('.rb-controls');
            if(bStart) bStart.style.display='grid';
            const inp = this.ui.querySelector('#rb-input');
            if(inp) inp.disabled=false;
        }

        destroy() {
            this.state.isTyping = false;
            this.disableSelectionMode();
            if(this.toastEl) this.toastEl.remove();
            if(this.ui) this.ui.remove();
            window[APP_ID] = null;
        }
    }
    window[APP_ID] = new RedacaoBypassEngine();

})();
