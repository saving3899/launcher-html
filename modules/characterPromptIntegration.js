/**
 * 캐릭터 프롬프트 통합 함수
 * 실리태번의 getCharacterCardFields 함수와 동일한 역할
 */


/**
 * 기본 채팅 텍스트 치환 (이름 교체)
 * 실리태번의 baseChatReplace 함수와 동일
 * @param {string} value - 원본 텍스트
 * @param {string} name1 - 사용자 이름
 * @param {string} name2 - 캐릭터 이름
 * @returns {string} 치환된 텍스트
 */
function baseChatReplace(value, name1, name2) {
    if (!value) {
        return '';
    }

    // \r 제거
    value = value.replace(/\r/g, '');
    
    // 이름 치환은 substituteParams에서 처리됨
    return value;
}

/**
 * 캐릭터 카드 필드 가져오기
 * 실리태번의 getCharacterCardFields 함수와 동일한 구조
 * 
 * @param {Object} character - 캐릭터 객체
 * @param {Object} chatMetadata - 채팅 메타데이터 (선택사항)
 * @param {string} name1 - 사용자 이름
 * @param {string} name2 - 캐릭터 이름
 * @returns {Object} 캐릭터 카드 필드 객체
 */
function getCharacterCardFields(character, chatMetadata = {}, name1 = '', name2 = '') {
    const result = {
        system: '',
        mesExamples: '',
        description: '',
        personality: '',
        persona: '',
        scenario: '',
        jailbreak: '',
        version: '',
        charDepthPrompt: '',
        creatorNotes: '',
    };

    if (!character) {
        return result;
    }

    const data = character.data || character;

    // Scenario: chat_metadata 우선, 그 다음 character.scenario 또는 character.data.scenario
    const scenarioText = chatMetadata['scenario'] || data.scenario || character.scenario || '';
    
    // Example Dialog: chat_metadata 우선, 그 다음 character.mes_example 또는 character.data.mes_example
    const exampleDialog = chatMetadata['mes_example'] || data.mes_example || character.mes_example || '';
    
    // System Prompt: chat_metadata 우선, 그 다음 character.data.system_prompt
    const systemPrompt = chatMetadata['system_prompt'] || data.system_prompt || '';

    // Description
    result.description = baseChatReplace((data.description || character.description || '').trim(), name1, name2);
    
    // Personality
    result.personality = baseChatReplace((data.personality || character.personality || '').trim(), name1, name2);
    
    // Scenario
    result.scenario = baseChatReplace(scenarioText.trim(), name1, name2);
    
    // Message Examples
    result.mesExamples = baseChatReplace(exampleDialog.trim(), name1, name2);
    
    // System Prompt
    result.system = baseChatReplace(systemPrompt.trim(), name1, name2);
    
    // Jailbreak (Post History Instructions)
    result.jailbreak = baseChatReplace((data.post_history_instructions || '').trim(), name1, name2);
    
    // Character Version
    result.version = data.character_version || '';
    
    // Character Depth Prompt
    result.charDepthPrompt = baseChatReplace((data.extensions?.depth_prompt?.prompt || '').trim(), name1, name2);
    
    // Creator Notes
    result.creatorNotes = baseChatReplace((data.creator_notes || character.creator_notes || character.creatorcomment || '').trim(), name1, name2);

    // Persona (사용자 페르소나) - 현재는 비어있음
    result.persona = '';

    return result;
}

/**
 * 캐릭터 프롬프트 데이터 준비
 * prepareOpenAIMessages에 전달할 캐릭터 데이터 준비
 * 
 * @param {Object} character - 캐릭터 객체
 * @param {Object} chatMetadata - 채팅 메타데이터 (선택사항)
 * @param {string} name1 - 사용자 이름
 * @param {string} name2 - 캐릭터 이름
 * @returns {Object} prepareOpenAIMessages에 전달할 객체
 */
function prepareCharacterPromptData(character, chatMetadata = {}, name1 = '', name2 = '') {
    const fields = getCharacterCardFields(character, chatMetadata, name1, name2);

    return {
        name2: name2,
        charDescription: fields.description,
        charPersonality: fields.personality,
        scenario: fields.scenario,
        systemPromptOverride: fields.system,
        jailbreakPromptOverride: fields.jailbreak,
        messageExamples: fields.mesExamples ? parseMesExamples(fields.mesExamples) : [],
        firstMessage: character?.data?.first_mes || character?.first_mes || '',
    };
}

/**
 * 메시지 예제 파싱
 * 실리태번의 parseMesExamples 함수와 동일한 구조 (기본 구현)
 * @param {string} examplesStr - 예제 문자열
 * @param {boolean} isInstruct - Instruct 모드 여부
 * @returns {string[]} 파싱된 예제 배열
 */
function parseMesExamples(examplesStr, isInstruct = false) {
    if (!examplesStr || examplesStr.length === 0 || examplesStr === '<START>') {
        return [];
    }

    if (!examplesStr.startsWith('<START>')) {
        examplesStr = '<START>\n' + examplesStr.trim();
    }

    // <START> 태그로 예제 블록 분리
    const splitExamples = examplesStr.split(/<START>/gi).slice(1)
        .map(block => {
            const blockHeading = isInstruct ? '<START>\n' : '';
            return `${blockHeading}${block.trim()}\n`;
        });

    return splitExamples;
}

