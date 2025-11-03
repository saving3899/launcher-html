/**
 * 그리팅 편집 모달 UI 생성 및 관리
 */


/**
 * 그리팅 편집 모달 HTML 생성
 * @param {string} characterId - 캐릭터 ID
 * @returns {Promise<string>} HTML 문자열
 */
async function createGreetingsEditorModal(characterId) {
    const character = await CharacterStorage.load(characterId);
    if (!character) {
        return '<div class="panel-error">캐릭터를 찾을 수 없습니다.</div>';
    }

    const data = character.data || character;
    const name = data.name || character.name || 'Unknown';
    const firstMessage = data.first_mes || data.first_message || character.first_mes || '';
    const alternateGreetings = data.alternate_greetings || character.alternate_greetings || [];
    const greetingsList = [firstMessage, ...(Array.isArray(alternateGreetings) ? alternateGreetings : [])].filter(g => g && g.trim());

    const greetingsHtml = greetingsList.map((greeting, index) => `
        <div class="greeting-item" data-index="${index}">
            <div class="greeting-item-header">
                <span class="greeting-item-number">${index === 0 ? '기본' : `대체 ${index}`}</span>
                ${index > 0 ? `<button type="button" class="icon-btn greeting-delete-btn" data-index="${index}" title="삭제">
                    <i class="fa-solid fa-trash"></i>
                </button>` : ''}
            </div>
            <textarea class="form-textarea greeting-textarea" rows="6" data-index="${index}" placeholder="그리팅을 입력하세요...">${escapeHtml(greeting)}</textarea>
        </div>
    `).join('');

    return `
        <div class="modal-content panel-modal greetings-editor-modal">
            <div class="modal-header">
                <h2>${escapeHtml(name)} - 그리팅 편집</h2>
                <button class="icon-btn close-greetings-editor-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modal-body panel-body">
                <form id="greetings-editor-form" data-character-id="${characterId}">
                    <div class="panel-section">
                        <label class="panel-setting-label">그리팅 목록</label>
                        <div class="greetings-list" id="greetings-list">
                            ${greetingsHtml || `
                                <div class="greeting-item" data-index="0">
                                    <div class="greeting-item-header">
                                        <span class="greeting-item-number">기본</span>
                                    </div>
                                    <textarea class="form-textarea greeting-textarea" rows="6" data-index="0" placeholder="그리팅을 입력하세요..."></textarea>
                                </div>
                            `}
                        </div>
                        <button type="button" class="panel-btn-secondary" id="greeting-add-btn" style="margin-top: var(--spacing-md);">
                            <i class="fa-solid fa-plus"></i>
                            <span>대체 그리팅 추가</span>
                        </button>
                    </div>
                    
                    <div class="panel-actions">
                        <button type="button" class="panel-btn-secondary" id="greetings-editor-cancel-btn">취소</button>
                        <button type="submit" class="panel-btn-primary" id="greetings-editor-save-btn">
                            <i class="fa-solid fa-floppy-disk"></i>
                            <span>저장</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

/**
 * 그리팅 편집 모달 이벤트 설정
 * @param {HTMLElement} container - 모달 컨테이너
 * @param {Function} onSave - 저장 콜백 (characterId, firstMes, alternateGreetings) => Promise<void>
 * @param {Function} onCancel - 취소 콜백
 */
async function setupGreetingsEditorEvents(container, onSave, onCancel) {
    const form = container.querySelector('#greetings-editor-form');
    const cancelBtn = container.querySelector('#greetings-editor-cancel-btn');
    const closeBtn = container.querySelector('.close-greetings-editor-btn');
    const addBtn = container.querySelector('#greeting-add-btn');
    const greetingsList = container.querySelector('#greetings-list');
    const characterId = form?.dataset.characterId;

    const closeModal = () => {
        if (onCancel) {
            onCancel();
        } else {
            container.remove();
            const overlay = document.getElementById('overlay');
            if (overlay && !overlay.classList.contains('hidden')) {
                overlay.classList.add('hidden');
            }
        }
    };

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    // 대체 그리팅 추가
    if (addBtn && greetingsList) {
        addBtn.addEventListener('click', () => {
            const existingGreetings = greetingsList.querySelectorAll('.greeting-item');
            const nextIndex = existingGreetings.length;
            
            const greetingItem = document.createElement('div');
            greetingItem.className = 'greeting-item';
            greetingItem.dataset.index = nextIndex;
            greetingItem.innerHTML = `
                <div class="greeting-item-header">
                    <span class="greeting-item-number">대체 ${nextIndex}</span>
                    <button type="button" class="icon-btn greeting-delete-btn" data-index="${nextIndex}" title="삭제">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                <textarea class="form-textarea greeting-textarea" rows="6" data-index="${nextIndex}" placeholder="그리팅을 입력하세요..."></textarea>
            `;
            
            greetingsList.appendChild(greetingItem);
            
            // 삭제 버튼 이벤트 추가
            const deleteBtn = greetingItem.querySelector('.greeting-delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    greetingItem.remove();
                    // 인덱스 재정렬
                    updateGreetingIndices(greetingsList);
                });
            }
        });
    }

    // 삭제 버튼 이벤트 (기존 항목들)
    if (greetingsList) {
        greetingsList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.greeting-delete-btn');
            if (deleteBtn) {
                const greetingItem = deleteBtn.closest('.greeting-item');
                if (greetingItem) {
                    greetingItem.remove();
                    updateGreetingIndices(greetingsList);
                }
            }
        });
    }

    // 폼 제출
    if (form && onSave) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const greetingItems = greetingsList?.querySelectorAll('.greeting-item') || [];
            const greetings = [];
            
            greetingItems.forEach(item => {
                const textarea = item.querySelector('.greeting-textarea');
                if (textarea) {
                    const text = textarea.value.trim();
                    if (text) {
                        greetings.push(text);
                    }
                }
            });
            
            if (greetings.length === 0) {
                showToast('최소 하나의 그리팅을 입력해주세요.', 'warning');
                return;
            }
            
            const firstMes = greetings[0] || '';
            const alternateGreetings = greetings.slice(1);
            
            try {
                await onSave(characterId, firstMes, alternateGreetings);
                closeModal();
            } catch (error) {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_PERSONA_12002', '페르소나 저장 오류', error);
                } else if (typeof showToast === 'function') {
                    showToast('저장 중 오류가 발생했습니다: ' + error.message, 'error');
                }
            }
        });
    }
}

/**
 * 그리팅 인덱스 업데이트
 * @param {HTMLElement} greetingsList - 그리팅 목록 컨테이너
 */
function updateGreetingIndices(greetingsList) {
    const items = greetingsList.querySelectorAll('.greeting-item');
    items.forEach((item, index) => {
        item.dataset.index = index;
        const numberSpan = item.querySelector('.greeting-item-number');
        const textarea = item.querySelector('.greeting-textarea');
        const deleteBtn = item.querySelector('.greeting-delete-btn');
        
        if (numberSpan) {
            numberSpan.textContent = index === 0 ? '기본' : `대체 ${index}`;
        }
        
        if (textarea) {
            textarea.dataset.index = index;
        }
        
        if (deleteBtn) {
            deleteBtn.dataset.index = index;
        }
    });
}

