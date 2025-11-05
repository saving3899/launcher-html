/**
 * 대필 모달 UI 생성 및 관리
 */


// 기본 대필 지시문 (실리태번과 유사하지만 커스텀)
const DEFAULT_AUTOFILL_PROMPT = 'You are {{user}}. Next story development: {{대필내용}} (Only describe {{user}}\'s dialogue and actions.)';

/**
 * 대필 히스토리 저장 (최대 5개)
 * @param {string} content - 대필 내용
 * @returns {Promise<boolean>} 저장 성공 여부
 */
async function saveAutofillHistory(content) {
    try {
        if (!content || !content.trim()) {
            return false;
        }
        
        const settings = await SettingsStorage.load();
        const history = settings.autofill_history || [];
        
        // 중복 제거 (같은 내용이 있으면 제거)
        const filteredHistory = history.filter(item => item !== content);
        
        // 최신 항목을 맨 앞에 추가
        filteredHistory.unshift(content);
        
        // 최대 5개만 유지
        const trimmedHistory = filteredHistory.slice(0, 5);
        
        settings.autofill_history = trimmedHistory;
        await SettingsStorage.save(settings);
        
        return true;
    } catch (error) {
        // 저장 실패 시 조용히 처리 (토스트 알림 없음)
        console.debug('[AutofillModal] 대필 히스토리 저장 실패:', error);
        return false;
    }
}

/**
 * 대필 히스토리 로드
 * @returns {Promise<string[]>} 대필 히스토리 배열 (최대 5개)
 */
async function loadAutofillHistory() {
    const settings = await SettingsStorage.load();
    return settings.autofill_history || [];
}

/**
 * 대필 히스토리 모달 HTML 생성
 * @returns {Promise<string>} HTML 문자열
 */
async function createAutofillHistoryModal() {
    const history = await loadAutofillHistory();
    
    // 5개 버튼 생성 (히스토리가 부족하면 빈 버튼)
    let buttonsHtml = '';
    for (let i = 0; i < 5; i++) {
        const content = history[i] || '';
        // data-content는 나중에 JavaScript로 읽으므로 JSON.stringify로 안전하게 처리
        const contentAttr = content ? `data-content="${escapeHtml(content.replace(/"/g, '&quot;'))}"` : '';
        buttonsHtml += `
            <button type="button" class="autofill-history-btn" ${contentAttr} ${!content ? 'disabled' : ''}>
                ${content ? escapeHtml(content) : '(비어있음)'}
            </button>
        `;
    }
    
    return `
        <div class="modal-content autofill-history-modal">
            <div class="modal-header">
                <h3>대필 히스토리</h3>
                <button class="icon-btn close-autofill-history-modal-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modal-body autofill-history-modal-body">
                <div class="autofill-history-buttons">
                    ${buttonsHtml}
                </div>
            </div>
        </div>
    `;
}


/**
 * 대필 모달 HTML 생성
 * @returns {Promise<string>} HTML 문자열
 */
async function createAutofillModal() {
    // 저장된 대필 지시문 로드
    const settings = await SettingsStorage.load();
    const savedPrompt = settings.autofill_prompt || DEFAULT_AUTOFILL_PROMPT;

    return `
        <div class="modal-content autofill-modal">
            <div class="modal-header">
                <h2>대필</h2>
                <button class="icon-btn close-autofill-modal-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modal-body autofill-modal-body">
                <form id="autofill-form">
                    <div class="form-group">
                        <label for="autofill-content-input">대필 내용 <span class="required">*</span></label>
                        <textarea id="autofill-content-input" class="form-textarea" rows="3" 
                                  placeholder="대필할 내용을 입력하세요..." required></textarea>
                        <small class="form-help">AI가 이 내용을 바탕으로 대필 문장을 생성합니다.</small>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn btn-icon" id="autofill-clipboard-btn" title="클립보드에서 붙여넣기">
                            <i class="fa-solid fa-clipboard"></i>
                        </button>
                        <div class="form-actions-right">
                            <button type="button" class="btn btn-secondary" id="autofill-cancel-btn">취소</button>
                            <button type="submit" class="btn btn-primary" id="autofill-submit-btn">대필</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
}

/**
 * 대필 모달 이벤트 설정
 * @param {HTMLElement} container - 모달 컨테이너
 * @param {Function} onSubmit - 대필 실행 콜백 (prompt, content) => Promise<void>
 * @param {Function} onCancel - 취소 콜백
 */
async function setupAutofillModalEvents(container, onSubmit, onCancel) {
    const form = container.querySelector('#autofill-form');
    const cancelBtn = container.querySelector('#autofill-cancel-btn');
    const closeBtn = container.querySelector('.close-autofill-modal-btn');
    const contentInput = container.querySelector('#autofill-content-input');
    const clipboardBtn = container.querySelector('#autofill-clipboard-btn');

    // 저장된 대필 지시문 로드
    const settings = await SettingsStorage.load();
    const savedPrompt = settings.autofill_prompt || DEFAULT_AUTOFILL_PROMPT;

    // 취소 버튼
    const closeModal = () => {
        if (onCancel) {
            onCancel();
        } else {
            // chatManager의 closeAutofillModal 메서드 사용 (애니메이션 포함)
            if (typeof window !== 'undefined' && window.app && window.app.chatManager) {
                window.app.chatManager.closeAutofillModal(container);
            } else {
                // chatManager를 찾을 수 없으면 즉시 제거 (fallback)
                container.remove();
                const overlay = document.getElementById('overlay');
                if (overlay && !overlay.classList.contains('hidden')) {
                    // 다른 모달이 열려있는지 확인
                    const panelContainer = document.getElementById('panel-modal-container');
                    const settingsModal = document.getElementById('settings-modal');
                    const sideMenu = document.getElementById('side-menu');
                    const settingsModalOpen = settingsModal && !settingsModal.classList.contains('hidden');
                    const sideMenuOpen = sideMenu && !sideMenu.classList.contains('hidden');
                    
                    // 다른 모달이 없으면 오버레이 숨김
                    if (!panelContainer && !settingsModalOpen && !sideMenuOpen) {
                        overlay.classList.add('hidden');
                        overlay.style.pointerEvents = 'none';
                    }
                }
            }
        }
    };

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    // 클립보드 버튼 (히스토리 모달 열기)
    if (clipboardBtn) {
        clipboardBtn.addEventListener('click', async () => {
            await showAutofillHistoryModal(contentInput);
        });
    }

    // 폼 제출
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const content = contentInput?.value.trim() || '';

            if (!content) {
                showToast('대필 내용을 입력해주세요.', 'warning');
                return;
            }

            // 저장된 대필 지시문 사용, {{대필내용}}을 실제 내용으로 치환
            let finalPrompt = savedPrompt.replace(/\{\{대필내용\}\}/g, content);
            
            // {{user}} 치환 (페르소나 이름)
            // SettingsStorage, UserPersonaStorage - 전역 스코프에서 사용
            const currentSettings = await SettingsStorage.load();
            let userName = 'User';
            if (currentSettings.currentPersonaId) {
                const persona = await UserPersonaStorage.load(currentSettings.currentPersonaId);
                if (persona && persona.name) {
                    userName = persona.name;
                }
            }
            finalPrompt = finalPrompt.replace(/\{\{user\}\}/gi, userName);

            // 모달 닫기 (성공 여부와 관계없이 먼저 닫기)
            // closeModal()은 onCancel을 호출하는데, 여기서는 직접 모달을 닫아야 함
            // chatManager의 closeAutofillModal 메서드 사용 (애니메이션 포함)
            if (typeof window !== 'undefined' && window.app && window.app.chatManager) {
                window.app.chatManager.closeAutofillModal(container);
            } else {
                // chatManager를 찾을 수 없으면 즉시 제거 (fallback)
                container.remove();
                const overlay = document.getElementById('overlay');
                if (overlay && !overlay.classList.contains('hidden')) {
                    // 다른 모달이 열려있는지 확인
                    const panelContainer = document.getElementById('panel-modal-container');
                    const settingsModal = document.getElementById('settings-modal');
                    const sideMenu = document.getElementById('side-menu');
                    const settingsModalOpen = settingsModal && !settingsModal.classList.contains('hidden');
                    const sideMenuOpen = sideMenu && !sideMenu.classList.contains('hidden');
                    
                    // 다른 모달이 없으면 오버레이 숨김
                    if (!panelContainer && !settingsModalOpen && !sideMenuOpen) {
                        overlay.classList.add('hidden');
                        overlay.style.pointerEvents = 'none';
                    }
                }
            }
            
            try {
                // 대필 실행 전에 히스토리에 저장 (저장 실패해도 대필은 계속 진행)
                const historySaved = await saveAutofillHistory(content);
                if (!historySaved) {
                    // 히스토리 저장 실패는 경고만 표시하고 계속 진행
                    console.warn('[AutofillModal] 대필 히스토리 저장 실패, 대필은 계속 진행됩니다.');
                }
                
                await onSubmit(finalPrompt, content);
            } catch (error) {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_UI_13002', '대필 실행 오류', error);
                } else if (typeof showToast === 'function') {
                    showToast('대필 실행 중 오류가 발생했습니다: ' + error.message, 'error');
                }
            }
        });
    }
    
    // 입력칸에 자동 포커스 (DOM이 렌더링될 시간을 주기 위해 requestAnimationFrame 사용)
    if (contentInput) {
        requestAnimationFrame(() => {
            contentInput.focus();
        });
    }
}

/**
 * 대필 히스토리 모달 표시
 * @param {HTMLTextAreaElement} contentInput - 대필 내용 입력 필드
 */
async function showAutofillHistoryModal(contentInput) {
    // 기존 히스토리 모달이 있으면 제거
    const existingModal = document.getElementById('autofill-history-modal-container');
    if (existingModal) {
        existingModal.remove();
    }
    
    // 히스토리 모달 HTML 생성
    const modalHtml = await createAutofillHistoryModal();
    
    // 모달 컨테이너 생성
    const modalContainer = document.createElement('div');
    modalContainer.id = 'autofill-history-modal-container';
    modalContainer.className = 'modal autofill-history-modal-container';
    modalContainer.innerHTML = modalHtml;
    
    // 오버레이 확인 및 추가
    let overlay = document.getElementById('overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'overlay';
        overlay.className = 'overlay';
        document.body.appendChild(overlay);
    }
    overlay.classList.remove('hidden');
    
    // 모달을 body에 추가
    document.body.appendChild(modalContainer);
    
    // 히스토리 버튼 이벤트 설정
    const historyButtons = modalContainer.querySelectorAll('.autofill-history-btn');
    historyButtons.forEach(btn => {
        if (!btn.disabled) {
            btn.addEventListener('click', () => {
                const content = btn.getAttribute('data-content');
                if (content && contentInput) {
                    contentInput.value = content;
                    // 입력 이벤트 트리거
                    contentInput.dispatchEvent(new Event('input', { bubbles: true }));
                    // 모달 닫기
                    closeAutofillHistoryModal(modalContainer);
                }
            });
        }
    });
    
    // 닫기 버튼 이벤트
    const closeBtn = modalContainer.querySelector('.close-autofill-history-modal-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeAutofillHistoryModal(modalContainer);
        });
    }
    
    // 모달 컨테이너 바깥 클릭 시 닫기 (모달 내부 클릭은 무시)
    modalContainer.addEventListener('click', (e) => {
        // 모달 콘텐츠 영역이 아닌 곳(배경)을 클릭했을 때만 닫기
        if (e.target === modalContainer) {
            closeAutofillHistoryModal(modalContainer);
        }
    });
    
    // 오버레이 클릭 시 히스토리 모달만 닫기 (대필 모달은 유지)
    // 기존 오버레이 이벤트와 충돌을 피하기 위해 capture 단계에서 처리
    const overlayClickHandler = (e) => {
        // 오버레이 자체를 클릭했고, 히스토리 모달이 열려있으면 닫기
        if (e.target === overlay && modalContainer && !modalContainer.classList.contains('hidden') && !modalContainer.classList.contains('closing')) {
            // 히스토리 모달이 열려있는지 확인
            const historyModal = document.getElementById('autofill-history-modal-container');
            if (historyModal && !historyModal.classList.contains('hidden') && !historyModal.classList.contains('closing')) {
                e.stopImmediatePropagation(); // 다른 모든 이벤트 핸들러 실행 중단
                e.preventDefault(); // 기본 동작 방지
                closeAutofillHistoryModal(modalContainer);
                return false; // 추가 안전장치
            }
        }
    };
    
    // 이벤트를 capture 단계에서 실행하여 다른 이벤트보다 먼저 처리
    overlay.addEventListener('click', overlayClickHandler, true);
    
    // 모달이 닫힐 때 이벤트 리스너 제거를 위한 참조 저장
    modalContainer._overlayClickHandler = overlayClickHandler;
}

/**
 * 대필 히스토리 모달 닫기
 * @param {HTMLElement} modalContainer - 모달 컨테이너
 */
function closeAutofillHistoryModal(modalContainer) {
    if (!modalContainer) return;
    
    // 이미 닫히는 중이면 무시
    if (modalContainer.classList.contains('closing')) {
        return;
    }
    
    // 닫기 애니메이션 추가
    modalContainer.classList.add('closing');
    
    // 즉시 클릭 방지 (애니메이션 중에도)
    modalContainer.style.pointerEvents = 'none';
    
    // 정리 함수 (오버레이는 유지 - 대필 모달이 열려있을 수 있음)
    const cleanup = () => {
        // 오버레이 클릭 이벤트 리스너 제거
        const overlay = document.getElementById('overlay');
        if (overlay && modalContainer._overlayClickHandler) {
            overlay.removeEventListener('click', modalContainer._overlayClickHandler, true);
        }
        
        modalContainer.remove();
        
        // 다른 모달이 열려있는지 확인
        const autofillModal = document.querySelector('.autofill-modal');
        const autofillModalContainer = autofillModal ? autofillModal.closest('.modal') : null;
        const panelContainer = document.getElementById('panel-modal-container');
        const settingsModal = document.getElementById('settings-modal');
        const sideMenu = document.getElementById('side-menu');
        
        const autofillModalOpen = autofillModalContainer && !autofillModalContainer.classList.contains('hidden');
        const panelContainerOpen = panelContainer && !panelContainer.classList.contains('hidden');
        const settingsModalOpen = settingsModal && !settingsModal.classList.contains('hidden');
        const sideMenuOpen = sideMenu && !sideMenu.classList.contains('hidden');
        
        // 다른 모달이 없으면 오버레이 숨김
        if (overlay && !autofillModalOpen && !panelContainerOpen && !settingsModalOpen && !sideMenuOpen) {
            overlay.classList.remove('closing');
            overlay.classList.add('hidden');
            overlay.style.pointerEvents = 'none';
        } else if (overlay) {
            // 다른 모달이 있으면 오버레이 유지
            overlay.classList.remove('closing');
        }
    };
    
    // 애니메이션 완료 이벤트 리스너
    let animationHandled = false;
    const handleAnimationEnd = () => {
        if (animationHandled) return;
        animationHandled = true;
        
        modalContainer.removeEventListener('animationend', handleAnimationEnd);
        cleanup();
    };
    
    modalContainer.addEventListener('animationend', handleAnimationEnd);
    
    // 타임아웃으로 강제 정리 (최대 500ms 후)
    setTimeout(() => {
        if (!animationHandled) {
            animationHandled = true;
            modalContainer.removeEventListener('animationend', handleAnimationEnd);
            cleanup();
        }
    }, 500);
}

