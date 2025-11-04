/**
 * 정규식 관리 모듈
 * 정규식 스크립트 생성/수정/삭제 및 UI 관리
 */


/**
 * 정규식 패널 UI 생성
 * @param {string|null} currentCharacterId - 현재 선택된 캐릭터 ID (캐릭터 한정 정규식용)
 */
async function createRegexPanel(currentCharacterId = null) {
    const globalScripts = await RegexScriptStorage.loadAll();
    const globalScriptList = createScriptListHTML(globalScripts, 'global');
    
    // currentCharacterId가 유효한지 확인 (null, undefined, 빈 문자열 체크)
    // 명시적으로 null, undefined, 빈 문자열, 공백만 있는 문자열 체크
    let hasCharacter = false;
    if (currentCharacterId !== null && currentCharacterId !== undefined) {
        if (typeof currentCharacterId === 'string') {
            hasCharacter = currentCharacterId.trim() !== '';
        } else {
            hasCharacter = false;
        }
    }
    
    let characterScriptList = '<div class="panel-empty">캐릭터를 선택하면 캐릭터 한정 정규식을 관리할 수 있습니다</div>';
    if (hasCharacter) {
        const characterScripts = await RegexScriptStorage.loadCharacterRegex(currentCharacterId);
        characterScriptList = createScriptListHTML(characterScripts, 'character', currentCharacterId);
    }

    return `
        <div class="modal-content panel-modal" style="max-width: 800px;" data-current-character-id="${hasCharacter ? currentCharacterId : ''}">
            <div class="modal-header">
                <h2>정규식 관리</h2>
                <button class="icon-btn close-panel-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modal-body panel-body">
                <!-- 탭 버튼 -->
                <div class="regex-tab-container">
                    <button class="regex-tab-btn active" data-tab="global">
                        글로벌 정규식
                    </button>
                    ${hasCharacter 
                        ? `<button class="regex-tab-btn" data-tab="character">캐릭터 한정 정규식</button>`
                        : `<button class="regex-tab-btn disabled" data-tab="character" disabled="disabled">캐릭터 한정 정규식</button>`
                    }
                </div>

                <!-- 글로벌 정규식 탭 -->
                <div id="regex-global-tab" class="regex-tab-content" style="display: block;">
                    <div class="panel-actions">
                        <button class="panel-btn-primary" id="regex-global-create-btn">
                            <i class="fa-solid fa-plus"></i>
                            <span>새 정규식</span>
                        </button>
                        <button class="panel-btn-secondary" id="regex-global-import-btn">
                            <i class="fa-solid fa-file-import"></i>
                            <span>불러오기</span>
                        </button>
                    </div>
                    <!-- 검색 입력 -->
                    <div class="panel-search" style="margin-top: var(--spacing-md);">
                        <input type="text" id="regex-global-search" class="form-input" placeholder="정규식 검색..." style="width: 100%;">
                    </div>
                    <div class="panel-list regex-sortable-list" id="regex-global-list">
                        ${globalScriptList || '<div class="panel-empty">정규식 스크립트가 없습니다</div>'}
                    </div>
                </div>

                <!-- 캐릭터 한정 정규식 탭 -->
                <div id="regex-character-tab" class="regex-tab-content" style="display: none;">
                    <div class="panel-actions">
                        ${hasCharacter 
                            ? `<button class="panel-btn-primary" id="regex-character-create-btn">
                                <i class="fa-solid fa-plus"></i>
                                <span>새 정규식</span>
                            </button>
                            <button class="panel-btn-secondary" id="regex-character-import-btn">
                                <i class="fa-solid fa-file-import"></i>
                                <span>불러오기</span>
                            </button>`
                            : `<button class="panel-btn-primary" id="regex-character-create-btn" disabled style="opacity: 0.5; cursor: not-allowed; pointer-events: none;">
                                <i class="fa-solid fa-plus"></i>
                                <span>새 정규식</span>
                            </button>
                            <button class="panel-btn-secondary" id="regex-character-import-btn" disabled style="opacity: 0.5; cursor: not-allowed; pointer-events: none;">
                                <i class="fa-solid fa-file-import"></i>
                                <span>불러오기</span>
                            </button>`
                        }
                    </div>
                    <!-- 검색 입력 -->
                    <div class="panel-search" style="margin-top: var(--spacing-md);">
                        <input type="text" id="regex-character-search" class="form-input" placeholder="정규식 검색..." style="width: 100%;">
                    </div>
                    <div class="panel-list regex-sortable-list" id="regex-character-list">
                        ${characterScriptList}
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 정규식 스크립트 목록 HTML 생성
 * @param {object} scripts - 정규식 스크립트 객체
 * @param {string} type - 'global' 또는 'character'
 * @param {string|null} characterId - 캐릭터 ID (캐릭터 한정일 경우)
 * @returns {string} HTML 문자열
 */
function createScriptListHTML(scripts, type = 'global', characterId = null) {
    // 실리태번과 동일: 저장된 순서대로 렌더링 (정렬하지 않음)
    // Object.entries는 객체의 키 삽입 순서를 보장함 (ES2015+)
    const scriptEntries = Object.entries(scripts);
    
    const scriptList = scriptEntries.map(([id, script]) => {
        // Ephemerality 옵션 표시
        const ephemeralityOptions = [];
        if (script.markdownOnly) ephemeralityOptions.push('형식 표시만');
        if (script.promptOnly) ephemeralityOptions.push('형식 프롬프트만');
        
        const ephemeralityText = ephemeralityOptions.length > 0 
            ? ephemeralityOptions.join(', ')
            : '';

        return `
            <div class="panel-item regex-script-item" data-script-id="${id}" data-script-type="${type}">
                <div class="panel-item-content">
                    <div class="drag-handle" style="cursor: move; padding: 8px; margin-right: 8px; color: var(--text-tertiary);">
                        <i class="fa-solid fa-grip-vertical"></i>
                    </div>
                    <div style="flex: 1;">
                        <div class="panel-item-name">${escapeHtml(script.scriptName || '이름 없음')}</div>
                        <div class="panel-item-meta">${ephemeralityText || '직접 편집'}${script.disabled ? ' (비활성화)' : ''}</div>
                    </div>
                </div>
                <div class="panel-item-actions">
                    <button class="panel-btn" data-action="edit" data-id="${id}" data-script-type="${type}" ${characterId ? `data-character-id="${characterId}"` : ''} title="편집">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button class="panel-btn" data-action="export" data-id="${id}" data-script-type="${type}" ${characterId ? `data-character-id="${characterId}"` : ''} title="내보내기">
                        <i class="fa-solid fa-file-export"></i>
                    </button>
                    <button class="panel-btn" data-action="delete" data-id="${id}" data-script-type="${type}" ${characterId ? `data-character-id="${characterId}"` : ''} title="삭제">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    return scriptList || '';
}

/**
 * ID에서 타임스탬프 추출 (regex_1234567890_abc 형식에서)
 * @param {string} id - 스크립트 ID
 * @returns {number|null} 타임스탬프 또는 null
 */
function extractTimestampFromId(id) {
    if (!id || typeof id !== 'string') return null;
    
    // regex_1234567890_abc 형식에서 타임스탬프 추출
    const match = id.match(/regex_(\d+)/);
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }
    
    return null;
}

/**
 * 정규식 편집기 UI 생성
 * @param {string|null} scriptId - 편집할 스크립트 ID (null이면 새로 생성)
 * @param {string} scriptType - 'global' 또는 'character'
 * @param {string|null} characterId - 캐릭터 ID (캐릭터 한정일 경우)
 */
async function createRegexEditor(scriptId = null, scriptType = 'global', characterId = null) {
    let script = null;
    if (scriptId) {
        if (scriptType === 'character' && characterId) {
            script = await RegexScriptStorage.loadCharacterRegex(characterId);
            script = script[scriptId] || null;
        } else {
            script = await RegexScriptStorage.load(scriptId);
        }
    }

    // 기본값 설정
    const defaultScript = {
        scriptName: '',
        findRegex: '',
        replaceString: '',
        trimStrings: [],
        placement: [],
        disabled: false,
        markdownOnly: false,
        promptOnly: false,
        runOnEdit: false,
        substituteRegex: 0,
        minDepth: null,
        maxDepth: null,
    };

    const scriptData = script || defaultScript;
    const trimStringsText = Array.isArray(scriptData.trimStrings) 
        ? scriptData.trimStrings.join('\n') 
        : '';

    // Placement 체크박스 (실리태번 스타일)
    const placementChecks = `
        <div>
            <label class="checkbox flex-container">
                <input type="checkbox" name="placement" value="${REGEX_PLACEMENT.USER_INPUT}" ${scriptData.placement?.includes(REGEX_PLACEMENT.USER_INPUT) ? 'checked' : ''}>
                <span>사용자 입력</span>
            </label>
        </div>
        <div>
            <label class="checkbox flex-container">
                <input type="checkbox" name="placement" value="${REGEX_PLACEMENT.AI_OUTPUT}" ${scriptData.placement?.includes(REGEX_PLACEMENT.AI_OUTPUT) ? 'checked' : ''}>
                <span>AI 출력</span>
            </label>
        </div>
        <div>
            <label class="checkbox flex-container">
                <input type="checkbox" name="placement" value="${REGEX_PLACEMENT.SLASH_COMMAND}" ${scriptData.placement?.includes(REGEX_PLACEMENT.SLASH_COMMAND) ? 'checked' : ''}>
                <span>슬래시 명령</span>
            </label>
        </div>
        <div>
            <label class="checkbox flex-container">
                <input type="checkbox" name="placement" value="${REGEX_PLACEMENT.WORLD_INFO}" ${scriptData.placement?.includes(REGEX_PLACEMENT.WORLD_INFO) ? 'checked' : ''}>
                <span>월드 인포</span>
            </label>
        </div>
        <div>
            <label class="checkbox flex-container">
                <input type="checkbox" name="placement" value="${REGEX_PLACEMENT.REASONING}" ${scriptData.placement?.includes(REGEX_PLACEMENT.REASONING) ? 'checked' : ''}>
                <span>Reasoning</span>
            </label>
        </div>
    `;

    return `
        <div class="modal-content panel-modal" style="max-width: 700px;" data-script-id="${scriptId || ''}" data-script-type="${scriptType}" ${characterId && characterId !== 'null' ? `data-character-id="${characterId}"` : ''}>
            <div class="modal-header">
                <h2>${scriptId ? '정규식 편집' : '새 정규식'}</h2>
                <button class="icon-btn close-panel-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modal-body panel-body">
                <div class="form-group">
                    <label for="regex-script-name">스크립트 이름</label>
                    <input type="text" id="regex-script-name" class="form-input" value="${escapeHtml(scriptData.scriptName)}" placeholder="정규식 스크립트 이름">
                </div>

                <div class="form-group">
                    <label for="regex-find">Find Regex</label>
                    <input type="text" id="regex-find" class="form-input" value="${escapeHtml(scriptData.findRegex)}" placeholder="/패턴/flags 또는 패턴">
                    <small style="color: var(--text-tertiary); font-size: 12px;">정규식 패턴 (예: /hello/gi 또는 hello)</small>
                </div>

                <div class="form-group">
                    <label for="regex-replace">Replace With</label>
                    <textarea id="regex-replace" class="form-textarea" rows="3" placeholder="교체할 문자열. {{match}}, $1, $2, $<name> 사용 가능">${escapeHtml(scriptData.replaceString)}</textarea>
                </div>

                <div class="form-group">
                    <label for="regex-trim">Trim Out (한 줄에 하나씩)</label>
                    <textarea id="regex-trim" class="form-textarea" rows="3" placeholder="매칭 후 제거할 문자열들">${escapeHtml(trimStringsText)}</textarea>
                </div>

                <div style="display: flex; gap: var(--spacing-xl); margin-top: var(--spacing-lg);">
                    <!-- 왼쪽 열: 적용 위치 및 Depth -->
                    <div style="flex: 1; display: flex; flex-direction: column; gap: var(--spacing-md);">
                        <small style="font-weight: 600; color: var(--text-primary);">영향을 미침</small>
                        <div style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
                            ${placementChecks}
                        </div>
                        <div style="display: flex; gap: var(--spacing-md); margin-top: var(--spacing-md);">
                            <div style="flex: 1;">
                                <small style="display: flex; align-items: center; gap: var(--spacing-xs); margin-bottom: var(--spacing-xs);">
                                    <span>최소 깊이</span>
                                    <span style="font-size: 10px; color: var(--text-tertiary); cursor: help;" title="프롬프트나 표시에 적용 시, 최소 N 레벨 깊이의 메시지만 영향을 받습니다. 0 = 마지막 메시지, 1 = 마지막에서 두 번째 메시지 등">?</span>
                                </small>
                                <input type="number" id="regex-min-depth" class="form-input" min="-1" max="9999" value="${scriptData.minDepth !== null && scriptData.minDepth !== undefined ? scriptData.minDepth : ''}" placeholder="제한 없는">
                            </div>
                            <div style="flex: 1;">
                                <small style="display: flex; align-items: center; gap: var(--spacing-xs); margin-bottom: var(--spacing-xs);">
                                    <span>최대 깊이</span>
                                    <span style="font-size: 10px; color: var(--text-tertiary); cursor: help;" title="프롬프트나 표시에 적용 시, 최대 N 레벨 깊이의 메시지만 영향을 받습니다. 0 = 마지막 메시지, 1 = 마지막에서 두 번째 메시지 등">?</span>
                                </small>
                                <input type="number" id="regex-max-depth" class="form-input" min="0" max="9999" value="${scriptData.maxDepth !== null && scriptData.maxDepth !== undefined ? scriptData.maxDepth : ''}" placeholder="제한 없는">
                            </div>
                        </div>
                    </div>

                    <!-- 오른쪽 열: 기타 옵션 -->
                    <div style="flex: 1; display: flex; flex-direction: column; gap: var(--spacing-md);">
                        <small style="font-weight: 600; color: var(--text-primary);">다른 옵션</small>
                        <div style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
                            <label class="checkbox flex-container">
                                <input type="checkbox" id="regex-disabled" ${scriptData.disabled ? 'checked' : ''}>
                                <span>비활성화됨</span>
                            </label>
                            <label class="checkbox flex-container">
                                <input type="checkbox" id="regex-run-on-edit" ${scriptData.runOnEdit ? 'checked' : ''}>
                                <span>편집 실행</span>
                            </label>
                        </div>
                        
                        <div style="margin-top: var(--spacing-sm);">
                            <small style="display: flex; align-items: center; gap: var(--spacing-xs); margin-bottom: var(--spacing-xs);">
                                <span>Macros in Find Regex</span>
                                <span style="font-size: 10px; color: var(--text-tertiary); cursor: help;" title="Find Regex에서 {{macros}}를 치환할지 여부">?</span>
                            </small>
                            <select id="regex-substitute-regex" class="form-input" style="width: 100%;">
                                <option value="0" ${scriptData.substituteRegex === 0 ? 'selected' : ''}>Don't substitute</option>
                                <option value="1" ${scriptData.substituteRegex === 1 ? 'selected' : ''}>Substitute (raw)</option>
                                <option value="2" ${scriptData.substituteRegex === 2 ? 'selected' : ''}>Substitute (escaped)</option>
                            </select>
                        </div>

                        <div style="margin-top: var(--spacing-sm);">
                            <small style="display: flex; align-items: center; gap: var(--spacing-xs); margin-bottom: var(--spacing-xs);">
                                <span>Ephemerality</span>
                                <span style="font-size: 10px; color: var(--text-tertiary); cursor: help;" title="기본적으로 정규식 스크립트는 채팅 파일을 직접 변경합니다. 아래 옵션을 활성화하면 채팅 파일 변경 없이 지정된 항목에만 적용됩니다.">?</span>
                            </small>
                            <div style="display: flex; flex-direction: column; gap: var(--spacing-sm); margin-top: var(--spacing-xs);">
                                <label class="checkbox flex-container">
                                    <input type="checkbox" id="regex-markdown-only" ${scriptData.markdownOnly ? 'checked' : ''}>
                                    <span>형식 표시만</span>
                                </label>
                                <label class="checkbox flex-container">
                                    <input type="checkbox" id="regex-prompt-only" ${scriptData.promptOnly ? 'checked' : ''}>
                                    <span>형식 프롬프트만</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label>테스트 모드</label>
                    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
                        <textarea id="regex-test-input" class="form-textarea" rows="3" placeholder="테스트 입력..."></textarea>
                        <textarea id="regex-test-output" class="form-textarea" rows="3" placeholder="테스트 출력..." readonly style="background: var(--bg-tertiary);"></textarea>
                    </div>
                </div>

                <div class="panel-actions" style="margin-top: 20px;">
                    <button class="panel-btn-secondary" id="regex-editor-cancel">취소</button>
                    <button class="panel-btn-primary" id="regex-editor-save">저장</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * HTML 이스케이프
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

