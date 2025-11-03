/**
 * 대필 모달 UI 생성 및 관리
 */


// 기본 대필 지시문 (실리태번과 유사하지만 커스텀)
const DEFAULT_AUTOFILL_PROMPT = 'You are {{user}}. Next story development: {{대필내용}} (Only describe {{user}}\'s dialogue and actions.)';

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
                        <button type="button" class="btn btn-secondary" id="autofill-cancel-btn">취소</button>
                        <button type="submit" class="btn btn-primary" id="autofill-submit-btn">대필</button>
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

