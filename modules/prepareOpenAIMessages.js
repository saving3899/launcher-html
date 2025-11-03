/**
 * prepareOpenAIMessages 함수
 * 실리태번의 openai.js prepareOpenAIMessages 함수와 동일한 구조
 */


/**
 * 캐릭터 객체에서 직접 prepareOpenAIMessages 호출하는 편의 함수
 * @param {Object} options - 옵션 객체
 * @param {Object} options.character - 캐릭터 객체
 * @param {Object} [options.chatMetadata] - 채팅 메타데이터
 * @param {string} options.name1 - 사용자 이름
 * @param {string} options.name2 - 캐릭터 이름
 * @param {Object} [options.additionalOptions] - prepareOpenAIMessages에 전달할 추가 옵션
 * @param {boolean} dryRun - 드라이런 여부
 * @param {PromptManager} promptManager - PromptManager 인스턴스
 * @param {Object} oaiSettings - OpenAI 설정 객체
 * @param {Function} [tokenCountFn] - Optional token counting function
 * @returns {Promise<any>} prepareOpenAIMessages 결과
 */
async function prepareOpenAIMessagesFromCharacter({
    character,
    chatMetadata = {},
    name1 = '',
    name2 = '',
    additionalOptions = {},
}, dryRun, promptManager, oaiSettings = {}, tokenCountFn = null, generateType = 'normal') {
    try {
        // 캐릭터 데이터에서 프롬프트 데이터 추출
        const charPromptData = prepareCharacterPromptData(character, chatMetadata, name1, name2);
        
        // additionalOptions에서 excludeStatusBarChoice가 명시적으로 전달되지 않으면 활성화 여부 확인
        let excludeStatusBarChoice = additionalOptions.excludeStatusBarChoice;
        if (excludeStatusBarChoice === undefined) {
            // 활성화 여부 확인
            // isStatusBarChoiceEnabled - 전역 스코프에서 사용
            const statusBarChoiceEnabled = await isStatusBarChoiceEnabled();
            excludeStatusBarChoice = !statusBarChoiceEnabled; // 비활성화되어 있으면 제외
        }
        
        // prepareOpenAIMessages 호출
        const result = await prepareOpenAIMessages({
            name2: charPromptData.name2,
            charDescription: charPromptData.charDescription,
            charPersonality: charPromptData.charPersonality,
            scenario: charPromptData.scenario,
            systemPromptOverride: charPromptData.systemPromptOverride,
            jailbreakPromptOverride: charPromptData.jailbreakPromptOverride,
            messageExamples: charPromptData.messageExamples,
            ...additionalOptions,
            excludeStatusBarChoice: excludeStatusBarChoice, // 명시적으로 전달 (또는 활성화 여부 확인 결과)
        }, dryRun, promptManager, oaiSettings, tokenCountFn, generateType);
        
        return result;
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_AI_5001', 'prepareOpenAIMessagesFromCharacter 오류', error);
        }
        throw error;
    }
}

/**
 * Take a configuration object and prepares messages for a chat with OpenAI's chat completion API.
 * Handles prompts, prepares chat history, manages token budget, and processes various user settings.
 *
 * @param {Object} content - System prompts provided by SillyTavern
 * @param {string} content.name2 - The second name to be used in the messages.
 * @param {string} content.charDescription - Description of the character.
 * @param {string} content.charPersonality - Description of the character's personality.
 * @param {string} content.scenario - The scenario or context of the dialogue.
 * @param {string} content.worldInfoBefore - The world info to be added before the main conversation.
 * @param {string} content.worldInfoAfter - The world info to be added after the main conversation.
 * @param {string} content.bias - The bias to be added in the conversation.
 * @param {string} content.type - The type of the chat, can be 'impersonate'.
 * @param {string} content.quietPrompt - The quiet prompt to be used in the conversation.
 * @param {string} content.quietImage - Image prompt for extras
 * @param {string} content.cyclePrompt - The last prompt used for chat message continuation.
 * @param {string} content.systemPromptOverride - The system prompt override.
 * @param {string} content.jailbreakPromptOverride - The jailbreak prompt override.
 * @param {object} content.extensionPrompts - An array of additional prompts.
 * @param {object[]} content.messages - An array of messages to be used as chat history.
 * @param {string[]} content.messageExamples - An array of messages to be used as dialogue examples.
 * @param {boolean} [content.excludeStatusBarChoice] - 상태창/선택지 지시문 제외 여부 (대필 요청 시 true)
 * @param {boolean} dryRun - Whether this is a live call or not.
 * @param {PromptManager} promptManager - PromptManager 인스턴스
 * @param {Object} oaiSettings - OpenAI 설정 객체
 * @param {Function} [tokenCountFn] - Optional token counting function
 * @returns {Promise<(any[]|boolean)[]>} An array where the first element is the prepared chat and the second element is a boolean flag.
 */
async function prepareOpenAIMessages({
    name2,
    charDescription,
    charPersonality,
    scenario,
    worldInfoBefore,
    worldInfoAfter,
    bias,
    type,
    quietPrompt,
    quietImage,
    extensionPrompts,
    cyclePrompt,
    systemPromptOverride,
    jailbreakPromptOverride,
    messages,
    messageExamples,
    excludeStatusBarChoice = false,
}, dryRun, promptManager, oaiSettings = {}, tokenCountFn = null, generateType = 'normal') {
    // Without a character selected, there is no way to accurately calculate tokens
    if (!promptManager.activeCharacter && dryRun) {
        return [null, false];
    }

    const chatCompletion = new ChatCompletion();
    
    // TODO: power_user.console_log_prompts 지원
    // if (power_user.console_log_prompts) {
    //     chatCompletion.enableLogging();
    // }

    const userSettings = promptManager.serviceSettings || {};
    let maxContext = userSettings.openai_max_context || oaiSettings.openai_max_context || 4095;
    const maxTokens = userSettings.openai_max_tokens || oaiSettings.openai_max_tokens || 300;
    
    // oaiSettings에서 apiProvider와 model 정보 가져오기 (있는 경우)
    // getMaxContextForModel - 전역 스코프에서 사용
    if (oaiSettings.apiProvider && oaiSettings.model) {
        const maxContextUnlocked = oaiSettings.max_context_unlocked || oaiSettings.oai_max_context_unlocked || false;
        const modelMaxContext = getMaxContextForModel(oaiSettings.model, oaiSettings.apiProvider, maxContextUnlocked);
        // 설정값과 모델 최대값 중 더 작은 값 사용 (모델 한계를 초과하지 않도록)
        maxContext = Math.min(maxContext, modelMaxContext);
    }
    
    // tokenHandler 설정 (실리태번과 동일)
    if (promptManager && promptManager.tokenHandler) {
        chatCompletion.tokenHandler = promptManager.tokenHandler;
    }
    
    chatCompletion.setTokenBudget(maxContext, maxTokens);

    // 월드인포 가져오기 (실리태번과 동일)
    let finalWorldInfoBefore = worldInfoBefore || '';
    let finalWorldInfoAfter = worldInfoAfter || '';
    
    // worldInfoBefore/worldInfoAfter가 제공되지 않은 경우, getWorldInfoPrompt에서 가져오기
    if (!worldInfoBefore && !worldInfoAfter && messages) {
        // 채팅 메시지를 배열로 변환 (역순)
        const chatForWI = messages.map(msg => {
            if (typeof msg === 'string') return msg;
            return msg.content || '';
        }).reverse();
        
        const globalScanData = {
            trigger: generateType === 'continue' ? 'continue' : (type || 'normal'),
            personaDescription: '',
            characterDescription: charDescription || '',
            characterPersonality: charPersonality || '',
            characterDepthPrompt: '',
            scenario: scenario || '',
            creatorNotes: '',
        };
        
        const worldInfoResult = await getWorldInfoPrompt(chatForWI, maxContext, dryRun, globalScanData);
        finalWorldInfoBefore = worldInfoResult.worldInfoBefore || '';
        finalWorldInfoAfter = worldInfoResult.worldInfoAfter || '';
        
        // 월드인포 예제를 messageExamples에 통합 (실리태번과 동일)
        if (worldInfoResult.worldInfoExamples && worldInfoResult.worldInfoExamples.length > 0 && messageExamples) {
            for (const example of worldInfoResult.worldInfoExamples) {
                if (example.content && example.content.length > 0) {
                    // TODO: parseMesExamples 함수 구현 필요
                    // const formattedExample = baseChatReplace(example.content, name1, name2);
                    // const cleanedExample = parseMesExamples(formattedExample, isInstruct);
                    // if (example.position === wi_anchor_position.before) {
                    //     messageExamples.unshift(...cleanedExample);
                    // } else {
                    //     messageExamples.push(...cleanedExample);
                    // }
                }
            }
        }
    }

    try {
        // extensionPrompts가 없으면 빈 객체로 초기화
        const finalExtensionPrompts = extensionPrompts || {};
        
        // 상태창/선택지 Outlet 엔트리 수집 및 extensionPrompts에 추가
        // 대필 요청 시에는 제외
        if (!excludeStatusBarChoice) {
            // collectStatusBarChoiceEntries - 전역 스코프에서 사용
            const { outletEntries } = await collectStatusBarChoiceEntries();
            
            // Outlet 엔트리를 extensionPrompts에 추가
            if (Object.keys(outletEntries).length > 0) {
                // configuration에서 name1, name2 가져오기 ({{user}}, {{char}} 치환용)
                const name1 = promptManager.configuration?.name1 || '';
                const name2 = promptManager.configuration?.name2 || '';
                // substituteParams - 전역 스코프에서 사용
                
                Object.entries(outletEntries).forEach(([outletName, instructions]) => {
                    const outletKey = `outlet_${outletName}`;
                    const rawOutletText = instructions.join('\n');
                    const outletText = substituteParams(rawOutletText, name1, name2);
                    finalExtensionPrompts[outletKey] = {
                        value: outletText,
                        position: 0, // extension_prompt_types.NONE (0)
                        depth: 0,
                        role: 0, // extension_prompt_roles.SYSTEM
                        scan: false,
                        filter: null
                    };
                });
            }
        }
        
        // Merge markers and ordered user prompts with system prompts
        const prompts = preparePromptsForChatCompletion({
            scenario,
            charPersonality,
            name2,
            worldInfoBefore: finalWorldInfoBefore,
            worldInfoAfter: finalWorldInfoAfter,
            charDescription,
            quietPrompt,
            bias,
            extensionPrompts: finalExtensionPrompts,
            systemPromptOverride,
            jailbreakPromptOverride,
            type,
        }, promptManager, oaiSettings);

        // Fill the chat completion with as much context as the budget allows
        await populateChatCompletion(
            prompts, 
            chatCompletion, 
            { bias, quietPrompt, quietImage, type, cyclePrompt, messages, messageExamples, excludeStatusBarChoice },
            promptManager,
            tokenCountFn,
            oaiSettings // oaiSettings를 전달하여 new_chat_prompt 등 사용
        );

        // TODO: 에러 처리 (TokenBudgetExceededError, InvalidCharacterNameError 등)
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_AI_5002', 'prepareOpenAIMessages 오류', error);
        }
        // TODO: 실리태번과 동일한 에러 처리
        throw error;
    } finally {
        // 실리태번과 동일: Pass chat completion to prompt manager for inspection (1427-1429번 라인)
        promptManager.setChatCompletion(chatCompletion);

        // 실리태번과 동일: squashSystemMessages 호출 (1431-1433번 라인)
        const shouldSquash = oaiSettings.squash_system_messages !== undefined 
            ? oaiSettings.squash_system_messages 
            : (userSettings.squash_system_messages !== false); // 기본값 true
        
        if (shouldSquash && !dryRun) {
            await chatCompletion.squashSystemMessages(tokenCountFn);
        }

        // 실리태번과 동일: All information is up-to-date, render. (1435-1436번 라인)
        if (dryRun === false && promptManager) {
            await promptManager.render(false);
        }
    }

    let chat = chatCompletion.getChat();
    
    // 실리태번과 동일: names_behavior 적용 (517-534번 라인)
    // 캐릭터 이름 동작 설정 확인
    const namesBehavior = oaiSettings.names_behavior !== undefined 
        ? oaiSettings.names_behavior 
        : ((userSettings && userSettings.names_behavior !== undefined) ? userSettings.names_behavior : 0); // 기본값: 0 (Default)
    
    // names_behavior 값 정의 (실리태번과 동일)
    const NONE = -1;
    const DEFAULT = 0;
    const COMPLETION = 1;
    const CONTENT = 2;
    
    // CONTENT 모드: 모든 메시지 content 앞에 이름 추가
    if (namesBehavior === CONTENT) {
        chat = chat.map(message => {
            if (message.name && message.content && typeof message.content === 'string' && message.role !== 'system') {
                // 이름이 이미 content 앞에 있는지 확인
                const namePrefix = `${message.name}: `;
                if (!message.content.startsWith(namePrefix)) {
                    return {
                        ...message,
                        content: `${namePrefix}${message.content}`
                    };
                }
            }
            return message;
        });
    }
    // DEFAULT 모드는 populateChatHistory에서 처리 (그룹 채팅이나 force_avatar인 경우)
    // COMPLETION 모드는 name 필드로 처리 (이미 Message.name으로 전달됨)
    // NONE 모드는 아무 처리 안 함
    
    // 실리태번과 동일: wrap_in_quotes 옵션 적용 (540번 라인)
    // 사용자 메시지에 따옴표 추가
    const wrapInQuotes = oaiSettings.wrap_in_quotes !== undefined 
        ? oaiSettings.wrap_in_quotes 
        : ((userSettings && userSettings.wrap_in_quotes) || false);
    
    if (wrapInQuotes) {
        chat = chat.map(message => {
            if (message.role === 'user' && message.content && typeof message.content === 'string') {
                return {
                    ...message,
                    content: `"${message.content}"`
                };
            }
            return message;
        });
    }
    
    // 실리태번과 동일: tokenHandler.counts 반환 (1446번 라인)
    const counts = promptManager.tokenHandler ? promptManager.tokenHandler.counts : null;
    return [chat, counts];
}

