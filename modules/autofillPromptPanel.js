/**
 * 대필 지시문 패널 생성 및 관리
 */


// 기본 대필 지시문 (autofillModal.js와 동일)
// 중복 선언 방지를 위해 autofillModal.js의 것을 사용하거나, 여기서는 값만 참조
// const DEFAULT_AUTOFILL_PROMPT는 autofillModal.js에서 이미 선언됨

/**
 * 대필 지시문 패널 HTML 생성
 * @returns {Promise<string>} HTML 문자열
 */
async function createAutofillPromptPanel() {
    // 저장된 대필 지시문 로드
    const settings = await SettingsStorage.load();
    // autofillModal.js의 DEFAULT_AUTOFILL_PROMPT 사용 (전역 스코프)
    const defaultPrompt = 'You are {{user}}. Next story development: {{대필내용}} (Only describe {{user}}\'s dialogue and actions.)';
    const savedPrompt = settings.autofill_prompt || defaultPrompt;

    return `
        <div class="modal-content">
            <div class="modal-header">
                <h2>대필 지시문</h2>
                <button class="close-panel-btn close-btn">&times;</button>
            </div>
            <div class="modal-body" style="padding: var(--spacing-lg);">
                <form id="autofill-prompt-form">
                    <div class="form-group">
                        <label for="autofill-prompt-textarea">대필 지시문</label>
                        <textarea id="autofill-prompt-textarea" class="form-textarea" rows="8" 
                                  placeholder="${escapeHtml(defaultPrompt)}">${escapeHtml(savedPrompt)}</textarea>
                        <small class="form-help">
                            {{대필내용}} 부분이 사용자가 입력한 대필 내용으로 치환됩니다.<br>
                            다른 매크로도 사용할 수 있습니다: {{user}}, {{char}}
                        </small>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" id="autofill-prompt-reset-btn">기본값으로 초기화</button>
                        <button type="submit" class="btn btn-primary" id="autofill-prompt-save-btn">저장</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

/**
 * 대필 지시문 패널 이벤트 설정
 * @param {HTMLElement} container - 패널 컨테이너
 */
async function setupAutofillPromptPanelEvents(container) {
    const form = container.querySelector('#autofill-prompt-form');
    const textarea = container.querySelector('#autofill-prompt-textarea');
    const resetBtn = container.querySelector('#autofill-prompt-reset-btn');
    const closeBtn = container.querySelector('.close-panel-btn');

    // 기본값으로 초기화
    if (resetBtn && textarea) {
        resetBtn.addEventListener('click', async () => {
            const confirmed = await showConfirmModal('대필 지시문을 기본값으로 초기화하시겠습니까?', '초기화 확인');
            if (confirmed) {
                // autofillModal.js의 DEFAULT_AUTOFILL_PROMPT와 동일한 값
                textarea.value = 'You are {{user}}. Next story development: {{대필내용}} (Only describe {{user}}\'s dialogue and actions.)';
            }
        });
    }

    // 저장
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const prompt = textarea?.value.trim() || '';

            if (!prompt) {
                showToast('대필 지시문을 입력해주세요.', 'warning');
                return;
            }

            // {{대필내용}} 포함 여부 확인
            if (!prompt.includes('{{대필내용}}')) {
                const confirmed = await showConfirmModal('대필 지시문에 {{대필내용}}이 포함되어 있지 않습니다. 계속하시겠습니까?', '확인');
                if (!confirmed) {
                    return;
                }
            }

            try {
                const settings = await SettingsStorage.load();
                settings.autofill_prompt = prompt;
                await SettingsStorage.save(settings);

                showToast('대필 지시문이 저장되었습니다.', 'success');
            } catch (error) {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_UI_13001', '대필 지시문 저장 오류', error);
                } else if (typeof showToast === 'function') {
                    showToast('대필 지시문 저장 중 오류가 발생했습니다: ' + error.message, 'error');
                }
            }
        });
    }

    // 닫기 버튼
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (window.panelManager) {
                window.panelManager.closePanelModal();
            }
        });
    }
}

