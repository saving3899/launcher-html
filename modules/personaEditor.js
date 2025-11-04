/**
 * 페르소나 편집기 UI 생성 및 관리
 */


// 실리태번과 동일: persona_description_positions
const persona_description_positions = {
    IN_PROMPT: 0,
    AFTER_CHAR: 1, // deprecated
    TOP_AN: 2,
    BOTTOM_AN: 3,
    AT_DEPTH: 4,
    NONE: 9,
};

const DEFAULT_PERSONA_DEPTH = 2; // 페르소나 설명 깊이 (promptManager.js의 DEFAULT_DEPTH와 구분)
const DEFAULT_ROLE = 0; // system

// 기본 아바타 이미지 (SVG base64)
const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik01MCAzNUM1Ni42MzQ0IDM1IDYyIDQwLjM2NTYgNjIgNDdDNjIgNTMuNjM0NCA1Ni42MzQ0IDU5IDUwIDU5QzQzLjM2NTYgNTkgMzggNTMuNjM0NCAzOCA0N0MzOCA0MC4zNjU2IDQzLjM2NTYgMzUgNTAgMzVaTTUwIDY2QzU3LjE3NzcgNjYgNjMuNzY4OCA2OS40NzA2IDY3LjEwMzcgNzQuNjIzNEM2OS44NzI5IDcwLjYxMjUgNzEuNSA2NS42MjI5IDcxLjUgNjBDNzEuNSA1MC4zMzUwIDYyLjE2NSA0MSA1Mi41IDQxQzQyLjgzNTEgNDEgMzMuNSA1MC4zMzUwIDMzLjUgNjBDMzMuNSA2NS42MjI5IDM1LjEyNzEgNzAuNjEyNSAzNy44OTYzIDc0LjYyMzRDNDEuMjMxMiA2OS40NzA2IDQ3LjgyMjMgNjYgNTUgNjZINTBaTTUwIDcwQzU3LjE3NzcgNzAgNjMuNzY4OCA3My40NzA2IDY3LjEwMzcgNzguNjIzNCIgc3Ryb2tlPSIjQ0NDIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+';

/**
 * 페르소나 편집 패널 HTML 생성
 * @param {string|null} personaId - 편집할 페르소나 ID (null이면 새로 생성)
 * @returns {Promise<string>} HTML 문자열
 */
async function createPersonaEditorPanel(personaId = null) {
    let persona = null;
    if (personaId) {
        persona = await UserPersonaStorage.load(personaId);
    }

    const name = persona?.name || '';
    const description = persona?.description || '';
    const title = persona?.title || '';
    const avatar = persona?.avatar || '';
    const avatarUrl = avatar || DEFAULT_AVATAR;
    const position = persona?.position ?? persona_description_positions.IN_PROMPT;
    const depth = persona?.depth ?? DEFAULT_PERSONA_DEPTH;
    const role = persona?.role ?? DEFAULT_ROLE;
    const removeBtnHtml = avatar ? '<button type="button" class="btn btn-secondary" id="persona-avatar-remove-btn"><i class="fa-solid fa-trash"></i> 제거</button>' : '';

    return `
        <div class="modal-content panel-modal persona-editor-modal">
            <div class="modal-header">
                <h2>${personaId ? '페르소나 편집' : '새 페르소나'}</h2>
                <button class="icon-btn close-panel-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modal-body panel-body persona-editor-body">
                <form id="persona-editor-form" data-persona-id="${personaId || ''}">
                    <div class="form-group">
                        <label for="persona-avatar">프로필 이미지</label>
                        <div class="persona-avatar-upload">
                            <div class="persona-avatar-preview">
                                ${avatar && avatar.trim() !== ''
                                    ? `<img id="persona-avatar-preview" src="${avatarUrl}" 
                                           alt="프로필 이미지" style="width: 100px; height: 100px; object-fit: cover; border-radius: 50%; border: 2px solid var(--border-color);"
                                           onerror="this.outerHTML='<i id=\\'persona-avatar-preview\\' class=\\'fa-solid fa-user persona-avatar-icon\\' style=\\'font-size: 48px; color: var(--text-secondary);\\'></i>'">`
                                    : `<i id="persona-avatar-preview" class="fa-solid fa-user persona-avatar-icon" style="font-size: 48px; color: var(--text-secondary);"></i>`
                                }
                            </div>
                            <div class="persona-avatar-controls">
                                <input type="file" id="persona-avatar-input" accept="image/*" style="display: none;">
                                <button type="button" class="btn btn-secondary" id="persona-avatar-upload-btn">
                                    <i class="fa-solid fa-image"></i> 이미지 선택
                                </button>
                                ${removeBtnHtml}
                            </div>
                        </div>
                        <small class="form-help">페르소나 목록에 표시될 프로필 이미지입니다.</small>
                    </div>

                    <div class="form-group">
                        <label for="persona-name-input">이름 <span class="required">*</span></label>
                        <input type="text" id="persona-name-input" class="form-input" 
                               value="${escapeHtml(name)}" required placeholder="페르소나 이름">
                    </div>

                    <div class="form-group">
                        <label for="persona-title-input">제목</label>
                        <input type="text" id="persona-title-input" class="form-input" 
                               value="${escapeHtml(title)}" placeholder="페르소나 제목 (선택사항)">
                    </div>

                    <div class="form-group">
                        <label for="persona-description">설명</label>
                        <textarea id="persona-description" class="form-textarea" rows="8" 
                                  placeholder="페르소나 설명을 입력하세요. 이 설명이 AI 프롬프트에 포함됩니다.">${escapeHtml(description)}</textarea>
                        <small class="form-help">이 설명이 AI에게 전달되어 당신의 페르소나를 반영합니다.</small>
                    </div>

                    <div class="form-group">
                        <label for="persona-position">삽입 위치</label>
                        <select id="persona-position" class="form-select">
                            <option value="${persona_description_positions.IN_PROMPT}" ${position === persona_description_positions.IN_PROMPT ? 'selected' : ''}>프롬프트 내 (In Prompt)</option>
                            <option value="${persona_description_positions.TOP_AN}" ${position === persona_description_positions.TOP_AN ? 'selected' : ''}>Authors Note 상단 (Top AN)</option>
                            <option value="${persona_description_positions.BOTTOM_AN}" ${position === persona_description_positions.BOTTOM_AN ? 'selected' : ''}>Authors Note 하단 (Bottom AN)</option>
                            <option value="${persona_description_positions.AT_DEPTH}" ${position === persona_description_positions.AT_DEPTH ? 'selected' : ''}>특정 깊이 (At Depth)</option>
                            <option value="${persona_description_positions.NONE}" ${position === persona_description_positions.NONE ? 'selected' : ''}>사용 안 함 (None)</option>
                        </select>
                        <small class="form-help">페르소나 설명을 프롬프트의 어디에 삽입할지 선택합니다.</small>
                    </div>

                    <div id="persona-depth-role-group" class="form-group" style="display: ${position === persona_description_positions.AT_DEPTH ? 'block' : 'none'};">
                        <div class="form-row">
                            <div class="form-col">
                                <label for="persona-depth">삽입 깊이</label>
                                <input type="number" id="persona-depth" class="form-input" 
                                       value="${depth}" min="0" max="20">
                                <small class="form-help">채팅 내 삽입 위치 (0=가장 최근, 높을수록 과거)</small>
                            </div>
                            <div class="form-col">
                                <label for="persona-role">역할</label>
                                <select id="persona-role" class="form-select">
                                    <option value="0" ${role === 0 ? 'selected' : ''}>System</option>
                                    <option value="1" ${role === 1 ? 'selected' : ''}>User</option>
                                    <option value="2" ${role === 2 ? 'selected' : ''}>Assistant</option>
                                </select>
                                <small class="form-help">페르소나 설명의 역할</small>
                            </div>
                        </div>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" id="persona-editor-cancel-btn">취소</button>
                        <button type="submit" class="btn btn-primary" id="persona-editor-save-btn">저장</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

/**
 * 페르소나 편집 패널 이벤트 설정
 * @param {HTMLElement} container - 패널 컨테이너
 * @param {Function} onSave - 저장 완료 콜백
 */
function setupPersonaEditorEvents(container, onSave) {
    const form = container.querySelector('#persona-editor-form');
    const cancelBtn = container.querySelector('#persona-editor-cancel-btn');
    const closeBtn = container.querySelector('.close-panel-btn');
    const positionSelect = container.querySelector('#persona-position');
    const depthRoleGroup = container.querySelector('#persona-depth-role-group');
    
    // 프로필 이미지 관련 요소
    const avatarInput = container.querySelector('#persona-avatar-input');
    const avatarUploadBtn = container.querySelector('#persona-avatar-upload-btn');
    const avatarRemoveBtn = container.querySelector('#persona-avatar-remove-btn');
    const avatarPreview = container.querySelector('#persona-avatar-preview');
    
    // 초기 아바타 값 설정 (기존 아바타가 있으면 유지, 없으면 기본값)
    let currentAvatar = '';
    if (avatarPreview) {
        const initialSrc = avatarPreview.src;
        // 기본 아바타인지 확인 (SVG 데이터 URL이 아니면 실제 이미지)
        if (initialSrc && !initialSrc.includes('data:image/svg+xml')) {
            currentAvatar = initialSrc;
        }
    }
    
    // 제거 버튼 초기 표시 상태 설정
    if (avatarRemoveBtn) {
        avatarRemoveBtn.style.display = currentAvatar ? 'inline-block' : 'none';
    }

    // 이미지 업로드 버튼 클릭
    if (avatarUploadBtn && avatarInput) {
        avatarUploadBtn.addEventListener('click', () => {
            avatarInput.click();
        });
    }

    // 이미지 파일 선택
    if (avatarInput && avatarPreview) {
        avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                showToast('이미지 파일만 업로드할 수 있습니다.', 'warning');
                return;
            }

            // 파일 크기 제한 (5MB)
            if (file.size > 5 * 1024 * 1024) {
                showToast('이미지 크기는 5MB 이하여야 합니다.', 'warning');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const imageDataUrl = event.target.result;
                currentAvatar = imageDataUrl;
                // 아이콘이 표시 중이면 img로 교체
                if (avatarPreview.tagName === 'I') {
                    const img = document.createElement('img');
                    img.id = 'persona-avatar-preview';
                    img.src = imageDataUrl;
                    img.alt = '프로필 이미지';
                    img.style.width = '100px';
                    img.style.height = '100px';
                    img.style.objectFit = 'cover';
                    img.style.borderRadius = '50%';
                    img.style.border = '2px solid var(--border-color)';
                    img.onerror = () => {
                        img.outerHTML = '<i id="persona-avatar-preview" class="fa-solid fa-user persona-avatar-icon" style="font-size: 48px; color: var(--text-secondary);"></i>';
                    };
                    avatarPreview.parentNode.replaceChild(img, avatarPreview);
                } else {
                    avatarPreview.src = imageDataUrl;
                    avatarPreview.onerror = () => {
                        avatarPreview.outerHTML = '<i id="persona-avatar-preview" class="fa-solid fa-user persona-avatar-icon" style="font-size: 48px; color: var(--text-secondary);"></i>';
                    };
                }
                
                // 제거 버튼 표시
                if (avatarRemoveBtn) {
                    avatarRemoveBtn.style.display = 'inline-block';
                }
            };
            reader.onerror = () => {
                showToast('이미지를 읽는 중 오류가 발생했습니다.', 'error');
            };
            reader.readAsDataURL(file);
        });
    }

    // 이미지 제거 버튼
    if (avatarRemoveBtn && avatarPreview) {
        avatarRemoveBtn.addEventListener('click', () => {
            currentAvatar = '';
            // img가 있으면 아이콘으로 교체
            if (avatarPreview.tagName === 'IMG') {
                const icon = document.createElement('i');
                icon.id = 'persona-avatar-preview';
                icon.className = 'fa-solid fa-user persona-avatar-icon';
                icon.style.fontSize = '48px';
                icon.style.color = 'var(--text-secondary)';
                avatarPreview.parentNode.replaceChild(icon, avatarPreview);
            }
            if (avatarRemoveBtn) {
                avatarRemoveBtn.style.display = 'none';
            }
            if (avatarInput) {
                avatarInput.value = '';
            }
        });
    }

    // 위치 변경 시 깊이/역할 그룹 표시/숨김
    if (positionSelect && depthRoleGroup) {
        positionSelect.addEventListener('change', () => {
            const position = Number(positionSelect.value);
            depthRoleGroup.style.display = position === persona_description_positions.AT_DEPTH ? 'block' : 'none';
        });
    }

    // 모달 닫기 함수
    const closeModal = async () => {
        const panelContainer = document.getElementById('panel-modal-container');
        if (!panelContainer) return;
        
        // 페르소나 편집 모달인지 확인 (#persona-editor-form이 있으면 편집 모달)
        const isPersonaEditor = panelContainer.querySelector('#persona-editor-form');
        
        // onSave 콜백이 있거나 페르소나 편집 모달이면 페르소나 목록으로 돌아가기
        // (편집 모달은 항상 관리 모달에서 열렸다고 가정)
        if (onSave || isPersonaEditor) {
            // 전환 시작
            if (window.panelManager) {
                window.panelManager.isTransitioning = true;
            }
            
            // 페르소나 목록으로 돌아가기 (애니메이션 적용)
            panelContainer.classList.add('closing');
            panelContainer.style.pointerEvents = 'none';
            
            await new Promise(resolve => {
                const handleAnimationEnd = () => {
                    panelContainer.removeEventListener('animationend', handleAnimationEnd);
                    resolve();
                };
                panelContainer.addEventListener('animationend', handleAnimationEnd);
                setTimeout(() => {
                    panelContainer.removeEventListener('animationend', handleAnimationEnd);
                    resolve();
                }, 300); // 타임아웃
            });
            
            const newPanelHtml = await createPersonaPanel();
            panelContainer.classList.remove('closing');
            panelContainer.innerHTML = newPanelHtml;
            panelContainer.style.opacity = '0';
            panelContainer.style.transform = 'translateY(20px) scale(0.95)';
            panelContainer.style.pointerEvents = '';
            panelContainer.classList.remove('hidden'); // hidden 클래스 제거 보장
            
            // DOM이 완전히 렌더링될 때까지 대기
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        resolve();
                    });
                });
            });
            
            // 이벤트 리스너 재설정 (닫기 버튼 포함)
            if (window.panelManager) {
                window.panelManager.setupPersonaPanelEvents(panelContainer);
                window.panelManager.setupPanelClickHandler(panelContainer);
                // 닫기 버튼 이벤트도 다시 설정
                const closeBtn = panelContainer.querySelector('.close-panel-btn');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => window.panelManager.closePanelModal());
                }
            }
            
            // 애니메이션 시작 - 약간의 지연을 두어 DOM이 완전히 준비되도록 함
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        resolve();
                    });
                });
            });
            
            // opacity와 transform을 명시적으로 설정
            panelContainer.style.transition = 'all var(--transition-normal)';
            panelContainer.style.opacity = '1';
            panelContainer.style.transform = 'translateY(0) scale(1)';
            panelContainer.style.visibility = 'visible';
            panelContainer.style.display = ''; // display 초기화
            
            // 전환 완료
            if (window.panelManager) {
                window.panelManager.isTransitioning = false;
            }
        } else {
            // onSave 콜백이 없고 페르소나 편집 모달이 아니면 모달 닫기
            if (window.panelManager) {
                window.panelManager.closePanelModal();
            } else {
                panelContainer.remove();
                const overlay = document.getElementById('overlay');
                if (overlay && !overlay.classList.contains('hidden')) {
                    overlay.classList.add('hidden');
                }
            }
        }
    };

    // 취소 버튼
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }

    // 닫기 버튼 (X 버튼)
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    // 폼 제출
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const personaId = form.dataset.personaId || null;
            const nameInput = container.querySelector('#persona-name-input');
            const titleInput = container.querySelector('#persona-title-input');
            const descriptionInput = container.querySelector('#persona-description');
            const positionInput = container.querySelector('#persona-position');
            const depthInput = container.querySelector('#persona-depth');
            const roleInput = container.querySelector('#persona-role');

            if (!nameInput || !nameInput.value.trim()) {
                showToast('페르소나 이름을 입력해주세요.', 'warning');
                return;
            }

            const personaData = {
                name: nameInput.value.trim(),
                title: titleInput?.value.trim() || '',
                description: descriptionInput?.value || '',
                avatar: currentAvatar || '',
                position: Number(positionInput?.value || persona_description_positions.IN_PROMPT),
                depth: positionInput?.value == persona_description_positions.AT_DEPTH 
                    ? Number(depthInput?.value || DEFAULT_PERSONA_DEPTH) 
                    : DEFAULT_PERSONA_DEPTH,
                role: positionInput?.value == persona_description_positions.AT_DEPTH 
                    ? Number(roleInput?.value || DEFAULT_ROLE) 
                    : DEFAULT_ROLE,
            };

            try {
                // UUID 생성 (새 페르소나인 경우)
                const finalPersonaId = personaId || `persona_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                await UserPersonaStorage.save(finalPersonaId, personaData);
                
                // 현재 채팅이 열려있으면 모든 메시지의 사용자 아바타 업데이트
                if (window.chatManager) {
                    await window.chatManager.updateAllMessageAvatars();
                }
                
                if (onSave) {
                    // onSave 콜백 실행 (페르소나 목록으로 새로고침)
                    await onSave(finalPersonaId, personaData);
                } else {
                    // onSave 콜백이 없으면 기본적으로 패널 닫기
                    const panelContainer = document.getElementById('panel-modal-container');
                    if (panelContainer) {
                        panelContainer.remove();
                        const overlay = document.getElementById('overlay');
                        if (overlay && !overlay.classList.contains('hidden')) {
                            overlay.classList.add('hidden');
                        }
                    }
                }
            } catch (error) {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_PERSONA_12001', '페르소나 저장 오류', error);
                } else if (typeof showToast === 'function') {
                    showToast('페르소나 저장 중 오류가 발생했습니다: ' + error.message, 'error');
                }
            }
        });
    }
}

