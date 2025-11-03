/**
 * 상태창/선택지 지시문 처리 모듈
 * World Info처럼 Position, Depth, Order에 따라 프롬프트에 삽입
 * 활성화 시 100% 확률로 항상 포함됨 (키워드 스캔 없음)
 */

/**
 * 상태창/선택지 설정 로드 및 지시문 수집
 * 활성화된 프리셋은 키워드 매칭 없이 무조건 포함됨
 * @returns {Promise<Object>} 분류된 엔트리들
 */
async function collectStatusBarChoiceEntries() {
    // SettingsStorage - 전역 스코프에서 사용
    const settings = await SettingsStorage.load();
    
    // 활성화된 상태창/선택지 프리셋 수집 (100% 확률로 항상 포함)
    const statusBarEntries = [];
    const choiceEntries = [];
    
    // 상태창 활성화 시 무조건 포함 (키워드 스캔 없음)
    // UI에서 입력한 지시문(statusBarInstruction) 또는 프리셋의 지시문(preset.instruction) 사용
    if (settings.statusBarEnabled) {
        // 지시문: UI에서 입력한 값 우선, 없으면 프리셋 값
        let instruction = '';
        if (settings.statusBarInstruction?.trim()) {
            instruction = settings.statusBarInstruction.trim();
        } else if (settings.statusBarPresetId && settings.statusBarPresets) {
            const preset = settings.statusBarPresets[settings.statusBarPresetId];
            if (preset && preset.instruction?.trim()) {
                instruction = preset.instruction.trim();
            }
        }
        
        if (instruction) {
            statusBarEntries.push({
                position: settings.statusBarPosition ?? 4,
                role: settings.statusBarRole ?? 0,
                depth: settings.statusBarDepth ?? 1,
                order: settings.statusBarOrder ?? 250,
                instruction: instruction
            });
        } else {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_UI_20003', '상태창 활성화되었지만 지시문이 없음');
            }
        }
    }
    
    // 선택지 활성화 시 무조건 포함 (키워드 스캔 없음)
    // UI에서 입력한 지시문(choiceInstruction) 또는 프리셋의 지시문(preset.instruction) 사용
    if (settings.choiceEnabled) {
        // 지시문: UI에서 입력한 값 우선, 없으면 프리셋 값
        let instruction = '';
        if (settings.choiceInstruction?.trim()) {
            instruction = settings.choiceInstruction.trim();
        } else if (settings.choicePresetId && settings.choicePresets) {
            const preset = settings.choicePresets[settings.choicePresetId];
            if (preset && preset.instruction?.trim()) {
                instruction = preset.instruction.trim();
            }
        }
        
        if (instruction) {
            choiceEntries.push({
                position: settings.choicePosition ?? 4,
                role: settings.choiceRole ?? 0,
                depth: settings.choiceDepth ?? 1,
                order: settings.choiceOrder ?? 250,
                instruction: instruction
            });
        } else {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_UI_20004', '선택지 활성화되었지만 지시문이 없음');
            }
        }
    }
    
    // 모든 엔트리 합치고 Order 기준으로 정렬 (높은 Order가 먼저) - World Info와 동일
    const allEntries = [...statusBarEntries, ...choiceEntries].sort((a, b) => b.order - a.order);
    
    // Position별로 분류 (World Info와 동일한 구조)
    const beforeEntries = [];      // Position 0: before (캐릭터 정의 전)
    const afterEntries = [];       // Position 1: after (캐릭터 정의 후)
    const anTopEntries = [];       // Position 2: ANTop (Author's Note 상단)
    const anBottomEntries = [];    // Position 3: ANBottom (Author's Note 하단)
    const depthEntries = [];       // Position 4: atDepth (채팅 히스토리 특정 위치)
    const emTopEntries = [];       // Position 5: EMTop (Extension Module 상단)
    const emBottomEntries = [];    // Position 6: EMBottom (Extension Module 하단)
    const outletEntries = {};      // Position 7: outlet (커스텀 아웃렛)
    
    allEntries.forEach(entry => {
        switch (entry.position) {
            case 0: // before (캐릭터 정의 전) - World Info: WIBeforeEntries
                beforeEntries.push(entry.instruction);
                break;
            case 1: // after (캐릭터 정의 후) - World Info: WIAfterEntries
                afterEntries.push(entry.instruction);
                break;
            case 2: // ANTop (Author's Note 상단) - World Info: ANTopEntries
                anTopEntries.push(entry.instruction);
                break;
            case 3: // ANBottom (Author's Note 하단) - World Info: ANBottomEntries
                anBottomEntries.push(entry.instruction);
                break;
            case 4: // atDepth (채팅 히스토리 특정 위치) - World Info: WIDepthEntries
                // 같은 depth와 role을 가진 엔트리는 그룹화
                const existingDepthIndex = depthEntries.findIndex(
                    (e) => e.depth === entry.depth && e.role === entry.role
                );
                if (existingDepthIndex !== -1) {
                    depthEntries[existingDepthIndex].instructions.push(entry.instruction);
                } else {
                    depthEntries.push({
                        depth: entry.depth,
                        role: entry.role,
                        instructions: [entry.instruction],
                        order: entry.order
                    });
                }
                break;
            case 5: // EMTop (Extension Module 상단) - World Info: EMEntries (before)
                emTopEntries.push(entry.instruction);
                break;
            case 6: // EMBottom (Extension Module 하단) - World Info: EMEntries (after)
                emBottomEntries.push(entry.instruction);
                break;
            case 7: // outlet (커스텀 아웃렛) - World Info: WIOutletEntries
                // outletName이 없으면 기본값 사용
                const outletName = entry.outletName || 'default';
                if (!outletEntries[outletName]) {
                    outletEntries[outletName] = [];
                }
                outletEntries[outletName].push(entry.instruction);
                break;
            default:
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_UI_20005', `알 수 없는 position 값: ${entry.position}`);
                }
                break;
        }
    });
    
    // worldInfoBefore와 worldInfoAfter에 추가할 텍스트 생성
    const beforeText = beforeEntries.join('\n');
    const afterText = afterEntries.join('\n');
    
    return {
        beforeText,
        afterText,
        anTopEntries,
        anBottomEntries,
        depthEntries,
        emTopEntries,
        emBottomEntries,
        outletEntries,
        totalEntries: allEntries.length
    };
}

/**
 * 프롬프트 컬렉션에 상태창/선택지 지시문 적용
 * World Info처럼 모든 Position을 처리
 * @param {Object} prompts - PromptCollection 인스턴스
 * @returns {Promise<Object>} 적용 결과 (depthEntries 등)
 */
async function applyStatusBarChoiceToPrompts(prompts) {
    const { 
        beforeText, 
        afterText, 
        anTopEntries, 
        anBottomEntries,
        depthEntries,
        emTopEntries,
        emBottomEntries,
        outletEntries,
        totalEntries
    } = await collectStatusBarChoiceEntries();
    
    // Position 0: worldInfoBefore에 상태창/선택지 지시문 추가 (있으면)
    if (beforeText) {
        if (prompts.has('worldInfoBefore')) {
            const worldInfoBeforePrompt = prompts.get('worldInfoBefore');
            const existingContent = worldInfoBeforePrompt.content?.trim() || '';
            worldInfoBeforePrompt.content = existingContent 
                ? `${beforeText}\n${existingContent}` 
                : beforeText;
        } else {
            // worldInfoBefore 프롬프트가 없으면 생성
            // Prompt - 전역 스코프에서 사용
            const worldInfoBeforePrompt = new Prompt('worldInfoBefore', beforeText, 'system');
            prompts.set('worldInfoBefore', worldInfoBeforePrompt);
        }
    }
    
    // Position 1: worldInfoAfter에 상태창/선택지 지시문 추가 (있으면)
    if (afterText) {
        if (prompts.has('worldInfoAfter')) {
            const worldInfoAfterPrompt = prompts.get('worldInfoAfter');
            const existingContent = worldInfoAfterPrompt.content?.trim() || '';
            worldInfoAfterPrompt.content = existingContent 
                ? `${existingContent}\n${afterText}` 
                : afterText;
        } else {
            // worldInfoAfter 프롬프트가 없으면 생성
            // Prompt - 전역 스코프에서 사용
            const worldInfoAfterPrompt = new Prompt('worldInfoAfter', afterText, 'system');
            prompts.set('worldInfoAfter', worldInfoAfterPrompt);
        }
    }
    
    // Position 2, 3: Author's Note 처리 (World Info와 동일)
    if (anTopEntries.length > 0 || anBottomEntries.length > 0) {
        if (prompts.has('authorsNote')) {
            const authorsNotePrompt = prompts.get('authorsNote');
            const existingContent = authorsNotePrompt.content?.trim() || '';
            // ANTop + 기존 내용 + ANBottom
            const anTopText = anTopEntries.join('\n');
            const anBottomText = anBottomEntries.join('\n');
            
            let newContent = '';
            if (anTopText) newContent += anTopText;
            if (existingContent) {
                if (newContent) newContent += '\n';
                newContent += existingContent;
            }
            if (anBottomText) {
                if (newContent) newContent += '\n';
                newContent += anBottomText;
            }
            
            authorsNotePrompt.content = newContent;
        }
    }
    
    // Position 5, 6: Extension Module 처리
    // Extension Module은 messageExamples 앞/뒤에 삽입됨
    // populateDialogueExamples에서 처리됨 (별도 반환)
    
    // Position 7: Outlet 처리
    // Outlet은 extensionPrompts를 통해 처리됨 (커스텀 아웃렛)
    // prepareOpenAIMessages에서 extensionPrompts에 추가됨
    
    // Position 4: atDepth 엔트리는 채팅 히스토리 처리 시 별도 삽입 필요
    
    return { 
        depthEntries,
        anTopEntries,
        anBottomEntries,
        emTopEntries,
        emBottomEntries,
        outletEntries
    };
}

/**
 * 상태창/선택지 활성화 여부 확인
 * 둘 중 하나라도 활성화되어 있으면 지시문 포함 필요
 * @returns {Promise<boolean>} 활성화 여부 (true: 활성화됨, false: 비활성화됨)
 */
async function isStatusBarChoiceEnabled() {
    // SettingsStorage - 전역 스코프에서 사용
    const settings = await SettingsStorage.load();
    
    // 상태창 또는 선택지 중 하나라도 활성화되어 있으면 true
    return (settings.statusBarEnabled === true) || (settings.choiceEnabled === true);
}


