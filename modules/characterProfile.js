/**
 * 캐릭터 프로필 페이지 UI 생성 및 관리
 */


/**
 * 캐릭터 프로필 페이지 HTML 생성
 * @param {string} characterId - 캐릭터 ID
 * @returns {Promise<string>} HTML 문자열
 */
async function createCharacterProfilePanel(characterId) {
    const character = await CharacterStorage.load(characterId);
    if (!character) {
        return '<div class="panel-error">캐릭터를 찾을 수 없습니다.</div>';
    }

    const data = character.data || character;
    const name = data.name || character.name || 'Unknown';
    const description = data.description || character.description || '';
    const personality = data.personality || character.personality || '';
    const scenario = data.scenario || character.scenario || '';
    const firstMessage = data.first_mes || data.first_message || character.first_mes || '';
    const creatorNotes = data.creator_notes || character.creator_notes || character.creatorcomment || '';
    const systemPrompt = data.system_prompt || '';
    const postHistoryInstructions = data.post_history_instructions || '';
    const characterVersion = data.character_version || '';
    const creator = data.creator || '';
    const tags = Array.isArray(data.tags) ? data.tags.join(', ') : '';
    
    // 캐릭터 이미지 (base64 또는 URL)
    const avatarImage = character.avatar_image || character.avatarImage || character.data?.avatar_image || '';
    const avatarUrl = character.avatar || character.data?.avatar || '';

    return `
        <div class="modal-content panel-modal character-profile-modal">
            <div class="modal-header">
                <h2>${escapeHtml(name)} - 프로필</h2>
                <button class="icon-btn close-panel-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modal-body panel-body character-profile-body">
                <form id="character-profile-form" data-character-id="${characterId}">
                    <div class="profile-section">
                        <!-- 캐릭터 이미지 표시 -->
                        <div class="form-group profile-image-group">
                            <label>프로필 이미지</label>
                            <div class="profile-image-container">
                                ${avatarImage && avatarImage.trim() !== '' 
                                    ? `<img id="char-profile-image" class="profile-image" 
                                           src="${avatarImage}" 
                                           alt="${escapeHtml(name)}"
                                           onerror="this.outerHTML='<div class=\\'profile-image-placeholder\\'><i class=\\'fa-solid fa-user\\'></i></div>'">`
                                    : `<div id="char-profile-image" class="profile-image-placeholder"><i class="fa-solid fa-user"></i></div>`
                                }
                                <input type="file" id="char-profile-image-input" accept="image/*" style="display: none;">
                                <div class="profile-image-controls" style="display: flex; gap: var(--spacing-sm); align-items: center;">
                                    <button type="button" class="profile-image-upload-btn" id="char-profile-image-upload-btn">
                                        <i class="fa-solid fa-upload"></i>
                                        <span>이미지 변경</span>
                                    </button>
                                    ${avatarImage && avatarImage.trim() !== '' 
                                        ? `<button type="button" class="profile-image-remove-btn panel-btn-secondary" id="char-profile-image-remove-btn">
                                            <i class="fa-solid fa-trash"></i>
                                            <span>이미지 삭제</span>
                                        </button>`
                                        : ''
                                    }
                                </div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="char-name-input">이름</label>
                            <input type="text" id="char-name-input" class="form-input" value="${escapeHtml(name)}" required>
                        </div>

                        <div class="form-group">
                            <label for="char-description">설명</label>
                            <textarea id="char-description" class="form-textarea" rows="3">${escapeHtml(description)}</textarea>
                        </div>

                        <div class="form-group">
                            <label for="char-personality">성격</label>
                            <textarea id="char-personality" class="form-textarea" rows="4">${escapeHtml(personality)}</textarea>
                        </div>

                        <div class="form-group">
                            <label for="char-scenario">시나리오</label>
                            <textarea id="char-scenario" class="form-textarea" rows="3">${escapeHtml(scenario)}</textarea>
                        </div>

                        <div class="form-group">
                            <label>그리팅</label>
                            <div style="display: flex; gap: var(--spacing-md); align-items: center;">
                                <div style="flex: 1;">
                                    <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: var(--spacing-xs);">
                                        ${firstMessage ? escapeHtml(firstMessage.substring(0, 50)) + (firstMessage.length > 50 ? '...' : '') : '그리팅이 없습니다'}
                                        ${(data.alternate_greetings && Array.isArray(data.alternate_greetings) && data.alternate_greetings.length > 0) ? ` (대체 ${data.alternate_greetings.length}개)` : ''}
                                    </div>
                                </div>
                                <button type="button" class="panel-btn-secondary" id="char-greetings-edit-btn" style="white-space: nowrap;">
                                    <i class="fa-solid fa-message"></i>
                                    <span>그리팅 편집</span>
                                </button>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="char-creator-notes">제작자 메모</label>
                            <textarea id="char-creator-notes" class="form-textarea" rows="4">${escapeHtml(creatorNotes)}</textarea>
                        </div>

                        <div class="form-group">
                            <label for="char-system-prompt">시스템 프롬프트</label>
                            <textarea id="char-system-prompt" class="form-textarea" rows="4">${escapeHtml(systemPrompt)}</textarea>
                        </div>

                        <div class="form-group">
                            <label for="char-post-history">사후 히스토리 지시사항</label>
                            <textarea id="char-post-history" class="form-textarea" rows="3">${escapeHtml(postHistoryInstructions)}</textarea>
                        </div>

                        <div class="form-group">
                            <label for="char-version">캐릭터 버전</label>
                            <input type="text" id="char-version" class="form-input" value="${escapeHtml(characterVersion)}">
                        </div>

                        <div class="form-group">
                            <label for="char-creator">제작자</label>
                            <input type="text" id="char-creator" class="form-input" value="${escapeHtml(creator)}">
                        </div>

                        <div class="form-group">
                            <label for="char-tags">태그 (쉼표로 구분)</label>
                            <input type="text" id="char-tags" class="form-input" value="${escapeHtml(tags)}" placeholder="태그1, 태그2, 태그3">
                        </div>
                    </div>

                    <div class="profile-actions">
                        <button type="button" class="panel-btn-secondary" id="char-profile-cancel-btn">취소</button>
                        <button type="submit" class="panel-btn-primary" id="char-profile-save-btn">
                            <i class="fa-solid fa-floppy-disk"></i>
                            <span>저장</span>
                        </button>
                        <button type="button" class="panel-btn-secondary" id="char-profile-export-btn">
                            <i class="fa-solid fa-file-export"></i>
                            <span>내보내기</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

/**
 * 기본 아바타 HTML 생성 (Font Awesome 사용자 아이콘 사용)
 * @param {string} name - 캐릭터 이름 (사용 안 함, 호환성 유지용)
 * @returns {string} 기본 아바타 HTML (Font Awesome 아이콘 포함)
 */
function getDefaultAvatar(name) {
    // Font Awesome 사용자 아이콘을 SVG data URI로 생성
    const size = 120;
    // Font Awesome fa-user 아이콘의 SVG 경로
    const svgPath = 'M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="${size}" height="${size}"><path fill="currentColor" d="${svgPath}"/></svg>`;
    const encodedSvg = encodeURIComponent(svg);
    return `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
}

/**
 * HTML 이스케이프
 * @param {string} text - 이스케이프할 텍스트
 * @returns {string} 이스케이프된 텍스트
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

