/**
 * 프롬프트 준비 함수들
 * preparePromptsForChatCompletion 및 관련 함수들
 * 실리태번의 openai.js 구조를 따름
 */


/**
 * stringFormat 함수
 * 실리태번의 utils.js stringFormat 함수와 동일
 * @param {string} format - 포맷 문자열
 * @param {...any} args - 치환할 인자들
 * @returns {string} 포맷팅된 문자열
 * @example
 * stringFormat('Hello, {0}!', 'world'); // 'Hello, world!'
 */
function stringFormat(format) {
    const args = Array.prototype.slice.call(arguments, 1);
    return format.replace(/{(\d+)}/g, function (match, number) {
        return typeof args[number] != 'undefined'
            ? args[number]
            : match;
    });
}

/**
 * 월드인포 포맷팅
 * 실리태번의 formatWorldInfo 함수와 동일
 * @param {string} value - 월드인포 값
 * @param {Object} [options] - 옵션
 * @param {string} [options.wiFormat] - 포맷 문자열 (기본값: '{0}')
 * @returns {string}
 */
function formatWorldInfo(value, options = {}) {
    if (!value) {
        return '';
    }

    const format = options.wiFormat || '{0}';

    if (!format.trim()) {
        return value;
    }

    // 실리태번과 동일하게 stringFormat 함수 사용
    return stringFormat(format, value);
}

/**
 * 프롬프트 역할 가져오기
 * @param {string} role - 역할 문자열
 * @returns {string} 'system', 'user', 또는 'assistant'
 */
function getPromptRole(role) {
    const validRoles = ['system', 'user', 'assistant'];
    return validRoles.includes(role) ? role : 'system';
}

/**
 * 프롬프트 위치 가져오기
 * @param {string|number} position - 위치 값
 * @returns {number} INJECTION_POSITION 값
 */
function getPromptPosition(position) {
    if (position === INJECTION_POSITION.ABSOLUTE || position === INJECTION_POSITION.RELATIVE) {
        return position;
    }
    return INJECTION_POSITION.RELATIVE;
}

/**
 * 프롬프트 준비 함수
 * 실리태번의 preparePromptsForChatCompletion 함수와 동일
 * @param {Object} options - 옵션 객체
 * @param {string} [options.scenario] - 시나리오 텍스트
 * @param {string} [options.charPersonality] - 캐릭터 성격 텍스트
 * @param {string} [options.name2] - 캐릭터 이름
 * @param {string} [options.worldInfoBefore] - 월드인포 (이전)
 * @param {string} [options.worldInfoAfter] - 월드인포 (이후)
 * @param {string} [options.charDescription] - 캐릭터 설명
 * @param {string} [options.quietPrompt] - 조용한 프롬프트
 * @param {string} [options.bias] - 바이어스
 * @param {Object} [options.extensionPrompts={}] - 확장 프롬프트들
 * @param {string} [options.systemPromptOverride] - 시스템 프롬프트 오버라이드 (캐릭터 카드에서)
 * @param {string} [options.jailbreakPromptOverride] - Jailbreak 프롬프트 오버라이드 (캐릭터 카드에서)
 * @param {string} [options.type='normal'] - 생성 타입
 * @param {Object} [options.oaiSettings={}] - OpenAI 설정 (scenario_format, personality_format 등 포함)
 * @param {Object} promptManager - PromptManager 인스턴스
 * @returns {PromptCollection} 준비된 프롬프트 컬렉션
 */
function preparePromptsForChatCompletion(options = {}, promptManager, oaiSettings = {}) {
    const {
        scenario = '',
        charPersonality = '',
        name2 = '',
        worldInfoBefore = '',
        worldInfoAfter = '',
        charDescription = '',
        quietPrompt = '',
        bias = '',
        extensionPrompts = {},
        systemPromptOverride = '',
        jailbreakPromptOverride = '',
        type = 'normal',
    } = options;

    // 포맷 적용 및 변수 치환
    const scenarioFormat = oaiSettings.scenario_format || '{{scenario}}';
    const personalityFormat = oaiSettings.personality_format || '{{personality}}';
    const groupNudgePrompt = oaiSettings.group_nudge_prompt || '';
    const impersonationPrompt = oaiSettings.impersonation_prompt || '';

    const scenarioText = scenario && scenarioFormat 
        ? substituteParams(scenarioFormat, '', name2, '', '', true, { scenario }) 
        : (scenario || '');
    
    const charPersonalityText = charPersonality && personalityFormat
        ? substituteParams(personalityFormat, '', name2, '', '', true, { personality: charPersonality })
        : (charPersonality || '');
    
    const groupNudge = substituteParams(groupNudgePrompt, '', name2);
    const impersonation = impersonationPrompt ? substituteParams(impersonationPrompt, '', name2) : '';

    // 시스템 프롬프트 생성
    const systemPrompts = [
        // 순서가 있는 마커 프롬프트들
        { 
            role: 'system', 
            content: formatWorldInfo(worldInfoBefore, { wiFormat: oaiSettings.wi_format || '{0}' }), 
            identifier: 'worldInfoBefore' 
        },
        { 
            role: 'system', 
            content: formatWorldInfo(worldInfoAfter, { wiFormat: oaiSettings.wi_format || '{0}' }), 
            identifier: 'worldInfoAfter' 
        },
        { 
            role: 'system', 
            content: charDescription, 
            identifier: 'charDescription' 
        },
        { 
            role: 'system', 
            content: charPersonalityText, 
            identifier: 'charPersonality' 
        },
        { 
            role: 'system', 
            content: scenarioText, 
            identifier: 'scenario' 
        },
        // 순서가 없는 프롬프트들
        { 
            role: 'system', 
            content: impersonation, 
            identifier: 'impersonate' 
        },
        { 
            role: 'system', 
            content: quietPrompt, 
            identifier: 'quietPrompt' 
        },
        { 
            role: 'system', 
            content: groupNudge, 
            identifier: 'groupNudge' 
        },
        { 
            role: 'assistant', 
            content: bias, 
            identifier: 'bias' 
        },
    ];

    // 확장 프롬프트 추가 (예: Summary, Authors Note 등)
    // 알려진 extensionPrompts (Summary, Authors Note 등)
    const summary = extensionPrompts['1_memory'];
    if (summary && summary.value) {
        systemPrompts.push({
            role: getPromptRole(summary.role),
            content: summary.value,
            identifier: 'summary',
            injection_position: getPromptPosition(summary.position),
        });
    }

    // Authors Note
    const authorsNote = extensionPrompts['2_floating_prompt'];
    if (authorsNote && authorsNote.value) {
        systemPrompts.push({
            role: getPromptRole(authorsNote.role),
            content: authorsNote.value,
            identifier: 'authorsNote',
            injection_position: getPromptPosition(authorsNote.position),
        });
    }

    // 알려진 extensionPrompts 목록 (실리태번과 동일)
    const knownExtensionPrompts = [
        '1_memory',
        '2_floating_prompt',
        '3_vectors',
        '4_vectors_databank',
        '5_smartcontext',
        '6_chromadb',
        'DEPTH_PROMPT',
    ];

    // 알려지지 않은 extensionPrompts 처리 (실리태번과 동일)
    // Outlet은 position이 0 (NONE)이므로 제외
    for (const key in extensionPrompts) {
        if (Object.hasOwn(extensionPrompts, key)) {
            const prompt = extensionPrompts[key];
            if (knownExtensionPrompts.includes(key)) continue;
            if (!prompt.value) continue;
            // BEFORE_PROMPT(1) 또는 IN_PROMPT(2)만 처리 (NONE은 제외)
            if (prompt.position !== 1 && prompt.position !== 2) continue;

            // filter 함수가 있으면 확인
            const hasFilter = typeof prompt.filter === 'function';
            if (hasFilter && prompt.filter) {
                // 동기적으로 처리 가능한 경우만 (비동기 필터는 추후 구현)
                try {
                    const filterResult = prompt.filter();
                    if (filterResult instanceof Promise) {
                        // Promise인 경우 스킵 (비동기 필터는 추후 구현)
                        continue;
                    }
                    if (!filterResult) continue;
                } catch (error) {
                    // 경고 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('WARN_PROMPT_20021', '프롬프트 필터 오류', error);
                    }
                    continue;
                }
            }

            systemPrompts.push({
                identifier: key.replace(/\W/g, '_'),
                role: getPromptRole(prompt.role),
                content: prompt.value,
                injection_position: getPromptPosition(prompt.position),
                extension: true,
            });
        }
    }

    // Persona Description (실리태번과 동일)
    // IN_PROMPT = 0
    const personaDescription = oaiSettings.persona_description || '';
    const personaDescriptionPosition = oaiSettings.persona_description_position ?? 0;
    if (personaDescription && personaDescriptionPosition === 0) {
        systemPrompts.push({
            role: 'system',
            content: personaDescription,
            identifier: 'personaDescription'
        });
    }

    // PromptManager에서 프롬프트 컬렉션 가져오기
    const prompts = promptManager.getPromptCollection(type);

    // 시스템 프롬프트를 프롬프트 컬렉션에 병합
    // 실리태번과 동일: 빈 프롬프트도 추가 (1296-1316번 라인)
    systemPrompts.forEach(prompt => {
        const collectionPrompt = prompts.get(prompt.identifier);

        // PromptManager에서 설정한 injection_position, injection_depth, injection_order, role 적용
        if (collectionPrompt) {
            prompt.injection_position = collectionPrompt.injection_position ?? prompt.injection_position;
            prompt.injection_depth = collectionPrompt.injection_depth ?? prompt.injection_depth;
            prompt.injection_order = collectionPrompt.injection_order ?? prompt.injection_order;
            // role은 systemPrompts에서 설정한 값 우선 (실리태번과 동일)
            prompt.role = prompt.role || collectionPrompt.role || 'system';
        } else {
            // collectionPrompt가 없으면 기본 role 설정
            if (!prompt.role) {
                prompt.role = 'system';
            }
        }

        const newPrompt = promptManager.preparePrompt(prompt);
        const markerIndex = prompts.index(prompt.identifier);

        if (markerIndex >= 0) {
            // 기존 프롬프트 교체 (실리태번과 동일)
            prompts.collection[markerIndex] = newPrompt;
        } else {
            // 새 프롬프트 추가
            prompts.add(newPrompt);
        }
    });

    // 캐릭터별 시스템 프롬프트 오버라이드 적용
    const systemPrompt = prompts.get('main') ?? null;
    const isSystemPromptDisabled = promptManager.isPromptDisabledForActiveCharacter('main');
    
    if (systemPromptOverride && systemPrompt && 
        systemPrompt.forbid_overrides !== true && 
        !isSystemPromptDisabled) {
        const mainOriginalContent = systemPrompt.content;
        systemPrompt.content = systemPromptOverride;
        const mainReplacement = promptManager.preparePrompt(systemPrompt, mainOriginalContent);
        prompts.override(mainReplacement, prompts.index('main'));
    }

    // Jailbreak 프롬프트 오버라이드 적용
    const jailbreakPrompt = prompts.get('jailbreak') ?? null;
    const isJailbreakPromptDisabled = promptManager.isPromptDisabledForActiveCharacter('jailbreak');
    
    if (jailbreakPromptOverride && jailbreakPrompt && 
        jailbreakPrompt.forbid_overrides !== true && 
        !isJailbreakPromptDisabled) {
        const jbOriginalContent = jailbreakPrompt.content;
        jailbreakPrompt.content = jailbreakPromptOverride;
        const jbReplacement = promptManager.preparePrompt(jailbreakPrompt, jbOriginalContent);
        prompts.override(jbReplacement, prompts.index('jailbreak'));
    }

    return prompts;
}

