/**
 * 각 섹션별 관리 UI 패널
 * 실리태번과 유사한 구조로 구현
 */


/**
 * 상태창/선택지 패널 UI 생성
 * @returns {Promise<string>} HTML 문자열
 */
async function createStatusBarChoicePanel() {
    // 설정에서 로드 (임시로 SettingsStorage 사용)
    // SettingsStorage - 전역 스코프에서 사용
    const settings = await SettingsStorage.load();
    
    // 상태창 설정
    const statusBarEnabled = settings.statusBarEnabled ?? false;
    const statusBarPresetId = settings.statusBarPresetId || '';
    const statusBarPresets = settings.statusBarPresets || {};
    const statusBarPosition = settings.statusBarPosition ?? 4; // 기본값: atDepth
    const statusBarRole = settings.statusBarRole ?? 0; // 기본값: 0 (SYSTEM)
    const statusBarDepth = settings.statusBarDepth ?? 1;
    const statusBarOrder = settings.statusBarOrder ?? 250;
    const statusBarInstruction = settings.statusBarInstruction || '';
    
    // 선택지 설정
    const choiceEnabled = settings.choiceEnabled ?? false;
    const choicePresetId = settings.choicePresetId || '';
    const choicePresets = settings.choicePresets || {};
    const choicePosition = settings.choicePosition ?? 4; // 기본값: atDepth
    const choiceRole = settings.choiceRole ?? 0; // 기본값: 0 (SYSTEM)
    const choiceDepth = settings.choiceDepth ?? 1;
    const choiceOrder = settings.choiceOrder ?? 250;
    const choiceInstruction = settings.choiceInstruction || '';
    
    // 상태창 프리셋 옵션
    const statusBarPresetOptions = Object.entries(statusBarPresets).map(([id, preset]) => {
        const selected = id === statusBarPresetId ? 'selected' : '';
        return `<option value="${escapeHtml(id)}" ${selected}>${escapeHtml(preset.name || id)}</option>`;
    }).join('');
    
    // 선택지 프리셋 옵션
    const choicePresetOptions = Object.entries(choicePresets).map(([id, preset]) => {
        const selected = id === choicePresetId ? 'selected' : '';
        return `<option value="${escapeHtml(id)}" ${selected}>${escapeHtml(preset.name || id)}</option>`;
    }).join('');
    
    // Position 옵션 생성 (실리태번과 동일)
    // extension_prompt_roles: SYSTEM=0, USER=1, ASSISTANT=2
    const positionOptions = [
        { value: 0, label: '캐릭터 정의 전', role: null, icon: null },
        { value: 1, label: '캐릭터 정의 후', role: null, icon: null },
        { value: 5, label: '↑EM', role: null, icon: null },
        { value: 6, label: '↓EM', role: null, icon: null },
        { value: 2, label: '작가 노트 전', role: null, icon: null },
        { value: 3, label: '작가 노트 후', role: null, icon: null },
        { value: 4, label: '@D', role: 0, icon: '⚙️' }, // SYSTEM
        { value: 4, label: '@D', role: 1, icon: '👤' }, // USER
        { value: 4, label: '@D', role: 2, icon: '🤖' }, // ASSISTANT
        { value: 7, label: 'Outlet', role: null, icon: '➡️' }
    ];
    
    // 상태창 Position 옵션 생성
    const statusBarPositionOptions = positionOptions.map(opt => {
        let selected = false;
        if (opt.value === statusBarPosition) {
            if (opt.role !== null) {
                selected = opt.role === statusBarRole;
            } else {
                selected = true;
            }
        }
        const roleAttr = opt.role !== null ? `data-role="${opt.role}"` : 'data-role=""';
        const iconHtml = opt.icon ? ` ${opt.icon}` : '';
        const selectedAttr = selected ? 'selected' : '';
        return `<option value="${opt.value}" ${selectedAttr} ${roleAttr}>${opt.label}${iconHtml}</option>`;
    }).join('');
    
    // 선택지 Position 옵션 생성
    const choicePositionOptions = positionOptions.map(opt => {
        let selected = false;
        if (opt.value === choicePosition) {
            if (opt.role !== null) {
                selected = opt.role === choiceRole;
            } else {
                selected = true;
            }
        }
        const roleAttr = opt.role !== null ? `data-role="${opt.role}"` : 'data-role=""';
        const iconHtml = opt.icon ? ` ${opt.icon}` : '';
        const selectedAttr = selected ? 'selected' : '';
        return `<option value="${opt.value}" ${selectedAttr} ${roleAttr}>${opt.label}${iconHtml}</option>`;
    }).join('');
    
    // Position 표시 텍스트 함수
    function getPositionText(position, depth) {
        switch (position) {
            case 0: return '↑CD';
            case 1: return 'CD↓';
            case 2: return '↑AN';
            case 3: return 'AN↓';
            case 4: return `@D${depth}`;
            case 5: return 'EMTop';
            case 6: return 'EMBottom';
            case 7: return 'outlet';
            default: return '@D';
        }
    }
    
    const statusBarPositionText = getPositionText(statusBarPosition, statusBarDepth);
    const choicePositionText = getPositionText(choicePosition, choiceDepth);
    
    return `
        <div class="modal-content panel-modal" style="max-width: 800px;">
            <div class="modal-header">
                <h2>상태창/선택지</h2>
                <button class="icon-btn close-panel-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modal-body panel-body">
                <!-- 탭 버튼 -->
                <div class="regex-tab-container">
                    <button class="regex-tab-btn active" data-tab="status-bar">
                        상태창
                    </button>
                    <button class="regex-tab-btn" data-tab="choice">
                        선택지
                    </button>
                </div>

                <!-- 상태창 탭 -->
                <div id="status-bar-choice-status-bar-tab" class="regex-tab-content" style="display: block;">
                    <div class="panel-section">
                        <div class="panel-setting-row">
                            <label class="panel-setting-label">상태창 활성화</label>
                            <label class="panel-toggle-switch">
                                <input type="checkbox" id="status-bar-toggle" ${statusBarEnabled ? 'checked' : ''}>
                                <span class="panel-toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="panel-section">
                        <label class="panel-setting-label">프리셋 선택</label>
                        <select class="form-select" id="status-bar-preset-select">
                            <option value="">프리셋 선택...</option>
                            ${statusBarPresetOptions}
                        </select>
                    </div>
                    
                    <div class="panel-section">
                        <div class="panel-setting-row" style="display: flex; flex-direction: row; justify-content: space-between; align-items: center;">
                            <div style="flex: 1; min-width: 150px;">
                                <label class="panel-setting-label" style="margin-bottom: 5px;">Position</label>
                                <div style="position: relative;">
                                    <select class="form-select" id="status-bar-position-select" style="padding-right: 40px;">
                                        ${statusBarPositionOptions}
                                    </select>
                                </div>
                            </div>
                            <div style="flex: 0 0 auto; min-width: 100px;">
                                <label class="panel-setting-label" style="margin-bottom: 5px;">깊이</label>
                                <input type="number" class="form-input" id="status-bar-depth-input" 
                                       value="${statusBarDepth}" min="0" max="100" 
                                       style="width: 100%; ${statusBarPosition !== 4 ? 'visibility: hidden;' : ''}">
                            </div>
                            <div style="flex: 0 0 auto; min-width: 120px;">
                                <label class="panel-setting-label" style="margin-bottom: 5px;">순서:</label>
                                <input type="number" class="form-input" id="status-bar-order-input" 
                                       value="${statusBarOrder}" min="0" max="9999" style="width: 100%;">
                            </div>
                        </div>
                    </div>
                    
                    <div class="panel-section">
                        <label class="panel-setting-label">지시문</label>
                        <textarea class="form-textarea" id="status-bar-instruction-textarea" rows="6" 
                                  placeholder="지시문을 입력하세요...">${escapeHtml(statusBarInstruction)}</textarea>
                    </div>
                    
                    <div class="panel-actions">
                        <button class="panel-btn-primary" id="status-bar-add-btn">
                            <i class="fa-solid fa-plus"></i>
                            <span>추가</span>
                        </button>
                        <button class="panel-btn-secondary" id="status-bar-edit-name-btn">
                            <i class="fa-solid fa-pencil"></i>
                            <span>이름 편집</span>
                        </button>
                        <button class="panel-btn-secondary" id="status-bar-save-btn">
                            <i class="fa-solid fa-floppy-disk"></i>
                            <span>저장</span>
                        </button>
                        <button class="panel-btn-secondary" id="status-bar-export-btn">
                            <i class="fa-solid fa-file-export"></i>
                            <span>내보내기</span>
                        </button>
                        <button class="panel-btn-secondary" id="status-bar-import-btn">
                            <i class="fa-solid fa-file-import"></i>
                            <span>불러오기</span>
                        </button>
                    </div>
                </div>

                <!-- 선택지 탭 -->
                <div id="status-bar-choice-choice-tab" class="regex-tab-content" style="display: none;">
                    <div class="panel-section">
                        <div class="panel-setting-row">
                            <label class="panel-setting-label">선택지 활성화</label>
                            <label class="panel-toggle-switch">
                                <input type="checkbox" id="choice-toggle" ${choiceEnabled ? 'checked' : ''}>
                                <span class="panel-toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="panel-section">
                        <label class="panel-setting-label">프리셋 선택</label>
                        <select class="form-select" id="choice-preset-select">
                            <option value="">프리셋 선택...</option>
                            ${choicePresetOptions}
                        </select>
                    </div>
                    
                    <div class="panel-section">
                        <div class="panel-setting-row" style="display: flex; flex-direction: row; justify-content: space-between; align-items: center;">
                            <div style="flex: 1; min-width: 150px;">
                                <label class="panel-setting-label" style="margin-bottom: 5px;">Position</label>
                                <div style="position: relative;">
                                    <select class="form-select" id="choice-position-select" style="padding-right: 40px;">
                                        ${choicePositionOptions}
                                    </select>
                                </div>
                            </div>
                            <div style="flex: 0 0 auto; min-width: 100px;">
                                <label class="panel-setting-label" style="margin-bottom: 5px;">깊이</label>
                                <input type="number" class="form-input" id="choice-depth-input" 
                                       value="${choiceDepth}" min="0" max="100" 
                                       style="width: 100%; ${choicePosition !== 4 ? 'visibility: hidden;' : ''}">
                            </div>
                            <div style="flex: 0 0 auto; min-width: 120px;">
                                <label class="panel-setting-label" style="margin-bottom: 5px;">순서:</label>
                                <input type="number" class="form-input" id="choice-order-input" 
                                       value="${choiceOrder}" min="0" max="9999" style="width: 100%;">
                            </div>
                        </div>
                    </div>
                    
                    <div class="panel-section">
                        <label class="panel-setting-label">지시문</label>
                        <textarea class="form-textarea" id="choice-instruction-textarea" rows="6" 
                                  placeholder="지시문을 입력하세요...">${escapeHtml(choiceInstruction)}</textarea>
                    </div>
                    
                    <div class="panel-actions">
                        <button class="panel-btn-primary" id="choice-add-btn">
                            <i class="fa-solid fa-plus"></i>
                            <span>추가</span>
                        </button>
                        <button class="panel-btn-secondary" id="choice-edit-name-btn">
                            <i class="fa-solid fa-pencil"></i>
                            <span>이름 편집</span>
                        </button>
                        <button class="panel-btn-secondary" id="choice-save-btn">
                            <i class="fa-solid fa-floppy-disk"></i>
                            <span>저장</span>
                        </button>
                        <button class="panel-btn-secondary" id="choice-export-btn">
                            <i class="fa-solid fa-file-export"></i>
                            <span>내보내기</span>
                        </button>
                        <button class="panel-btn-secondary" id="choice-import-btn">
                            <i class="fa-solid fa-file-import"></i>
                            <span>불러오기</span>
                        </button>
                    </div>
                </div>
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
    const size = 48;
    // Font Awesome fa-user 아이콘의 SVG 경로
    const svgPath = 'M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="${size}" height="${size}"><path fill="currentColor" d="${svgPath}"/></svg>`;
    const encodedSvg = encodeURIComponent(svg);
    return `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
}

/**
 * 캐릭터 관리 패널 UI 생성
 * @returns {Promise<string>} HTML 문자열
 */
async function createCharactersPanel() {
    const characters = await CharacterStorage.loadAll();
    
    const characterList = Object.entries(characters).map(([id, char]) => {
        // 캐릭터 데이터 구조 확인 (Chara Card V2 형식 지원)
        // 실리태번은 { data: { name: ... } } 형식이지만, 다른 형식도 지원
        const data = char?.data || char;
        
        // 이름 추출: 여러 가능한 위치에서 시도
        let name = data?.name || 
                   char?.name || 
                   data?.character_name ||
                   char?.character_name ||
                   id;
        
        // 한자가 비어있거나 공백만 있는 경우 ID 사용
        if (!name || name.trim() === '' || name === id || name.startsWith('___')) {
            name = id;
        }
        
        const avatarImage = char?.avatar_image || char?.avatarImage || data?.avatar_image || '';
        const hasAvatar = avatarImage && avatarImage.trim() !== '';
        const avatarSrc = hasAvatar ? avatarImage : getDefaultAvatar(name);
        const avatarDisplay = hasAvatar 
            ? `<img class="panel-item-avatar" src="${avatarSrc}" alt="${escapeHtml(name)}" onerror="this.outerHTML='<i class=\\'fa-solid fa-user panel-item-avatar-icon\\'></i>'">`
            : `<i class="fa-solid fa-user panel-item-avatar-icon"></i>`;
        
        return `
            <div class="panel-item" data-character-id="${id}" data-character-name="${escapeHtml(name.toLowerCase())}">
                <div class="panel-item-content">
                    <div class="panel-item-avatar">${avatarDisplay}</div>
                    <div class="panel-item-name">${escapeHtml(name)}</div>
                </div>
                <div class="panel-item-actions">
                    <button class="panel-btn" data-action="edit" data-id="${id}" title="편집">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button class="panel-btn" data-action="export" data-id="${id}" title="내보내기">
                        <i class="fa-solid fa-file-export"></i>
                    </button>
                    <button class="panel-btn" data-action="delete" data-id="${id}" title="삭제">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="modal-content panel-modal">
            <div class="modal-header">
                <h2>캐릭터 관리</h2>
                <button class="icon-btn close-panel-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modal-body panel-body">
                <div class="panel-actions">
                    <button class="panel-btn-primary" id="character-import-btn">
                        <i class="fa-solid fa-file-import"></i>
                        <span>불러오기</span>
                    </button>
                    <button class="panel-btn-primary" id="character-create-btn">
                        <i class="fa-solid fa-plus"></i>
                        <span>새 캐릭터</span>
                    </button>
                </div>
                <div class="panel-controls">
                    <div class="panel-search">
                        <input type="text" id="character-search-input" class="panel-search-input" placeholder="캐릭터 검색...">
                        <i class="fa-solid fa-magnifying-glass panel-search-icon"></i>
                    </div>
                    <select id="character-sort-select" class="panel-sort-select">
                        <option value="recent-chat">최근 채팅순 (채팅 없으면 생성순)</option>
                        <option value="create-date-desc">생성순 (최신)</option>
                        <option value="create-date-asc">생성순 (오래된 순)</option>
                        <option value="name-asc" selected>이름순 (A-Z)</option>
                        <option value="name-desc">이름순 (Z-A)</option>
                    </select>
                </div>
                <div class="panel-list" id="character-list">
                    ${characterList || '<div class="panel-empty">캐릭터가 없습니다</div>'}
                </div>
            </div>
        </div>
    `;
}

/**
 * 채팅 목록 패널 UI 생성 (현재 캐릭터의 채팅 목록)
 * @param {string} characterId - 캐릭터 ID
 * @returns {Promise<string>} HTML 문자열
 */
async function createChatListPanel(characterId) {
    const character = await CharacterStorage.load(characterId);
    const characterName = character?.data?.name || character?.name || 'Unknown';
    
    // 현재 채팅 ID 가져오기
    let currentChatId = null;
    if (window.chatManager && window.chatManager.currentChatId) {
        currentChatId = window.chatManager.currentChatId;
    }
    
    // 해당 캐릭터와의 채팅만 필터링
    // 실리태번과 동일: characterId로 필터링 (chatId 형식: "characterId_chatName")
    const allChats = await ChatStorage.loadAll();
    const filteredChats = Object.entries(allChats).filter(([id, chat]) => {
        // 삭제된 채팅 제외 (chat 데이터가 없거나 null인 경우)
        if (!chat || chat === null) {
            return false;
        }
        
        // chatId가 "characterId_"로 시작하는지 확인
        return id.startsWith(`${characterId}_`) || chat?.characterId === characterId;
    });
    
    // 실리태번과 동일: lastMessageDate 기준으로 최신순 정렬
    const sortedChats = filteredChats.map(([id, chat]) => {
        // lastMessageDate 계산: 저장된 lastMessageDate가 있으면 우선 사용, 없으면 계산
        let lastMessageDate = chat?.lastMessageDate || 0;
        
        if (lastMessageDate === 0 && chat?.messages && chat.messages.length > 0) {
            // send_date 기준으로 정렬하여 마지막 메시지 찾기
            const sortedMessages = [...chat.messages].sort((a, b) => (a.send_date || 0) - (b.send_date || 0));
            const lastMessage = sortedMessages[sortedMessages.length - 1];
            lastMessageDate = lastMessage.send_date || 0;
        }
        
        if (lastMessageDate === 0) {
            // 메시지가 없으면 create_date 사용
            lastMessageDate = chat?.metadata?.create_date || 
                             chat?.metadata?.chat_metadata?.create_date || 
                             chat?.create_date || 
                             0;
        }
        
        return { id, chat, lastMessageDate };
    }).sort((a, b) => {
        // 최신순 정렬: lastMessageDate 기준
        if (b.lastMessageDate !== a.lastMessageDate) {
            return b.lastMessageDate - a.lastMessageDate;
        }
        // lastMessageDate가 같으면 chatId로 비교 (더 최근에 생성된 채팅이 먼저)
        return b.id.localeCompare(a.id);
    });
    
    const chatList = sortedChats.map(({ id, chat }) => {
        // 메시지 카운팅: messages 배열 사용 (저장 시 사용하는 필드와 일치)
        const messageCount = chat?.messages?.length || chat?.chat?.length || 0;
        const lastMessage = messageCount > 0 ? '최근 메시지 있음' : '새 채팅';
        // 실리태번과 동일: 채팅 제목은 chatName 사용 (예: "제미니 - 2025-11-01@15h37m33s")
        const chatTitle = chat?.chatName || chat?.metadata?.chat_name || id;
        const isCurrentChat = id === currentChatId;
        const currentChatClass = isCurrentChat ? 'panel-item-selected' : '';
        const currentChatBadge = isCurrentChat ? ' <span class="panel-item-badge">현재 채팅</span>' : '';
        return `
            <div class="panel-item ${currentChatClass}" data-chat-id="${id}">
                <div class="panel-item-content">
                    <div class="panel-item-name">${escapeHtml(chatTitle)}${currentChatBadge}</div>
                    <div class="panel-item-meta">${messageCount}개 메시지 · ${lastMessage}</div>
                </div>
                <div class="panel-item-actions">
                    <button class="panel-btn" data-action="edit-title" data-id="${id}" title="제목 편집">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button class="panel-btn" data-action="export" data-id="${id}" title="내보내기">
                        <i class="fa-solid fa-file-export"></i>
                    </button>
                    <button class="panel-btn" data-action="delete" data-id="${id}" title="삭제">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="modal-content panel-modal">
            <div class="modal-header">
                <h2>${escapeHtml(characterName)}의 채팅 목록</h2>
                <button class="icon-btn close-panel-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modal-body panel-body">
                <div class="panel-actions">
                    <button class="panel-btn-primary" id="chat-import-btn">
                        <i class="fa-solid fa-file-import"></i>
                        <span>불러오기</span>
                    </button>
                    <button class="panel-btn-primary" id="chat-create-btn">
                        <i class="fa-solid fa-plus"></i>
                        <span>새 채팅</span>
                    </button>
                </div>
                <div class="panel-list">
                    ${chatList || '<div class="panel-empty">채팅이 없습니다</div>'}
                </div>
            </div>
        </div>
    `;
}

/**
 * 월드인포 관리 패널 UI 생성
 * @returns {Promise<string>} HTML 문자열
 */
async function createWorldInfoPanel() {
    const worldInfo = await WorldInfoStorage.load();
    const entryCount = Object.keys(worldInfo?.entries || {}).length;

    return `
        <div class="modal-content panel-modal">
            <div class="modal-header">
                <h2>월드인포 관리</h2>
                <button class="icon-btn close-panel-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modal-body panel-body">
                <div class="panel-actions">
                    <button class="panel-btn-primary" id="world-info-import-btn">
                        <i class="fa-solid fa-file-import"></i>
                        <span>불러오기</span>
                    </button>
                    <button class="panel-btn-primary" id="world-info-export-btn">
                        <i class="fa-solid fa-file-export"></i>
                        <span>내보내기</span>
                    </button>
                </div>
                <div class="panel-info">
                    <p>엔트리 개수: ${entryCount}개</p>
                    <p class="panel-info-note">월드인포 관리 UI는 추후 구현 예정입니다.</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Quick Reply 관리 패널 UI 생성
 * @returns {Promise<string>} HTML 문자열
 */
async function createQuickReplyPanel() {
    const quickReply = await QuickReplyStorage.load();
    const setCount = (quickReply?.setList || []).length;

    return `
        <div class="modal-content panel-modal">
            <div class="modal-header">
                <h2>Quick Reply 관리</h2>
                <button class="icon-btn close-panel-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modal-body panel-body">
                <div class="panel-actions">
                    <button class="panel-btn-primary" id="quick-reply-import-btn">
                        <i class="fa-solid fa-file-import"></i>
                        <span>불러오기</span>
                    </button>
                    <button class="panel-btn-primary" id="quick-reply-export-btn">
                        <i class="fa-solid fa-file-export"></i>
                        <span>내보내기</span>
                    </button>
                </div>
                <div class="panel-info">
                    <p>세트 개수: ${setCount}개</p>
                    <p class="panel-info-note">Quick Reply 관리 UI는 추후 구현 예정입니다.</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * 페르소나 관리 패널 UI 생성
 * @returns {Promise<string>} HTML 문자열
 */
async function createPersonaPanel() {
    const personas = await UserPersonaStorage.loadAll();
    // SettingsStorage - 전역 스코프에서 사용
    const settings = await SettingsStorage.load();
    const currentPersonaId = settings.currentPersonaId || null;
    
    const personaList = Object.entries(personas).map(([id, persona]) => {
        const name = persona?.name || id;
        const isSelected = id === currentPersonaId;
        const selectedClass = isSelected ? 'panel-item-selected' : '';
        const avatar = persona?.avatar || '';
        const hasAvatar = avatar && avatar.trim() !== '';
        const avatarDisplay = hasAvatar
            ? `<img src="${avatar}" alt="${escapeHtml(name)}" class="persona-avatar-img" onerror="this.outerHTML='<i class=\\'fa-solid fa-user\\'></i>'">`
            : `<i class="fa-solid fa-user"></i>`;
        return `
            <div class="panel-item ${selectedClass}" data-persona-id="${id}">
                <div class="panel-item-content">
                    <div class="panel-item-avatar">
                        ${avatarDisplay}
                    </div>
                    <div class="panel-item-info">
                        <div class="panel-item-name">
                            ${escapeHtml(name)}
                            ${isSelected ? ' <span class="panel-item-badge">선택됨</span>' : ''}
                        </div>
                        ${persona?.title ? `<div class="panel-item-meta">${escapeHtml(persona.title)}</div>` : ''}
                    </div>
                </div>
                <div class="panel-item-actions">
                    <button class="panel-btn" data-action="edit" data-id="${id}" title="편집">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button class="panel-btn" data-action="select" data-id="${id}" title="선택">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button class="panel-btn" data-action="export" data-id="${id}" title="내보내기">
                        <i class="fa-solid fa-file-export"></i>
                    </button>
                    <button class="panel-btn" data-action="delete" data-id="${id}" title="삭제">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="modal-content panel-modal">
            <div class="modal-header">
                <h2>페르소나 관리</h2>
                <button class="icon-btn close-panel-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modal-body panel-body">
                <div class="panel-actions">
                    <button class="panel-btn-primary" id="persona-import-btn">
                        <i class="fa-solid fa-file-import"></i>
                        <span>불러오기</span>
                    </button>
                    <button class="panel-btn-primary" id="persona-create-btn">
                        <i class="fa-solid fa-plus"></i>
                        <span>새 페르소나</span>
                    </button>
                </div>
                <div class="panel-list">
                    ${personaList || '<div class="panel-empty">페르소나가 없습니다</div>'}
                </div>
            </div>
        </div>
    `;
}

/**
 * AI 로딩 설정 패널 UI 생성
 * @returns {Promise<string>} HTML 문자열
 */
async function createAILoadingPanel() {
    // 설정에서 로드한 값으로 초기화
    const isEnabled = await AILoadingStorage.loadEnabled();
    let presets = await AILoadingStorage.loadAllPresets();
    let currentPresetId = await AILoadingStorage.loadCurrentPresetId();
    
    // 기본 로더 프리셋 (빙글빙글 도는 기어 아이콘)
    const defaultHtml = `<div class="ai-loader-content">
    <div class="ai-loader-spinner">
        <i class="fa-solid fa-gear fa-spin"></i>
    </div>
</div>`;
    
    const defaultCss = `.ai-loader-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.ai-loader-spinner {
    font-size: 48px;
    color: var(--accent-green);
    animation: spin 2s linear infinite;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}`;
    
    // "기본" 프리셋이 없으면 자동 생성
    const defaultPresetName = '기본';
    const defaultPresetId = 'default-preset-id'; // 고정 ID 사용
    let defaultPresetExists = false;
    
    for (const [id, preset] of Object.entries(presets)) {
        if (preset.name === defaultPresetName || id === defaultPresetId) {
            defaultPresetExists = true;
            break;
        }
    }
    
    if (!defaultPresetExists) {
        // 기본 프리셋 생성
        await AILoadingStorage.savePreset(defaultPresetId, {
            name: defaultPresetName,
            html: defaultHtml,
            css: defaultCss
        });
        
        // 프리셋 목록 다시 로드
        presets = await AILoadingStorage.loadAllPresets();
        
        // 현재 프리셋이 없으면 기본 프리셋으로 설정
        if (!currentPresetId) {
            await AILoadingStorage.saveCurrentPresetId(defaultPresetId);
            currentPresetId = defaultPresetId;
        }
    }
    
    // 현재 선택된 프리셋 또는 기본값 사용
    let currentHtml = defaultHtml;
    let currentCss = defaultCss;
    
    if (currentPresetId && presets[currentPresetId]) {
        currentHtml = presets[currentPresetId].html || defaultHtml;
        currentCss = presets[currentPresetId].css || defaultCss;
    }
    
    const presetOptions = Object.entries(presets).map(([id, preset]) => {
        const selected = id === currentPresetId ? 'selected' : '';
        return `<option value="${escapeHtml(id)}" ${selected}>${escapeHtml(preset.name || id)}</option>`;
    }).join('');
    
    return `
        <div class="modal-content panel-modal">
            <div class="modal-header">
                <h2>AI 로딩 설정</h2>
                <button class="icon-btn close-panel-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modal-body panel-body">
                <div class="panel-section">
                    <div class="panel-setting-row">
                        <label class="panel-setting-label">AI 로딩 표시</label>
                        <label class="panel-toggle-switch">
                            <input type="checkbox" id="ai-loading-toggle" ${isEnabled ? 'checked' : ''}>
                            <span class="panel-toggle-slider"></span>
                        </label>
                    </div>
                </div>
                
                <div class="panel-section">
                    <label class="panel-setting-label">프리셋 선택</label>
                    <select class="form-select" id="ai-loading-preset-select">
                        <option value="">프리셋 선택...</option>
                        ${presetOptions}
                    </select>
                </div>
                
                <div class="panel-section">
                    <label class="panel-setting-label">HTML 작성</label>
                    <textarea class="form-textarea" id="ai-loading-html" rows="6" placeholder="로더 HTML을 작성하세요...">${escapeHtml(currentHtml)}</textarea>
                </div>
                
                <div class="panel-section">
                    <label class="panel-setting-label">CSS 작성</label>
                    <textarea class="form-textarea" id="ai-loading-css" rows="6" placeholder="로더 CSS를 작성하세요...">${escapeHtml(currentCss)}</textarea>
                </div>
                
                <div class="panel-actions">
                    <button class="panel-btn-secondary" id="ai-loading-preview-btn">
                        <i class="fa-solid fa-eye"></i>
                        <span>미리보기</span>
                    </button>
                    <button class="panel-btn-primary" id="ai-loading-add-btn">
                        <i class="fa-solid fa-plus"></i>
                        <span>추가</span>
                    </button>
                    <button class="panel-btn-secondary" id="ai-loading-edit-name-btn">
                        <i class="fa-solid fa-pencil"></i>
                        <span>이름 편집</span>
                    </button>
                    <button class="panel-btn-secondary" id="ai-loading-save-btn">
                        <i class="fa-solid fa-floppy-disk"></i>
                        <span>저장</span>
                    </button>
                    <button class="panel-btn-secondary" id="ai-loading-export-btn">
                        <i class="fa-solid fa-file-export"></i>
                        <span>내보내기</span>
                    </button>
                    <button class="panel-btn-secondary" id="ai-loading-import-btn">
                        <i class="fa-solid fa-file-import"></i>
                        <span>불러오기</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * 채팅 처리 설정 패널 UI 생성
 * @returns {Promise<string>} HTML 문자열
 */
async function createChatProcessingPanel() {
    const settings = await SettingsStorage.load();
    const messagesToLoad = settings.messagesToLoad ?? 0; // 0이면 모든 메시지 표시 (실리태번 기본값)
    const htmlRenderLimit = settings.htmlRenderLimit ?? 0; // 0이면 모든 메시지의 HTML 렌더링
    
    return `
        <div class="modal-content panel-modal">
            <div class="modal-header">
                <h2>채팅 처리 설정</h2>
                <button class="icon-btn close-panel-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modal-body panel-body">
                <div class="panel-section">
                    <div class="panel-setting-row">
                        <label class="panel-setting-label" for="messages-to-load">
                            로딩할 메시지 수
                            <span class="panel-setting-hint">채팅에 들어왔을 때 최근 메시지 몇 개만 표시할지 설정합니다. (0이면 모든 메시지 표시)</span>
                        </label>
                        <input 
                            type="number" 
                            id="messages-to-load" 
                            class="panel-setting-input"
                            min="0" 
                            value="${escapeHtml(String(messagesToLoad))}"
                            placeholder="0"
                        >
                    </div>
                </div>
                
                <div class="panel-section">
                    <div class="panel-setting-row">
                        <label class="panel-setting-label" for="html-render-limit">
                            HTML 렌더링할 메시지 수
                            <span class="panel-setting-hint">성능 최적화: 최근 메시지 몇 개만 iframe으로 렌더링할지 설정합니다. (0이면 모든 메시지 렌더링)</span>
                        </label>
                        <div style="display: flex; gap: var(--spacing-sm); align-items: center;">
                            <input 
                                type="number" 
                                id="html-render-limit" 
                                class="panel-setting-input"
                                style="flex: 1;"
                                min="0" 
                                value="${escapeHtml(String(htmlRenderLimit))}"
                                placeholder="0"
                            >
                            <button type="button" id="html-render-limit-apply-btn" class="panel-btn-primary" style="flex-shrink: 0;">
                                <i class="fa-solid fa-check"></i>
                                <span>적용</span>
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="panel-section">
                    <div class="panel-setting-row">
                        <p class="panel-setting-info">
                            <i class="fa-solid fa-info-circle"></i>
                            채팅 히스토리는 표시 여부와 관계없이 모든 메시지가 포함됩니다.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 데이터 관리 설정 패널 UI 생성
 * @returns {Promise<string>} HTML 문자열
 */
async function createDataManagementPanel() {
    return `
        <div class="modal-content panel-modal">
            <div class="modal-header">
                <h2>데이터 관리</h2>
                <button class="icon-btn close-panel-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modal-body panel-body">
                <div class="panel-section">
                    <div class="panel-setting-row">
                        <p class="panel-setting-info">
                            <i class="fa-solid fa-info-circle"></i>
                            앱의 모든 데이터를 관리할 수 있습니다.
                        </p>
                    </div>
                </div>
                
                <div class="panel-section">
                    <div class="panel-setting-row">
                        <label class="panel-setting-label">
                            데이터 내보내기
                            <span class="panel-setting-hint">모든 채팅, 캐릭터, 설정 등을 백업 파일로 내보냅니다.</span>
                        </label>
                        <button id="export-all-data" class="panel-action-btn">
                            <i class="fa-solid fa-download"></i> 모든 데이터 내보내기
                        </button>
                    </div>
                </div>
                
                <div class="panel-section">
                    <div class="panel-setting-row">
                        <label class="panel-setting-label">
                            데이터 가져오기
                            <span class="panel-setting-hint">백업 파일에서 데이터를 복원합니다.</span>
                        </label>
                        <button id="import-all-data" class="panel-action-btn">
                            <i class="fa-solid fa-upload"></i> 데이터 가져오기
                        </button>
                        <input type="file" id="import-all-data-file" accept=".json" style="display: none;">
                    </div>
                </div>
                
                <div class="panel-section">
                    <div class="panel-setting-row">
                        <label class="panel-setting-label">
                            데이터 삭제
                            <span class="panel-setting-hint">주의: 삭제된 데이터는 복구할 수 없습니다.</span>
                        </label>
                        <button id="clear-all-data" class="panel-action-btn danger">
                            <i class="fa-solid fa-trash"></i> 모든 데이터 삭제
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 기타 설정 패널 UI 생성
 * @returns {Promise<string>} HTML 문자열
 */
async function createOtherSettingsPanel() {
    const settings = await SettingsStorage.load();
    const playMessageSound = settings.play_message_sound ?? false;
    const playSoundUnfocused = settings.play_sound_unfocused ?? true;
    const currentSoundId = settings.current_sound_id || 'default';
    const messageSendKey = settings.message_send_key || 'enter';
    
    // 기본 효과음 파일 목록 (파일명 기준 정렬)
    const defaultSoundFiles = [
        'message.mp3',
        'Blop.mp3',
        'Coin.mp3',
        'Correct.mp3',
        'Glow.mp3',
        'Pop.mp3',
        'Stapler.mp3',
        'Tiny Button.mp3'
    ].sort((a, b) => {
        // message.mp3는 항상 첫 번째로 유지
        if (a === 'message.mp3') return -1;
        if (b === 'message.mp3') return 1;
        // 나머지는 파일명 기준 정렬
        return a.localeCompare(b);
    });
    
    // 유저 업로드 효과음 목록 가져오기
    const userSounds = await UserSoundStorage.loadAll();
    const userSoundList = Object.values(userSounds || {}).sort((a, b) => {
        // 업로드 시간순 정렬 (과거순 - 최신이 가장 아래)
        return (a.uploaded_at || 0) - (b.uploaded_at || 0);
    });
    
    // 셀렉트 옵션 생성
    let soundSelectOptions = '';
    
    // 기본 효과음 옵션 추가
    defaultSoundFiles.forEach((filename, index) => {
        const soundId = `sound_${index}`;
        const displayName = `기본 효과음 ${index + 1}`;
        const isSelected = currentSoundId === soundId || (index === 0 && currentSoundId === 'default');
        soundSelectOptions += `<option value="${escapeHtml(soundId)}" ${isSelected ? 'selected' : ''}>${escapeHtml(displayName)}</option>`;
    });
    
    // 유저 업로드 효과음 옵션 추가
    userSoundList.forEach(sound => {
        soundSelectOptions += `<option value="${escapeHtml(sound.id)}" ${currentSoundId === sound.id ? 'selected' : ''}>${escapeHtml(sound.name || '사용자 효과음')}</option>`;
    });
    
    // 현재 선택된 효과음이 유저 업로드인지 확인
    const isUserSound = currentSoundId !== 'default' && !currentSoundId.startsWith('sound_') && userSounds[currentSoundId];
    
    return `
        <div class="modal-content panel-modal">
            <div class="modal-header">
                <h2>기타 설정</h2>
                <button class="icon-btn close-panel-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modal-body panel-body">
                <div class="panel-section">
                    <h3 class="panel-section-title">효과음 설정</h3>
                    
                    <div class="panel-setting-row">
                        <label class="checkbox_label" for="play-message-sound">
                            <input type="checkbox" id="play-message-sound" ${playMessageSound ? 'checked' : ''}>
                            <span>메시지 생성 완료 시 효과음 재생</span>
                        </label>
                        <span class="panel-setting-hint">AI 응답이 완료될 때 효과음을 재생합니다.</span>
                    </div>
                    
                    <div class="panel-setting-row">
                        <label class="checkbox_label" for="play-sound-unfocused">
                            <input type="checkbox" id="play-sound-unfocused" ${playSoundUnfocused ? 'checked' : ''}>
                            <span>탭이 포커스되지 않았을 때만 재생</span>
                        </label>
                        <span class="panel-setting-hint">브라우저 탭이 포커스되지 않았을 때만 효과음을 재생합니다.</span>
                    </div>
                    
                    <div class="panel-setting-row">
                        <label class="panel-setting-label" for="sound-select">
                            효과음 선택
                            <span class="panel-setting-hint">사용할 효과음을 선택합니다. 기본 효과음 또는 업로드한 효과음을 선택할 수 있습니다.</span>
                        </label>
                        <div style="display: flex; gap: var(--spacing-sm); align-items: center; flex-wrap: wrap;">
                            <select id="sound-select" class="panel-setting-input" style="flex: 1; min-width: 200px;">
                                ${soundSelectOptions}
                            </select>
                            <button type="button" id="sound-delete-btn" class="panel-action-btn danger" style="flex-shrink: 0; display: ${isUserSound ? 'inline-flex' : 'none'};">
                                <i class="fa-solid fa-trash"></i> 삭제
                            </button>
                            <button type="button" id="sound-upload-btn" class="panel-action-btn" style="flex-shrink: 0;">
                                <i class="fa-solid fa-upload"></i> 업로드
                            </button>
                            <button type="button" id="sound-test-btn" class="panel-action-btn" style="flex-shrink: 0;">
                                <i class="fa-solid fa-volume-high"></i> 테스트
                            </button>
                        </div>
                        <input 
                            type="file" 
                            id="sound-file-input" 
                            accept=".mp3,.wav,.ogg,.m4a"
                            style="display: none;"
                        >
                        <audio id="audio_message_sound" src="public/sounds/message.mp3" hidden></audio>
                    </div>
                </div>
                
                <div class="panel-section">
                    <h3 class="panel-section-title">메시지 전송 설정</h3>
                    
                    <div class="panel-setting-row">
                        <label class="panel-setting-label" for="message-send-key">
                            메시지 전송 키
                        </label>
                        <div style="display: flex; gap: var(--spacing-md); align-items: center; flex-wrap: wrap;">
                            <label style="display: flex; align-items: center; gap: var(--spacing-sm); cursor: pointer;">
                                <input type="radio" name="message-send-key" value="enter" ${messageSendKey === 'enter' ? 'checked' : ''} style="margin: 0;">
                                <span>Enter 입력</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: var(--spacing-sm); cursor: pointer;">
                                <input type="radio" name="message-send-key" value="ctrl_enter" ${messageSendKey === 'ctrl_enter' ? 'checked' : ''} style="margin: 0;">
                                <span>Ctrl+Enter 입력</span>
                            </label>
                        </div>
                        <span class="panel-setting-hint" style="margin-top: var(--spacing-xs);">
                            ${messageSendKey === 'enter' ? 'Enter 키로 메시지를 전송하고, Shift+Enter로 줄바꿈합니다.' : 'Ctrl+Enter 키로 메시지를 전송하고, Enter로 줄바꿈합니다.'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 홈화면에 최근 채팅 목록 렌더링
 * @returns {Promise<void>}
 */
async function renderRecentChatsToHomeScreen() {
    const homeScreen = document.getElementById('home-screen');
    if (!homeScreen) {
        return;
    }
    
    try {
        // 모든 채팅 가져오기
        const allChats = await ChatStorage.loadAll();
        
        // 날짜를 숫자로 변환하는 헬퍼 함수
        const parseDate = (dateValue) => {
            if (!dateValue) return 0;
            if (typeof dateValue === 'number') return dateValue;
            if (typeof dateValue === 'string') {
                // 문자열 날짜를 숫자로 변환
                const parsed = new Date(dateValue).getTime();
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        };
        
        // 삭제된 채팅 제외 및 정렬
        const validChats = Object.entries(allChats)
            .filter(([id, chat]) => {
                // null 체크
                if (!chat || chat === null) {
                    return false;
                }
                
                // 그리팅만 있는 채팅 제외 (그리팅 외에 실제 메시지가 1개 이상 있어야 함)
                const messages = chat?.messages || chat?.chat || [];
                const messageCount = messages.length;
                
                // 메시지가 0개면 제외
                if (messageCount === 0) {
                    return false;
                }
                
                // 메시지가 1개이고 그것이 그리팅이면 제외
                if (messageCount === 1) {
                    const firstMessage = messages[0];
                    // 첫 번째 메시지가 AI 메시지(그리팅)이고, 사용자 메시지가 없으면 제외
                    if (firstMessage && !firstMessage.is_user && firstMessage.mes && firstMessage.mes.trim()) {
                        return false; // 그리팅만 있는 채팅
                    }
                }
                
                // 메시지가 2개 이상이면 실제 대화가 있는 것으로 간주
                // 또는 메시지 중에 사용자 메시지가 있는지 확인
                const hasUserMessage = messages.some(msg => msg && msg.is_user === true);
                if (!hasUserMessage && messageCount === 1) {
                    // 사용자 메시지가 없고 메시지가 1개면 그리팅만 있는 채팅
                    return false;
                }
                
                return true;
            })
            .map(([id, chat]) => {
                // lastMessageDate 계산
                let lastMessageDate = parseDate(chat?.lastMessageDate);
                
                if (lastMessageDate === 0 && chat?.messages && chat.messages.length > 0) {
                    // send_date 기준으로 정렬하여 마지막 메시지 찾기
                    const sortedMessages = [...chat.messages].sort((a, b) => {
                        const dateA = parseDate(a.send_date);
                        const dateB = parseDate(b.send_date);
                        return dateA - dateB;
                    });
                    const lastMessage = sortedMessages[sortedMessages.length - 1];
                    lastMessageDate = parseDate(lastMessage?.send_date);
                }
                
                if (lastMessageDate === 0) {
                    // 메시지가 없으면 create_date 사용
                    lastMessageDate = parseDate(chat?.metadata?.create_date) || 
                                     parseDate(chat?.metadata?.chat_metadata?.create_date) || 
                                     parseDate(chat?.create_date) || 
                                     0;
                }
                
                // lastMessageDate가 여전히 0이면 현재 시간 사용 (최하위 우선순위)
                if (lastMessageDate === 0) {
                    lastMessageDate = Date.now();
                }
                
                return { id, chat, lastMessageDate };
            })
            .sort((a, b) => {
                // 최신순 정렬: lastMessageDate 기준
                // 안전하게 숫자로 변환 (undefined/null 방지)
                const dateA = Number(a?.lastMessageDate) || 0;
                const dateB = Number(b?.lastMessageDate) || 0;
                
                if (dateB !== dateA) {
                    return dateB - dateA;
                }
                // lastMessageDate가 같으면 chatId로 비교
                return (b?.id || '').localeCompare(a?.id || '');
            })
            .slice(0, 10); // 최근 10개만 표시
        
        // 채팅 목록 HTML 생성
        if (validChats.length === 0) {
            homeScreen.innerHTML = `
                <div class="home-screen-content">
                    <div class="home-screen-empty">
                        <i class="fa-solid fa-comment-dots"></i>
                        <p>최근 채팅이 없습니다</p>
                    </div>
                </div>
            `;
            return;
        }
        
        const chatListHtml = await Promise.all(validChats.map(async ({ id, chat, lastMessageDate }) => {
            // 캐릭터 정보 가져오기
            const characterId = chat?.characterId || id.split('_')[0];
            let character = null;
            let characterName = 'Unknown';
            let avatarImage = '';
            
            try {
                character = await CharacterStorage.load(characterId);
                if (character) {
                    const data = character?.data || character;
                    characterName = data?.name || character?.name || characterId;
                    avatarImage = character?.avatar_image || character?.avatarImage || data?.avatar_image || '';
                }
            } catch (error) {
                // 캐릭터를 찾을 수 없으면 메타데이터에서 가져오기
                characterName = chat?.metadata?.character_name || chat?.character_name || 'Unknown';
            }
            
            // 아바타 이미지 처리
            const hasAvatar = avatarImage && avatarImage.trim() !== '';
            const avatarSrc = hasAvatar ? avatarImage : getDefaultAvatar(characterName);
            const avatarDisplay = hasAvatar 
                ? `<img class="recent-chat-avatar" src="${avatarSrc}" alt="${escapeHtml(characterName)}" onerror="this.outerHTML='<i class=\\'fa-solid fa-user recent-chat-avatar-icon\\'></i>'">`
                : `<i class="fa-solid fa-user recent-chat-avatar-icon"></i>`;
            
            // 메시지 카운팅
            const messageCount = chat?.messages?.length || chat?.chat?.length || 0;
            
            // 마지막 메시지 내용 가져오기
            let lastMessageText = '새 채팅';
            if (messageCount > 0 && chat?.messages && chat.messages.length > 0) {
                const lastMessage = chat.messages[chat.messages.length - 1];
                if (lastMessage?.mes) {
                    lastMessageText = lastMessage.mes.substring(0, 50);
                    if (lastMessage.mes.length > 50) {
                        lastMessageText += '...';
                    }
                }
            }
            
            // 날짜 포맷팅 (안전하게 처리)
            let dateStr = '';
            try {
                // lastMessageDate가 숫자인지 확인하고 날짜 생성
                const dateValue = Number(lastMessageDate) || Date.now();
                const date = new Date(dateValue);
                
                if (!isNaN(date.getTime()) && dateValue > 0) {
                    // toLocaleString을 사용하여 날짜와 시간 모두 표시
                    dateStr = date.toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    });
                } else {
                    dateStr = '날짜 없음';
                }
            } catch (error) {
                console.error('[renderRecentChatsToHomeScreen] 날짜 포맷팅 오류:', error, { lastMessageDate, chatId: id });
                dateStr = '날짜 없음';
            }
            
            // 채팅 제목
            const chatTitle = chat?.chatName || chat?.metadata?.chat_name || id;
            
            return `
                <div class="recent-chat-item" data-chat-id="${id}" data-character-id="${characterId}">
                    <div class="recent-chat-avatar-wrapper">
                        ${avatarDisplay}
                    </div>
                    <div class="recent-chat-content">
                        <div class="recent-chat-header">
                            <div class="recent-chat-name">${escapeHtml(characterName)}</div>
                            <div class="recent-chat-date">${escapeHtml(dateStr)}</div>
                        </div>
                        <div class="recent-chat-title">${escapeHtml(chatTitle)}</div>
                        <div class="recent-chat-preview">${escapeHtml(lastMessageText)}</div>
                        <div class="recent-chat-meta">${messageCount}개 메시지</div>
                    </div>
                </div>
            `;
        }));
        
        homeScreen.innerHTML = `
            <div class="home-screen-content">
                <div class="home-screen-header">
                    <h2>최근 채팅</h2>
                </div>
                <div class="recent-chats-list">
                    ${chatListHtml.join('')}
                </div>
            </div>
        `;
        
        // 이벤트 리스너 추가
        const chatItems = homeScreen.querySelectorAll('.recent-chat-item');
        chatItems.forEach(item => {
            item.addEventListener('click', async (e) => {
                // 버튼 클릭이면 무시
                if (e.target.closest('.recent-chat-item-actions')) {
                    return;
                }
                
                const chatId = item.dataset.chatId;
                const characterId = item.dataset.characterId;
                
                if (!chatId || !characterId) {
                    return;
                }
                
                // 채팅 로드
                if (window.app && window.app.chatManager && window.app.characterManager) {
                    try {
                        // 1. 캐릭터 저장 및 UI 기본 설정
                        await CharacterStorage.saveCurrent(characterId);
                        window.app.isCharacterSelected = true;
                        
                        // 2. 캐릭터 정보 업데이트 (characterManager.selectCharacter의 일부 기능만 수행)
                        const character = await CharacterStorage.load(characterId);
                        if (character && window.app.elements.charName) {
                            const name = character?.data?.name || character?.name || characterId;
                            window.app.elements.charName.textContent = name;
                        }
                        
                        // 3. 특정 채팅 로드 (캐릭터 선택 후 특정 채팅 로드)
                        await window.app.chatManager.loadChat(chatId);
                        
                        // 4. 입력창 표시
                        const chatInputContainer = document.querySelector('.chat-input-container');
                        if (chatInputContainer) {
                            chatInputContainer.classList.add('visible');
                        }
                        
                        // 5. 홈화면/채팅 영역 표시 상태 업데이트 (채팅 화면으로 전환)
                        await window.app.updateHomeScreenVisibility();
                        
                    } catch (error) {
                        // 오류 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('ERR_HOME_1001', '채팅 로드 중 오류가 발생했습니다', error);
                        }
                        console.error('[renderRecentChatsToHomeScreen] 채팅 로드 오류:', error);
                    }
                }
            });
        });
        
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_HOME_1002', '최근 채팅 목록 로드 중 오류가 발생했습니다', error);
        }
        
        // 오류 시 빈 화면 표시
        homeScreen.innerHTML = `
            <div class="home-screen-content">
                <div class="home-screen-empty">
                    <i class="fa-solid fa-exclamation-triangle"></i>
                    <p>채팅 목록을 불러올 수 없습니다</p>
                </div>
            </div>
        `;
    }
}

/**
 * HTML 이스케이프
 * @param {string} text - 이스케이프할 텍스트
 * @returns {string} 이스케이프된 텍스트
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

