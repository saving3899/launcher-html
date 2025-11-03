/**
 * populateChatCompletion 함수
 * 실리태번의 openai.js populateChatCompletion 함수와 동일한 구조
 */


/**
 * 프롬프트를 ChatCompletion에 추가하는 헬퍼 함수
 * @param {Object} prompts - PromptCollection
 * @param {ChatCompletion} chatCompletion - ChatCompletion 인스턴스
 * @param {PromptManager} promptManager - PromptManager 인스턴스
 * @param {Function} [tokenCountFn] - Optional token counting function
 * @param {string} source - 프롬프트 식별자
 * @param {string} [target] - 타겟 프롬프트 식별자
 */
async function addToChatCompletion(prompts, chatCompletion, promptManager, tokenCountFn, source, target = null) {
    // We need the prompts array to determine a position for the source.
    if (!prompts.has(source)) return;

    if (promptManager.isPromptDisabledForActiveCharacter(source) && source !== 'main') {
        promptManager.log(`Skipping prompt ${source} because it is disabled`);
        return;
    }

    const prompt = prompts.get(source);

    if (prompt.injection_position === INJECTION_POSITION.ABSOLUTE) {
        promptManager.log(`Skipping prompt ${source} because it is an absolute prompt`);
        return;
    }

    const index = target ? prompts.index(target) : prompts.index(source);
    const collection = new MessageCollection(source);
    const message = await Message.fromPromptAsync(prompt, tokenCountFn);
    
    // 디버깅: user role 프롬프트 확인
    if (message.role === 'user') {
        // 디버깅: 프롬프트가 user role을 가짐
        console.debug('[PopulateChatCompletion] 프롬프트가 user role을 가짐:', source);
    }
    
    collection.add(message);
    chatCompletion.add(collection, index);
}

/**
 * populateChatCompletion 함수
 * 실리태번의 populateChatCompletion 함수와 동일
 * @param {Object} prompts - PromptCollection 인스턴스
 * @param {ChatCompletion} chatCompletion - ChatCompletion 인스턴스
 * @param {Object} options - 옵션 객체
 * @param {string} [options.bias] - 바이어스
 * @param {string} [options.quietPrompt] - 조용한 프롬프트
 * @param {string} [options.quietImage] - 조용한 이미지
 * @param {string} [options.type] - 생성 타입
 * @param {string} [options.cyclePrompt] - 사이클 프롬프트
 * @param {Array} [options.messages] - 채팅 메시지 배열
 * @param {Array} [options.messageExamples] - 메시지 예제 배열
 * @param {boolean} [options.excludeStatusBarChoice] - 상태창/선택지 지시문 제외 여부 (대필 요청 시 true)
 * @param {PromptManager} promptManager - PromptManager 인스턴스
 * @param {Function} [tokenCountFn] - Optional token counting function
 */
async function populateChatCompletion(
    prompts, 
    chatCompletion, 
    { bias, quietPrompt, quietImage, type, cyclePrompt, messages, messageExamples, excludeStatusBarChoice = false },
    promptManager,
    tokenCountFn = null,
    oaiSettings = {}
) {
    // Helper function binding
    const addToChatCompletionBound = (source, target = null) => 
        addToChatCompletion(prompts, chatCompletion, promptManager, tokenCountFn, source, target);

    chatCompletion.reserveBudget(3); // every reply is primed with <|start|>assistant<|message|>
    
    // 상태창/선택지 지시문 적용 (World Info처럼 처리)
    // 대필 요청 시에는 제외
    if (!excludeStatusBarChoice) {
        // applyStatusBarChoiceToPrompts - 전역 스코프에서 사용
        await applyStatusBarChoiceToPrompts(prompts);
    }
    
    // 중요: populateChatHistory를 먼저 호출하여 채팅 히스토리가 비어있을 때 atDepth 엔트리를 worldInfoBefore에 추가
    // (worldInfoBefore를 chatCompletion에 추가하기 전에 내용을 미리 수정해야 함)
    const chatHistoryMessages = Array.isArray(messages) ? messages : (messages === undefined || messages === null ? [] : []);
    // names_behavior 설정 확인
    const namesBehavior = oaiSettings.names_behavior !== undefined 
        ? oaiSettings.names_behavior 
        : ((promptManager && promptManager.serviceSettings && promptManager.serviceSettings.names_behavior !== undefined) 
            ? promptManager.serviceSettings.names_behavior 
            : 0); // 기본값: 0 (Default)
    
    await populateChatHistory(chatHistoryMessages, prompts, chatCompletion, type, cyclePrompt, promptManager, tokenCountFn, oaiSettings, excludeStatusBarChoice, namesBehavior);
    
    // 실리태번과 동일: Character and world information을 하드코딩된 순서로 먼저 추가 (1022-1029번 라인)
    await addToChatCompletionBound('worldInfoBefore');
    await addToChatCompletionBound('main');
    await addToChatCompletionBound('worldInfoAfter');
    await addToChatCompletionBound('charDescription');
    await addToChatCompletionBound('charPersonality');
    await addToChatCompletionBound('scenario');
    await addToChatCompletionBound('personaDescription');

    // Collection of control prompts that will always be positioned last
    chatCompletion.setOverriddenPrompts(prompts.overriddenPrompts);
    const controlPrompts = new MessageCollection('controlPrompts');

    const impersonateMessage = prompts.has('impersonate') 
        ? await Message.fromPromptAsync(prompts.get('impersonate'), tokenCountFn) 
        : null;
    if (type === 'impersonate' && impersonateMessage) {
        controlPrompts.add(impersonateMessage);
    }

    // Add quiet prompt to control prompts
    // This should always be last, even in control prompts. Add all further control prompts BEFORE this prompt
    const quietPromptMessage = prompts.has('quietPrompt')
        ? await Message.fromPromptAsync(prompts.get('quietPrompt'), tokenCountFn)
        : null;
    if (quietPromptMessage && quietPromptMessage.content) {
        // TODO: 이미지 인라이닝 지원 확인 및 추가
        // if (isImageInliningSupported() && quietImage) {
        //     await quietPromptMessage.addImage(quietImage);
        // }
        controlPrompts.add(quietPromptMessage);
    }

    // 실리태번과 동일: Continue prefill 처리 (1141-1154번 라인)
    // Displace the message to be continued from its original position before performing in-chat injections
    // In case if it is an assistant message, we want to prepend the users assistant prefill on the message
    const continuePrefill = oaiSettings.continue_prefill !== undefined 
        ? oaiSettings.continue_prefill 
        : false;
    
    if (type === 'continue' && continuePrefill && messages && messages.length > 0) {
        // messages 배열의 첫 번째 메시지 (마지막 메시지)를 가져옴
        const chatMessage = messages[0];
        const isAssistantRole = chatMessage.role === 'assistant';
        
        // TODO: assistant_prefill 설정 지원 필요 (현재는 빈 문자열)
        const assistantPrefill = ''; // isAssistantRole ? substituteParams(oaiSettings.assistant_prefill) : '';
        const messageContent = [assistantPrefill, chatMessage.content].filter(x => x).join('\n\n');
        
        // Message.createAsync - 전역 스코프에서 사용
        const continueMessage = await Message.createAsync(chatMessage.role, messageContent, 'continuePrefill', tokenCountFn);
        
        // TODO: names_behavior === COMPLETION일 때만 이름 설정 필요
        // if (chatMessage.name && namesInCompletion) {
        //     await continueMessage.setName(promptManager.sanitizeName(chatMessage.name));
        // }
        
        controlPrompts.add(continueMessage);
        chatCompletion.reserveBudget(continueMessage);
        
        // messages 배열에서 첫 번째 메시지 제거 (populateChatHistory에서 다시 추가되지 않도록)
        messages.shift();
    }

    // continue_nudge_prompt 처리 (기존 continue 로직 이후, quietPrompt 전에 추가)
    // 기존 continue 기능과 공존하면서 보조적으로 작동
    if (type === 'continue') {
        const continueNudge = oaiSettings.continue_nudge_prompt || '';
        if (continueNudge) {
            // configuration에서 name1, name2 가져오기 ({{user}}, {{char}} 치환용)
            const name1 = promptManager.configuration?.name1 || '';
            const name2 = promptManager.configuration?.name2 || '';
            // substituteParams - 전역 스코프에서 사용
            const continueNudgeContent = substituteParams(continueNudge, name1, name2);
            if (continueNudgeContent && continueNudgeContent.trim()) {
                const continueNudgeMessage = await Message.createAsync(
                    'system',
                    continueNudgeContent.trim(),
                    'continueNudge',
                    tokenCountFn
                );
                // continuePrefill 다음에 추가 (기존 로직 이후)
                // quietPrompt 전에 추가 (quietPrompt는 항상 마지막이어야 함)
                controlPrompts.add(continueNudgeMessage);
                chatCompletion.reserveBudget(continueNudgeMessage);
            }
        }
    }

    chatCompletion.reserveBudget(controlPrompts);

    // 실리태번과 동일: Add ordered system and user prompts (1051-1068번 라인)
    const systemPrompts = ['nsfw', 'jailbreak'];
    
    const userRelativePrompts = prompts.collection
        .filter((prompt) => prompt.system_prompt !== true && prompt.injection_position !== INJECTION_POSITION.ABSOLUTE)
        .reduce((acc, prompt) => {
            acc.push(prompt.identifier);
            return acc;
        }, []);
    
    for (const identifier of [...systemPrompts, ...userRelativePrompts]) {
        await addToChatCompletionBound(identifier);
    }

    // Absolute injection prompts 처리
    const absolutePrompts = prompts.collection
        .filter((prompt) => prompt.injection_position === INJECTION_POSITION.ABSOLUTE)
        .reduce((acc, prompt) => {
            acc.push(prompt);
            return acc;
        }, []);

    // 실리태번과 동일: Add enhance definition instruction (1071번 라인)
    if (prompts.has('enhanceDefinitions')) {
        await addToChatCompletionBound('enhanceDefinitions');
    }

    // Bias는 별도로 처리 (control prompts 전에) (1074번 라인)
    if (bias && bias.trim().length) {
        await addToChatCompletionBound('bias');
    }

    // Tavern Extras - Summary
    if (prompts.has('summary')) {
        const summary = prompts.get('summary');
        if (summary.injection_position !== undefined && summary.injection_position !== INJECTION_POSITION.ABSOLUTE) {
            const message = await Message.fromPromptAsync(summary, tokenCountFn);
            chatCompletion.insert(message, 'main', summary.injection_depth || 4);
        }
    }

    // Authors Note
    if (prompts.has('authorsNote')) {
        const authorsNote = prompts.get('authorsNote');
        if (authorsNote.injection_position !== undefined && authorsNote.injection_position !== INJECTION_POSITION.ABSOLUTE) {
            const message = await Message.fromPromptAsync(authorsNote, tokenCountFn);
            chatCompletion.insert(message, 'main', authorsNote.injection_depth || 4);
        }
    }

    // TODO: Vectors Memory, Vectors Data Bank, Smart Context 등의 확장 프롬프트 처리
    // TODO: Tool calling 지원
    // Continue 모드 처리: 위에서 이미 처리됨 (controlPrompts에 continuePrefill 메시지 추가)
    
    // 상태창/선택지 Extension Module 엔트리 수집 (EMTop/EMBottom)
    // 대필 요청 시에는 제외
    let emTopEntries = [];
    let emBottomEntries = [];
    if (!excludeStatusBarChoice) {
        // collectStatusBarChoiceEntries - 전역 스코프에서 사용
        const collected = await collectStatusBarChoiceEntries();
        emTopEntries = collected.emTopEntries || [];
        emBottomEntries = collected.emBottomEntries || [];
    }
    
    // Dialogue examples 처리 (실리태번과 동일)
    // pin_examples 설정이 없으므로 기본적으로 chat history 전에 추가
    if (messageExamples && Array.isArray(messageExamples) && messageExamples.length > 0) {
        await populateDialogueExamples(prompts, chatCompletion, messageExamples, promptManager, tokenCountFn, emTopEntries, emBottomEntries, oaiSettings);
    } else if ((emTopEntries.length > 0 || emBottomEntries.length > 0) && !excludeStatusBarChoice) {
        // messageExamples가 없어도 EMTop/EMBottom 엔트리가 있으면 dialogueExamples 컬렉션 생성 후 추가
        if (!prompts.has('dialogueExamples')) {
            // dialogueExamples 프롬프트가 없으면 생성
            // Prompt - 전역 스코프에서 사용
            const dialogueExamplesPrompt = new Prompt('dialogueExamples', '', 'system');
            prompts.set('dialogueExamples', dialogueExamplesPrompt);
        }
        await populateDialogueExamples(prompts, chatCompletion, [], promptManager, tokenCountFn, emTopEntries, emBottomEntries, oaiSettings);
    }
    
    // Chat history 처리 (실제 메시지 추가)
    // 주의: populateChatHistory는 이미 위에서 호출되었음 (worldInfoBefore 수정을 위해)
    // 여기서는 실제 채팅 메시지가 있을 때만 chatHistory 컬렉션에 추가하는 로직이 필요하지만,
    // populateChatHistory 내부에서 이미 처리되므로 여기서는 추가 호출이 필요 없음
    // (populateChatHistory는 messages가 비어있어도 호출되지만, 메시지가 있을 때만 실제로 추가함)

    chatCompletion.freeBudget(controlPrompts);
    if (controlPrompts.collection.length) {
        chatCompletion.add(controlPrompts);
    }
    
    const finalChat = chatCompletion.getChat();
}

/**
 * 대화 예제를 ChatCompletion에 추가
 * 실리태번의 populateDialogueExamples 함수와 동일
 * @param {Object} prompts - PromptCollection
 * @param {ChatCompletion} chatCompletion - ChatCompletion 인스턴스
 * @param {Array} messageExamples - 메시지 예제 배열
 * @param {PromptManager} promptManager - PromptManager 인스턴스
 * @param {Function} [tokenCountFn] - Optional token counting function
 * @param {Array} [emTopEntries] - Extension Module 상단 엔트리들 (상태창/선택지)
 * @param {Array} [emBottomEntries] - Extension Module 하단 엔트리들 (상태창/선택지)
 * @param {Object} [oaiSettings] - OpenAI 설정 객체 (new_example_chat_prompt 포함)
 */
async function populateDialogueExamples(prompts, chatCompletion, messageExamples, promptManager, tokenCountFn = null, emTopEntries = [], emBottomEntries = [], oaiSettings = {}) {
    if (!prompts.has('dialogueExamples')) {
        return;
    }

    const dialogueExamplesIndex = prompts.index('dialogueExamples');
    if (dialogueExamplesIndex < 0) {
        return;
    }

    // dialogueExamples 컬렉션 추가
    chatCompletion.add(new MessageCollection('dialogueExamples'), dialogueExamplesIndex);
    
    // Extension Module 상단 엔트리 삽입 (EMTop - Position 5)
    if (emTopEntries.length > 0) {
        // configuration에서 name1, name2 가져오기 ({{user}}, {{char}} 치환용)
        const name1 = promptManager.configuration?.name1 || '';
        const name2 = promptManager.configuration?.name2 || '';
        const rawEmTopText = emTopEntries.join('\n');
        const emTopText = substituteParams(rawEmTopText, name1, name2);
        try {
            const emTopMessage = await Message.createAsync('system', emTopText, 'statusBarChoice-EMTop', tokenCountFn);
            if (chatCompletion.canAfford(emTopMessage)) {
                chatCompletion.insertAtStart(emTopMessage, 'dialogueExamples');
            }
        } catch (error) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_AI_5003', 'EMTop 삽입 오류', error);
            }
        }
    }
    
    if (Array.isArray(messageExamples) && messageExamples.length > 0) {
        // new_example_chat_prompt는 oaiSettings에서 가져오고, 없으면 기본값 사용
        const newExampleChatPrompt = oaiSettings.new_example_chat_prompt || '{Example Dialogue:}';
        const newExampleChat = await Message.createAsync('system', substituteParams(newExampleChatPrompt), 'newChat');
        
        for (const dialogue of [...messageExamples]) {
            const dialogueIndex = messageExamples.indexOf(dialogue);
            const chatMessages = [];

            for (let promptIndex = 0; promptIndex < dialogue.length; promptIndex++) {
                const prompt = dialogue[promptIndex];
                const role = 'system';
                const content = prompt.content || '';
                const identifier = `dialogueExamples ${dialogueIndex}-${promptIndex}`;

                const chatMessage = await Message.createAsync(role, content, identifier, tokenCountFn);
                if (prompt.name) {
                    await chatMessage.setName(prompt.name);
                }
                chatMessages.push(chatMessage);
            }

            // 토큰 예산 확인
            if (!chatCompletion.canAffordAll([newExampleChat, ...chatMessages])) {
                break;
            }

            // ChatCompletion에 추가
            chatCompletion.insert(newExampleChat, 'dialogueExamples');
            for (const chatMessage of chatMessages) {
                chatCompletion.insert(chatMessage, 'dialogueExamples');
            }
        }
    }
    
    // Extension Module 하단 엔트리 삽입 (EMBottom - Position 6)
    if (emBottomEntries.length > 0) {
        // configuration에서 name1, name2 가져오기 ({{user}}, {{char}} 치환용)
        const name1 = promptManager.configuration?.name1 || '';
        const name2 = promptManager.configuration?.name2 || '';
        const rawEmBottomText = emBottomEntries.join('\n');
        const emBottomText = substituteParams(rawEmBottomText, name1, name2);
        try {
            const emBottomMessage = await Message.createAsync('system', emBottomText, 'statusBarChoice-EMBottom', tokenCountFn);
            if (chatCompletion.canAfford(emBottomMessage)) {
                // dialogueExamples 컬렉션의 끝에 추가
                chatCompletion.insert(emBottomMessage, 'dialogueExamples');
            }
        } catch (error) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_AI_5004', 'EMBottom 삽입 오류', error);
            }
        }
    }
}

/**
 * 채팅 히스토리를 ChatCompletion에 추가
 * 실리태번의 populateChatHistory 함수와 동일
 * @param {Array} messages - 채팅 메시지 배열 [{ role, content, name? }]
 * @param {Object} prompts - PromptCollection
 * @param {ChatCompletion} chatCompletion - ChatCompletion 인스턴스
 * @param {string} [type] - 생성 타입
 * @param {string} [cyclePrompt] - 사이클 프롬프트
 * @param {PromptManager} promptManager - PromptManager 인스턴스
 * @param {Function} [tokenCountFn] - Optional token counting function
 */
async function populateChatHistory(messages, prompts, chatCompletion, type = null, cyclePrompt = null, promptManager, tokenCountFn = null, oaiSettings = {}, excludeStatusBarChoice = false, namesBehavior = 0) {
    const messagesArray = Array.isArray(messages) ? messages : [];
    
    // 실리태번과 동일 (786번 라인)
    // 중요: chatHistory 프롬프트가 없어도 채팅 메시지는 추가해야 함!
    // chatHistory 프롬프트는 마커 역할만 하므로, 없으면 자동으로 추가
    // 또한, chatHistory 컬렉션이 이미 존재하는지 확인 (중복 생성 방지)
    let chatHistoryCollection = chatCompletion.messages.collection.find(
        item => item instanceof MessageCollection && item.identifier === 'chatHistory'
    );
    
    if (!chatHistoryCollection) {
        // chatHistory 컬렉션이 없으면 생성
        chatHistoryCollection = new MessageCollection('chatHistory');
        
        // chatHistory 프롬프트의 정확한 position을 사용하여 추가
        // 이렇게 하면 다른 프롬프트들이 같은 position을 사용할 때 덮어쓰지 않음
        if (prompts.has('chatHistory')) {
            const chatHistoryPosition = prompts.index('chatHistory');
            chatCompletion.add(chatHistoryCollection, chatHistoryPosition);
        } else {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_AI_20002', 'chatHistory 프롬프트를 찾을 수 없음, 계속 진행');
            }
            // chatHistory 프롬프트가 없으면 맨 끝에 추가 (position 지정 없이)
            chatCompletion.add(chatHistoryCollection);
        }
    }

    // 실리태번과 동일: Reserve budget for new chat message (793-796번 라인)
    // selected_group은 현재 구현되지 않았으므로 new_chat_prompt 사용
    const newChat = oaiSettings.new_chat_prompt || oaiSettings.new_group_chat_prompt || '';
    // configuration에서 name1, name2 가져오기 ({{user}}, {{char}} 치환용)
    // init()에서 moduleConfiguration이 this.configuration에 병합되므로 여기서 참조
    const name1 = promptManager.configuration?.name1 || '';
    const name2 = promptManager.configuration?.name2 || '';
    const newChatContent = substituteParams(newChat, name1, name2);
    // newChatContent가 비어있으면 newChatMessage를 생성하지 않음 (실리태번과 동일)
    const newChatMessage = newChatContent && newChatContent.trim() 
        ? await Message.createAsync('system', newChatContent, 'newMainChat', tokenCountFn)
        : null;
    if (newChatMessage) {
        chatCompletion.reserveBudget(newChatMessage);
    }

    // 상태창/선택지 atDepth 엔트리 수집
    // 대필 요청 시에는 제외
    let statusBarDepthEntries = [];
    let atDepthMap = new Map();
    const roleMap = { 0: 'system', 1: 'user', 2: 'assistant' };
    
    if (!excludeStatusBarChoice) {
        // collectStatusBarChoiceEntries - 전역 스코프에서 사용
        const collected = await collectStatusBarChoiceEntries();
        statusBarDepthEntries = collected.depthEntries || [];
        
        // depth와 role별로 그룹화된 atDepth 엔트리를 Map으로 변환 (빠른 검색용)
        // key: `${depth}-${role}`, value: { instructions, inserted: false }
        statusBarDepthEntries.forEach(entry => {
            const key = `${entry.depth}-${entry.role}`;
            if (!atDepthMap.has(key)) {
                atDepthMap.set(key, { instructions: [], inserted: false });
            }
            atDepthMap.get(key).instructions.push(...entry.instructions);
        });
    }
    
    // 실리태번과 동일: Insert chat messages (840-886번 라인)
    // 중요: reverse()를 사용하지 않고 원래 순서대로 처리
    // 이유: insertAtStart()를 사용하므로 역순 처리가 필요 없음
    // 대필 요청의 경우: [그리팅, 대필지시문] 순서를 유지해야 함
    const chatPool = [...messages]; // reverse() 제거
    let addedCount = 0;
    for (let index = 0; index < chatPool.length; index++) {
        const chatPrompt = chatPool[index];

        // 메시지 유효성 검사
        if (!chatPrompt || !chatPrompt.role || !chatPrompt.content) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_AI_20003', `유효하지 않은 메시지 건너뛰기 (인덱스: ${index})`);
            }
            continue;
        }

        // 실리태번과 동일: Prompt 객체 생성 (846-848번 라인)
        const prompt = new Prompt(chatPrompt);
        // identifier는 원래 순서 기준 (마지막 메시지가 가장 최근 메시지)
        prompt.identifier = `chatHistory-${chatPool.length - index}`;
        const preparedPrompt = promptManager.preparePrompt(prompt);
        
        // preparePrompt는 Prompt 객체를 반환하므로, content를 추출해야 함
        // 실리태번과 동일: preparePrompt는 Prompt 객체를 반환하고, content는 이미 substituteParams가 적용됨
        let promptContent = preparedPrompt.content || '';
        
        // 실리태번과 동일: 프롬프트 생성 시 정규식 적용 (isPrompt: true, depth 계산)
        // 실리태번의 Generate 함수 (3745번 라인): { isPrompt: true, depth: (coreChat.length - index - (isContinue ? 2 : 1)) }
        // getRegexedString, REGEX_PLACEMENT - 전역 스코프에서 사용
        // depth 계산: 마지막 메시지가 depth=0, 그 이전이 depth=1, ...
        // 원래 순서대로 처리하므로 depth = (chatPool.length - index - 1)
        const depth = chatPool.length - index - 1;
        
        // 상태창/선택지 atDepth 엔트리 확인 및 삽입
        // 현재 메시지의 role을 숫자로 변환 (0=system, 1=user, 2=assistant)
        const currentRoleNum = chatPrompt.role === 'system' ? 0 : 
                               chatPrompt.role === 'user' ? 1 : 
                               chatPrompt.role === 'assistant' ? 2 : 0;
        const atDepthKey = `${depth}-${currentRoleNum}`;
        
        // 해당 depth와 role에 맞는 atDepth 엔트리 찾기
        let atDepthEntry = null;
        let matchedKey = null;
        
        // 1. 정확히 일치하는 키 찾기
        if (atDepthMap.has(atDepthKey) && !atDepthMap.get(atDepthKey).inserted) {
            atDepthEntry = atDepthMap.get(atDepthKey);
            matchedKey = atDepthKey;
        } else {
            // 2. Fallback: 같은 depth에서 다른 role의 엔트리 찾기
            // role=0 (system)은 일반적으로 채팅 히스토리에 없으므로, user 또는 assistant와 매칭
            // 또한 채팅 히스토리에 system 메시지가 없을 경우 role=0 엔트리는 항상 매칭 시도
            const depthOnlyKey = `${depth}-`;
            
            // 먼저 정확히 같은 depth에서 role=0 (system) 엔트리 찾기
            for (const [key, entry] of atDepthMap.entries()) {
                if (key.startsWith(depthOnlyKey) && !entry.inserted) {
                    const entryRole = parseInt(key.split('-')[1]);
                    // role=0일 때는 항상 fallback 적용 (system 메시지가 없으므로)
                    if (entryRole === 0) {
                        atDepthEntry = entry;
                        matchedKey = key;
                        break;
                    }
                }
            }
            
            // 위에서 매칭이 안 되면, depth가 0일 때 depth=1 엔트리도 찾기 (사용자가 depth=1로 설정했지만 실제로는 depth=0에 삽입해야 할 수도)
            if (!atDepthEntry && depth === 0) {
                for (const [key, entry] of atDepthMap.entries()) {
                    const entryDepth = parseInt(key.split('-')[0]);
                    const entryRole = parseInt(key.split('-')[1]);
                    // depth=1이고 role=0인 엔트리를 depth=0에서 찾기
                    if (entryDepth === 1 && entryRole === 0 && !entry.inserted) {
                        atDepthEntry = entry;
                        matchedKey = key;
                        break;
                    }
                }
            }
            
            // 위에서 매칭이 안 되고, 정확히 같은 role일 때만 추가 매칭 시도
            if (!atDepthEntry) {
                for (const [key, entry] of atDepthMap.entries()) {
                    if (key.startsWith(depthOnlyKey) && !entry.inserted) {
                        const entryRole = parseInt(key.split('-')[1]);
                        // 정확히 같은 role일 때만 매칭
                        if (entryRole === currentRoleNum) {
                            atDepthEntry = entry;
                            matchedKey = key;
                            break;
                        }
                    }
                }
            }
        }
        
        // atDepth 엔트리 삽입
        if (atDepthEntry) {
            // Status Bar/Choice 지시문에서 {{user}}, {{char}} 등 매크로 치환
            const rawAtDepthText = atDepthEntry.instructions.join('\n');
            const atDepthText = substituteParams(rawAtDepthText, name1, name2);
            
            try {
                // atDepth 메시지는 원래 설정된 role이 아닌 현재 메시지의 role을 사용
                const atDepthMessage = await Message.createAsync(
                    chatPrompt.role,
                    atDepthText,
                    `statusBarChoice-atDepth-${depth}-${currentRoleNum}`,
                    tokenCountFn
                );
                
                // 현재 메시지 앞에 atDepth 메시지 삽입
                // 중요: insertAtEnd()를 사용하므로, atDepth를 먼저 추가하고 그 다음에 일반 메시지를 추가
                // 이렇게 하면 최종 순서는 [atDepth, 일반메시지]가 됨
                if (chatCompletion.canAfford(atDepthMessage)) {
                    chatCompletion.insertAtEnd(atDepthMessage, 'chatHistory');
                    atDepthEntry.inserted = true; // 삽입 완료 표시
                } else {
                    // 경고 코드 토스트 알림 표시
                    if (typeof showErrorCodeToast === 'function') {
                        showErrorCodeToast('WARN_AI_20004', `atDepth 엔트리 삽입 실패: 토큰 예산 부족 (depth=${depth}, role=${chatPrompt.role})`);
                    }
                }
            } catch (error) {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_AI_5005', 'atDepth 삽입 오류', error);
                }
            }
        }
        
        const regexPlacement = chatPrompt.role === 'user' ? REGEX_PLACEMENT.USER_INPUT : REGEX_PLACEMENT.AI_OUTPUT;
        
        // 실리태번과 동일: 프롬프트 생성 시 isPrompt: true
        const regexedContent = await getRegexedString(promptContent, regexPlacement, {
            isMarkdown: false,
            isPrompt: true,
            depth: depth
        });
        
        // Message.fromPromptAsync는 Prompt 객체를 받아야 하지만, 여기서는 이미 처리된 문자열을 사용
        // 따라서 Message.createAsync를 직접 사용하여 identifier를 명시적으로 전달
        const chatMessage = await Message.createAsync(
            chatPrompt.role || 'system',
            regexedContent,
            prompt.identifier,
            tokenCountFn
        );

        // 실리태번과 동일: 이름 설정 (850-853번 라인, names_behavior === COMPLETION일 때만)
        // COMPLETION 모드: Message.name 필드로 전달
        const COMPLETION = 1;
        if (namesBehavior === COMPLETION && chatPrompt.name && promptManager && promptManager.sanitizeName) {
            // 실리태번과 동일: sanitizeName 함수 사용
            const sanitizedName = promptManager.sanitizeName(chatPrompt.name);
            if (sanitizedName) {
                await chatMessage.setName(sanitizedName, tokenCountFn);
            }
        }
        // DEFAULT 모드는 그룹 채팅이나 force_avatar인 경우에만 content 앞에 이름 추가 (현재는 그룹 채팅 미구현)
        // CONTENT 모드는 prepareOpenAIMessages에서 처리
        // NONE 모드는 아무 처리 안 함

        // 실리태번과 동일: 토큰 예산 확인 후 추가 (881-885번 라인)
        // 중요: insertAtEnd()를 사용하여 메시지 순서 유지
        // [그리팅, 대필지시문] 순서로 입력되면 [그리팅, 대필지시문] 순서로 추가됨
        if (chatCompletion.canAfford(chatMessage)) {
            chatCompletion.insertAtEnd(chatMessage, 'chatHistory');
            addedCount++;
        } else {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_AI_20005', `토큰 예산 초과로 메시지 추가 중단 (${addedCount}/${chatPool.length})`);
            }
            break;
        }
    }

    // 채팅 히스토리가 비어있을 때 atDepth 엔트리를 worldInfoBefore에 추가
    // 또는 삽입되지 않은 atDepth 엔트리가 있을 때 처리
    if (!excludeStatusBarChoice && atDepthMap.size > 0) {
        // 사용자 입력 메시지가 있는지 확인 (user role 메시지가 있으면 true)
        const hasUserMessages = messages && messages.some(m => m && m.role === 'user');
        
        // 모든 atDepth 엔트리를 수집
        // 사용자 입력 메시지가 없으면 모든 atDepth 엔트리를 worldInfoBefore에 추가
        const allAtDepthInstructions = [];
        
        // 사용자 입력 메시지가 없으면 모든 atDepth 엔트리 추가 (그리팅만 있거나 완전히 빈 상태)
        if (!hasUserMessages) {
            for (const [key, entry] of atDepthMap.entries()) {
                if (entry.instructions.length > 0) {
                    allAtDepthInstructions.push(...entry.instructions);
                }
            }
        } else {
            // 사용자 입력 메시지가 있으면 삽입되지 않은 atDepth 엔트리만 수집
            for (const [key, entry] of atDepthMap.entries()) {
                if (!entry.inserted && entry.instructions.length > 0) {
                    allAtDepthInstructions.push(...entry.instructions);
                }
            }
        }
        
        if (allAtDepthInstructions.length > 0) {
            // 매크로 치환
            // substituteParams - 전역 스코프에서 사용
            const character = prompts.get('charDescription')?.data?.char;
            const name1 = character?.data?.name || '';
            const name2 = character?.name || '';
            
            const processedInstructions = allAtDepthInstructions.map(instruction => 
                substituteParams(instruction, name1, name2)
            ).join('\n');
            
            // worldInfoBefore에 추가
            if (prompts.has('worldInfoBefore')) {
                const worldInfoBeforePrompt = prompts.get('worldInfoBefore');
                const existingContent = worldInfoBeforePrompt.content?.trim() || '';
                worldInfoBeforePrompt.content = existingContent 
                    ? `${processedInstructions}\n${existingContent}` 
                    : processedInstructions;
            } else {
                // worldInfoBefore가 없으면 생성
                // Prompt - 전역 스코프에서 사용
                const worldInfoBeforePrompt = new Prompt('worldInfoBefore', processedInstructions, 'system');
                prompts.set('worldInfoBefore', worldInfoBeforePrompt);
            }
        }
    }

    // 실리태번과 동일: Insert and free new chat (889-890번 라인)
    if (newChatMessage) {
        chatCompletion.freeBudget(newChatMessage);
        chatCompletion.insertAtStart(newChatMessage, 'chatHistory');
    }
}
