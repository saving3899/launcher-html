/**
 * 슬래시 명령어 실행 시스템
 * 실리태번의 슬래시 명령어 시스템을 참고하여 구현
 */

/**
 * 변수 저장소 (Scope)
 */
class SlashCommandScope {
    constructor(parent = null) {
        this.variables = new Map();
        this.parent = parent;
    }

    /**
     * 변수 설정
     * @param {string} key - 변수 이름
     * @param {string} value - 변수 값
     */
    setVariable(key, value) {
        this.variables.set(key, value);
    }

    /**
     * 변수 가져오기
     * @param {string} key - 변수 이름
     * @returns {string|null} 변수 값 또는 null
     */
    getVariable(key) {
        if (this.variables.has(key)) {
            return this.variables.get(key);
        }
        if (this.parent) {
            return this.parent.getVariable(key);
        }
        return null;
    }

    /**
     * 변수 존재 여부 확인
     * @param {string} key - 변수 이름
     * @returns {boolean}
     */
    existsVariable(key) {
        if (this.variables.has(key)) {
            return true;
        }
        if (this.parent) {
            return this.parent.existsVariable(key);
        }
        return false;
    }

    /**
     * 변수 삭제
     * @param {string} key - 변수 이름
     */
    deleteVariable(key) {
        this.variables.delete(key);
    }

    /**
     * 모든 변수 삭제
     */
    clear() {
        this.variables.clear();
    }
}

/**
 * 전역 변수 저장소
 */
const globalScope = new SlashCommandScope();

/**
 * 슬래시 명령어 실행 컨텍스트
 */
class SlashCommandContext {
    constructor(chatManager, characterManager) {
        // chatManager와 characterManager가 전달되었는지 확인
        if (!chatManager) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_SLASH_14001', 'SlashCommandContext 생성 시 chatManager 없음');
            }
            throw new Error('SlashCommandContext 생성 시 chatManager가 필요합니다.');
        }
        if (!characterManager) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_SLASH_14002', 'SlashCommandContext 생성 시 characterManager 없음');
            }
            throw new Error('SlashCommandContext 생성 시 characterManager가 필요합니다.');
        }
        
        this.chatManager = chatManager;
        this.characterManager = characterManager;
        this.scope = new SlashCommandScope(globalScope);
        this.pipe = ''; // 파이프 결과
        this.aborted = false;
    }

    /**
     * 명령어 실행 중단
     */
    abort() {
        this.aborted = true;
    }
}

/**
 * 명령어 체인 파싱 (파이프 `||` 또는 `|`로 구분)
 * 따옴표 안의 파이프는 무시
 * @param {string} commandText - 명령어 텍스트
 * @returns {string[]} 명령어 배열
 */
function parseCommandChain(commandText) {
    if (!commandText || typeof commandText !== 'string') {
        return [];
    }

    // 이중 파이프(`||`)를 먼저 찾아서 분리 (더 높은 우선순위)
    // 하지만 따옴표 안의 `||`는 무시해야 함
    const commands = [];
    let currentCommand = '';
    let inQuotes = false;
    let quoteChar = null;
    let i = 0;

    while (i < commandText.length) {
        const char = commandText[i];
        const nextChar = i + 1 < commandText.length ? commandText[i + 1] : null;

        // 따옴표 처리 (이스케이프된 따옴표는 무시)
        if ((char === '"' || char === "'") && (i === 0 || commandText[i - 1] !== '\\')) {
            if (!inQuotes) {
                inQuotes = true;
                quoteChar = char;
            } else if (char === quoteChar) {
                inQuotes = false;
                quoteChar = null;
            }
            currentCommand += char;
        } else if (!inQuotes && char === '|' && nextChar === '|') {
            // 이중 파이프(`||`) 발견 - 명령어 분리
            const cmd = currentCommand.trim();
            if (cmd.length > 0) {
                commands.push(cmd);
            }
            currentCommand = '';
            i += 2; // `||` 두 글자 건너뛰기
            continue;
        } else {
            currentCommand += char;
        }
        i++;
    }

    // 마지막 명령어 추가
    const lastCmd = currentCommand.trim();
    if (lastCmd.length > 0) {
        commands.push(lastCmd);
    }

    // 이중 파이프가 없으면 단일 파이프(`|`)로 분리 시도
    if (commands.length === 1 && commands[0].includes('|')) {
        // 단일 파이프로 다시 분리 (따옴표 안의 것은 무시)
        const singleCommands = [];
        let current = '';
        inQuotes = false;
        quoteChar = null;
        i = 0;
        const text = commands[0];

        while (i < text.length) {
            const char = text[i];
            if ((char === '"' || char === "'") && (i === 0 || text[i - 1] !== '\\')) {
                if (!inQuotes) {
                    inQuotes = true;
                    quoteChar = char;
                } else if (char === quoteChar) {
                    inQuotes = false;
                    quoteChar = null;
                }
                current += char;
            } else if (!inQuotes && char === '|') {
                // 단일 파이프 발견 - 명령어 분리
                const cmd = current.trim();
                if (cmd.length > 0) {
                    singleCommands.push(cmd);
                }
                current = '';
            } else {
                current += char;
            }
            i++;
        }

        // 마지막 명령어 추가
        const last = current.trim();
        if (last.length > 0) {
            singleCommands.push(last);
        }

        return singleCommands.length > 1 ? singleCommands : commands;
    }

    return commands.filter(cmd => cmd.length > 0);
}

/**
 * `{{pipe}}` 매크로 치환
 * @param {string} text - 치환할 텍스트
 * @param {SlashCommandContext} context - 실행 컨텍스트
 * @returns {string} 치환된 텍스트
 */
function substitutePipe(text, context) {
    if (!text || typeof text !== 'string') {
        return text;
    }
    // {{pipe}}를 현재 pipe 값으로 치환
    return text.replace(/\{\{pipe\}\}/g, String(context.pipe || ''));
}

/**
 * `/setvar` 명령어 파싱 및 실행
 * 형식: `/setvar key=name value` 또는 `/setvar key="name" "value"`
 * @param {string} command - 명령어 텍스트
 * @param {SlashCommandContext} context - 실행 컨텍스트
 * @returns {Promise<string>} pipe 결과
 */
async function executeSetvar(command, context) {
    // `/setvar key=name value` 또는 `/setvar key="name" "value"` 파싱
    // 따옴표로 감싸진 값은 이스케이프된 따옴표를 포함할 수 있으므로 정확히 파싱 필요
    const keyMatch = command.match(/\/setvar\s+key=(\w+)\s+/);
    if (!keyMatch) {
        // 경고 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('WARN_SLASH_20001', '/setvar 파싱 실패 (key 없음)');
        }
        return '';
    }

    const key = keyMatch[1];
    const valueStart = keyMatch[0].length;
    let value = command.substring(valueStart).trim();

    // 따옴표로 시작하는 경우, 매칭되는 닫는 따옴표 찾기 (이스케이프 고려)
    if (value.startsWith('"')) {
        // 이스케이프되지 않은 닫는 따옴표 찾기
        let endQuote = -1;
        for (let i = 1; i < value.length; i++) {
            if (value[i] === '"' && value[i - 1] !== '\\') {
                endQuote = i;
                break;
            }
        }
        if (endQuote > 0) {
            // 따옴표 안의 내용만 추출
            value = value.substring(1, endQuote);
            // 이스케이프 해제
            value = value.replace(/\\"/g, '"')
                         .replace(/\\n/g, '\n')
                         .replace(/\\'/g, "'")
                         .replace(/\\\\/g, '\\');
        } else {
            // 닫는 따옴표가 없으면 전체를 값으로 사용 (에러 상황)
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_SLASH_20002', '/setvar 닫는 따옴표 없음');
            }
            value = value.substring(1); // 여는 따옴표만 제거
        }
    } else if (value.startsWith("'")) {
        // 작은따옴표 처리
        let endQuote = -1;
        for (let i = 1; i < value.length; i++) {
            if (value[i] === "'" && value[i - 1] !== '\\') {
                endQuote = i;
                break;
            }
        }
        if (endQuote > 0) {
            value = value.substring(1, endQuote);
            value = value.replace(/\\'/g, "'")
                         .replace(/\\n/g, '\n')
                         .replace(/\\"/g, '"')
                         .replace(/\\\\/g, '\\');
        } else {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_SLASH_20003', '/setvar 닫는 작은따옴표 없음');
            }
            value = value.substring(1);
        }
    } else {
        // 따옴표 없이 시작하는 경우, 공백이나 명령어 끝까지
        // `||`가 있으면 그 전까지만
        const pipeIndex = value.indexOf(' ||');
        if (pipeIndex > 0) {
            value = value.substring(0, pipeIndex).trim();
        }
    }

    // {{pipe}} 치환 (이전 명령어의 결과 사용)
    value = substitutePipe(value, context);

    context.scope.setVariable(key, value);
    context.pipe = value;
    return value;
}

/**
 * `/getvar` 명령어 파싱 및 실행
 * 형식: `/getvar name` 또는 `{{getvar::name}}`
 * @param {string} command - 명령어 텍스트
 * @param {SlashCommandContext} context - 실행 컨텍스트
 * @returns {Promise<string>} 변수 값
 */
async function executeGetvar(command, context) {
    // `/getvar name` 파싱
    const match = command.match(/\/getvar\s+(\w+)/);
    if (!match) {
        // 경고 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('WARN_SLASH_20004', '/getvar 파싱 실패');
        }
        return '';
    }

    const key = match[1];
    const value = context.scope.getVariable(key);
    if (value === null) {
        // 경고 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('WARN_SLASH_20005', `변수가 존재하지 않음: ${key}`);
        }
        return '';
    }

    context.pipe = value;
    return value;
}

/**
 * `/flushvar` 명령어 파싱 및 실행
 * 형식: `/flushvar name`
 * @param {string} command - 명령어 텍스트
 * @param {SlashCommandContext} context - 실행 컨텍스트
 * @returns {Promise<string>} pipe 결과 (빈 문자열)
 */
async function executeFlushvar(command, context) {
    const match = command.match(/\/flushvar\s+(\w+)/);
    if (!match) {
        // 경고 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('WARN_SLASH_20006', '/flushvar 파싱 실패');
        }
        return '';
    }

    const key = match[1];
    context.scope.deleteVariable(key);
    context.pipe = '';
    return '';
}

/**
 * `/setinput` 명령어 파싱 및 실행
 * 형식: `/setinput ${변수명}` 또는 `/setinput {{getvar::변수명}}`
 * 지정된 변수의 값을 채팅 입력창에 설정
 * @param {string} command - 명령어 텍스트
 * @param {SlashCommandContext} context - 실행 컨텍스트
 * @returns {Promise<string>} pipe 결과 (설정된 값)
 */
async function executeSetinput(command, context) {
    // `/setinput ${변수명}` 또는 `/setinput {{getvar::변수명}}` 또는 `/setinput 변수명` 파싱
    const match = command.match(/\/setinput\s+(.+)/);
    if (!match) {
        // 경고 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('WARN_SLASH_20007', '/setinput 파싱 실패');
        }
        return '';
    }

    let variableName = match[1].trim();
    let isVariableReference = false;
    
    // {{getvar::name}} 형식인 경우 치환
    if (variableName.includes('{{getvar::')) {
        variableName = substituteGetvar(variableName, context);
        isVariableReference = true;
    }
    // ${변수명} 형식인 경우 ${ 제거
    else if (variableName.startsWith('${') && variableName.endsWith('}')) {
        variableName = variableName.slice(2, -1).trim();
        isVariableReference = true;
    }
    // 따옴표로 감싸진 경우 제거
    else if ((variableName.startsWith('"') && variableName.endsWith('"')) || 
             (variableName.startsWith("'") && variableName.endsWith("'"))) {
        variableName = variableName.slice(1, -1).trim();
        // ${ 변수가 따옴표 안에 있는 경우
        if (variableName.startsWith('${') && variableName.endsWith('}')) {
            variableName = variableName.slice(2, -1).trim();
            isVariableReference = true;
        }
        // 따옴표로 감싸진 문자열 자체가 값인 경우 (변수 참조 아님)
        else {
            isVariableReference = false;
        }
    }
    // 그 외의 경우: 공백 없는 단일 단어면 변수명으로, 공백 있거나 특수문자면 직접 값으로 처리
    else {
        // 변수명으로 사용 가능한지 확인 (영문자, 숫자, 언더스코어만)
        const isValidVariableName = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variableName);
        isVariableReference = isValidVariableName;
    }
    
    let value;
    
    if (isVariableReference) {
        // 변수명이 비어있으면 에러
        if (!variableName) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_SLASH_20008', '/setinput 변수명이 비어있음');
            }
            return '';
        }

        // 변수에서 값 가져오기
        value = context.scope.getVariable(variableName);
        if (value === null) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_SLASH_20009', `변수가 존재하지 않음 (setinput): ${variableName}`);
            }
            context.pipe = '';
            return '';
        }
    } else {
        // 직접 값으로 처리
        value = variableName;
        // {{pipe}} 치환 적용
        value = substitutePipe(value, context);
    }

    // chatManager를 통해 입력창에 값 설정
    if (!context.chatManager || !context.chatManager.elements || !context.chatManager.elements.messageInput) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_SLASH_14003', 'executeSetinput: chatManager 또는 messageInput 없음');
        }
        context.pipe = '';
        return '';
    }

    const messageInput = context.chatManager.elements.messageInput;
    const stringValue = String(value || '');
    
    // 입력창에 값 설정
    messageInput.value = stringValue;
    
    // input 이벤트 발생시켜서 높이 자동 조정 등 처리 (기존 adjustHeight 함수가 처리)
    messageInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    // DOM 업데이트 대기 후 포커스 및 커서 위치 설정
    // 일반 입력과 동일한 방식으로 처리 (scrollTop 조정 없이)
    await new Promise(resolve => requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            messageInput.focus();
            // 텍스트 끝으로 커서 이동
            messageInput.setSelectionRange(stringValue.length, stringValue.length);
            resolve();
        });
    }));

    context.pipe = stringValue;
    return stringValue;
}

/**
 * `/run` 명령어 파싱 및 실행
 * 형식: `/run qrName` 또는 `/run "qr name"`
 * QR 이름에 `대필`이 포함되면 우리의 대필 시스템 사용
 * @param {string} command - 명령어 텍스트
 * @param {SlashCommandContext} context - 실행 컨텍스트
 * @returns {Promise<string>} pipe 결과
 */
async function executeRun(command, context) {
    // `/run qrName` 또는 `/run "qr name"` 파싱
    const match = command.match(/\/run\s+(.+)/);
    if (!match) {
        // 경고 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('WARN_SLASH_20010', '/run 파싱 실패');
        }
        return '';
    }

    let qrName = match[1].trim();

    // 따옴표로 감싸진 경우 제거
    if ((qrName.startsWith('"') && qrName.endsWith('"')) || 
        (qrName.startsWith("'") && qrName.endsWith("'"))) {
        qrName = qrName.slice(1, -1);
    }

    // {{getvar::name}} 또는 {{pipe}} 치환
    qrName = substituteGetvar(qrName, context);
    qrName = substitutePipe(qrName, context);

    // QR 이름에 `대필`이 포함되는지 확인
    if (/대필/i.test(qrName)) {
        // 우리의 대필 시스템 사용
        // choiceText 변수가 있으면 기본값으로 사용
        const choiceText = context.scope.getVariable('choiceText');
        const defaultValue = choiceText !== null ? choiceText : '';

        // 대필 모달 열기 (일반 모드로 대필 실행)
        // 기존 대필 모달과 동일한 버튼 텍스트 유지 (옵션 없음)
        if (!context.chatManager || !context.chatManager.openAutofillModal) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_SLASH_14004', 'executeRun: chatManager 또는 openAutofillModal 없음');
            }
            throw new Error('chatManager가 초기화되지 않았거나 openAutofillModal 메서드가 없습니다.');
        }
        
        await context.chatManager.openAutofillModal(defaultValue, {
            inputOnly: false // 일반 모드로 대필 실행
        });

        // 대필 모달이 닫히면 executeAutofill이 이미 실행됨
        // pipe에는 빈 문자열 반환 (대필은 이미 실행되었으므로)
        context.pipe = '';
        return '';
    } else {
        // 일반 QR 시스템 사용 (나중에 구현)
        // TODO: 나중에 QR 시스템 구현 시 여기서 처리
        context.pipe = '';
        return '';
    }
}

/**
 * `/input` 명령어 파싱 및 실행
 * 형식: `/input okButton="..." cancelButton="..." default="..." "메시지"`
 * @param {string} command - 명령어 텍스트
 * @param {SlashCommandContext} context - 실행 컨텍스트
 * @returns {Promise<string>} 사용자 입력값 (pipe에 저장)
 */
async function executeInput(command, context) {
    // 옵션 파싱: okButton, cancelButton, default
    const options = {};
    let message = '';

    // okButton="..." 파싱
    const okButtonMatch = command.match(/okButton="([^"]+)"/);
    if (okButtonMatch) {
        options.okButton = okButtonMatch[1];
    }

    // cancelButton="..." 파싱
    const cancelButtonMatch = command.match(/cancelButton="([^"]+)"/);
    if (cancelButtonMatch) {
        options.cancelButton = cancelButtonMatch[1];
    }

    // default="..." 파싱 ({{getvar::name}} 포함 가능)
    const defaultMatch = command.match(/default="([^"]+)"/);
    if (defaultMatch) {
        let defaultValue = defaultMatch[1];
        // {{getvar::name}} 치환
        defaultValue = defaultValue.replace(/\{\{getvar::(\w+)\}\}/g, (match, key) => {
            const value = context.scope.getVariable(key);
            return value !== null ? value : '';
        });
        options.defaultValue = defaultValue;
    }

    // 마지막 따옴표로 감싼 메시지 파싱
    const messageMatch = command.match(/"([^"]+)"\s*$/);
    if (messageMatch) {
        message = messageMatch[1];
    }

    // 대필 모달 열기 (inputOnly 모드로 사용자 입력값만 받음)
    // 기존 대필 모달과 동일한 버튼 텍스트 유지
    if (!context.chatManager || !context.chatManager.openAutofillModal) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_SLASH_14005', 'executeInput: chatManager 또는 openAutofillModal 없음');
        }
        throw new Error('chatManager가 초기화되지 않았거나 openAutofillModal 메서드가 없습니다.');
    }
    
    const userInput = await context.chatManager.openAutofillModal(options.defaultValue || '', {
        inputOnly: true,
        message: message
        // okButton, cancelButton 옵션 제거 - 기본값("대필", "취소") 사용
    });

    // 사용자 입력값 처리
    // null 또는 false이면 취소된 것으로 처리 (실리태번과 동일)
    if (userInput === null || userInput === false) {
        context.pipe = '';
        return '';
    }

    // 사용자 입력값을 pipe에 저장하고 반환
    const inputValue = String(userInput || '');
    context.pipe = inputValue;
    return inputValue;
}

/**
 * `{{getvar::name}}` 매크로 치환
 * @param {string} text - 치환할 텍스트
 * @param {SlashCommandContext} context - 실행 컨텍스트
 * @returns {string} 치환된 텍스트
 */
function substituteGetvar(text, context) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    return text.replace(/\{\{getvar::(\w+)\}\}/g, (match, key) => {
        const value = context.scope.getVariable(key);
        return value !== null ? value : '';
    });
}

/**
 * 명령어 실행
 * @param {string} command - 명령어 텍스트
 * @param {SlashCommandContext} context - 실행 컨텍스트
 * @returns {Promise<string>} pipe 결과
 */
async function executeCommand(command, context) {
    if (!command || typeof command !== 'string' || !command.trim().startsWith('/')) {
        // 명령어가 아니면 그대로 반환
        return command;
    }

    const trimmedCommand = command.trim();

    // 명령어 타입 확인
    if (trimmedCommand.startsWith('/setvar')) {
        return await executeSetvar(trimmedCommand, context);
    } else if (trimmedCommand.startsWith('/getvar')) {
        return await executeGetvar(trimmedCommand, context);
    } else if (trimmedCommand.startsWith('/flushvar')) {
        return await executeFlushvar(trimmedCommand, context);
    } else if (trimmedCommand.startsWith('/setinput')) {
        return await executeSetinput(trimmedCommand, context);
    } else if (trimmedCommand.startsWith('/input')) {
        return await executeInput(trimmedCommand, context);
    } else if (trimmedCommand.startsWith('/run')) {
        return await executeRun(trimmedCommand, context);
    } else {
        // 알 수 없는 명령어는 무시
        // 경고 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('WARN_SLASH_20011', `알 수 없는 슬래시 명령어: ${trimmedCommand}`);
        }
        return '';
    }
}

/**
 * 명령어에서 매크로 치환 적용
 * @param {string} command - 명령어 텍스트
 * @param {SlashCommandContext} context - 실행 컨텍스트
 * @returns {string} 치환된 명령어
 */
function substituteMacrosInCommand(command, context) {
    if (!command || typeof command !== 'string') {
        return command;
    }
    
    // {{pipe}} 치환
    let result = substitutePipe(command, context);
    
    // {{getvar::name}} 치환
    result = substituteGetvar(result, context);
    
    return result;
}

/**
 * 슬래시 명령어 체인 실행
 * @param {string} commandText - 명령어 체인 텍스트 (파이프 `||`로 구분)
 * @param {SlashCommandContext} context - 실행 컨텍스트
 * @returns {Promise<string>} 최종 pipe 결과
 */
async function executeSlashCommandChain(commandText, context) {
    if (!commandText || typeof commandText !== 'string') {
        return '';
    }

    // 명령어 체인 파싱
    const commands = parseCommandChain(commandText);

    if (commands.length === 0) {
        return '';
    }

    // 각 명령어를 순차적으로 실행
    for (let i = 0; i < commands.length; i++) {
        if (context.aborted) {
            break;
        }

        const command = commands[i];

        // 명령어에서 매크로 치환 적용 ({{pipe}}, {{getvar::name}} 등)
        const substitutedCommand = substituteMacrosInCommand(command, context);

        // 명령어 실행
        await executeCommand(substitutedCommand, context);

        // pipe 값은 다음 명령어에서 `{{pipe}}`로 사용 가능
    }

    return context.pipe;
}

/**
 * 슬래시 명령어 실행 (간단 버전)
 * @param {string} commandText - 명령어 텍스트
 * @param {ChatManager} chatManager - ChatManager 인스턴스
 * @param {CharacterManager} characterManager - CharacterManager 인스턴스
 * @returns {Promise<string>} 실행 결과
 */
async function executeSlashCommands(commandText, chatManager, characterManager) {
    // iframe 내부에서 호출된 경우 처리
    // iframe 내부에서는 window.parent의 executeSlashCommands를 호출할 수 없으므로
    // 현재 컨텍스트에서 chatManager와 characterManager를 찾아야 함
    if (!chatManager || !characterManager) {
        // iframe 내부에서 호출된 경우: window.app를 통해 접근 시도
        if (typeof window !== 'undefined' && window.app) {
            chatManager = window.app.chatManager;
            characterManager = window.app.characterManager;
        }
        // window.app이 없는 경우: window 객체에서 직접 찾기
        else if (typeof window !== 'undefined' && window.chatManager && window.characterManager) {
            chatManager = window.chatManager;
            characterManager = window.characterManager;
        }
        
        // 여전히 없는 경우 에러
        if (!chatManager || !characterManager) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_SLASH_14006', 'chatManager 또는 characterManager를 찾을 수 없음');
            }
            throw new Error('executeSlashCommands: chatManager와 characterManager가 필요합니다. iframe 내부에서는 window.app이 필요합니다.');
        }
    }
    
    // 응답 생성 중이면 슬래시 명령어 실행 차단
    if (chatManager.isGenerating) {
        return '';
    }
    
    const context = new SlashCommandContext(chatManager, characterManager);
    return await executeSlashCommandChain(commandText, context);
}

/**
 * 전역 변수 가져오기
 * @param {string} key - 변수 이름
 * @returns {string|null} 변수 값
 */
function getGlobalVariable(key) {
    return globalScope.getVariable(key);
}

/**
 * 전역 변수 설정
 * @param {string} key - 변수 이름
 * @param {string} value - 변수 값
 */
function setGlobalVariable(key, value) {
    globalScope.setVariable(key, value);
}

